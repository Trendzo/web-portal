import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Clock, Package, Plus, ShoppingBag, Store as StoreIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { retailerStatusMeta, storeStatusMeta } from '@/lib/status';
import type { Listing, RetailerProfile, Store } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

type MeResponse = { retailer: RetailerProfile; store: Store | null };

/**
 * Retailer dashboard — built for the small-store owner persona, often on phone.
 * Goals:
 *   1. Status above all — am I approved? Is my store live?
 *   2. Clear next step — what should I do right now?
 *   3. Quick stats once I'm live (products, stock).
 */
export default function RetailerDashboard() {
  const session = useAuth((s) => s.session);
  const patchRetailer = useAuth((s) => s.patchRetailer);
  const fallback = session?.kind === 'retailer' ? session.retailer : null;

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<MeResponse>('/retailer/me'),
  });

  // Sync the auth store with freshest profile.
  if (data?.retailer && fallback && data.retailer.status !== fallback.status) {
    patchRetailer({ status: data.retailer.status, storeId: data.retailer.storeId });
  }

  const retailer = data?.retailer ?? fallback;
  const store = data?.store ?? null;

  const listings = useQuery({
    queryKey: ['retailer', 'listings', 'all'],
    queryFn: () => api<Listing[]>('/retailer/listings'),
    enabled: !!store && store.status === 'active',
  });

  if (!retailer) {
    return <Page><Skeleton className="h-12 w-2/3" /></Page>;
  }

  const firstName = retailer.legalName.split(' ')[0] ?? retailer.legalName;
  const liveAndKicking = retailer.status === 'active' && store?.status === 'active';

  return (
    <Page>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={liveAndKicking
          ? 'Your store is live. Add products, manage stock, and keep customers happy.'
          : 'Here\'s your store status and what to do next.'}
        actions={
          liveAndKicking ? (
            <Button asChild variant="accent" iconLeft={<Plus className="size-4" />}>
              <Link to="/retailer/listings">Add product</Link>
            </Button>
          ) : undefined
        }
      />

      {/* Status hero */}
      <StatusHero retailer={retailer} store={store} loading={isLoading} />

      {/* Onboarding steps if not live */}
      {!liveAndKicking && (
        <Steps retailer={retailer} store={store} />
      )}

      {/* Live store stats */}
      {liveAndKicking && (
        <div className="mt-8">
          <div className="grid gap-3 sm:grid-cols-3 mb-6">
            <StatCard
              label="Products"
              value={listings.data?.length}
              loading={listings.isLoading}
              icon={<Package className="size-4" />}
            />
            <StatCard
              label="Total stock"
              value={listings.data?.reduce(
                (n, l) => n + (l.variants?.reduce((m, v) => m + v.stock, 0) ?? 0),
                0,
              )}
              loading={listings.isLoading}
              icon={<ShoppingBag className="size-4" />}
            />
            <StatCard
              label="Active products"
              value={listings.data?.filter((l) => l.status === 'active').length}
              loading={listings.isLoading}
              icon={<Check className="size-4" />}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <QuickLink
              to="/retailer/listings"
              title="Manage products"
              description="Add, edit, change stock and prices."
              icon={<Package className="size-4" />}
            />
            <QuickLink
              to="/retailer/promotions"
              title="Run a promotion"
              description="Offer a discount on your catalogue."
              icon={<Plus className="size-4" />}
            />
          </div>
        </div>
      )}
    </Page>
  );
}

function StatusHero({
  retailer,
  store,
  loading,
}: {
  retailer: RetailerProfile;
  store: Store | null;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-32" />;

  const rMeta = retailerStatusMeta(retailer.status);
  const sMeta = store ? storeStatusMeta(store.status) : null;

  // Decide overall headline + tone
  let title: string;
  let subtitle: string;
  let nextStep: { label: string; to: string } | null = null;

  if (retailer.status === 'pending_approval') {
    title = 'Your account is being reviewed.';
    subtitle = 'Admin usually responds within a working day. You can still set up your storefront in the meantime.';
    nextStep = { label: store ? 'View storefront' : 'Set up storefront', to: '/retailer/store' };
  } else if (retailer.status === 'deactivated') {
    title = 'Your account has been deactivated.';
    subtitle = 'Contact admin to learn why and request reactivation.';
  } else if (!store) {
    title = 'You\'re approved — set up your storefront.';
    subtitle = 'Tell us where customers can find you. We\'ll then review your storefront.';
    nextStep = { label: 'Submit storefront', to: '/retailer/store' };
  } else if (store.status === 'onboarding') {
    title = 'Your storefront is being reviewed.';
    subtitle = 'Once approved, you\'ll be able to publish products and accept orders.';
    nextStep = { label: 'Review storefront', to: '/retailer/store' };
  } else if (store.status !== 'active') {
    title = `Your storefront is ${store.status}.`;
    subtitle = 'Reach out to admin if you think this is wrong.';
  } else {
    title = 'Everything\'s live.';
    subtitle = 'You\'re ready to sell. Add products, manage stock, run promotions.';
  }

  return (
    <div className="rounded-xl border border-line bg-bg p-5 sm:p-6 accent-strip relative">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge tone={rMeta.tone} pulse={retailer.status === 'pending_approval'}>
              Account: {rMeta.label}
            </Badge>
            {sMeta && (
              <Badge tone={sMeta.tone} pulse={store?.status === 'onboarding'}>
                Storefront: {sMeta.label}
              </Badge>
            )}
          </div>
          <h2 className="text-[18px] sm:text-[20px] font-semibold text-ink leading-snug mb-1.5">
            {title}
          </h2>
          <p className="text-[13.5px] text-ink-3 leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        </div>

        {nextStep && (
          <div className="shrink-0">
            <Button asChild variant="accent" iconRight={<ArrowRight className="size-4" />}>
              <Link to={nextStep.to}>{nextStep.label}</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Steps({ retailer, store }: { retailer: RetailerProfile; store: Store | null }) {
  const steps = [
    {
      title: 'Account created',
      done: true,
      desc: 'KYC verified at signup.',
    },
    {
      title: 'Account approved',
      done: retailer.status === 'active',
      pending: retailer.status === 'pending_approval',
      desc: retailer.status === 'pending_approval' ? 'Waiting on admin.' : retailer.status === 'active' ? 'Approved.' : 'Account deactivated.',
    },
    {
      title: 'Storefront submitted',
      done: !!store,
      desc: store ? store.legalName : 'Add your store details to begin.',
      cta: !store ? { label: 'Submit storefront', to: '/retailer/store' } : null,
    },
    {
      title: 'Storefront approved',
      done: store?.status === 'active',
      pending: store?.status === 'onboarding',
      desc: store?.status === 'onboarding' ? 'Waiting on admin.' : store?.status === 'active' ? 'Live.' : 'Pending.',
    },
    {
      title: 'Add your first product',
      done: false,
      desc: store?.status === 'active' ? 'You\'re ready — start adding products.' : 'Available once your store is approved.',
      cta: store?.status === 'active' ? { label: 'Add product', to: '/retailer/listings' } : null,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="kicker mb-1">Onboarding</div>
          <h2 className="text-[15px] font-semibold text-ink">Getting your store live</h2>
        </div>
        <div className="text-[12px] text-ink-3">
          {completedCount} of {steps.length} done
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-bg-3 overflow-hidden mb-5">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li
            key={i}
            className={cn(
              'flex items-start gap-3 rounded-lg border bg-bg p-3 sm:p-4',
              s.done ? 'border-line' : s.pending ? 'border-warning/30 bg-warning-soft/30' : 'border-line',
            )}
          >
            <div
              className={cn(
                'shrink-0 grid size-7 place-items-center rounded-full text-[12px] font-semibold',
                s.done ? 'bg-success text-white' :
                s.pending ? 'bg-warning text-white' :
                'bg-bg-3 text-ink-3 border border-line',
              )}
            >
              {s.done ? <Check className="size-3.5" /> : s.pending ? <Clock className="size-3.5" /> : i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium text-ink leading-snug">{s.title}</div>
              <div className="text-[12.5px] text-ink-3 mt-0.5">{s.desc}</div>
            </div>
            {s.cta && (
              <Button asChild variant="outline" size="sm" iconRight={<ArrowRight className="size-3.5" />}>
                <Link to={s.cta.to}>{s.cta.label}</Link>
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function StatCard({
  label,
  value,
  loading,
  icon,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-bg p-4">
      <div className="kicker mb-2 flex items-center gap-1.5">
        <span className="text-ink-3">{icon}</span>
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <div className="font-mono text-[24px] font-semibold tabular-nums text-ink leading-none">
          {String(value ?? 0)}
        </div>
      )}
    </div>
  );
}

function QuickLink({
  to,
  title,
  description,
  icon,
}: {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group block rounded-lg border border-line bg-bg p-4 hover:border-line-2 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h3 className="text-[14px] font-semibold text-ink flex items-center gap-2">
          <span className="text-accent">{icon}</span>
          {title}
        </h3>
        <ArrowRight className="size-4 text-ink-4 group-hover:text-ink group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-[12.5px] text-ink-3 leading-relaxed">{description}</p>
    </Link>
  );
}

// Suppress unused — kept for future surface.
void StoreIcon;
