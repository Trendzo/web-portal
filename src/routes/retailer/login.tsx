import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { RetailerProfile } from '@/lib/types';
import { AuthShell } from '@/components/forms/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FieldError, Label } from '@/components/ui/label';

const Schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(4),
});
type FormValues = z.infer<typeof Schema>;

type LoginResponse = { token: string; retailer: RetailerProfile };

export default function RetailerLogin() {
  const navigate = useNavigate();
  const signIn = useAuth((s) => s.signIn);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(Schema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: FormValues) {
    try {
      const { token, retailer } = await api<LoginResponse>('/auth/retailer/login', {
        method: 'POST',
        body: values,
      });
      signIn({ kind: 'retailer', token, retailer });
      navigate('/retailer/dashboard', { replace: true });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'invalid_credentials'
          ? "Those credentials don't match. Try again."
          : code === 'forbidden'
            ? 'This account has been deactivated. Contact admin for help.'
            : e instanceof Error
              ? e.message
              : 'Login failed.',
      );
    }
  }

  return (
    <AuthShell
      kicker="Retailer"
      title={<>Sign in to your <em>store</em></>}
      blurb={<>Manage your store, products, and inventory.</>}
      footer={
        <>
          Don't have an account?{' '}
          <Link
            to="/retailer/signup"
            className="font-medium text-ink underline underline-offset-4 hover:no-underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <div>
          <Label htmlFor="email" required>Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="password" required>Password</Label>
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
