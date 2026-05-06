import { Link, Navigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Mark } from '@/components/ui/mark';

/**
 * Landing — pick a role and sign in. Bold typography, plain words.
 */
export default function Landing() {
  const session = useAuth((s) => s.session);
  if (session?.kind === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (session?.kind === 'retailer') return <Navigate to="/retailer/dashboard" replace />;

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <header className="border-b border-rule px-5 sm:px-10 py-6">
        <div className="mx-auto flex max-w-[1360px] items-center justify-between">
          <Mark size="md" />
          <div className="hidden text-right text-[10.5px] uppercase tracking-[0.2em] text-ink-3 md:block">
            <div>Admin and retailer dashboards</div>
            <div className="text-ink">for ClosetX</div>
          </div>
        </div>
      </header>

      <main
        className="flex-1 mx-auto w-full max-w-[1360px] px-5 sm:px-10 py-14 sm:py-24"
        data-stagger
      >
        <div className="grid gap-16 lg:grid-cols-12 lg:gap-20">
          <section className="lg:col-span-7">
            <div className="kicker mb-6 text-ink-3">ClosetX Dashboards</div>
            <h1 className="editorial text-[64px] sm:text-[96px] lg:text-[120px] text-ink">
              Sign in <em className="not-italic">to your</em>
              <br />
              <span className="italic">workspace.</span>
            </h1>
            <p className="mt-10 max-w-xl text-[16px] leading-relaxed text-ink-2">
              ClosetX is a quick-commerce marketplace for clothing in India. This is the
              back office — admins approve retailers and storefronts; retailers list their
              products and manage inventory. Pick your role on the right.
            </p>
          </section>

          <aside className="lg:col-span-5 space-y-6">
            <RoleCard
              ord="01"
              title="Admin Ops"
              kicker="Marketplace operator"
              description="Approve retailers and storefronts, manage the marketplace."
              href="/admin/login"
            />
            <RoleCard
              ord="02"
              title="Retailer Ops"
              kicker="Store owner"
              description="List products, manage stock, track your store status."
              href="/retailer/login"
              cta={
                <Link
                  to="/retailer/signup"
                  className="mt-3 inline-block font-semibold underline decoration-ink decoration-1 underline-offset-[5px] text-[12px] uppercase tracking-[0.16em] text-ink hover:decoration-2"
                >
                  · Or create an account →
                </Link>
              }
            />
          </aside>
        </div>
      </main>

      <footer className="border-t border-rule px-5 sm:px-10 py-6">
        <div className="mx-auto flex max-w-[1360px] items-center justify-between text-[10.5px] uppercase tracking-[0.2em] text-ink-3">
          <span>Closet/X · 2026</span>
          <span className="font-mono text-[10px] normal-case tracking-normal text-ink-4">
            quick-commerce, India
          </span>
        </div>
      </footer>
    </div>
  );
}

function RoleCard({
  ord,
  title,
  kicker,
  description,
  href,
  cta,
}: {
  ord: string;
  title: string;
  kicker: string;
  description: string;
  href: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {/* Offset ink plate sits behind the card. As the card lifts up-left on hover,
          the plate is revealed — like the card peeling off the page. */}
      <div aria-hidden className="absolute inset-0 translate-x-1.5 translate-y-1.5 bg-ink/85" />
      <Link
        to={href}
        className="group relative block border border-ink bg-surface p-6 sm:p-8 transition-transform duration-200 ease-out hover:-translate-x-[5px] hover:-translate-y-[5px] hover:bg-paper"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="kicker mb-1 text-ink-3">{kicker}</div>
            <div className="font-mono text-[12px] tracking-wider text-ink-3">No. {ord}</div>
          </div>
          <ArrowUpRight className="size-5 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
        <h2 className="mt-6 font-display italic text-[44px] sm:text-[56px] leading-[0.95] text-ink">
          {title}
        </h2>
        <p className="mt-4 text-[14px] text-ink-2 leading-relaxed">{description}</p>
        {cta}
      </Link>
    </div>
  );
}
