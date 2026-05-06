import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { retailerStatusMeta, storeStatusMeta } from '@/lib/status';
import type { AdminRetailerView, Store } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDashboard() {
  const session = useAuth((s) => s.session);
  const admin = session?.kind === 'admin' ? session.admin : null;

  // Fetch the four buckets in parallel — small payloads, used for both stat counts and
  // the "most recent" lists below.
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
    queryFn: () => api<Store[]>('/admin/stores?status=onboarding'),
  });
  const activeStores = useQuery({
    queryKey: ['admin', 'stores', 'active'],
    queryFn: () => api<Store[]>('/admin/stores?status=active'),
  });

  return (
    <Page>
      <PageHeader
        title={
          <>
            What's on the desk
            <br />
            <em>this morning</em>.
          </>
        }
        description={
          <>
            Live state of the marketplace at a glance — applications waiting for a decision,
            storefronts pending the wave-through, and a few quick ways to act.
          </>
        }
      />

      {/* Stat strip — four buckets, each clickable */}
      <div className="mb-12 grid grid-cols-2 divide-y divide-rule border-y border-rule sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <Stat
          kicker="Pending applications"
          value={pendingRetailers.data?.length}
          loading={pendingRetailers.isLoading}
          to="/admin/retailers"
          tone="warn"
        />
        <Stat
          kicker="Onboarding storefronts"
          value={onboardingStores.data?.length}
          loading={onboardingStores.isLoading}
          to="/admin/stores"
          tone="info"
        />
        <Stat
          kicker="Active retailers"
          value={activeRetailers.data?.length}
          loading={activeRetailers.isLoading}
          to="/admin/retailers"
          tone="good"
        />
        <Stat
          kicker="Active storefronts"
          value={activeStores.data?.length}
          loading={activeStores.isLoading}
          to="/admin/stores"
          tone="good"
        />
      </div>

      {/* Quick actions */}
      <SectionHeading title="Quick actions" hint="Common operator tasks" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-14">
        <ActionCard
          to="/admin/retailers"
          title="Review applications"
          description="Approve or reject the retailers waiting at the door."
          count={pendingRetailers.data?.length ?? 0}
          countLabel="pending"
        />
        <ActionCard
          to="/admin/stores"
          title="Approve storefronts"
          description="Wave through onboarding storefronts so retailers can publish."
          count={onboardingStores.data?.length ?? 0}
          countLabel="onboarding"
        />
        <ActionCard
          to="/admin/retailers"
          title="Browse all retailers"
          description="Search and filter every retailer on the platform."
        />
      </ul>

      {/* Recent lists side-by-side */}
      <div className="grid gap-12 lg:grid-cols-2">
        <RecentRetailers
          retailers={pendingRetailers.data ?? []}
          loading={pendingRetailers.isLoading}
        />
        <RecentStores
          stores={onboardingStores.data ?? []}
          loading={onboardingStores.isLoading}
        />
      </div>

      {admin && (
        <p className="mt-12 text-[11px] uppercase tracking-[0.16em] text-ink-3">
          Signed in as <span className="text-ink">{admin.email}</span>
          <span className="mx-2 text-ink-4">·</span>
          {admin.subRole.replace('_', ' ')}
        </p>
      )}
    </Page>
  );
}

type StatTone = 'good' | 'warn' | 'info' | 'neutral';

function Stat({
  kicker,
  value,
  loading,
  to,
  tone,
}: {
  kicker: string;
  value: number | undefined;
  loading: boolean;
  to: string;
  tone: StatTone;
}) {
  const dot =
    tone === 'good' ? 'bg-success' : tone === 'warn' ? 'bg-warning' : tone === 'info' ? 'bg-info' : 'bg-ink-3';
  return (
    <Link
      to={to}
      className="group block px-6 py-7 hover:bg-surface/40 transition-colors"
    >
      <div className="kicker mb-3 flex items-center gap-2 text-ink-3">
        <span className={`size-1.5 rounded-full ${dot}`} aria-hidden />
        {kicker}
      </div>
      {loading ? (
        <Skeleton className="h-12 w-20" />
      ) : (
        <div className="font-mono text-[44px] tabular-nums leading-none text-ink">
          {String(value ?? 0).padStart(2, '0')}
        </div>
      )}
      <div className="mt-3 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-ink-3 group-hover:text-ink">
        Open
        <ArrowUpRight className="size-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function ActionCard({
  to,
  title,
  description,
  count,
  countLabel,
}: {
  to: string;
  title: string;
  description: string;
  count?: number;
  countLabel?: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className="group block border border-rule bg-surface p-5 hover:border-ink press transition-colors h-full"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display italic text-[22px] leading-tight text-ink">{title}</h3>
          <ArrowUpRight className="size-4 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{description}</p>
        {typeof count === 'number' && (
          <div className="mt-4 flex items-baseline gap-2 border-t border-rule pt-3">
            <span className="font-mono text-[20px] tabular-nums text-ink">
              {String(count).padStart(2, '0')}
            </span>
            <span className="kicker text-ink-3">{countLabel}</span>
          </div>
        )}
      </Link>
    </li>
  );
}

function RecentRetailers({
  retailers,
  loading,
}: {
  retailers: AdminRetailerView[];
  loading: boolean;
}) {
  const items = retailers.slice(0, 5);
  return (
    <section>
      <SectionHeading
        title="Latest applications"
        hint={
          <Link to="/admin/retailers" className="hover:text-ink">
            All retailers →
          </Link>
        }
      />
      {loading ? (
        <div className="space-y-px">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-[13.5px] text-ink-3">No retailers waiting at the door.</p>
      ) : (
        <ul className="border-y border-rule divide-y divide-rule">
          {items.map((r) => {
            const meta = retailerStatusMeta(r.status);
            return (
              <li key={r.id} className="py-3">
                <Link to="/admin/retailers" className="group block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-ink truncate group-hover:underline underline-offset-4">
                        {r.legalName}
                      </div>
                      <div className="mt-0.5 text-[12px] text-ink-3 truncate">{r.email}</div>
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RecentStores({ stores, loading }: { stores: Store[]; loading: boolean }) {
  const items = stores.slice(0, 5);
  return (
    <section>
      <SectionHeading
        title="Latest storefronts"
        hint={
          <Link to="/admin/stores" className="hover:text-ink">
            All storefronts →
          </Link>
        }
      />
      {loading ? (
        <div className="space-y-px">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-[13.5px] text-ink-3">No storefronts in onboarding right now.</p>
      ) : (
        <ul className="border-y border-rule divide-y divide-rule">
          {items.map((s) => {
            const meta = storeStatusMeta(s.status);
            return (
              <li key={s.id} className="py-3">
                <Link to="/admin/stores" className="group block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-ink truncate group-hover:underline underline-offset-4">
                        {s.legalName}
                      </div>
                      <div className="mt-0.5 text-[12px] text-ink-3 truncate">{s.address}</div>
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
