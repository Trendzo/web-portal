import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BulkActionBar } from '@/components/admin/bulk-action-bar';
import { useBulkSelect } from '@/hooks/useBulkSelect';

interface OrderRow {
  id: string;
  status: string;
  placedAt: string;
  grandTotalPaise: number;
  consumerId: string;
}

export default function AdminStoreOrders() {
  const { id: retailerId, storeId } = useParams<{ id: string; storeId: string }>();
  const qc = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState<OrderRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'store-orders', storeId],
    queryFn: () => api<OrderRow[]>(`/admin/stores/${storeId}/orders`),
    enabled: Boolean(storeId),
  });
  const rows = data ?? [];
  const bulk = useBulkSelect(rows);

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['admin', 'store-orders', storeId] });
  }

  const transition = useMutation({
    mutationFn: ({ orderId, verb, body }: { orderId: string; verb: string; body?: Record<string, unknown> }) =>
      api(`/admin/stores/${storeId}/orders/${orderId}/${verb}`, {
        method: 'POST',
        body: body ?? {},
      }),
    onSuccess: (_d, vars) => {
      toast.success(`Order ${vars.verb}`);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Transition failed'),
  });

  const bulkAccept = useMutation({
    mutationFn: () =>
      api<{ accepted: number; skipped: string[] }>(`/admin/stores/${storeId}/orders/bulk-accept`, {
        method: 'POST',
        body: { orderIds: bulk.selectedIds },
      }),
    onSuccess: (r) => {
      toast.success(`Accepted ${r.accepted} (${r.skipped.length} skipped)`);
      bulk.clear();
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Bulk accept failed'),
  });

  const bulkPack = useMutation({
    mutationFn: () =>
      api<{ packed: number; skipped: string[] }>(`/admin/stores/${storeId}/orders/bulk-pack`, {
        method: 'POST',
        body: { orderIds: bulk.selectedIds },
      }),
    onSuccess: (r) => {
      toast.success(`Packed ${r.packed} (${r.skipped.length} skipped)`);
      bulk.clear();
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Bulk pack failed'),
  });

  return (
    <Page>
      <PageHeader
        kicker="Store"
        title="Orders"
        description="Order pipeline for this store. Per-row actions move the order through state. Select rows for bulk accept/pack."
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to={`/admin/retailers/${retailerId}/stores/${storeId}`}>Back</Link>
          </Button>
        }
      />

      <div className="mb-3 flex items-center gap-3 text-[12.5px] text-ink-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={bulk.isAllSelected} onChange={bulk.toggleAll} className="accent-accent" />
          Select all
        </label>
        <span>{rows.length} orders</span>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6"><p className="text-[13px] text-ink-3 italic">No orders yet.</p></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-2/40 border-b border-line">
                <tr>
                  <Th className="w-10"></Th>
                  <Th>Order</Th>
                  <Th>Placed</Th>
                  <Th>Status</Th>
                  <Th>Consumer</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((o) => (
                  <tr key={o.id} className={bulk.isSelected(o.id) ? 'bg-bg-2/40' : undefined}>
                    <Td>
                      <input type="checkbox" className="accent-accent" checked={bulk.isSelected(o.id)} onChange={() => bulk.toggle(o.id)} />
                    </Td>
                    <Td className="font-mono text-[12px]">{o.id}</Td>
                    <Td>{new Date(o.placedAt).toLocaleString('en-IN')}</Td>
                    <Td><Badge tone="info">{o.status}</Badge></Td>
                    <Td className="font-mono text-[12px]">{o.consumerId}</Td>
                    <Td className="text-right font-mono">₹{(o.grandTotalPaise / 100).toFixed(2)}</Td>
                    <Td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <RowActionsMenu
                          status={o.status}
                          onAct={(verb) => transition.mutate({ orderId: o.id, verb })}
                          onRequestCancel={() => setCancelTarget(o)}
                        />
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/admin/orders/${o.id}`}>Open</Link>
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClear={bulk.clear}
        actions={[
          { label: 'Accept', onClick: () => bulkAccept.mutate(), loading: bulkAccept.isPending },
          { label: 'Pack', onClick: () => bulkPack.mutate(), loading: bulkPack.isPending },
        ]}
      />

      <CancelRequestDialog
        target={cancelTarget}
        storeId={storeId ?? ''}
        onClose={() => setCancelTarget(null)}
        onRequested={() => {
          setCancelTarget(null);
          invalidate();
        }}
      />
    </Page>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-3 ${className ?? ''}`}>{children}</th>;
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ''}`}>{children}</td>;
}

function RowActionsMenu({
  status,
  onAct,
  onRequestCancel,
}: {
  status: string;
  onAct: (verb: string) => void;
  onRequestCancel: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {(status === 'pending' || status === 'routing') && (
          <DropdownMenuItem onClick={() => onAct('accept')}>Accept</DropdownMenuItem>
        )}
        {status === 'accepted' && <DropdownMenuItem onClick={() => onAct('pack')}>Pack</DropdownMenuItem>}
        {status === 'packed' && (
          <>
            <DropdownMenuItem onClick={() => onAct('handover')}>Handover to courier</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAct('mark-delivered')}>Mark delivered (pickup)</DropdownMenuItem>
          </>
        )}
        {status === 'picked_up' && <DropdownMenuItem onClick={() => onAct('depart')}>Depart for delivery</DropdownMenuItem>}
        {status === 'out_for_delivery' && (
          <>
            <DropdownMenuItem onClick={() => onAct('mark-delivered')}>Mark delivered</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAct('mark-undelivered')}>Mark undelivered</DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onClick={onRequestCancel} className="text-danger">
          Cancel order…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CancelRequestDialog({
  target,
  storeId,
  onClose,
  onRequested,
}: {
  target: OrderRow | null;
  storeId: string;
  onClose: () => void;
  onRequested: () => void;
}) {
  const [reason, setReason] = useState('');
  const send = useMutation({
    mutationFn: () =>
      api(`/admin/stores/${storeId}/orders/${target?.id}/request-cancel`, {
        method: 'POST',
        body: { reason: reason.trim() },
      }),
    onSuccess: () => {
      toast.success('Cancellation requested');
      setReason('');
      onRequested();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Request failed'),
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o) { setReason(''); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request cancellation</DialogTitle>
          <DialogDescription>
            Marker only — order is not auto-cancelled. Admin must approve via the orders queue.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="reason" required>Reason</Label>
          <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setReason(''); onClose(); }}>Cancel</Button>
          <Button variant="ink" disabled={reason.trim().length < 3} loading={send.isPending} onClick={() => send.mutate()}>
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
