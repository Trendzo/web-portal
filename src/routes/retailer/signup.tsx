import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { normaliseIndianMobile, INDIAN_MOBILE_ERROR, INDIAN_MOBILE_HINT } from '@/lib/phone';
import type { RetailerProfile } from '@/lib/types';
import { AuthShell } from '@/components/forms/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FieldError, Label } from '@/components/ui/label';

const Schema = z.object({
  legalName: z.string().trim().min(2, 'At least 2 characters').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  // Accept the phone in many shapes (with/without +91, spaces, hyphens) and normalise
  // to `+91XXXXXXXXXX` for the backend. Only the *normalised* value reaches submission.
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const ok = normaliseIndianMobile(v);
      if (!ok) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: INDIAN_MOBILE_ERROR });
        return z.NEVER;
      }
      return ok;
    }),
  // Relaxed for MVP — any 15-char string. Tighten when real KYC is wired.
  gstin: z.string().trim().toUpperCase().length(15, 'GSTIN must be exactly 15 characters'),
  password: z.string().min(4, 'Use at least 4 characters').max(72),
  confirmPassword: z.string(),
})
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
type FormValues = z.infer<typeof Schema>;

type SignupResponse = { token: string; retailer: RetailerProfile };

export default function RetailerSignup() {
  const navigate = useNavigate();
  const signIn = useAuth((s) => s.signIn);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(Schema),
    defaultValues: { legalName: '', email: '', phone: '', gstin: '', password: '', confirmPassword: '' },
  });

  async function onSubmit(values: FormValues) {
    // The backend doesn't expect confirmPassword — strip it before sending.
    const { confirmPassword: _confirm, ...payload } = values;
    try {
      const { token, retailer } = await api<SignupResponse>('/auth/retailer/signup', {
        method: 'POST',
        body: payload,
      });
      signIn({ kind: 'retailer', token, retailer });
      toast.success('Account created.', {
        description: 'KYC auto-verified. Awaiting admin approval.',
      });
      navigate('/retailer/dashboard', { replace: true });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      const msg =
        code === 'email_already_taken'
          ? 'An account with this email already exists.'
          : code === 'validation_error'
            ? 'Some fields look off — please check.'
            : e instanceof Error
              ? e.message
              : 'Signup failed.';
      toast.error(msg);
    }
  }

  return (
    <AuthShell
      kicker="Retailer signup"
      title={<>Create a <em>retailer</em> account</>}
      blurb={
        <>
          Sign up with your name, contact, and a valid GSTIN. KYC is auto-verified at signup —
          your account will be pending until admin approves it. Then you can create your store
          and add products.
        </>
      }
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/retailer/login"
            className="font-medium text-ink underline underline-offset-4 hover:no-underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div>
          <Label htmlFor="legalName" required>Legal name</Label>
          <Input id="legalName" autoComplete="name" placeholder="e.g. Acme Apparel" {...register('legalName')} />
          <FieldError>{errors.legalName?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="email" required>Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="e.g. you@store.com" {...register('email')} />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="phone" required hint={INDIAN_MOBILE_HINT}>Phone</Label>
          <Input id="phone" inputMode="tel" autoComplete="tel" placeholder="e.g. 9876543210" {...register('phone')} />
          <FieldError>{errors.phone?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="gstin" required hint="15 characters">GSTIN</Label>
          <Input
            id="gstin"
            mono
            maxLength={15}
            // Auto-upcase on every keystroke. RHF reads `e.target.value` after this
            // handler runs, so the form state stays in sync with what the user sees.
            placeholder="15-character GSTIN"
            {...register('gstin', {
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                e.target.value = e.target.value.toUpperCase();
              },
            })}
          />
          <FieldError>{errors.gstin?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="password" required hint="Min 4 characters">Password</Label>
          <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
          <FieldError>{errors.password?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="confirmPassword" required>Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
          <FieldError>{errors.confirmPassword?.message}</FieldError>
        </div>
        <Button type="submit" variant="ink" size="lg" caps className="w-full" loading={isSubmitting}>
          Sign up
        </Button>
        <p className="border-t border-rule pt-4 text-[11.5px] uppercase tracking-[0.16em] text-ink-3">
          GSTIN format check only · No documents required
        </p>
      </form>
    </AuthShell>
  );
}
