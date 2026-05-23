import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { api } from '@/lib/api';
import {
  deliveryMethodMeta,
  formatAge,
  formatPaise,
  orderStatusMeta,
  paymentMethodLabel,
} from '@/lib/status';
import { Package, Shirt, Store, Truck, Zap } from 'lucide-react';
import type { DeliveryMethod } from '@/lib/types';

const METHOD_ICON: Record<DeliveryMethod, typeof Package> = {
  express: Zap,
  standard: Truck,
  pickup: Store,
  try_and_buy: Shirt,
};
import type { OrderListRow, OrderStatus } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { AcceptanceCountdown } from '@/components/retailer/acceptance-countdown';
import { playNewOrderChime, unlockAudio } from '@/lib/audio-alert';
import { cn } from '@/lib/cn';

const AUDIO_PREF_KEY = 'retailer.orders.audioAlerts';

function readAudioPref(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = window.localStorage.getItem(AUDIO_PREF_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

function writeAudioPref(on: boolean) {
  try {
    window.localStorage.setItem(AUDIO_PREF_KEY, on ? '1' : '0');
  } catch {
    /* localStorage blocked — preference doesn't persist, fine */
  }
}

// Doc-aligned 8-bucket tab strip per §8 plan. `needs-action` pulse stays via
// orderStatusMeta.pulse on each row Badge — we no longer need a dedicated
// "needs action" tab because pending/accepted/packed/at_door already surface
// it visually.
type Tab =
  | 'pending'
  | 'accepted'
  | 'packed'
  | 'picked_up'
  | 'in_delivery'
  | 'at_door'
  | 'delivered_today'
  | 'cancelled_today';

const TAB_STATUSES: Record<Tab, OrderStatus[]> = {
  pending: ['routing'],
  accepted: ['accepted'],
  packed: ['packed'],
  picked_up: ['picked_up'],
  in_delivery: ['out_for_delivery', 'undelivered', 'returning_to_store'],
  at_door: ['at_door', 'returned_to_store'],
  delivered_today: ['delivered'],
  cancelled_today: ['cancelled', 'payment_failed'],
};

const TAB_LABEL: Record<Tab, string> = {
  pending: 'Pending acceptance',
  accepted: 'Accepted',
  packed: 'Packed',
  picked_up: 'Picked up',
  in_delivery: 'In delivery',
  at_door: 'At door / verify',
  delivered_today: 'Delivered today',
  cancelled_today: 'Cancelled today',
};

const TABS: Tab[] = [
  'pending',
  'accepted',
  'packed',
  'picked_up',
  'in_delivery',
  'at_door',
  'delivered_today',
  'cancelled_today',
];

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function inTodayBucket(tab: Tab, o: OrderListRow): boolean {
  const today = startOfToday();
  if (tab === 'delivered_today') {
    return o.deliveredAt ? new Date(o.deliveredAt).getTime() >= today : false;
  }
  if (tab === 'cancelled_today') {
    return new Date(o.placedAt).getTime() >= today;
  }
  return true;
}

export default function RetailerOrdersList() {
  const [tab, setTab] = useState<Tab>('pending');
  const [audioOn, setAudioOn] = useState<boolean>(() => readAudioPref());
  const prevPendingIdsRef = useRef<Set<string> | null>(null);
  const titleBaseRef = useRef<string>(typeof document !== 'undefined' ? document.title : 'Orders');
  const newSinceFocusRef = useRef<number>(0);

  useEffect(() => {
    unlockAudio();
  }, []);

  useEffect(() => {
    function clearTitleBadge() {
      newSinceFocusRef.current = 0;
      if (typeof document !== 'undefined') document.title = titleBaseRef.current;
    }
    function onVisible() {
      if (!document.hidden) clearTitleBadge();
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', clearTitleBadge);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', clearTitleBadge);
      document.title = titleBaseRef.current;
    };
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['retailer', 'orders', 'all'],
    queryFn: () => api<OrderListRow[]>('/retailer/orders'),
    refetchInterval: 5000,
  });

  const all = data ?? [];

  // §8 story 1 — diff the pending set across poll cycles. New IDs trigger an
  // audible chime (if pref allows), a toast (cap 3 per cycle so a flood doesn't
  // bury the screen), and a tab-title badge when the tab is hidden.
  useEffect(() => {
    if (!data) return;
    const pendingIds = new Set(
      data.filter((o) => TAB_STATUSES.pending.includes(o.status)).map((o) => o.id),
    );
    const prev = prevPendingIdsRef.current;
    if (prev === null) {
      // First successful poll — seed the baseline. Avoids firing for every
      // pre-existing pending order on initial mount.
      prevPendingIdsRef.current = pendingIds;
      return;
    }
    const newIds: string[] = [];
    for (const id of pendingIds) {
      if (!prev.has(id)) newIds.push(id);
    }
    if (newIds.length > 0) {
      const fresh = data.filter((o) => newIds.includes(o.id));
      if (audioOn) playNewOrderChime();
      fresh.slice(0, 3).forEach((o) => {
        toast.info(`New order · ${o.itemCount} item${o.itemCount === 1 ? '' : 's'} · ${formatPaise(o.grandTotalPaise)}`);
      });
      if (typeof document !== 'undefined' && document.hidden) {
        newSinceFocusRef.current += newIds.length;
        document.title = `(${newSinceFocusRef.current}) ${titleBaseRef.current}`;
      }
    }
    prevPendingIdsRef.current = pendingIds;
  }, [data, audioOn]);

  const counts = useMemo(() => {
    const map = Object.fromEntries(TABS.map((t) => [t, 0])) as Record<Tab, number>;
    for (const o of all) {
      for (const t of TABS) {
        if (TAB_STATUSES[t].includes(o.status) && inTodayBucket(t, o)) {
          map[t] += 1;
          break;
        }
      }
    }
    return map;
  }, [all]);

  const filtered = all.filter((o) => TAB_STATUSES[tab].includes(o.status) && inTodayBucket(tab, o));

  return (
    <Page>
      <PageHeader
        title="Orders"
        description="Walk every order through the lifecycle — accept, pack, hand to delivery, then mark delivered."
        actions={
          <Button
            variant="outline"
            size="sm"
            iconLeft={audioOn ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            onClick={() => {
              const next = !audioOn;
              setAudioOn(next);
              writeAudioPref(next);
              toast.success(next ? 'Order alerts unmuted' : 'Order alerts muted');
            }}
            title={audioOn ? 'Mute alert chime on new orders' : 'Unmute alert chime on new orders'}
          >
            {audioOn ? 'Alerts on' : 'Alerts muted'}
          </Button>
        }
      />

      <div className="mb-4 flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {TABS.map((t) => {
          const active = tab === t;
          const meta = orderStatusMeta(TAB_STATUSES[t][0]!);
          const pulse = meta.pulse && counts[t] > 0;
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
              {pulse && <span className="size-1.5 rounded-full bg-current pulse-dot" aria-hidden />}
              {TAB_LABEL[t]}
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
          kicker={tab === 'pending' ? 'All clear' : 'Nothing here'}
          title={
            tab === 'pending'
              ? 'No orders need acceptance right now.'
              : 'No orders in this view.'
          }
          description={
            tab === 'pending'
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-ink truncate">{order.consumerName}</span>
              {/* §9 — method chip leads the row so staff can scan pickup vs try-and-buy vs standard at a glance. */}
              <MethodChip method={order.deliveryMethod} />
            </div>
            {order.consumerPhone && (
              <div className="text-[11.5px] text-ink-3 truncate mt-0.5">{order.consumerPhone}</div>
            )}
          </div>
          <Badge tone={meta.tone} pulse={meta.pulse}>{meta.label}</Badge>
        </div>

        <div className="flex items-center justify-between text-[12.5px] mt-2">
          <div className="text-ink-3">
            {order.itemCount} item{order.itemCount === 1 ? '' : 's'} · {paymentMethodLabel(order.paymentMethod)}
          </div>
          <div className="font-mono tabular-nums text-ink">{formatPaise(order.grandTotalPaise)}</div>
        </div>

        <div className="flex items-center justify-between mt-2 text-[11.5px] text-ink-3">
          <span className="inline-flex items-center gap-2">
            placed {formatAge(order.placedAt)}
            {(order.status === 'pending' || order.status === 'routing') && order.acceptanceDeadlineAt && (
              <>
                <span className="text-ink-4">·</span>
                <AcceptanceCountdown deadlineAt={order.acceptanceDeadlineAt} variant="inline" />
              </>
            )}
            {/* §9 — try-on countdown on every active door visit row. */}
            {order.status === 'at_door' && order.doorWindowExpiresAt && (
              <>
                <span className="text-ink-4">·</span>
                <span className="text-ink-3">try-on</span>
                <AcceptanceCountdown
                  deadlineAt={order.doorWindowExpiresAt}
                  variant="inline"
                  label="Try-on window"
                />
              </>
            )}
          </span>
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

function MethodChip({ method }: { method: DeliveryMethod }) {
  const m = deliveryMethodMeta(method);
  const Icon = METHOD_ICON[method] ?? Package;
  const toneCls =
    m.tone === 'success' ? 'border-success/30 bg-success-soft text-success-strong'
    : m.tone === 'info' ? 'border-info/30 bg-info-soft text-info'
    : m.tone === 'warning' ? 'border-warning/30 bg-warning-soft text-warning'
    : 'border-line bg-bg-2 text-ink-2';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
        toneCls,
      )}
      title={m.label}
    >
      <Icon className="size-3" />
      {m.short}
    </span>
  );
}
