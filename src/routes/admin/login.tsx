import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AdminProfile } from '@/lib/types';
import { AuthShell } from '@/components/forms/AuthShell';
import { HardwareKeyChallenge } from '@/components/forms/HardwareKeyChallenge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FieldError, Label } from '@/components/ui/label';

const Schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(4, 'Password is too short'),
});
type FormValues = z.infer<typeof Schema>;

export default function AdminLogin() {
  const navigate = useNavigate();
  const signIn = useAuth((s) => s.signIn);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(Schema),
    // Prefilled with seeded creds for one-click dev sign-in.
    defaultValues: { email: 'admin@closetx.local', password: 'admin1234' },
  });

  async function onSubmit(values: FormValues) {
    try {
      const { token, admin } = await api<{ token: string; admin: AdminProfile }>(
        '/auth/admin/login',
        { method: 'POST', body: values },
      );
      signIn({ kind: 'admin', token, admin });
      toast.success(`Signed in as ${admin.email}`);
      navigate('/admin/dashboard', { replace: true });
    } catch (e) {
      toast.error(
        e instanceof ApiError && e.code === 'invalid_credentials'
          ? 'Incorrect email or password.'
          : e instanceof Error ? e.message : 'Something went wrong.',
      );
    }
  }

  return (
    <AuthShell
      kicker="Admin"
      title="Sign in to admin"
      blurb="Approve retailers and storefronts, manage promotions and the marketplace."
      highlights={[
        'Review the queue of pending retailer applications.',
        'Approve or reject storefronts before they go live.',
        'Issue platform-wide promotions, vouchers, and tune loyalty rules.',
        'Look up consumer wallets and adjust balances when needed.',
      ]}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email" required>Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...register('email')} />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="password" required hint="At least 4 characters">Password</Label>
          <PasswordInput id="password" autoComplete="current-password" {...register('password')} />
          <FieldError>{errors.password?.message}</FieldError>
        </div>
        <Button type="submit" variant="accent" size="lg" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
        <HardwareKeyChallenge />
      </form>
    </AuthShell>
  );
}
