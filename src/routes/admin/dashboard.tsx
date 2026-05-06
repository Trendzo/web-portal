import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  Clock,
  Inbox,
  Package,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { retailerStatusMeta, storeStatusMeta } from '@/lib/status';
import type { AdminRetailerView, Store as StoreT } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

/**
 * Admin dashboard — built for the operator persona who lives in this all day.
 * Goals:
 *   1. Queues at a glance — how many things need my attention?
 *   2. Age signals — which queue has the oldest item? Act on the stalest first.
 *   3. One-click drill-in to triage.
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
  const oldestStoreAge = ageOfOldest(onboardingStores.data, 'createdAt' as keyof StoreT);

  return (
    <Page>
      <PageHeader
        title={`Hey, ${admin?.email.split('@')[0] ?? 'there'}`}
        description="Live state of the marketplace — review what's waiting and triage from one place."
      />

      {/* Queue stats — clickable, with age indicator on the oldest pending item */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          icon={<Inbox className="size-4" />}
          label="Pending applications"
          value={pendingRetailers.data?.length}
          loading={pendingRetailers.isLoading}
          to="/admin/retailers"
          tone="warn"
          subtitle={oldestRetailerAge ? `Oldest ${oldestRetailerAge}` : 'All clear'}
          primary={(pendingRetailers.data?.length ?? 0) > 0}
        />
        <StatCard
          icon={<Store className="size-4" />}
          label="Onboarding storefronts"
          value={onboardingStores.data?.length}
          loading={onboardingStores.isLoading}
          to="/admin/stores"
          tone="info"
          subtitle={oldestStoreAge ? `Oldest ${oldestStoreAge}` : 'All clear'}
        />
        <StatCard
          icon={<Users className="size-4" />}
          label="Active retailers"
          value={activeRetailers.data?.length}
          loading={activeRetailers.isLoading}
          to="/admin/retailers"
          tone="success"
        />
        <StatCard
          icon={<TrendingUp className="size-4" />}
          label="Active storefronts"
          value={activeStores.data?.length}
          loading={activeStores.isLoading}
          to="/admin/stores"
          tone="success"
        />
      </div>

      {/* Quick actions */}
      <div className="mb-10">
        <div className="kicker mb-3">Quick actions</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            to="/admin/retailers"
            title="Review applications"
            count={pendingRetailers.data?.length ?? 0}
            description="Approve or reject the retailers waiting at the door."
            primary={(pendingRetailers.data?.length ?? 0) > 0}
          />
          <ActionCard
            to="/admin/stores"
            title="Approve storefronts"
            count={onboardingStores.data?.length ?? 0}
            description="Wave through onboarding storefronts so they can publish."
          />
          <ActionCard
            to="/admin/promotions"
            title="Run a promotion"
            description="Create offers, coupons, vouchers across the marketplace."
            icon={<Package className="size-4" />}
          />
        </div>
      </div>

      {/* Two recent-items lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentList
          title="Latest applications"
          all="/admin/retailers"
          loading={pendingRetailers.isLoading}
          emptyText="No retailers waiting at the door."
          items={(pendingRetailers.data ?? []).slice(0, 5).map((r) => {
            const meta = retailerStatusMeta(r.status);
            return {
              id: r.id,
              to: '/admin/retailers',
              primary: r.legalName,
              secondary: r.email,
              meta: r.createdAt,
              badge: { tone: meta.tone, label: meta.label, pulse: r.status === 'pending_approval' },
            };
          })}
        />
        <RecentList
          title="Latest storefronts"
          all="/admin/stores"
          loading={onboardingStores.isLoading}
          emptyText="No storefronts onboarding right now."
          items={(onboardingStores.data ?? []).slice(0, 5).map((s) => {
            const meta = storeStatusMeta(s.status);
            return {
              id: s.id,
              to: '/admin/stores',
              primary: s.legalName,
              secondary: s.address,
              meta: undefined,
              badge: { tone: meta.tone, label: meta.label, pulse: s.status === 'onboarding' },
            };
          })}
        />
      </div>
    </Page>
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

// ─── components ───

type Tone = 'warn' | 'info' | 'success' | 'neutral';

function StatCard({
  icon,
  label,
  value,
  loading,
  to,
  tone,
  subtitle,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  loading: boolean;
  to: string;
  tone: Tone;
  subtitle?: string;
  primary?: boolean;
}) {
  const dot =
    tone === 'success' ? 'bg-success' :
    tone === 'warn' ? 'bg-warning' :
    tone === 'info' ? 'bg-info' : 'bg-ink-3';
  return (
    <Link
      to={to}
      className={cn(
        'group block rounded-lg border bg-bg p-4 transition-all hover:border-line-2 hover:shadow-sm',
        primary ? 'border-accent/40 accent-strip relative' : 'border-line',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="grid size-7 place-items-center rounded-md bg-bg-3 text-ink-2">
          {icon}
        </span>
        <ArrowRight className="size-3.5 text-ink-4 group-hover:text-ink group-hover:translate-x-0.5 transition-all" />
      </div>
      <div className="kicker text-ink-3 mb-1.5 flex items-center gap-1.5">
        <span className={cn('size-1.5 rounded-full', dot)} />
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-12" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[28px] font-semibold tabular-nums text-ink leading-none">
            {String(value ?? 0)}
          </span>
        </div>
      )}
      {subtitle && (
        <div className="mt-1.5 flex items-center gap-1 text-[11.5px] text-ink-3">
          <Clock className="size-3" />
          {subtitle}
        </div>
      )}
    </Link>
  );
}

function ActionCard({
  to,
  title,
  description,
  count,
  icon,
  primary,
}: {
  to: string;
  title: string;
  description: string;
  count?: number;
  icon?: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group block rounded-lg border bg-bg p-4 transition-all hover:border-line-2 hover:shadow-sm',
        primary ? 'border-accent/40 accent-strip relative' : 'border-line',
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-[14px] font-semibold text-ink flex items-center gap-2">
          {icon && <span className="text-accent">{icon}</span>}
          {title}
        </h3>
        <ArrowRight className="size-4 text-ink-4 group-hover:text-ink group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-[12.5px] text-ink-3 leading-relaxed">{description}</p>
      {typeof count === 'number' && count > 0 && (
        <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-warning-soft border border-warning/20 text-[11.5px] font-medium text-warning">
          <span className="size-1.5 rounded-full bg-warning pulse-dot" />
          {count} pending
        </div>
      )}
    </Link>
  );
}

function RecentList({
  title,
  all,
  loading,
  emptyText,
  items,
}: {
  title: string;
  all: string;
  loading: boolean;
  emptyText: string;
  items: Array<{
    id: string;
    to: string;
    primary: string;
    secondary: string;
    meta?: string | undefined;
    badge: { tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral'; label: string; pulse?: boolean };
  }>;
}) {
  return (
    <section className="rounded-lg border border-line bg-bg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
        <Link to={all} className="text-[12px] text-ink-3 hover:text-accent">View all →</Link>
      </div>
      {loading ? (
        <div className="p-4 space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 flex items-center justify-center gap-2 text-[13px] text-ink-3">
          <Check className="size-4 text-success" />
          {emptyText}
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((it) => (
            <li key={it.id}>
              <Link to={it.to} className="block px-4 py-3 hover:bg-bg-2 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium text-ink truncate">{it.primary}</div>
                    <div className="text-[12px] text-ink-3 truncate mt-0.5">{it.secondary}</div>
                  </div>
                  <Badge tone={it.badge.tone} pulse={it.badge.pulse}>{it.badge.label}</Badge>
                </div>
                {it.meta && (
                  <div className="mt-1 text-[11px] text-ink-3 flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatAge(Date.now() - new Date(it.meta).getTime())}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
