import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Check,
  Clock,
  Download,
  Filter,
  Inbox,
  MoreHorizontal,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { retailerStatusMeta } from '@/lib/status';
import type { AdminRetailerView, Store as StoreT } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Count } from '@/components/ui/count';
import { LineChart, type Series } from '@/components/ui/line-chart';
import { Segmented } from '@/components/ui/segmented';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';

/**
 * Admin overview — single-pane operator console. The dark KPI card carries the
 * highest-attention metric (whichever queue currently demands action), the
 * chart shows recent marketplace activity, the right rail surfaces top
 * retailers, and the table lists latest applications with one-click triage
 * affordances.
 */
export default function AdminDashboard() {
  const session = useAuth((s) => s.session);
  const admin = session?.kind === 'admin' ? session.admin : null;

  const pendingRetailers = useQuery({
    queryKey: ['admin', 'retailers', 'pending_approval'],
    queryFn: () => api<AdminRetailerView[]>('/admin/retailers?status=pending_approval'),
  });
  const activeRetailers = useQuery({
    queryKey: ['admin', 'retailers', 'active'],
    queryFn: () => api<AdminRetailerView[]>('/admin/retailers?status=active'),
  });
  const onboardingStores = useQuery({
    queryKey: ['admin', 'stores', 'onboarding'],
    queryFn: () => api<StoreT[]>('/admin/stores?status=onboarding'),
  });
  const activeStores = useQuery({
    queryKey: ['admin', 'stores', 'active'],
    queryFn: () => api<StoreT[]>('/admin/stores?status=active'),
  });

  const oldestRetailerAge = ageOfOldest(pendingRetailers.data, 'createdAt');
  const firstName = admin?.email.split('@')[0] ?? 'there';

  // Real time-series — bucket retailer createdAt timestamps over the last 7 months
  // and split into Active vs Pending. (Store doesn't have createdAt, so we keep
  // the chart honest by leaving it out.)
  const series = useMemo(() => {
    return buildActivitySeries(
      activeRetailers.data ?? [],
      pendingRetailers.data ?? [],
    );
  }, [pendingRetailers.data, activeRetailers.data]);

  const pendingCount = pendingRetailers.data?.length;
  const activeRetailerCount = activeRetailers.data?.length;
  const activeStoreCount = activeStores.data?.length;

  const topApplications = (pendingRetailers.data ?? []).slice(0, 6);

  return (
    <Page>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's the live state of the marketplace — review what's waiting and triage from one place."
      />

      {/* KPI strip — featured dark card on the left, secondary cards beside */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <FeaturedKpi
          icon={<Inbox className="size-4" />}
          label="Pending applications"
          value={pendingCount}
          loading={pendingRetailers.isLoading}
          deltaText={oldestRetailerAge ? `Oldest ${oldestRetailerAge}` : 'All clear'}
          deltaTone={oldestRetailerAge ? 'danger' : 'success'}
          to="/admin/retailers"
        />
        <Kpi
          icon={<Users className="size-4" />}
          label="Active retailers"
          value={activeRetailerCount}
          loading={activeRetailers.isLoading}
          delta={changePctish(activeRetailers.data?.length, pendingRetailers.data?.length)}
          to="/admin/retailers"
        />
        <Kpi
          icon={<Store className="size-4" />}
          label="Active storefronts"
          value={activeStoreCount}
          loading={activeStores.isLoading}
          delta={changePctish(activeStores.data?.length, onboardingStores.data?.length)}
          to="/admin/stores"
        />
      </div>

      {/* Chart + top retailers */}
      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <ChartCard series={series} className="lg:col-span-2" />
        <TopRetailersCard
          retailers={(activeRetailers.data ?? []).slice(0, 4)}
          loading={activeRetailers.isLoading}
        />
      </div>

      {/* Latest applications */}
      <LatestApplicationsCard
        items={topApplications}
        loading={pendingRetailers.isLoading}
      />
    </Page>
  );
}

// ─── KPI cards ───

function FeaturedKpi({
  icon,
  label,
  value,
  loading,
  deltaText,
  deltaTone,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  loading: boolean;
  deltaText?: string;
  deltaTone: 'success' | 'danger';
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl bg-ink p-6 text-bg shadow-card transition-transform press"
    >
      <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="relative flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium uppercase tracking-wider text-bg/60">
            {label}
          </span>
          <span className="grid size-9 place-items-center rounded-full bg-bg/10 text-bg">
            {icon}
          </span>
        </div>
        <div className="leading-none">
          {loading ? (
            <Skeleton className="h-10 w-28 bg-bg/15" />
          ) : (
            <div className="font-mono text-[40px] font-semibold tracking-tight">
              <Count value={value} />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-[12px] text-bg/70">
          <span className={cn(
            'inline-flex items-center gap-1.5',
            deltaTone === 'success' ? 'text-emerald-400' : 'text-rose-300',
          )}>
            <Clock className="size-3" />
            {deltaText}
          </span>
          <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </Link>
  );
}

function Kpi({
  icon,
  label,
  value,
  loading,
  delta,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  loading: boolean;
  delta?: { tone: 'success' | 'danger' | 'neutral'; text: string };
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group surface-card p-6 transition-shadow press hover:shadow-md"
    >
      <div className="flex items-center justify-between mb-5">
        <span className="text-[12px] font-medium uppercase tracking-wider text-ink-3">
          {label}
        </span>
        <span className="grid size-9 place-items-center rounded-full bg-bg-3 text-ink-2">
          {icon}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-10 w-28" />
      ) : (
        <div className="font-mono text-[40px] font-semibold tracking-tight text-ink leading-none">
          <Count value={value} />
        </div>
      )}
      {delta && (
        <div className="mt-3 flex items-center justify-between text-[12px]">
          <span
            className={cn(
              delta.tone === 'success' ? 'text-success' :
              delta.tone === 'danger' ? 'text-danger' :
              'text-ink-3',
            )}
          >
            {delta.text}
          </span>
          <ArrowUpRight className="size-4 text-ink-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      )}
    </Link>
  );
}

// ─── Chart card ───

function ChartCard({ series, className }: { series: { labels: string[]; data: Series[] }; className?: string }) {
  const [view, setView] = useState<'all' | 'active' | 'pending'>('all');
  const visible: Series[] = series.data.filter((s) => {
    if (view === 'all') return true;
    if (view === 'active') return s.label === 'Active';
    return s.label === 'Pending';
  });

  return (
    <section className={cn('surface-card p-6', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Retailer signups</h2>
          <p className="text-[12.5px] text-ink-3">New retailer applications over the last 7 months.</p>
        </div>
        <Segmented<'all' | 'active' | 'pending'>
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'pending', label: 'Pending' },
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

// ─── Top retailers ───

function TopRetailersCard({ retailers, loading }: { retailers: AdminRetailerView[]; loading: boolean }) {
  return (
    <section className="surface-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold text-ink">Top retailers</h2>
        <Link to="/admin/retailers" className="text-[12px] text-ink-3 hover:text-ink">View all →</Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : retailers.length === 0 ? (
        <EmptyHint icon={<TrendingUp className="size-4" />} text="No active retailers yet." />
      ) : (
        <ul className="space-y-3">
          {retailers.map((r) => (
            <li key={r.id} className="flex items-center gap-3">
              <Avatar name={r.legalName} />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium text-ink truncate">{r.legalName}</div>
                <div className="text-[12px] text-ink-3 truncate">{r.email}</div>
              </div>
              <Badge tone="success" nodot>Active</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Latest applications ───

function LatestApplicationsCard({
  items,
  loading,
}: {
  items: AdminRetailerView[];
  loading: boolean;
}) {
  const [columns, setColumns] = useState<{ company: boolean; email: boolean; createdAt: boolean; status: boolean }>({
    company: true,
    email: true,
    createdAt: true,
    status: true,
  });

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between border-b border-line">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Latest applications</h2>
          <p className="text-[12.5px] text-ink-3">Retailers awaiting your review.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ColumnsMenu columns={columns} setColumns={setColumns} />
          <ToolbarButton icon={<Filter className="size-3.5" />}>Filter</ToolbarButton>
          <ToolbarButton icon={<Download className="size-3.5" />} onClick={() => exportCsv(items)}>Export</ToolbarButton>
        </div>
      </div>

      {loading ? (
        <div className="p-6 space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-bg-3 mb-3">
            <Check className="size-5 text-success" />
          </div>
          <p className="text-[13.5px] font-medium text-ink">All caught up</p>
          <p className="text-[12.5px] text-ink-3 mt-1">No retailers waiting for review.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11.5px] uppercase tracking-wider text-ink-3 border-b border-line">
                <th className="py-3 px-6 font-medium">App. ID</th>
                {columns.company && <th className="py-3 font-medium">Company</th>}
                {columns.email && <th className="py-3 font-medium">Email</th>}
                {columns.createdAt && <th className="py-3 font-medium">Submitted</th>}
                {columns.status && <th className="py-3 font-medium">Status</th>}
                <th className="py-3 px-6 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((r) => {
                const meta = retailerStatusMeta(r.status);
                return (
                  <tr key={r.id} className="text-[13px] hover:bg-bg-2 transition-colors">
                    <td className="py-3.5 px-6 font-mono text-[12px] text-ink-2">#{r.id.slice(0, 8).toUpperCase()}</td>
                    {columns.company && (
                      <td className="py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.legalName} size="sm" />
                          <span className="font-medium text-ink truncate max-w-[200px]">{r.legalName}</span>
                        </div>
                      </td>
                    )}
                    {columns.email && (
                      <td className="py-3.5 text-ink-2 truncate max-w-[220px]">{r.email}</td>
                    )}
                    {columns.createdAt && (
                      <td className="py-3.5 text-ink-3 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    )}
                    {columns.status && (
                      <td className="py-3.5">
                        <Badge tone={meta.tone} pulse>{meta.label}</Badge>
                      </td>
                    )}
                    <td className="py-3.5 px-6 text-right">
                      <RowActions retailer={r} />
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

function RowActions({ retailer }: { retailer: AdminRetailerView }) {
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
        <DropdownMenuLabel>{retailer.legalName.slice(0, 24)}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => navigate('/admin/retailers')}>
          <Inbox className="size-3.5 text-ink-3" />
          <span>Review application</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/admin/retailers')}>
          <Check className="size-3.5 text-success" />
          <span>Approve</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigator.clipboard.writeText(retailer.email)}>
          <ShoppingBag className="size-3.5 text-ink-3" />
          <span>Copy email</span>
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
    company: 'Company',
    email: 'Email',
    createdAt: 'Submitted',
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

function EmptyHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-ink-3 py-6 justify-center">
      <span className="text-ink-4">{icon}</span>
      {text}
    </div>
  );
}

// ─── helpers ───

function ageOfOldest<T>(items: T[] | undefined, dateKey: keyof T): string | null {
  if (!items || items.length === 0) return null;
  const dates = items
    .map((it) => new Date(it[dateKey] as unknown as string).getTime())
    .filter((t) => !Number.isNaN(t));
  if (dates.length === 0) return null;
  const oldest = Math.min(...dates);
  return formatAge(Date.now() - oldest);
}

function formatAge(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatDate(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function changePctish(active: number | undefined, pending: number | undefined): { tone: 'success' | 'neutral'; text: string } {
  if (active == null || pending == null) return { tone: 'neutral', text: '—' };
  const total = active + pending;
  if (total === 0) return { tone: 'neutral', text: 'No data yet' };
  const pct = Math.round((active / total) * 100);
  return { tone: 'success', text: `${pct}% active` };
}

function buildActivitySeries(
  active: { createdAt: string }[],
  pending: { createdAt: string }[],
): { labels: string[]; data: Series[] } {
  const months = 7;
  const now = new Date();
  now.setDate(1);
  const buckets: { key: string; label: string; active: number; pending: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      active: 0,
      pending: 0,
    });
  }
  const idxByKey = new Map(buckets.map((b, i) => [b.key, i] as const));
  const bump = (createdAt: string, field: 'active' | 'pending') => {
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return;
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    const i = idxByKey.get(k);
    if (i != null) {
      const bucket = buckets[i];
      if (bucket) bucket[field] += 1;
    }
  };
  active.forEach((r) => bump(r.createdAt, 'active'));
  pending.forEach((r) => bump(r.createdAt, 'pending'));

  return {
    labels: buckets.map((b) => b.label),
    data: [
      { label: 'Active', color: 'var(--color-ink)', values: buckets.map((b) => b.active) },
      { label: 'Pending', color: 'var(--color-ink-3)', values: buckets.map((b) => b.pending) },
    ],
  };
}

function exportCsv(items: AdminRetailerView[]) {
  const rows = [
    ['App ID', 'Company', 'Email', 'Status', 'Submitted'],
    ...items.map((r) => [r.id, r.legalName, r.email, r.status, r.createdAt]),
  ];
  const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

