import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AdminProfile } from '@/lib/types';
import { AuthShell } from '@/components/forms/AuthShell';
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
    // Prefilled with the seeded super-admin credentials for one-click dev sign-in.
    // Match `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` in backend/.env.
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
      const msg =
        e instanceof ApiError && e.code === 'invalid_credentials'
          ? 'Those credentials don\'t match. Try again.'
          : e instanceof Error
            ? e.message
            : 'Something went wrong.';
      toast.error(msg);
    }
  }

  return (
    <AuthShell
      kicker="Admin"
      title={<>Sign in to <em>admin</em></>}
      blurb={<>Approve retailers and storefronts, manage the marketplace.</>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <div>
          <Label htmlFor="email" required>Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="e.g. you@company.com"
            {...register('email')}
          />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="password" required hint="At least 4 characters">Password</Label>
          <PasswordInput id="password" autoComplete="current-password" {...register('password')} />
          <FieldError>{errors.password?.message}</FieldError>
        </div>
        <Button type="submit" variant="ink" size="lg" caps className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
