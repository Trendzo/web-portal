import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Plus, Search } from 'lucide-react';
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

export default function AdminOrdersList() {
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [q, setQ] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'orders', status],
    queryFn: () => {
      const qs = status === 'all' ? '' : `?status=${status}`;
      return api<OrderListRow[]>(`/admin/orders${qs}`);
    },
    refetchInterval: 5000,
  });

  const filtered = (data ?? []).filter((o) => {
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
        description="Every order across all stores. Use the status filter to triage. Click any row for the full timeline."
        actions={
          <Button asChild variant="accent" iconLeft={<Plus className="size-4" />}>
            <Link to="/admin/orders/new">Place test order</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus | 'all')}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="hidden sm:inline text-[12px] text-ink-3">
            {filtered.length} {filtered.length === 1 ? 'order' : 'orders'}
          </span>
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
          kicker={q || status !== 'all' ? 'No matches' : 'No orders yet'}
          title={
            q || status !== 'all'
              ? 'No orders match these filters.'
              : 'No orders have been placed.'
          }
          description="Use the test-order button to walk an order through the lifecycle."
          action={
            <Button asChild variant="accent" iconLeft={<Plus className="size-4" />}>
              <Link to="/admin/orders/new">Place test order</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-line bg-bg overflow-hidden">
          {/* Desktop table */}
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
                  <tr key={o.id} className="hover:bg-bg-2/50 transition-colors">
                    <Td>
                      <CopyableId value={o.id} label="order id" />
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

          {/* Mobile cards */}
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
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Page>
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
