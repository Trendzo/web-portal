import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowUpRight, Plus, RefreshCw, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const STATUS_OPTIONS: ReadonlyArray<{ value: OrderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'routing', label: 'Routing (needs accept)' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'packed', label: 'Packed' },
  { value: 'picked_up', label: 'Picked up' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'undelivered', label: 'Undelivered' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'closed', label: 'Closed' },
  { value: 'payment_failed', label: 'Payment failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'all', label: 'Any payment method' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cod', label: 'Cash on delivery' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'gift_card', label: 'Gift card' },
] as const;

const DELIVERY_METHOD_OPTIONS = [
  { value: 'all', label: 'Any delivery method' },
  { value: 'express', label: 'Express' },
  { value: 'standard', label: 'Standard' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'try_and_buy', label: 'Try and buy' },
] as const;

const AGE_OPTIONS = [
  { value: 'all', label: 'Any age' },
  { value: '1', label: 'Older than 1h' },
  { value: '6', label: 'Older than 6h' },
  { value: '24', label: 'Older than 24h' },
  { value: '168', label: 'Older than a week' },
] as const;

const PAYMENT_STATE_OPTIONS = [
  { value: 'all', label: 'Any payment state' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
] as const;

const DISPUTE_OPTIONS = [
  { value: 'all', label: 'Any dispute state' },
  { value: 'open', label: 'Open disputes' },
  { value: 'none', label: 'No disputes' },
] as const;

type AdminStoreLite = { id: string; legalName: string };

export default function AdminOrdersList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'timeout' || params.get('tab') === 'cancel-requests'
    ? params.get('tab')!
    : 'all';

  const status = (params.get('status') ?? 'all') as OrderStatus | 'all';
  const storeId = params.get('storeId') ?? 'all';
  const paymentMethod = params.get('paymentMethod') ?? 'all';
  const deliveryMethod = params.get('deliveryMethod') ?? 'all';
  const ageHours = params.get('ageHours') ?? 'all';
  const paymentState = params.get('paymentState') ?? 'all';
  const disputeFlag = params.get('disputeFlag') ?? 'all';
  const [q, setQ] = useState('');

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value === 'all' || value === '') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  const PAGE_SIZE = 50;
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
  const queryString = useMemo(() => {
    const u = new URLSearchParams();
    if (status !== 'all') u.set('status', status);
    if (storeId !== 'all') u.set('storeId', storeId);
    if (paymentMethod !== 'all') u.set('paymentMethod', paymentMethod);
    if (deliveryMethod !== 'all') u.set('deliveryMethod', deliveryMethod);
    if (ageHours !== 'all') u.set('ageHours', ageHours);
    if (paymentState !== 'all') u.set('paymentState', paymentState);
    if (disputeFlag !== 'all') u.set('disputeFlag', disputeFlag);
    u.set('page', String(page));
    u.set('pageSize', String(PAGE_SIZE));
    return u.toString();
  }, [status, storeId, paymentMethod, deliveryMethod, ageHours, paymentState, disputeFlag, page]);

  type ListEnvelope = { rows: OrderListRow[]; total: number; page: number; pageSize: number };
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'orders', queryString],
    queryFn: () => api<ListEnvelope>(`/admin/orders${queryString ? `?${queryString}` : ''}`),
    refetchInterval: 5000,
  });

  function goToPage(p: number) {
    const next = new URLSearchParams(params);
    if (p <= 1) next.delete('page');
    else next.set('page', String(p));
    setParams(next, { replace: true });
  }

  // Store options for the Retailer filter — loaded lazily, cached for the session.
  const storesQ = useQuery({
    queryKey: ['admin', 'stores', 'lite'],
    queryFn: () => api<Array<AdminStoreLite & Record<string, unknown>>>('/admin/stores'),
    staleTime: 5 * 60 * 1000,
  });

  const timeoutCountQ = useQuery({
    queryKey: ['admin', 'orders', 'acceptance-timeout', 'count'],
    queryFn: () => api<TimeoutRow[]>('/admin/orders/acceptance-timeout'),
    refetchInterval: 30_000,
  });
  const cancelReqCountQ = useQuery({
    queryKey: ['admin', 'orders', 'cancellation-requests', 'count'],
    queryFn: () => api<CancellationRequestRow[]>('/admin/orders/cancellation-requests'),
    refetchInterval: 30_000,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = rows.filter((o) => {
    if (!q.trim()) return true;
    const n = q.toLowerCase();
    return (
      o.id.toLowerCase().includes(n) ||
      (o.consumerName ?? '').toLowerCase().includes(n) ||
      (o.storeName ?? '').toLowerCase().includes(n)
    );
  });

  return (
    <Page>
      <PageHeader
        title="Orders"
        description="Every order across all stores. Use the filters to triage. Click any row for the full timeline."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              iconLeft={<RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={() => {
                // Refresh every tab's data in one shot — main list, timeout panel,
                // and cancellation requests share the same React-Query keyspace.
                void qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
              }}
              title="Refresh all tabs"
            >
              Refresh
            </Button>
            <Button asChild variant="accent" iconLeft={<Plus className="size-4" />}>
              <Link to="/admin/orders/new">Place test order</Link>
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setParam('tab', v)}>
        <TabsList>
          <TabsTrigger value="all">All orders</TabsTrigger>
          <TabsTrigger value="timeout" className="gap-1.5">
            Acceptance timeout
            {(timeoutCountQ.data?.length ?? 0) > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-mono text-white">
                {timeoutCountQ.data!.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="cancel-requests" className="gap-1.5">
            Cancellation requests
            {(cancelReqCountQ.data?.length ?? 0) > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-mono text-white">
                {cancelReqCountQ.data!.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeout">
          <AcceptanceTimeoutPanel rows={timeoutCountQ.data ?? []} isLoading={timeoutCountQ.isLoading} />
        </TabsContent>

        <TabsContent value="cancel-requests">
          <CancellationRequestsPanel rows={cancelReqCountQ.data ?? []} isLoading={cancelReqCountQ.isLoading} />
        </TabsContent>

        <TabsContent value="all">
          <div className="mb-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex max-w-md flex-1 items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
                  <Input
                    placeholder="Search id, customer, or store…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="!pl-9"
                  />
                </div>
              </div>
              <span className="hidden sm:inline text-[12px] text-ink-3">
                {total === 0 ? '0 orders' : (
                  <>
                    Showing{' '}
                    <span className="font-mono text-ink">
                      {(page - 1) * PAGE_SIZE + 1}–{Math.min(total, (page - 1) * PAGE_SIZE + rows.length)}
                    </span>{' '}
                    of <span className="font-mono text-ink">{total}</span>
                  </>
                )}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                value={status}
                onChange={(v) => setParam('status', v)}
                options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                width="w-52"
              />
              <FilterSelect
                value={storeId}
                onChange={(v) => setParam('storeId', v)}
                options={[
                  { value: 'all', label: 'Any retailer' },
                  ...(storesQ.data ?? []).map((s) => ({ value: s.id, label: s.legalName })),
                ]}
                width="w-48"
              />
              <FilterSelect
                value={paymentMethod}
                onChange={(v) => setParam('paymentMethod', v)}
                options={PAYMENT_METHOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                width="w-44"
              />
              <FilterSelect
                value={deliveryMethod}
                onChange={(v) => setParam('deliveryMethod', v)}
                options={DELIVERY_METHOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                width="w-44"
              />
              <FilterSelect
                value={ageHours}
                onChange={(v) => setParam('ageHours', v)}
                options={AGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                width="w-40"
              />
              <FilterSelect
                value={paymentState}
                onChange={(v) => setParam('paymentState', v)}
                options={PAYMENT_STATE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                width="w-40"
              />
              <FilterSelect
                value={disputeFlag}
                onChange={(v) => setParam('disputeFlag', v)}
                options={DISPUTE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                width="w-40"
              />
              {queryString && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = new URLSearchParams();
                    if (params.get('tab')) next.set('tab', params.get('tab')!);
                    setParams(next, { replace: true });
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : isError ? (
            <Empty
              kicker="Connection lost"
              title="Couldn't load orders"
              action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
            />
          ) : filtered.length === 0 ? (
            <Empty
              kicker={q || queryString ? 'No matches' : 'No orders yet'}
              title={q || queryString ? 'No orders match these filters.' : 'No orders have been placed.'}
              description="Use the test-order button to walk an order through the lifecycle."
              action={
                <Button asChild variant="accent" iconLeft={<Plus className="size-4" />}>
                  <Link to="/admin/orders/new">Place test order</Link>
                </Button>
              }
            />
          ) : (
            <div className="rounded-lg border border-line bg-bg overflow-hidden">
              <table className="hidden md:table w-full text-[13px]">
                <thead className="bg-bg-2 border-b border-line">
                  <tr>
                    <Th>Order</Th>
                    <Th>Status</Th>
                    <Th>Store</Th>
                    <Th>Customer</Th>
                    <Th>Method</Th>
                    <Th className="text-right">Total</Th>
                    <Th>Placed</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((o) => {
                    const meta = orderStatusMeta(o.status);
                    return (
                      <tr
                        key={o.id}
                        onClick={() => navigate(`/admin/orders/${o.id}`)}
                        className="cursor-pointer hover:bg-bg-2/50 transition-colors"
                      >
                        <Td>
                          <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                            <CopyableId value={o.id} label="order id" />
                            {o.hasOpenDispute && (
                              <Badge tone="danger" className="w-fit">
                                <AlertTriangle className="size-3" /> Dispute
                              </Badge>
                            )}
                          </div>
                        </Td>
                        <Td>
                          <Badge tone={meta.tone} pulse={meta.pulse}>{meta.label}</Badge>
                        </Td>
                        <Td className="text-ink-2 truncate max-w-[160px]">{o.storeName ?? '—'}</Td>
                        <Td>
                          <div className="text-ink-2 truncate max-w-[160px]">{o.consumerName}</div>
                          {o.consumerPhone && (
                            <div className="text-[11.5px] text-ink-3 mt-0.5">{o.consumerPhone}</div>
                          )}
                        </Td>
                        <Td>
                          <div className="text-[12.5px] text-ink-2">{deliveryMethodLabel(o.deliveryMethod)}</div>
                          <div className="text-[11.5px] text-ink-3 mt-0.5">{paymentMethodLabel(o.paymentMethod)}</div>
                        </Td>
                        <Td className="text-right">
                          <div className="font-mono text-[13.5px] text-ink tabular-nums">
                            {formatPaise(o.grandTotalPaise)}
                          </div>
                          <div className="text-[11px] text-ink-3 mt-0.5">{o.itemCount} item{o.itemCount === 1 ? '' : 's'}</div>
                        </Td>
                        <Td className="text-[12px] text-ink-3">{formatAge(o.placedAt)}</Td>
                        <Td className="text-right">
                          <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                            <Link to={`/admin/orders/${o.id}`}>Open</Link>
                          </Button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <ul className="md:hidden divide-y divide-line">
                {filtered.map((o) => {
                  const meta = orderStatusMeta(o.status);
                  return (
                    <li key={o.id}>
                      <Link to={`/admin/orders/${o.id}`} className="block p-4 space-y-2 hover:bg-bg-2/50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-ink truncate">{o.consumerName}</div>
                            <div className="text-[11.5px] text-ink-3 truncate font-mono mt-0.5">{o.id}</div>
                          </div>
                          <Badge tone={meta.tone} pulse={meta.pulse}>{meta.kicker}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-[12.5px]">
                          <span className="text-ink-3 truncate max-w-[60%]">{o.storeName ?? '—'}</span>
                          <span className="font-mono tabular-nums text-ink">{formatPaise(o.grandTotalPaise)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11.5px] text-ink-3">
                          <span>{deliveryMethodLabel(o.deliveryMethod)} · {paymentMethodLabel(o.paymentMethod)}</span>
                          <span>{formatAge(o.placedAt)}</span>
                        </div>
                        {o.hasOpenDispute && (
                          <Badge tone="danger" className="w-fit">
                            <AlertTriangle className="size-3" /> Open dispute
                          </Badge>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between gap-3 text-[12.5px] text-ink-3">
              <div>
                Page <span className="font-mono text-ink">{page}</span>
                <span className="text-ink-4">/</span>
                <span className="font-mono text-ink">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  Prev
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Page>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  width,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  width?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={width}><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type TimeoutRow = {
  orderId: string;
  storeId: string;
  storeName: string;
  consumerName: string;
  consumerPhone: string | null;
  currentStatus: OrderStatus;
  grandTotalPaise: number;
  placedAt: string;
  attempts: number;
  maxAttempts: number;
  remainingAttempts: number;
  deadlineAt: string;
};

function AcceptanceTimeoutPanel({ rows, isLoading }: { rows: TimeoutRow[]; isLoading: boolean }) {
  const qc = useQueryClient();
  // §8 story 11 — the platform doesn't support cross-retailer routing (each
  // retailer's listing is a distinct DB record). "Extending the window" just
  // resets the acceptance clock against the same store and burns one of the
  // retailer's remaining attempts. After max attempts the order auto-cancels
  // with refund.
  const extend = useMutation({
    mutationFn: (orderId: string) =>
      api(`/admin/orders/${orderId}/reroute`, { method: 'POST', body: { reason: 'timeout' } }),
    onSuccess: () => {
      toast.success('Acceptance window extended');
      void qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Extend failed'),
  });

  if (isLoading) return <Skeleton className="h-32" />;
  if (rows.length === 0) {
    return <Empty kicker="All clear" title="No orders are stuck in acceptance timeout." />;
  }
  return (
    <div className="rounded-lg border border-line bg-bg overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-bg-2 border-b border-line">
          <tr>
            <Th>Order</Th>
            <Th>Originating store</Th>
            <Th>Customer</Th>
            <Th className="text-right">Attempts</Th>
            <Th>Deadline</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const lastTry = r.remainingAttempts <= 1;
            const exhausted = r.remainingAttempts <= 0;
            const attemptTone = exhausted ? 'danger' : lastTry ? 'danger' : 'warning';
            return (
              <tr key={r.orderId} className="hover:bg-bg-2/50 transition-colors">
                <Td><CopyableId value={r.orderId} label="order id" /></Td>
                <Td className="text-ink-2">{r.storeName}</Td>
                <Td className="text-ink-2">{r.consumerName}</Td>
                <Td className="text-right">
                  <div className="inline-flex flex-col items-end gap-1">
                    <Badge tone={attemptTone} pulse={exhausted}>
                      Attempt {r.attempts} of {r.maxAttempts}
                    </Badge>
                    <span className={`text-[11px] font-mono ${exhausted ? 'text-danger' : lastTry ? 'text-warning' : 'text-ink-3'}`}>
                      {exhausted ? 'no tries left' : `${r.remainingAttempts} ${r.remainingAttempts === 1 ? 'try' : 'tries'} left`}
                    </span>
                  </div>
                </Td>
                <Td className="text-[12px] text-ink-3">expired {formatAge(r.deadlineAt)}</Td>
                <Td className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exhausted}
                    title={
                      exhausted
                        ? 'No tries left. Sweeper will auto-cancel; cancel manually for an explicit reason.'
                        : 'Resets the acceptance clock against the same store and burns one attempt.'
                    }
                    loading={extend.isPending && extend.variables === r.orderId}
                    onClick={() => extend.mutate(r.orderId)}
                  >
                    Extend window
                  </Button>
                  <Button asChild variant="ghost" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                    <Link to={`/admin/orders/${r.orderId}`}>Open</Link>
                  </Button>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type CancellationRequestRow = {
  transitionId: string;
  orderId: string;
  storeId: string;
  storeName: string;
  consumerName: string;
  consumerPhone: string | null;
  currentStatus: OrderStatus;
  grandTotalPaise: number;
  placedAt: string;
  requestedReason: string | null;
  requestedAt: string;
  retailerActorId: string;
};

function CancellationRequestsPanel({
  rows,
  isLoading,
}: {
  rows: CancellationRequestRow[];
  isLoading: boolean;
}) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState<null | {
    kind: 'approve' | 'dismiss';
    row: CancellationRequestRow;
  }>(null);
  const [note, setNote] = useState('');

  const approve = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      api(`/admin/orders/${orderId}/cancel`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      toast.success('Order cancelled');
      void qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      setDecision(null);
      setNote('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Cancel failed'),
  });

  const dismiss = useMutation({
    mutationFn: ({ orderId, note }: { orderId: string; note: string }) =>
      api(`/admin/orders/${orderId}/cancel-request/dismiss`, {
        method: 'POST',
        body: note ? { note } : {},
      }),
    onSuccess: () => {
      toast.success('Request dismissed');
      void qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      setDecision(null);
      setNote('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Dismiss failed'),
  });

  if (isLoading) return <Skeleton className="h-32" />;
  if (rows.length === 0) {
    return <Empty kicker="All clear" title="No pending cancellation requests." />;
  }

  return (
    <>
      <div className="rounded-lg border border-line bg-bg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-bg-2 border-b border-line">
            <tr>
              <Th>Order</Th>
              <Th>Store</Th>
              <Th>Customer</Th>
              <Th>Retailer's reason</Th>
              <Th>Requested</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const meta = orderStatusMeta(r.currentStatus);
              return (
                <tr key={r.transitionId} className="hover:bg-bg-2/50 transition-colors">
                  <Td><CopyableId value={r.orderId} label="order id" /></Td>
                  <Td className="text-ink-2 truncate max-w-[160px]">{r.storeName}</Td>
                  <Td className="text-ink-2 truncate max-w-[160px]">{r.consumerName}</Td>
                  <Td className="text-ink-2 max-w-[260px] whitespace-normal text-[12.5px]">
                    {r.requestedReason ?? <span className="text-ink-3 italic">no reason given</span>}
                  </Td>
                  <Td className="text-[12px] text-ink-3">{formatAge(r.requestedAt)}</Td>
                  <Td><Badge tone={meta.tone}>{meta.label}</Badge></Td>
                  <Td className="text-right space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNote(r.requestedReason ?? '');
                        setDecision({ kind: 'approve', row: r });
                      }}
                    >
                      Approve & cancel
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNote('');
                        setDecision({ kind: 'dismiss', row: r });
                      }}
                    >
                      Dismiss
                    </Button>
                    <Button asChild variant="ghost" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                      <Link to={`/admin/orders/${r.orderId}`}>Open</Link>
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {decision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4">
          <div className="w-full max-w-md rounded-lg border border-line bg-bg p-5 shadow-lg">
            <h3 className="text-[15px] font-semibold text-ink">
              {decision.kind === 'approve' ? 'Approve cancellation' : 'Dismiss request'}
            </h3>
            <p className="mt-1 text-[12.5px] text-ink-3">
              {decision.kind === 'approve'
                ? 'Cancels the order and triggers refund to the original tender. Reason is recorded against the order.'
                : 'Records that the retailer\'s request was declined. The order stays in its current state.'}
            </p>
            <div className="mt-3">
              <label className="text-[11.5px] uppercase tracking-wide text-ink-3" htmlFor="note">
                {decision.kind === 'approve' ? 'Reason' : 'Note (optional)'}
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-[13px] text-ink"
                placeholder={decision.kind === 'approve' ? 'e.g. Retailer stockout confirmed' : 'Why are we declining?'}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setDecision(null); setNote(''); }}>
                Close
              </Button>
              {decision.kind === 'approve' ? (
                <Button
                  variant="accent"
                  loading={approve.isPending}
                  disabled={note.trim().length < 3}
                  onClick={() => approve.mutate({ orderId: decision.row.orderId, reason: note.trim() })}
                >
                  Approve & cancel
                </Button>
              ) : (
                <Button
                  variant="outline"
                  loading={dismiss.isPending}
                  onClick={() => dismiss.mutate({ orderId: decision.row.orderId, note: note.trim() })}
                >
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-3 ${className ?? ''}`}>
      {children}
    </th>
  );
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ''}`}>{children}</td>;
}
