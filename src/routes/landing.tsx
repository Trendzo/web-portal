import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Store } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Mark } from '@/components/ui/mark';

/**
 * Landing — clean role chooser. Two clear paths: admin sign in, retailer sign up/in.
 */
export default function Landing() {
  const session = useAuth((s) => s.session);
  if (session?.kind === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (session?.kind === 'retailer') return <Navigate to="/retailer/dashboard" replace />;

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="border-b border-line bg-bg">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-4 sm:px-8">
          <Mark size="md" />
          <div className="hidden text-right text-[12px] text-ink-3 md:block">
            ClosetX dashboard · India
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1100px] px-5 sm:px-8 py-12 sm:py-20">
        <div className="text-center mb-10 sm:mb-14">
          <h1 className="text-[28px] sm:text-[36px] font-semibold tracking-tight text-ink mb-3">
            Pick how you want to sign in
          </h1>
          <p className="text-[14px] sm:text-[15px] text-ink-3 max-w-xl mx-auto leading-relaxed">
            ClosetX runs marketplace operations and a self-serve store manager from
            one place. Each role has its own area; you can switch between accounts later.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 max-w-3xl mx-auto">
          <RoleCard
            icon={<ShieldCheck className="size-5" />}
            kicker="01 · Operations"
            title="Admin"
            description="Approve retailers and storefronts, run promotions, manage the marketplace."
            href="/admin/login"
          />
          <RoleCard
            icon={<Store className="size-5" />}
            kicker="02 · Store owner"
            title="Retailer"
            description="List products, manage inventory, track your store's status. Sign in or create an account."
            href="/retailer/login"
            secondary={{ label: 'Don\'t have an account? Sign up', href: '/retailer/signup' }}
          />
        </div>
      </main>

      <footer className="border-t border-line bg-bg-2/50">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 sm:px-8 py-4 text-[11.5px] text-ink-3">
          <span>Closet<span className="text-accent">X</span> · 2026</span>
          <span>Quick-commerce marketplace · India</span>
        </div>
      </footer>
    </div>
  );
}

function RoleCard({
  icon,
  kicker,
  title,
  description,
  href,
  secondary,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  description: string;
  href: string;
  secondary?: { label: string; href: string };
}) {
  return (
    <div className="rounded-xl border border-line bg-bg shadow-xs hover:shadow-md hover:border-line-2 transition-all duration-200 group">
      <Link
        to={href}
        className="block p-6 sm:p-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
      >
        <div className="flex items-start justify-between mb-5">
          <span className="grid size-10 place-items-center rounded-lg bg-bg-3 text-ink-2 group-hover:bg-accent group-hover:text-accent-fg transition-colors">
            {icon}
          </span>
          <ArrowRight className="size-4 text-ink-4 group-hover:text-ink group-hover:translate-x-1 transition-all" />
        </div>
        <div className="kicker mb-1.5">{kicker}</div>
        <h2 className="text-[20px] font-semibold text-ink mb-2">{title}</h2>
        <p className="text-[13.5px] text-ink-3 leading-relaxed">{description}</p>
      </Link>
      {secondary && (
        <div className="border-t border-line px-6 sm:px-7 py-3">
          <Link
            to={secondary.href}
            className="text-[12.5px] font-medium text-accent hover:underline underline-offset-2"
          >
            {secondary.label} →
          </Link>
        </div>
      )}
    </div>
  );
}
