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

// GSTIN validation kept intentionally permissive: 15 chars, normalised uppercase.
// We don't enforce the strict 27AAAPL1234C1Z5-style regex here — the back end
// re-checks structure on submit, and over-strict client validation kept rejecting
// otherwise-valid GSTINs the user typed.
const Schema = z
  .object({
    legalName: z.string().trim().min(2, 'At least 2 characters').max(120),
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
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
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .length(15, 'GSTIN must be 15 characters'),
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
    defaultValues: {
      legalName: '',
      email: '',
      phone: '',
      gstin: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Live-uppercase the GSTIN field so the user sees what gets submitted.
  const gstinReg = register('gstin');

  async function onSubmit(values: FormValues) {
    try {
      // The API doesn't expect confirmPassword — strip it before sending.
      const { confirmPassword: _, ...payload } = values;
      const { token, retailer } = await api<SignupResponse>('/auth/retailer/signup', {
        method: 'POST',
        body: payload,
      });
      signIn({ kind: 'retailer', token, retailer });
      toast.success('Account created.', { description: 'KYC verified. Awaiting admin approval.' });
      navigate('/retailer/dashboard', { replace: true });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'email_already_taken'
          ? 'An account with this email already exists.'
          : code === 'validation_error'
            ? 'Some fields look off — please check.'
            : e instanceof Error ? e.message : 'Signup failed.',
      );
    }
  }

  return (
    <AuthShell
      kicker="New retailer"
      title="Create a retailer account"
      blurb="Sign up with your store info — KYC is auto-verified at signup. After admin approval you can list products."
      highlights={[
        'Free to sign up and list products.',
        'List in minutes — name, photos, sizes, stock.',
        'Get paid weekly directly to your bank account.',
        'Run your own offers; coupons & vouchers via admin enablement.',
      ]}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/retailer/login" className="font-medium text-accent hover:underline underline-offset-2">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="legalName" required>Legal name</Label>
          <Input id="legalName" autoComplete="name" placeholder="e.g. Acme Apparel" {...register('legalName')} />
          <FieldError>{errors.legalName?.message}</FieldError>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
        <div>
          <Label htmlFor="gstin" required hint="15 chars, uppercase">GSTIN</Label>
          <Input
            id="gstin"
            mono
            maxLength={15}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="e.g. 27AAAPL1234C1Z5"
            className="uppercase tracking-wider"
            {...gstinReg}
            onChange={(e) => {
              e.target.value = e.target.value.toUpperCase();
              gstinReg.onChange(e);
            }}
          />
          <FieldError>{errors.gstin?.message}</FieldError>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="password" required hint="Min 4 characters">Password</Label>
            <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
            <FieldError>{errors.password?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="confirmPassword" required>Confirm password</Label>
            <PasswordInput id="confirmPassword" autoComplete="new-password" {...register('confirmPassword')} />
            <FieldError>{errors.confirmPassword?.message}</FieldError>
          </div>
        </div>
        <Button type="submit" variant="solid" size="lg" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
        <p className="text-[11px] text-ink-3 leading-relaxed">
          GSTIN length check at signup · Format re-verified server-side · No documents required
        </p>
      </form>
    </AuthShell>
  );
}
