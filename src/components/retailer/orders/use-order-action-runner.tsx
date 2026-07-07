/**
 * Runs an OrderAction uniformly across card / row / sheet / page. Owns the fixed
 * set of mutations + every shared confirm dialog so all surfaces reuse identical
 * UI and identical react-query invalidation.
 */
import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { api, ApiError, BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { uploadMedia } from '@/lib/upload';
import type { OrderDetail } from '@/lib/types';
import type { OrderAction, OrderActionKey, OrderConfirmKind } from '@/lib/order-actions';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ReturnDialog } from '@/components/ui/return-dialog';
import { DoorVisitDialog } from '@/components/ui/door-visit-dialog';

type RunnerResult = {
  run: (action: OrderAction) => void;
  pendingKey: OrderActionKey | null;
  dialogs: ReactNode;
};

export function useOrderActionRunner(orderId: string): RunnerResult {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [pendingKey, setPendingKey] = useState<OrderActionKey | null>(null);
  const [openConfirm, setOpenConfirm] = useState<OrderConfirmKind | null>(null);
  // Detail needed for item-level dialogs (counter-return, door visit).
  const [detail, setDetail] = useState<OrderDetail | null>(null);

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['retailer', 'orders'] });
    void qc.invalidateQueries({ queryKey: ['retailer', 'order', orderId] });
  }

  const post = useMutation({
    mutationFn: (v: { endpoint: string; body?: Record<string, unknown> }) =>
      api(`/retailer/orders/${orderId}/${v.endpoint}`, { method: 'POST', body: v.body ?? {} }),
    onSuccess: () => {
      toast.success('Order updated');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
    onSettled: () => setPendingKey(null),
  });

  async function ensureDetail(): Promise<OrderDetail | null> {
    try {
      const d = await qc.fetchQuery({
        queryKey: ['retailer', 'order', orderId],
        queryFn: () => api<OrderDetail>(`/retailer/orders/${orderId}`),
      });
      setDetail(d);
      return d;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load order');
      return null;
    }
  }

  // Accept every pending return on this order (issues refunds server-side).
  const acceptReturns = useMutation({
    mutationFn: async () => {
      const d = await ensureDetail();
      const pending = (d?.returns ?? []).filter((r) => r.storeDecision === 'pending');
      if (pending.length === 0) throw new Error('No pending return to accept');
      for (const r of pending) {
        await api(`/retailer/returns/${r.id}/verify`, { method: 'POST', body: { decision: 'accepted' } });
      }
    },
    onSuccess: () => {
      toast.success('Return accepted — refund issued');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not accept return'),
    onSettled: () => setPendingKey(null),
  });

  // Decline every pending return → opens a dispute + holds funds (server-side).
  const declineReturns = useMutation({
    mutationFn: async (v: { reasonNote: string; rejectPhotos: string[] }) => {
      const d = await ensureDetail();
      const pending = (d?.returns ?? []).filter((r) => r.storeDecision === 'pending');
      if (pending.length === 0) throw new Error('No pending return to decline');
      for (const r of pending) {
        await api(`/retailer/returns/${r.id}/decline`, {
          method: 'POST',
          body: { reasonNote: v.reasonNote, rejectPhotos: v.rejectPhotos },
        });
      }
    },
    onSuccess: () => {
      toast.success('Return declined — dispute opened, funds held pending admin review');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not decline return'),
    onSettled: () => setPendingKey(null),
  });

  function run(action: OrderAction) {
    if (!action.enabled) return;
    if (action.key === 'accept-return') {
      setPendingKey('accept-return');
      acceptReturns.mutate();
      return;
    }
    if (action.kind === 'mutation' && action.endpoint) {
      setPendingKey(action.key);
      post.mutate({ endpoint: action.endpoint });
      return;
    }
    if (action.kind === 'download' && action.key === 'tax-invoice') {
      void downloadInvoice(orderId);
      return;
    }
    if (action.kind === 'dialog' && action.confirm) {
      const confirm = action.confirm;
      if (confirm === 'counter-return' || confirm === 'door-close' || confirm === 'handover') {
        // Need order detail (item rows / assigned-agent state) — load it, then open.
        void ensureDetail().then((d) => {
          if (d) setOpenConfirm(confirm);
        });
      } else {
        setOpenConfirm(confirm);
      }
    }
  }

  const close = () => setOpenConfirm(null);

  const dialogs = (
    <>
      {(openConfirm === 'request-cancel' || openConfirm === 'mark-undelivered') && (
        <ReasonDialog
          kind={openConfirm}
          onClose={close}
          onSubmit={(reason) => {
            setPendingKey(openConfirm === 'request-cancel' ? 'request-cancel' : 'mark-undelivered');
            post.mutate(
              {
                endpoint: openConfirm === 'request-cancel' ? 'request-cancel' : 'mark-undelivered',
                body: { reason },
              },
              { onSuccess: close },
            );
          }}
          pending={post.isPending}
        />
      )}

      {openConfirm === 'reject' && (
        <RejectOrderDialog
          onClose={close}
          pending={post.isPending}
          onConfirm={() => {
            setPendingKey('reject');
            post.mutate({ endpoint: 'reject' }, { onSuccess: close });
          }}
        />
      )}

      {openConfirm === 'decline-return' && (
        <DeclineReturnDialog
          orderId={orderId}
          onClose={close}
          pending={declineReturns.isPending}
          onSubmit={(reasonNote, rejectPhotos) => {
            setPendingKey('decline-return');
            declineReturns.mutate({ reasonNote, rejectPhotos }, { onSuccess: close });
          }}
        />
      )}

      {openConfirm === 'handover' && (
        <HandoverDialog
          orderId={orderId}
          detail={detail}
          onClose={close}
          onSuccess={() => {
            invalidate();
            close();
          }}
        />
      )}

      {openConfirm === 'pickup-handover' && (
        <PickupHandoverDialog
          onClose={close}
          pending={post.isPending}
          onSubmit={(pickupCode) => {
            setPendingKey('pickup-handover');
            post.mutate({ endpoint: 'pickup-handover', body: { pickupCode } }, { onSuccess: close });
          }}
        />
      )}

      {openConfirm === 'counter-return' && detail && (
        <ReturnDialog
          items={detail.items}
          open
          onOpenChange={(o) => !o && close()}
          endpoint={`/retailer/orders/${orderId}/returns/open-counter`}
          title="Counter return"
          description="Select the items the customer is returning at the counter."
          onSuccess={() => {
            invalidate();
            close();
          }}
        />
      )}

      {openConfirm === 'door-close' && detail && (
        <DoorVisitDialog
          orderId={orderId}
          items={detail.items}
          doorWindowExpiresAt={detail.doorWindowExpiresAt ?? null}
          doorWindowExtendedAt={detail.doorWindowExtendedAt ?? null}
          open
          onOpenChange={(o) => !o && close()}
          onClosed={() => {
            invalidate();
            close();
          }}
        />
      )}

      {(openConfirm === 'raise-issue' || openConfirm === 'request-refund') && (
        <IssueDialog
          orderId={orderId}
          refund={openConfirm === 'request-refund'}
          onClose={close}
          onSuccess={() => {
            invalidate();
            close();
            navigate('/retailer/disputes');
          }}
        />
      )}
    </>
  );

  const anyPending = post.isPending || acceptReturns.isPending || declineReturns.isPending;
  return { run, pendingKey: anyPending ? pendingKey : null, dialogs };
}

/* ── Shared dialogs ───────────────────────────────────────────────────── */

/** Multi-image evidence uploader — used by the raise-issue + decline dialogs. */
function EvidenceUploader({
  urls,
  onChange,
  folder,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
  folder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const added: string[] = [];
    for (const f of Array.from(files)) {
      try {
        const r = await uploadMedia(f, { folder, purpose: 'listing-gallery', recordToLibrary: true });
        added.push(r.url);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Upload failed');
      }
    }
    if (added.length) onChange([...urls, ...added]);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <Label hint="Optional · JPG/PNG/WebP">Photos</Label>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={u} className="relative size-16 overflow-hidden rounded-xs border border-line">
            <img src={u} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(urls.filter((_, j) => j !== i))}
              className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-ink/80 text-paper hover:bg-danger"
              aria-label="Remove photo"
            >
              <X className="size-2.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="grid size-16 place-items-center rounded-xs border border-dashed border-rule text-ink-3 hover:border-ink hover:text-ink disabled:opacity-60"
          aria-label="Add photos"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
      />
    </div>
  );
}

function ReasonDialog({
  kind,
  onClose,
  onSubmit,
  pending,
}: {
  kind: 'request-cancel' | 'mark-undelivered';
  onClose: () => void;
  onSubmit: (reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState('');
  const title = kind === 'request-cancel' ? 'Request cancellation' : 'Mark undelivered';
  const desc =
    kind === 'request-cancel'
      ? 'Tell the operator why this order should be cancelled. An admin reviews the request.'
      : 'Record why the delivery failed. The system decides whether to retry or return to store.';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <Label htmlFor="reason" required>Reason</Label>
        <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        {reason.trim().length > 0 && reason.trim().length < 3 && (
          <FieldError>At least 3 characters.</FieldError>
        )}
        <DialogFooter className="mt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant={kind === 'request-cancel' ? 'danger' : 'ink'}
            size="sm"
            loading={pending}
            disabled={reason.trim().length < 3}
            onClick={() => onSubmit(reason.trim())}
          >
            {title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectOrderDialog({
  onClose,
  onConfirm,
  pending,
}: {
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject this order?</DialogTitle>
          <DialogDescription>
            The order is offered to the next-best store automatically. If no other store can
            fulfil it, it is cancelled and the customer refunded. This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Keep order</Button>
          <Button variant="danger" size="sm" loading={pending} onClick={onConfirm}>
            Reject order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeclineReturnDialog({
  orderId,
  onClose,
  onSubmit,
  pending,
}: {
  orderId: string;
  onClose: () => void;
  onSubmit: (reasonNote: string, rejectPhotos: string[]) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Decline return &amp; raise dispute</DialogTitle>
          <DialogDescription>
            Declining opens a dispute for admin review and holds the disputed amount — no refund is
            issued and you are not paid out until the admin decides. Attach photos as evidence.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="decline-reason" required>Why are you declining?</Label>
            <Textarea id="decline-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            {reason.trim().length > 0 && reason.trim().length < 3 && <FieldError>At least 3 characters.</FieldError>}
          </div>
          <EvidenceUploader urls={photos} onChange={setPhotos} folder={`disputes/${orderId}`} />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="danger" size="sm" loading={pending} disabled={reason.trim().length < 3} onClick={() => onSubmit(reason.trim(), photos)}>
            Decline &amp; dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Store→driver handover. Drivers are dispatched by the admin desk (not assigned by the
 * retailer), so this dialog either:
 *   - verifies the handoff code the dispatched driver reads off their app (releases the
 *     parcel → picked up), or
 *   - hands the parcel to an external courier by name/phone (no app, no code).
 * If no driver is dispatched yet, only the external-courier path is available.
 */
function HandoverDialog({
  orderId,
  detail,
  onClose,
  onSuccess,
}: {
  orderId: string;
  detail: OrderDetail | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const dispatched = !!detail?.assignedAgentId;
  // Verify the dispatched driver's code by default; fall back to external courier.
  const [mode, setMode] = useState<'code' | 'external'>(dispatched ? 'code' : 'external');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  const handover = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/retailer/orders/${orderId}/handover`, { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Handed over');
      onSuccess();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Handover failed'),
  });

  const nameOk = name.trim().length >= 2;
  const phoneOk = /^\d{10}$/.test(phone.trim());
  const codeOk = code.trim().length >= 4;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hand to delivery</DialogTitle>
          <DialogDescription>
            {mode === 'code'
              ? 'A driver has been dispatched. Ask them for the code shown in their app and enter it to release the parcel.'
              : dispatched
                ? 'Hand this parcel to an external courier instead (no app, no code).'
                : 'No driver dispatched yet. Wait for dispatch, or hand to an external courier below.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'code' ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="handoff-code" required>Handoff code</Label>
              <Input
                id="handoff-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                mono
                autoFocus
                maxLength={16}
                placeholder="Code from the driver's app"
              />
              <p className="mt-1 text-[11.5px] text-ink-3">
                Only the dispatched driver can see this code. A mismatch means the wrong driver.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="agent-name" required>Courier name</Label>
              <Input id="agent-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <Label htmlFor="agent-phone" required>Courier phone</Label>
              <Input id="agent-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" placeholder="10-digit mobile" />
              {phone.trim() && !phoneOk && <FieldError>Enter a 10-digit number.</FieldError>}
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          {mode === 'code' ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setMode('external')}>
                External courier instead
              </Button>
              <Button
                variant="accent"
                size="sm"
                loading={handover.isPending}
                disabled={!codeOk}
                onClick={() => handover.mutate({ handoffCode: code.trim() })}
              >
                Verify &amp; hand over
              </Button>
            </>
          ) : (
            <>
              {dispatched ? (
                <Button variant="ghost" size="sm" onClick={() => setMode('code')}>
                  Back to driver code
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              )}
              <Button
                variant="accent"
                size="sm"
                loading={handover.isPending}
                disabled={!nameOk || !phoneOk}
                onClick={() => handover.mutate({ agentName: name.trim(), agentPhone: phone.trim() })}
              >
                Hand over
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PickupHandoverDialog({
  onClose,
  onSubmit,
  pending,
}: {
  onClose: () => void;
  onSubmit: (pickupCode: string) => void;
  pending: boolean;
}) {
  const [code, setCode] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Hand to customer</DialogTitle>
          <DialogDescription>Enter the pickup code the customer shows to confirm collection.</DialogDescription>
        </DialogHeader>
        <Label htmlFor="pickup-code" required>Pickup code</Label>
        <Input id="pickup-code" value={code} onChange={(e) => setCode(e.target.value)} mono autoFocus />
        <DialogFooter className="mt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="accent" size="sm" loading={pending} disabled={!code.trim()} onClick={() => onSubmit(code.trim())}>
            Confirm collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueDialog({
  orderId,
  refund,
  onClose,
  onSuccess,
}: {
  orderId: string;
  refund: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  // Every retailer-raised item is filed as a dispute now (the kind distinction is
  // no longer shown in the UI; kind='dispute' is the backing customerIssues kind).
  const [subject, setSubject] = useState(refund ? 'Refund request' : '');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: () =>
      api('/retailer/issues', {
        method: 'POST',
        body: { kind: 'dispute', orderId, subject: subject.trim(), description: description.trim(), evidence },
      }),
    onSuccess: () => {
      toast.success(refund ? 'Refund request raised' : 'Dispute raised');
      onSuccess();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not raise dispute'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{refund ? 'Request refund' : 'Raise dispute'}</DialogTitle>
          <DialogDescription>
            {refund
              ? 'Opens a dispute requesting a refund — an admin reviews it.'
              : 'Raise a dispute on this order for admin review.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="issue-subject" required>Subject</Label>
            <Input id="issue-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="issue-desc" required>Details</Label>
            <Textarea id="issue-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <EvidenceUploader urls={evidence} onChange={setEvidence} folder={`disputes/${orderId}`} />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="ink"
            size="sm"
            loading={create.isPending}
            disabled={subject.trim().length < 3 || description.trim().length < 3}
            onClick={() => create.mutate()}
          >
            {refund ? 'Request refund' : 'Raise dispute'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function downloadInvoice(orderId: string) {
  try {
    const list = await api<{ id: string; number: string; kind: string }[]>(
      `/retailer/invoices?orderId=${encodeURIComponent(orderId)}&kind=invoice&limit=5`,
    );
    const inv = list.find((i) => i.kind === 'invoice');
    if (!inv) {
      toast.error('Tax invoice not generated yet (issues after delivery)');
      return;
    }
    const token = getToken();
    const r = await fetch(`${BASE}/retailer/invoices/${inv.id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) throw new Error('Download failed');
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${inv.number}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not download invoice');
  }
}
