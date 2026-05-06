import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Inbox, Truck, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import {
  deliveryMethodLabel,
  formatAge,
  formatPaise,
  orderStatusMeta,
  paymentMethodLabel,
} from '@/lib/status';
import type { OrderListRow, OrderStatus } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

type Tab = 'needs-action' | 'in-transit' | 'recent' | 'cancelled';

const TAB_STATUSES: Record<Tab, OrderStatus[]> = {
  'needs-action': ['routing', 'accepted', 'packed', 'undelivered', 'returned_to_store'],
  'in-transit': ['picked_up', 'out_for_delivery', 'at_door', 'returning_to_store'],
  recent: ['delivered', 'closed'],
  cancelled: ['cancelled', 'payment_failed'],
};

const TAB_META: Record<Tab, { label: string; icon: typeof Inbox; tone: 'accent' | 'info' | 'success' | 'neutral' }> = {
  'needs-action': { label: 'Needs action', icon: Inbox, tone: 'accent' },
  'in-transit': { label: 'In transit', icon: Truck, tone: 'info' },
  recent: { label: 'Recent', icon: CheckCircle2, tone: 'success' },
  cancelled: { label: 'Cancelled', icon: XCircle, tone: 'neutral' },
};

const TABS: Tab[] = ['needs-action', 'in-transit', 'recent', 'cancelled'];

export default function RetailerOrdersList() {
  const [tab, setTab] = useState<Tab>('needs-action');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['retailer', 'orders', 'all'],
    queryFn: () => api<OrderListRow[]>('/retailer/orders'),
    refetchInterval: 5000,
  });

  const all = data ?? [];
  const counts = useMemo(() => {
    const map: Record<Tab, number> = { 'needs-action': 0, 'in-transit': 0, recent: 0, cancelled: 0 };
    for (const o of all) {
      for (const t of TABS) {
        if (TAB_STATUSES[t].includes(o.status)) {
          map[t] += 1;
          break;
        }
      }
    }
    return map;
  }, [all]);

  const filtered = all.filter((o) => TAB_STATUSES[tab].includes(o.status));

  return (
    <Page>
      <PageHeader
        title="Orders"
        description="Walk every order through the lifecycle — accept, pack, hand to delivery, then mark delivered."
      />

      {/* Tabs */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {TABS.map((t) => {
          const m = TAB_META[t];
          const Icon = m.icon;
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors',
                active
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-line bg-bg text-ink-2 hover:border-line-2 hover:text-ink',
              )}
            >
              <Icon className="size-3.5" />
              {m.label}
              {counts[t] > 0 && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10.5px] font-mono',
                  active ? 'bg-accent-fg/20 text-accent-fg' : 'bg-bg-3 text-ink-2',
                )}>
                  {counts[t]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : isError ? (
        <Empty
          kicker="Connection lost"
          title="Couldn't load orders"
          action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
        />
      ) : filtered.length === 0 ? (
        <Empty
          kicker={tab === 'needs-action' ? 'All clear' : 'Nothing here'}
          title={
            tab === 'needs-action'
              ? 'No orders need your attention right now.'
              : 'No orders in this view.'
          }
          description={
            tab === 'needs-action'
              ? 'New orders will appear here as soon as customers place them.'
              : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((o) => <OrderCard key={o.id} order={o} />)}
        </ul>
      )}
    </Page>
  );
}

function OrderCard({ order }: { order: OrderListRow }) {
  const meta = orderStatusMeta(order.status);
  const isPrimary = meta.bucket === 'needs-action';

  return (
    <li>
      <Link
        to={`/retailer/orders/${order.id}`}
        className={cn(
          'group block rounded-lg border bg-bg p-4 transition-all hover:border-line-2 hover:shadow-sm',
          isPrimary ? 'border-accent/40 accent-strip relative' : 'border-line',
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="font-medium text-ink truncate">{order.consumerName}</div>
            {order.consumerPhone && (
              <div className="text-[11.5px] text-ink-3 truncate mt-0.5">{order.consumerPhone}</div>
            )}
          </div>
          <Badge tone={meta.tone} pulse={meta.pulse}>{meta.label}</Badge>
        </div>

        <div className="flex items-center justify-between text-[12.5px] mt-2">
          <div className="text-ink-3">
            {order.itemCount} item{order.itemCount === 1 ? '' : 's'} · {deliveryMethodLabel(order.deliveryMethod)} · {paymentMethodLabel(order.paymentMethod)}
          </div>
          <div className="font-mono tabular-nums text-ink">{formatPaise(order.grandTotalPaise)}</div>
        </div>

        <div className="flex items-center justify-between mt-2 text-[11.5px] text-ink-3">
          <span>placed {formatAge(order.placedAt)}</span>
          {isPrimary ? (
            <span className="text-accent font-medium inline-flex items-center gap-1">
              Open <ArrowRight className="size-3" />
            </span>
          ) : (
            <span className="font-mono text-[10.5px] text-ink-4 truncate max-w-[140px]">{order.id}</span>
          )}
        </div>
      </Link>
    </li>
  );
}
