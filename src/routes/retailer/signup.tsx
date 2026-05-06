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
import { FieldError, Label } from '@/components/ui/label';

const Schema = z.object({
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
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      '15 chars in GSTIN format (e.g. 27AAAPL1234C1Z5)',
    ),
  password: z.string().min(4, 'Use at least 4 characters').max(72),
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
    defaultValues: { legalName: '', email: '', phone: '', gstin: '', password: '' },
  });

  async function onSubmit(values: FormValues) {
    try {
      const { token, retailer } = await api<SignupResponse>('/auth/retailer/signup', {
        method: 'POST',
        body: values,
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
          <Input id="gstin" mono placeholder="e.g. 27AAAPL1234C1Z5" {...register('gstin')} />
          <FieldError>{errors.gstin?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="password" required hint="Min 4 characters">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
          <FieldError>{errors.password?.message}</FieldError>
        </div>
        <Button type="submit" variant="accent" size="lg" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
        <p className="text-[11px] text-ink-3 leading-relaxed">
          GSTIN format check only · No documents required at signup
        </p>
      </form>
    </AuthShell>
  );
}
