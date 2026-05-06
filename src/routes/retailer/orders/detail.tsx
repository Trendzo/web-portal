import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Check,
  CheckCircle2,
  ImageOff,
  RotateCcw,
  Send,
  Truck,
  User,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import {
  deliveryMethodLabel,
  formatAge,
  formatPaise,
  orderStatusMeta,
  paymentMethodLabel,
  paymentStatusMeta,
  refundStatusMeta,
  returnDecisionMeta,
} from '@/lib/status';
import type { OrderDetail, OrderStatus, Return } from '@/lib/types';
import { Page } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import { Timeline } from '@/components/ui/timeline';
import { ReturnDialog } from '@/components/ui/return-dialog';
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

export default function RetailerOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<null | { kind: 'undelivered' | 'request-cancel'; title: string }>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['retailer', 'orders', id],
    queryFn: () => api<OrderDetail>(`/retailer/orders/${id}`),
    enabled: !!id,
    refetchInterval: 4000,
  });

  function makeAction(path: string) {
    return useMutation({
      mutationFn: (body?: Record<string, unknown>) =>
        api(`/retailer/orders/${id}/${path}`, { method: 'POST', body: body ?? {} }),
      onSuccess: () => {
        toast.success('Updated');
        void qc.invalidateQueries({ queryKey: ['retailer', 'orders'] });
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
    });
  }

  const accept = makeAction('accept');
  const pack = makeAction('pack');
  const handover = makeAction('handover');
  const depart = makeAction('depart');
  const markDelivered = makeAction('mark-delivered');
  const markUndelivered = makeAction('mark-undelivered');
  const requestCancel = makeAction('request-cancel');

  const [counterReturnOpen, setCounterReturnOpen] = useState(false);

  const verify = useMutation({
    mutationFn: ({ returnId, decision }: { returnId: string; decision: 'accepted' | 'rejected' }) =>
      api(`/retailer/returns/${returnId}/verify`, { method: 'POST', body: { decision } }),
    onSuccess: (_r, vars) => {
      toast.success(`Return ${vars.decision}`);
      void qc.invalidateQueries({ queryKey: ['retailer', 'orders', id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Verify failed'),
  });

  if (!id) return null;

  return (
    <Page>
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
          <Link to="/retailer/orders">Orders</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      ) : isError || !data ? (
        <p className="text-[13px] text-danger">Couldn't load this order.</p>
      ) : (
        <>
          <Detail
            order={data}
            actions={{
              accept: () => accept.mutate({}),
              pack: () => pack.mutate({}),
              handover: () => handover.mutate({}),
              depart: () => depart.mutate({}),
              markDelivered: () => markDelivered.mutate({}),
              openUndelivered: () => {
                setConfirmAction({ kind: 'undelivered', title: 'Mark undelivered' });
                setReason('');
              },
              openRequestCancel: () => {
                setConfirmAction({ kind: 'request-cancel', title: 'Request cancellation' });
                setReason('');
              },
              openCounterReturn: () => setCounterReturnOpen(true),
            }}
            pending={{
              accept: accept.isPending,
              pack: pack.isPending,
              handover: handover.isPending,
              depart: depart.isPending,
              markDelivered: markDelivered.isPending,
            }}
            onVerify={(returnId, decision) => verify.mutate({ returnId, decision })}
            verifying={verify.isPending}
          />
          <ReturnDialog
            items={data.items}
            open={counterReturnOpen}
            onOpenChange={setCounterReturnOpen}
            endpoint={`/retailer/orders/${data.id}/returns/open-counter`}
            title="Counter return"
            description="Customer is at the counter. Pick the items they're returning. Each item becomes a pending return — verify it next to issue the refund."
            onSuccess={() => {
              void qc.invalidateQueries({ queryKey: ['retailer', 'orders', id] });
            }}
          />
        </>
      )}

      <Dialog open={!!confirmAction} onOpenChange={(o) => { if (!o) setConfirmAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction?.title}</DialogTitle>
            <DialogDescription>
              {confirmAction?.kind === 'undelivered'
                ? 'Logs a delivery attempt with this reason. If retry budget is left, status returns to "out for delivery". Otherwise the order returns to your store.'
                : 'Logs a cancellation request. Admin must approve before the order is actually cancelled.'}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="reason" required>Reason</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={confirmAction?.kind === 'undelivered' ? 'e.g. Customer not at door' : 'e.g. Stockout'}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant="accent"
              disabled={reason.trim().length < 3}
              loading={confirmAction?.kind === 'undelivered' ? markUndelivered.isPending : requestCancel.isPending}
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.kind === 'undelivered') {
                  markUndelivered.mutate({ reason: reason.trim() });
                } else {
                  requestCancel.mutate({ reason: reason.trim() });
                }
                setConfirmAction(null);
              }}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function Detail({
  order,
  actions,
  pending,
  onVerify,
  verifying,
}: {
  order: OrderDetail;
  actions: Record<string, () => void>;
  pending: Record<string, boolean>;
  onVerify: (returnId: string, decision: 'accepted' | 'rejected') => void;
  verifying: boolean;
}) {
  const meta = orderStatusMeta(order.status);
  const primaryAction = pickPrimaryAction(order.status);
  const canCounterReturn =
    order.status === 'delivered' &&
    !!order.deliveredAt &&
    Date.now() - new Date(order.deliveredAt).getTime() < 7 * 24 * 60 * 60 * 1000;
  const pendingReturns = (order.returns ?? []).filter((r) => r.storeDecision === 'pending');

  return (
    <>
      {/* Status hero */}
      <Card className="accent-strip relative mb-4">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge tone={meta.tone} pulse={meta.pulse}>{meta.label}</Badge>
            <CopyableId value={order.id} label="order id" />
            <span className="text-[11.5px] text-ink-3">placed {formatAge(order.placedAt)}</span>
          </div>
          <h1 className="text-[18px] sm:text-[20px] font-semibold text-ink leading-snug">
            {nextStepHeading(order.status)}
          </h1>
          <p className="text-[13px] text-ink-3 mt-1">
            {order.consumerNameSnap} · {deliveryMethodLabel(order.deliveryMethod)} · {paymentMethodLabel(order.paymentMethod)}
          </p>

          {primaryAction && (
            <Button
              variant="accent"
              size="lg"
              className="mt-4 w-full sm:w-auto"
              iconLeft={primaryAction.icon}
              loading={pending[primaryAction.id] === true}
              onClick={actions[primaryAction.id]}
            >
              {primaryAction.label}
            </Button>
          )}

          {/* Secondary actions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {order.status === 'out_for_delivery' && (
              <Button
                variant="outline"
                size="sm"
                iconLeft={<XCircle className="size-3.5" />}
                onClick={actions.openUndelivered}
              >
                Mark undelivered
              </Button>
            )}
            {!['cancelled', 'closed', 'delivered', 'payment_failed'].includes(order.status) && (
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<AlertTriangle className="size-3.5" />}
                onClick={actions.openRequestCancel}
              >
                Request cancellation
              </Button>
            )}
            {canCounterReturn && (
              <Button
                variant="outline"
                size="sm"
                iconLeft={<RotateCcw className="size-3.5" />}
                onClick={actions.openCounterReturn}
              >
                Counter return
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending verification panel */}
      {pendingReturns.length > 0 && (
        <Card className="mb-4 accent-strip relative">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="size-4" /> Verify returns ({pendingReturns.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-line">
              {pendingReturns.map((r) => (
                <ReturnVerifyRow key={r.id} ret={r} onVerify={onVerify} verifying={verifying} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Refunds related to this order */}
      {(order.refunds ?? []).length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Refunds</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(order.refunds ?? []).map((rf) => {
                const m = refundStatusMeta(rf.status);
                return (
                  <li key={rf.id} className="flex items-center justify-between text-[12.5px]">
                    <div className="flex items-center gap-2">
                      <Badge tone={m.tone}>{m.label}</Badge>
                      <CopyableId value={rf.id} label="refund id" />
                    </div>
                    <span className="font-mono tabular-nums">{formatPaise(rf.totalRefundPaise)}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Items ({order.items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-line">
                {order.items.map((it) => (
                  <li key={it.id} className="flex gap-3 py-3">
                    <div className="size-14 shrink-0 rounded border border-line bg-bg-2 grid place-items-center overflow-hidden">
                      {it.galleryImageSnap ? (
                        <img src={it.galleryImageSnap} alt={it.listingNameSnap} className="size-full object-cover" />
                      ) : (
                        <ImageOff className="size-5 text-ink-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink truncate">{it.listingNameSnap}</div>
                      <div className="text-[11.5px] text-ink-3 mt-0.5">
                        {it.brandSnap} · {it.attributesLabelSnap}
                      </div>
                      <div className="text-[11.5px] text-ink-3 font-mono mt-0.5 truncate">SKU: {it.variantId}</div>
                    </div>
                    <div className="text-right shrink-0 font-mono text-[13px] tabular-nums text-ink">
                      {formatPaise(it.unitPricePaise)} × {it.qty}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer & delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <Row icon={<User className="size-3.5" />} k="Customer" v={`${order.consumerNameSnap}`} />
              <Row icon={<Send className="size-3.5" />} k="Phone" v={order.consumerPhoneSnap} />
              {order.deliveryMethod !== 'pickup' && (
                <Row icon={<Truck className="size-3.5" />} k="Address" v={
                  <span className="text-right">
                    {order.addressLine1Snap}
                    {order.addressLine2Snap && <>, {order.addressLine2Snap}</>}
                    <br />
                    {order.addressCitySnap} {order.addressPincodeSnap}
                  </span>
                } />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Total</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-[13px]">
              <div className="flex justify-between"><span className="text-ink-3">Items</span><span className="font-mono tabular-nums">{formatPaise(order.itemsSubtotalPaise)}</span></div>
              {order.couponPaise > 0 && <div className="flex justify-between"><span className="text-ink-3">Coupon</span><span className="font-mono tabular-nums text-success">−{formatPaise(order.couponPaise)}</span></div>}
              <div className="flex justify-between"><span className="text-ink-3">Tax</span><span className="font-mono tabular-nums">{formatPaise(order.taxPaise)}</span></div>
              {order.deliveryFeePaise > 0 && <div className="flex justify-between"><span className="text-ink-3">Delivery</span><span className="font-mono tabular-nums">{formatPaise(order.deliveryFeePaise)}</span></div>}
              <hr className="border-line my-2" />
              <div className="flex justify-between text-[15px] font-semibold">
                <span className="text-ink">Total</span>
                <span className="font-mono tabular-nums text-ink">{formatPaise(order.grandTotalPaise)}</span>
              </div>
              {order.payments[0] && (
                <div className="mt-2 text-[11.5px] text-ink-3">
                  Payment: <Badge tone={paymentStatusMeta(order.payments[0].status).tone}>{paymentStatusMeta(order.payments[0].status).label}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline transitions={order.transitions} />
              {order.deliveryAttempts.length > 0 && (
                <>
                  <hr className="border-line my-3" />
                  <div className="kicker mb-2">Delivery attempts</div>
                  <ul className="space-y-1 text-[12px]">
                    {order.deliveryAttempts.map((a) => (
                      <li key={a.id} className="flex items-center justify-between">
                        <span>#{a.attemptNumber} · {a.outcome}</span>
                        <span className="text-ink-3">{formatAge(a.attemptedAt)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function pickPrimaryAction(status: OrderStatus): { id: string; label: string; icon: React.ReactNode } | null {
  switch (status) {
    case 'routing':
      return { id: 'accept', label: 'Accept order', icon: <Check className="size-4" /> };
    case 'accepted':
      return { id: 'pack', label: 'Mark as packed', icon: <Box className="size-4" /> };
    case 'packed':
      return { id: 'handover', label: 'Hand to delivery', icon: <Truck className="size-4" /> };
    case 'picked_up':
      return { id: 'depart', label: 'Out for delivery', icon: <Send className="size-4" /> };
    case 'out_for_delivery':
      return { id: 'markDelivered', label: 'Mark delivered', icon: <CheckCircle2 className="size-4" /> };
    case 'undelivered':
      return null; // System auto-routes; secondary buttons available
    default:
      return null;
  }
}

function nextStepHeading(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return 'Awaiting payment confirmation.';
    case 'confirmed':
    case 'routing':
      return 'New order — accept to start fulfilling.';
    case 'accepted':
      return 'Pull items, bag them, mark as packed.';
    case 'packed':
      return 'Ready for pickup. Hand to your delivery person.';
    case 'picked_up':
      return 'Items handed off. Mark when out for delivery.';
    case 'out_for_delivery':
      return 'On the way. Mark delivered once handed over.';
    case 'at_door':
      return 'At customer door — try-on in progress.';
    case 'undelivered':
      return 'Delivery attempt failed. System will retry or return to store.';
    case 'returning_to_store':
      return 'Items en route back to your store.';
    case 'returned_to_store':
      return 'Items back at store — verify and decide.';
    case 'delivered':
      return 'Order delivered successfully.';
    case 'closed':
      return 'Order closed — return window has passed.';
    case 'cancelled':
      return 'Order cancelled.';
    case 'payment_failed':
      return 'Payment did not go through. Awaiting customer retry or admin cancellation.';
  }
}

function Row({ icon, k, v }: { icon: React.ReactNode; k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-3 inline-flex items-center gap-1.5 shrink-0">{icon} {k}</span>
      <span className="text-ink text-right">{v}</span>
    </div>
  );
}

function ReturnVerifyRow({
  ret,
  onVerify,
  verifying,
}: {
  ret: Return;
  onVerify: (returnId: string, decision: 'accepted' | 'rejected') => void;
  verifying: boolean;
}) {
  const meta = returnDecisionMeta(ret.storeDecision);
  return (
    <li className="py-2.5 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="text-[11.5px] text-ink-3">
            {ret.kind === 'door_return' ? 'door return' : 'standard return'} · {formatAge(ret.openedAt)}
          </span>
        </div>
        {ret.reasonText && <div className="text-[12px] text-ink-3 italic mt-1">{ret.reasonText}</div>}
        {ret.agentDisposition && (
          <div className="text-[11.5px] text-ink-3 mt-1">
            Agent: <span className="font-mono">{ret.agentDisposition}</span>
          </div>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          size="sm"
          variant="outline"
          iconLeft={<XCircle className="size-3" />}
          disabled={verifying}
          onClick={() => onVerify(ret.id, 'rejected')}
        >
          Reject
        </Button>
        <Button
          size="sm"
          variant="accent"
          iconLeft={<Check className="size-3" />}
          disabled={verifying}
          onClick={() => onVerify(ret.id, 'accepted')}
        >
          Accept (refund)
        </Button>
      </div>
    </li>
  );
}
