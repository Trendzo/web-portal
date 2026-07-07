import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { RetailerProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OtpInput } from '@/components/ui/otp-input';
import { FieldError, Label } from '@/components/ui/label';

const OTP_LENGTH = 4;
import {
  COUNTRY_CODES,
  buildIdentifier,
  extractAccessToken,
  retryOtp,
  sendOtp,
  useMsg91Widget,
  verifyOtp,
} from '@/lib/msg91';

type OtpLoginResponse = { token: string; retailer: RetailerProfile };

const RESEND_SECONDS = 30;

function messageOf(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/**
 * Retailer phone-OTP login (primary). Drives the MSG91 web widget (send → verify), then posts
 * the verified access token to `POST /auth/retailer/otp/msg91`. On success it hands the
 * `{ token, retailer }` back to the parent, which commits the session exactly like email login.
 */
export function PhoneOtpLogin({
  onAuthenticated,
}: {
  onAuthenticated: (token: string, retailer: RetailerProfile) => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const { ready, error: widgetError } = useMsg91Widget();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [dial, setDial] = useState('91');
  const [number, setNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const nationalDigits = number.replace(/\D/g, '');

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    setFieldError(null);
    if (nationalDigits.length < 6) {
      setFieldError('Enter a valid phone number');
      return;
    }
    if (!ready) {
      toast.error('OTP service is still loading — try again in a moment.');
      return;
    }
    setSending(true);
    try {
      await sendOtp(buildIdentifier(dial, nationalDigits));
      setStep('otp');
      setOtp('');
      setResendIn(RESEND_SECONDS);
      toast.success('OTP sent to your phone.');
    } catch (err) {
      toast.error(messageOf(err, 'Could not send OTP. Check the number and try again.'));
    } finally {
      setSending(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0) return;
    try {
      await retryOtp(null);
      setResendIn(RESEND_SECONDS);
      toast.success('OTP resent.');
    } catch (err) {
      toast.error(messageOf(err, 'Could not resend OTP.'));
    }
  }

  async function handleVerify(codeOverride?: string) {
    setFieldError(null);
    const code = (codeOverride ?? otp).replace(/\D/g, '');
    if (code.length !== OTP_LENGTH) {
      setFieldError('Enter the OTP you received');
      return;
    }
    if (verifying) return;
    setVerifying(true);
    try {
      const data = await verifyOtp(code);
      const accessToken = extractAccessToken(data);
      if (!accessToken) throw new Error('OTP verification failed');
      const { token, retailer } = await api<OtpLoginResponse>('/auth/retailer/otp/msg91', {
        method: 'POST',
        body: { accessToken },
      });
      await onAuthenticated(token, retailer);
    } catch (err) {
      handleBackendError(err);
    } finally {
      setVerifying(false);
    }
  }

  function handleBackendError(err: unknown) {
    if (err instanceof ApiError) {
      const appId = (err.details as { applicationId?: string } | undefined)?.applicationId;
      if (err.code === 'application_pending') {
        navigate(`/retailer/application-status?id=${appId ?? ''}&status=pending`);
        return;
      }
      if (err.code === 'application_rejected') {
        navigate(`/retailer/application-status?id=${appId ?? ''}&status=rejected`);
        return;
      }
      if (err.code === 'invalid_credentials') {
        toast.error(
          'No retailer account is linked to this phone number. Sign up, or sign in with email.',
        );
        return;
      }
      if (err.status === 503) {
        toast.error('Phone login is temporarily unavailable. Use email & password.');
        return;
      }
    }
    toast.error(messageOf(err, 'OTP verification failed. Try again.'));
  }

  if (step === 'otp') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleVerify();
        }}
        className="space-y-4"
        noValidate
      >
        <button
          type="button"
          onClick={() => setStep('phone')}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink"
        >
          <ArrowLeft className="size-3.5" />
          Change number
        </button>
        <div>
          <Label required hint={`Sent to +${dial} ${nationalDigits}`}>
            Enter the {OTP_LENGTH}-digit OTP
          </Label>
          <OtpInput
            value={otp}
            onChange={setOtp}
            length={OTP_LENGTH}
            autoFocus
            disabled={verifying}
            onComplete={(code) => void handleVerify(code)}
          />
          <FieldError>{fieldError}</FieldError>
        </div>
        <Button type="submit" variant="accent" size="lg" className="w-full" loading={verifying}>
          Verify & sign in
        </Button>
        <div className="text-center text-[12.5px] text-ink-3">
          {resendIn > 0 ? (
            <span>Resend OTP in {resendIn}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="font-medium text-accent hover:underline underline-offset-2"
            >
              Resend OTP
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSend} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="phone" required>
          Phone number
        </Label>
        <div className="flex gap-2">
          <select
            aria-label="Country code"
            value={dial}
            onChange={(e) => setDial(e.target.value)}
            className="h-9 shrink-0 rounded-md border border-line-2 bg-bg px-2 text-[13px] text-ink focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/20"
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.iso} value={c.dial}>
                {c.iso} +{c.dial}
              </option>
            ))}
          </select>
          <Input
            id="phone"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="Phone number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="flex-1"
            autoFocus
          />
        </div>
        <FieldError>{fieldError}</FieldError>
      </div>
      {widgetError && (
        <p className="text-[12px] text-danger leading-snug">
          {widgetError}. You can sign in with email &amp; password instead.
        </p>
      )}
      <Button
        type="submit"
        variant="accent"
        size="lg"
        className="w-full"
        loading={sending}
        disabled={!ready}
      >
        {ready ? 'Send OTP' : 'Preparing secure OTP…'}
      </Button>
    </form>
  );
}
