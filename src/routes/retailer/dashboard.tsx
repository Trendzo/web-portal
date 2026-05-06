import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Check,
  Clock,
  Download,
  Filter,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { retailerStatusMeta, storeStatusMeta } from '@/lib/status';
import type { Listing, RetailerProfile, Store } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Count } from '@/components/ui/count';
import { LineChart, type Series } from '@/components/ui/line-chart';
import { Segmented } from '@/components/ui/segmented';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';

type MeResponse = { retailer: RetailerProfile; store: Store | null };

/**
 * Retailer overview — shape depends on lifecycle:
 *   - Pre-live: status hero + checklist driving the next concrete step.
 *   - Live: KPI strip + activity chart + top products + recent listings.
 * Phone owners see a single-column stack; desktops get the full grid.
 */
export default function RetailerDashboard() {
  const session = useAuth((s) => s.session);
  const patchRetailer = useAuth((s) => s.patchRetailer);
  const fallback = session?.kind === 'retailer' ? session.retailer : null;

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<MeResponse>('/retailer/me'),
  });

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
        title={`Welcome back, ${firstName}`}
        description={liveAndKicking
          ? "Here's your store snapshot — products, stock, and what changed lately."
          : "Here's your store status and what to do next."}
        actions={liveAndKicking ? (
          <Button asChild variant="solid" iconLeft={<Plus className="size-4" />}>
            <Link to="/retailer/listings">Add product</Link>
          </Button>
        ) : undefined}
      />

      {liveAndKicking ? (
        <LiveDashboard listings={listings.data ?? []} loading={listings.isLoading} />
      ) : (
        <PreLive retailer={retailer} store={store} loading={isLoading} />
      )}
    </Page>
  );
}

// ───────── Pre-live (onboarding) ─────────

function PreLive({ retailer, store, loading }: { retailer: RetailerProfile; store: Store | null; loading: boolean }) {
  return (
    <>
      <StatusHero retailer={retailer} store={store} loading={loading} />
      <Steps retailer={retailer} store={store} />
    </>
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
    title = "You're approved — set up your storefront.";
    subtitle = "Tell us where customers can find you. We'll then review your storefront.";
    nextStep = { label: 'Submit storefront', to: '/retailer/store' };
  } else if (store.status === 'onboarding') {
    title = 'Your storefront is being reviewed.';
    subtitle = "Once approved, you'll be able to publish products and accept orders.";
    nextStep = { label: 'Review storefront', to: '/retailer/store' };
  } else if (store.status !== 'active') {
    title = `Your storefront is ${store.status}.`;
    subtitle = 'Reach out to admin if you think this is wrong.';
  } else {
    title = "Everything's live.";
    subtitle = "You're ready to sell. Add products, manage stock, run promotions.";
  }

  return (
    <div className="rounded-2xl border border-line bg-bg p-6 sm:p-8 shadow-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
          <h2 className="text-[20px] font-semibold text-ink leading-snug mb-1.5">
            {title}
          </h2>
          <p className="text-[13.5px] text-ink-3 leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        </div>
        {nextStep && (
          <Button asChild variant="solid" iconRight={<ArrowRight className="size-4" />} className="shrink-0">
            <Link to={nextStep.to}>{nextStep.label}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function Steps({ retailer, store }: { retailer: RetailerProfile; store: Store | null }) {
  const steps = [
    { title: 'Account created', done: true, desc: 'KYC verified at signup.' },
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
      desc: store?.status === 'active' ? "You're ready — start adding products." : 'Available once your store is approved.',
      cta: store?.status === 'active' ? { label: 'Add product', to: '/retailer/listings' } : null,
    },
  ];
  const completedCount = steps.filter((s) => s.done).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  return (
    <section className="mt-6">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="kicker mb-1">Onboarding</div>
          <h2 className="text-[15px] font-semibold text-ink">Getting your store live</h2>
        </div>
        <div className="text-[12px] text-ink-3">{completedCount} of {steps.length} done</div>
      </div>
      <div className="h-1.5 rounded-full bg-bg-3 overflow-hidden mb-5">
        <div className="h-full bg-ink rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li
            key={i}
            className={cn(
              'flex items-start gap-3 rounded-xl border bg-bg p-4',
              s.pending ? 'border-warning/30 bg-warning-soft/30' : 'border-line',
            )}
          >
            <div
              className={cn(
                'shrink-0 grid size-8 place-items-center rounded-full text-[12px] font-semibold',
                s.done ? 'bg-ink text-bg' :
                s.pending ? 'bg-warning text-white' :
                'bg-bg-3 text-ink-3 border border-line',
              )}
            >
              {s.done ? <Check className="size-3.5" /> : s.pending ? <Clock className="size-3.5" /> : i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium text-ink">{s.title}</div>
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

// ───────── Live dashboard ─────────

function LiveDashboard({ listings, loading }: { listings: Listing[]; loading: boolean }) {
  const totalStock = listings.reduce(
    (n, l) => n + (l.variants?.reduce((m, v) => m + v.stock, 0) ?? 0),
    0,
  );
  const stockValue = Math.round(
    listings.reduce(
      (n, l) => n + (l.variants?.reduce((m, v) => m + v.stock * (v.pricePaise ?? 0), 0) ?? 0),
      0,
    ) / 100,
  );
  const activeProducts = listings.filter((l) => l.status === 'active').length;

  const series = useMemo(() => buildListingSeries(listings), [listings]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <FeaturedKpi
          icon={<Boxes className="size-4" />}
          label="Stock value"
          value={stockValue}
          loading={loading}
          prefix="₹"
          subtitle={`${listings.length} products listed`}
        />
        <Kpi
          icon={<Package className="size-4" />}
          label="Active products"
          value={activeProducts}
          loading={loading}
          delta={pctOf(activeProducts, listings.length)}
        />
        <Kpi
          icon={<ShoppingBag className="size-4" />}
          label="Total stock"
          value={totalStock}
          loading={loading}
          delta={{ tone: 'neutral', text: `${listings.length} SKUs` }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <ChartCard series={series} className="lg:col-span-2" />
        <TopProductsCard listings={listings} loading={loading} />
      </div>

      <RecentProductsCard listings={listings} loading={loading} />
    </>
  );
}

function FeaturedKpi({
  icon,
  label,
  value,
  loading,
  prefix,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  loading: boolean;
  prefix?: string;
  subtitle?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink p-6 text-bg shadow-card">
      <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="relative flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium uppercase tracking-wider text-bg/60">{label}</span>
          <span className="grid size-9 place-items-center rounded-full bg-bg/10">{icon}</span>
        </div>
        {loading ? (
          <Skeleton className="h-10 w-32 bg-bg/15" />
        ) : (
          <div className="font-mono text-[36px] font-semibold tracking-tight leading-none">
            <Count value={value} prefix={prefix} />
          </div>
        )}
        {subtitle && (
          <div className="text-[12px] text-bg/70">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  loading,
  delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  loading: boolean;
  delta?: { tone: 'success' | 'danger' | 'neutral'; text: string };
}) {
  return (
    <div className="surface-card p-6">
      <div className="flex items-center justify-between mb-5">
        <span className="text-[12px] font-medium uppercase tracking-wider text-ink-3">{label}</span>
        <span className="grid size-9 place-items-center rounded-full bg-bg-3 text-ink-2">{icon}</span>
      </div>
      {loading ? (
        <Skeleton className="h-10 w-28" />
      ) : (
        <div className="font-mono text-[36px] font-semibold tracking-tight text-ink leading-none">
          <Count value={value} />
        </div>
      )}
      {delta && (
        <div className="mt-3 text-[12px]">
          <span
            className={cn(
              delta.tone === 'success' ? 'text-success' :
              delta.tone === 'danger' ? 'text-danger' :
              'text-ink-3',
            )}
          >
            {delta.text}
          </span>
        </div>
      )}
    </div>
  );
}

function ChartCard({ series, className }: { series: { labels: string[]; data: Series[] }; className?: string }) {
  const [view, setView] = useState<'all' | 'active'>('all');
  const visible: Series[] = view === 'all' ? series.data : series.data.filter((s) => s.label === 'Active');
  return (
    <section className={cn('surface-card p-6', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Catalog activity</h2>
          <p className="text-[12.5px] text-ink-3">Listings published over the last 7 months.</p>
        </div>
        <Segmented<'all' | 'active'>
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active only' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      <LineChart
        labels={series.labels}
        series={visible}
        height={240}
        formatY={(n) => Math.round(n).toString()}
      />
    </section>
  );
}

function TopProductsCard({ listings, loading }: { listings: Listing[]; loading: boolean }) {
  // Highest-stock listings — proxy for "best stocked" / featured.
  const top = [...listings]
    .map((l) => ({
      ...l,
      stock: l.variants?.reduce((m, v) => m + v.stock, 0) ?? 0,
    }))
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 4);

  return (
    <section className="surface-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold text-ink">Top products</h2>
        <Link to="/retailer/listings" className="text-[12px] text-ink-3 hover:text-ink">See all →</Link>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : top.length === 0 ? (
        <div className="text-[13px] text-ink-3 py-6 text-center">No products yet.</div>
      ) : (
        <ul className="space-y-3">
          {top.map((l) => (
            <li key={l.id} className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-bg-3 border border-line">
                <Package className="size-4 text-ink-3" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium text-ink truncate">{l.name}</div>
                <div className="text-[12px] text-ink-3 truncate">{l.stock} in stock</div>
              </div>
              <Badge tone={l.status === 'active' ? 'success' : 'neutral'} nodot>
                {l.status === 'active' ? 'Available' : l.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentProductsCard({ listings, loading }: { listings: Listing[]; loading: boolean }) {
  const navigate = useNavigate();
  const [columns, setColumns] = useState({ product: true, status: true, stock: true, price: true });
  const recent = [...listings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between border-b border-line">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Latest products</h2>
          <p className="text-[12.5px] text-ink-3">Most recently added to your catalog.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ColumnsMenu columns={columns} setColumns={setColumns} />
          <ToolbarButton icon={<Filter className="size-3.5" />}>Filter</ToolbarButton>
          <ToolbarButton icon={<Download className="size-3.5" />} onClick={() => exportListings(recent)}>Export</ToolbarButton>
          <Button asChild variant="solid" size="sm" iconLeft={<Plus className="size-3.5" />}>
            <Link to="/retailer/listings">Add</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-6 space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : recent.length === 0 ? (
        <div className="p-12 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-bg-3 mb-3">
            <Package className="size-5 text-ink-3" />
          </div>
          <p className="text-[13.5px] font-medium text-ink">No products yet</p>
          <p className="text-[12.5px] text-ink-3 mt-1 mb-4">Start by adding your first listing.</p>
          <Button asChild variant="solid" size="sm">
            <Link to="/retailer/listings">Add product</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11.5px] uppercase tracking-wider text-ink-3 border-b border-line">
                <th className="py-3 px-6 font-medium">SKU</th>
                {columns.product && <th className="py-3 font-medium">Product</th>}
                {columns.stock && <th className="py-3 font-medium">Stock</th>}
                {columns.price && <th className="py-3 font-medium">Price</th>}
                {columns.status && <th className="py-3 font-medium">Status</th>}
                <th className="py-3 px-6 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recent.map((l) => {
                const stock = l.variants?.reduce((m, v) => m + v.stock, 0) ?? 0;
                const price = Math.round((l.variants?.[0]?.pricePaise ?? 0) / 100);
                return (
                  <tr key={l.id} className="text-[13px] hover:bg-bg-2 cursor-pointer transition-colors" onClick={() => navigate(`/retailer/listings/${l.id}`)}>
                    <td className="py-3.5 px-6 font-mono text-[12px] text-ink-2">#{l.id.slice(0, 8).toUpperCase()}</td>
                    {columns.product && (
                      <td className="py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={l.name} size="sm" />
                          <span className="font-medium text-ink truncate max-w-[200px]">{l.name}</span>
                        </div>
                      </td>
                    )}
                    {columns.stock && (
                      <td className="py-3.5 text-ink-2 tabular">{stock}</td>
                    )}
                    {columns.price && (
                      <td className="py-3.5 text-ink-2 tabular">₹{price.toLocaleString()}</td>
                    )}
                    {columns.status && (
                      <td className="py-3.5">
                        <Badge tone={l.status === 'active' ? 'success' : 'neutral'} nodot>
                          {l.status === 'active' ? 'Available' : l.status}
                        </Badge>
                      </td>
                    )}
                    <td className="py-3.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <ListingRowActions listing={l} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ListingRowActions({ listing }: { listing: Listing }) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Row actions"
          className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-bg-3 hover:text-ink press"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuLabel>{listing.name.slice(0, 24)}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => navigate(`/retailer/listings/${listing.id}`)}>
          <BadgeCheck className="size-3.5 text-ink-3" />
          <span>Open</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(`/retailer/listings/${listing.id}`)}>
          <Pencil className="size-3.5 text-ink-3" />
          <span>Edit</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigator.clipboard.writeText(listing.id)}>
          <ShoppingBag className="size-3.5 text-ink-3" />
          <span>Copy ID</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(`/retailer/listings/${listing.id}`)}>
          <Trash2 className="size-3.5 text-danger" />
          <span className="text-danger">Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ColumnsMenu<T extends Record<string, boolean>>({
  columns,
  setColumns,
}: {
  columns: T;
  setColumns: (next: T) => void;
}) {
  const labels: Record<string, string> = {
    product: 'Product',
    stock: 'Stock',
    price: 'Price',
    status: 'Status',
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={toolbarBtn}>
          <SlidersHorizontal className="size-3.5" />
          Customize
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuLabel>Columns</DropdownMenuLabel>
        {Object.keys(labels).map((key) => (
          <DropdownMenuItem
            key={key}
            onSelect={(e) => {
              e.preventDefault();
              setColumns({ ...columns, [key]: !columns[key] } as T);
            }}
          >
            <span
              className={cn(
                'grid size-4 place-items-center rounded border',
                columns[key] ? 'bg-ink border-ink text-bg' : 'border-line-2',
              )}
            >
              {columns[key] && <Check className="size-3" />}
            </span>
            <span>{labels[key]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const toolbarBtn =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-bg px-3 text-[12.5px] font-medium text-ink-2 hover:bg-bg-3 hover:text-ink press';

function ToolbarButton({
  icon,
  children,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={toolbarBtn}>
      {icon}
      {children}
    </button>
  );
}

// ─── helpers ───

function pctOf(part: number, total: number): { tone: 'success' | 'neutral'; text: string } {
  if (total === 0) return { tone: 'neutral', text: '—' };
  return { tone: 'success', text: `${Math.round((part / total) * 100)}% of catalog` };
}

function buildListingSeries(listings: Listing[]): { labels: string[]; data: Series[] } {
  const months = 7;
  const now = new Date();
  now.setDate(1);
  const buckets: { key: string; label: string; total: number; active: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      total: 0,
      active: 0,
    });
  }
  const idxByKey = new Map(buckets.map((b, i) => [b.key, i] as const));
  for (const l of listings) {
    const d = new Date(l.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    const i = idxByKey.get(k);
    if (i == null) continue;
    const bucket = buckets[i];
    if (!bucket) continue;
    bucket.total += 1;
    if (l.status === 'active') bucket.active += 1;
  }
  return {
    labels: buckets.map((b) => b.label),
    data: [
      { label: 'All', color: 'var(--color-ink)', values: buckets.map((b) => b.total) },
      { label: 'Active', color: 'var(--color-ink-3)', values: buckets.map((b) => b.active) },
    ],
  };
}

function exportListings(items: Listing[]) {
  const rows = [
    ['ID', 'Name', 'Status', 'Created'],
    ...items.map((l) => [l.id, l.name, l.status, l.createdAt]),
  ];
  const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
