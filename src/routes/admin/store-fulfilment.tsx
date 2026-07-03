import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useStoreRetailerId } from '@/hooks/useStoreRetailerId';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BulkActionBar } from '@/components/admin/bulk-action-bar';
import { useBulkSelect } from '@/hooks/useBulkSelect';

/**
 * Fulfilment hub — the former standalone Orders / Returns / Held-items operator
 * pages merged behind one entry, with URL-synced sub-tabs (`?tab=`). One place
 * for the whole post-checkout order lifecycle instead of three sibling routes.
 */
const TAB_KEYS = ['orders', 'returns', 'held'] as const;
type TabKey = (typeof TAB_KEYS)[number];
function parseTab(v: string | null): TabKey {
  return TAB_KEYS.includes(v as TabKey) ? (v as TabKey) : 'orders';
}

export default function AdminStoreFulfilment() {
  const { storeId } = useParams<{ storeId: string }>();
  const retailerId = useStoreRetailerId(storeId);
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = parseTab(searchParams.get('tab'));
  function setActiveTab(v: string) {
    const next = parseTab(v);
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (next === 'orders') sp.delete('tab');
        else sp.set('tab', next);
        return sp;
      },
      { replace: true },
    );
  }

  return (
    <Page>
      <PageHeader
        kicker="Store"
        title="Fulfilment"
        description="Orders, returns, and held items for this store — the full post-checkout lifecycle in one place."
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to={`/admin/retailers/${retailerId}/stores/${storeId}`}>Back</Link>
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="held">Held items</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <OrdersPanel storeId={storeId ?? ''} />
        </TabsContent>
        <TabsContent value="returns">
          <ReturnsPanel storeId={storeId ?? ''} />
        </TabsContent>
        <TabsContent value="held">
          <HeldPanel storeId={storeId ?? ''} />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

interface OrderRow {
  id: string;
  status: string;
  placedAt: string;
  grandTotalPaise: number;
  consumerId: string;
}

function OrdersPanel({ storeId }: { storeId: string }) {
  const navigate = useNavigate();
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
    <>
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
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/admin/orders/${o.id}`)}
                    className={`cursor-pointer transition-colors hover:bg-bg-2/40 ${bulk.isSelected(o.id) ? 'bg-bg-2/40' : ''}`}
                  >
                    <Td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="accent-accent" checked={bulk.isSelected(o.id)} onChange={() => bulk.toggle(o.id)} />
                    </Td>
                    <Td className="font-mono text-[12px]">{o.id}</Td>
                    <Td>{new Date(o.placedAt).toLocaleString('en-IN')}</Td>
                    <Td><Badge tone="info">{o.status}</Badge></Td>
                    <Td className="font-mono text-[12px]">{o.consumerId}</Td>
                    <Td className="text-right font-mono">₹{(o.grandTotalPaise / 100).toFixed(2)}</Td>
                    <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu
                        status={o.status}
                        onAct={(verb) => transition.mutate({ orderId: o.id, verb })}
                        onRequestCancel={() => setCancelTarget(o)}
                      />
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
        storeId={storeId}
        onClose={() => setCancelTarget(null)}
        onRequested={() => {
          setCancelTarget(null);
          invalidate();
        }}
      />
    </>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-3 ${className ?? ''}`}>{children}</th>;
}
function Td({ children, className, onClick }: { children?: React.ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void }) {
  return <td className={`px-4 py-3 align-top ${className ?? ''}`} onClick={onClick}>{children}</td>;
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

/* ------------------------------------------------------------------ */
/* Returns                                                             */
/* ------------------------------------------------------------------ */

interface ReturnRow {
  id: string;
  storeDecision: 'pending' | 'accepted' | 'rejected';
  openedAt: string;
  reasonText: string | null;
  orderItem: {
    id: string;
    order: { id: string };
  };
}

function ReturnsPanel({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'store-returns', storeId, decision],
    queryFn: () =>
      api<ReturnRow[]>(
        `/admin/stores/${storeId}/returns${decision === 'all' ? '' : `?decision=${decision}`}`,
      ),
    enabled: Boolean(storeId),
  });
  const rows = data ?? [];

  const verify = useMutation({
    mutationFn: ({ returnId, dec }: { returnId: string; dec: 'accepted' | 'rejected' }) =>
      api(`/admin/stores/${storeId}/returns/${returnId}/verify`, {
        method: 'POST',
        body: { decision: dec },
      }),
    onSuccess: (_d, vars) => {
      toast.success(`Return ${vars.dec}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'store-returns', storeId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Verify failed'),
  });

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <Select value={decision} onValueChange={(v) => setDecision(v as typeof decision)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All decisions</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[12px] text-ink-3">{rows.length} returns</span>
      </div>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6"><p className="text-[13px] text-ink-3 italic">No returns.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-ink">{r.id}</span>
                    <Badge
                      tone={r.storeDecision === 'accepted' ? 'success' : r.storeDecision === 'rejected' ? 'danger' : 'warning'}
                    >
                      {r.storeDecision}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[12px] text-ink-3">
                    Order <span className="font-mono">{r.orderItem.order.id}</span> · opened{' '}
                    {new Date(r.openedAt).toLocaleString('en-IN')}
                  </div>
                  {r.reasonText && (
                    <div className="mt-1 text-[12px] text-ink-2">Reason: {r.reasonText}</div>
                  )}
                </div>
                {r.storeDecision === 'pending' && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-danger border-danger/40"
                      onClick={() => verify.mutate({ returnId: r.id, dec: 'rejected' })}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="ink"
                      size="sm"
                      onClick={() => verify.mutate({ returnId: r.id, dec: 'accepted' })}
                    >
                      Accept
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Held items                                                          */
/* ------------------------------------------------------------------ */

interface HeldRow {
  id: string;
  status: 'holding' | 'expired' | 'resolved';
  holdingWindowExpiresAt: string;
}

function HeldPanel({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [dispose, setDispose] = useState<HeldRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'store-held-items', storeId],
    queryFn: () => api<HeldRow[]>(`/admin/stores/${storeId}/held-items`),
    enabled: Boolean(storeId),
  });
  const rows = data ?? [];

  const act = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: 'collect-at-counter' | 'redeliver' }) =>
      api(`/admin/stores/${storeId}/held-items/${id}/${verb}`, { method: 'POST', body: {} }),
    onSuccess: (_d, vars) => {
      toast.success(`Held item ${vars.verb}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'store-held-items', storeId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
  });

  return (
    <>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6"><p className="text-[13px] text-ink-3 italic">No held items.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-ink">{r.id}</span>
                    <Badge tone={r.status === 'holding' ? 'warning' : r.status === 'expired' ? 'danger' : 'success'}>
                      {r.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[12px] text-ink-3">
                    Holding window expires {new Date(r.holdingWindowExpiresAt).toLocaleString('en-IN')}
                  </div>
                </div>
                {r.status === 'holding' && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => act.mutate({ id: r.id, verb: 'collect-at-counter' })}>
                      Collected
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => act.mutate({ id: r.id, verb: 'redeliver' })}>
                      Redeliver
                    </Button>
                    <Button variant="outline" size="sm" className="text-danger border-danger/40" onClick={() => setDispose(r)}>
                      Force dispose
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <DisposeDialog
        target={dispose}
        storeId={storeId}
        onClose={() => setDispose(null)}
        onDone={() => {
          setDispose(null);
          void qc.invalidateQueries({ queryKey: ['admin', 'store-held-items', storeId] });
        }}
      />
    </>
  );
}

function DisposeDialog({
  target,
  storeId,
  onClose,
  onDone,
}: {
  target: HeldRow | null;
  storeId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [disposition, setDisposition] = useState<'restocked' | 'forfeited_to_store' | 'written_off'>('restocked');
  const [note, setNote] = useState('');
  const submit = useMutation({
    mutationFn: () =>
      api(`/admin/stores/${storeId}/held-items/${target?.id}/record-disposition`, {
        method: 'POST',
        body: { disposition, note: note.trim() || undefined },
      }),
    onSuccess: () => {
      toast.success('Disposition recorded');
      setNote('');
      onDone();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });
  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o) { setNote(''); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Force disposition</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="disposition" required>Disposition</Label>
            <Select value={disposition} onValueChange={(v) => setDisposition(v as 'restocked' | 'forfeited_to_store' | 'written_off')}>
              <SelectTrigger id="disposition"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="restocked">Restocked</SelectItem>
                <SelectItem value="forfeited_to_store">Forfeited to store</SelectItem>
                <SelectItem value="written_off">Written off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setNote(''); onClose(); }}>Cancel</Button>
          <Button variant="ink" loading={submit.isPending} onClick={() => submit.mutate()}>
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
