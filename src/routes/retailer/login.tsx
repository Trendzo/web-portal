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
          ? 'Incorrect email or password.'
          : code === 'forbidden'
            ? 'This account has been deactivated. Contact admin for help.'
            : e instanceof Error ? e.message : 'Login failed.',
      );
    }
  }

  return (
    <AuthShell
      kicker="Retailer"
      title="Sign in to your store"
      blurb="Manage your storefront, product listings, stock levels and promotions."
      highlights={[
        'Track your store approval status at a glance.',
        'Add products in minutes — name, photos, variants, price, stock.',
        'Update inventory directly when stock counts change.',
        'Run promotions for your own catalogue (offers available now).',
      ]}
      footer={
        <>
          Don't have an account?{' '}
          <Link to="/retailer/signup" className="font-medium text-accent hover:underline underline-offset-2">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email" required>Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@store.com" {...register('email')} />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="password" required>Password</Label>
          <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
          <FieldError>{errors.password?.message}</FieldError>
        </div>
        <Button type="submit" variant="accent" size="lg" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
