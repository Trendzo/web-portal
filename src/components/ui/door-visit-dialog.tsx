import { useEffect, useState } from 'react';
import { Check, ImageOff, Truck, X } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { uploadMedia } from '@/lib/upload';
import { formatPaise } from '@/lib/status';
import type { OrderItem } from '@/lib/types';
import { AcceptanceCountdown } from '@/components/retailer/acceptance-countdown';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';

type Decision = 'kept' | 'returned' | 'refused';

type ItemState = {
  decision: Decision;
  reason: string;
  photoUrl: string;
};

const DECISIONS: ReadonlyArray<{ value: Decision; label: string; tone: string }> = [
  { value: 'kept', label: 'Kept', tone: 'success' },
  { value: 'returned', label: 'Returned', tone: 'warning' },
  { value: 'refused', label: 'Refused', tone: 'danger' },
];

/**
 * Try-and-Buy door visit dialog. Per-item kept/returned/refused decisions, with mandatory
 * reason + photo for refused items. Admin acts on behalf of agent for MVP.
 *
 * §9 — countdown is API-driven now. Caller passes `doorWindowExpiresAt` from the
 * order detail payload; extend mutation invalidates the order query so the new
 * deadline propagates back via the same field.
 */
export function DoorVisitDialog({
  orderId,
  items,
  doorWindowExpiresAt,
  doorWindowExtendedAt,
  open,
  onOpenChange,
  onClosed,
}: {
  orderId: string;
  items: OrderItem[];
  doorWindowExpiresAt?: string | null;
  doorWindowExtendedAt?: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onClosed: () => void;
}) {
  const qc = useQueryClient();
  const [state, setState] = useState<Record<string, ItemState>>({});

  // Reset whenever dialog opens with a fresh set of items.
  useEffect(() => {
    if (open) {
      const init: Record<string, ItemState> = {};
      for (const it of items) {
        init[it.id] = { decision: 'kept', reason: '', photoUrl: '' };
      }
      setState(init);
    }
  }, [open, items]);

  const close = useMutation({
    mutationFn: () =>
      api(`/retailer/orders/${orderId}/door/close`, {
        method: 'POST',
        body: {
          items: items.map((it) => {
            const s = state[it.id]!;
            return {
              orderItemId: it.id,
              decision: s.decision,
              ...(s.reason.trim() && { reason: s.reason.trim() }),
              ...(s.photoUrl.trim() && { photos: [s.photoUrl.trim()] }),
            };
          }),
        },
      }),
    onSuccess: () => {
      toast.success('Door visit closed');
      onClosed();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Close failed'),
  });

  const extend = useMutation({
    mutationFn: () =>
      api(`/retailer/orders/${orderId}/door/extend`, {
        method: 'POST',
        body: { reason: 'Customer needs more time' },
      }),
    onSuccess: () => {
      toast.success('Try-on window extended');
      void qc.invalidateQueries({ queryKey: ['retailer', 'orders', orderId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Extend failed'),
  });

  // All refused items need reason + photo.
  const allRefusedComplete = items.every((it) => {
    const s = state[it.id];
    if (!s || s.decision !== 'refused') return true;
    return s.reason.trim().length >= 3 && s.photoUrl.trim().length > 0;
  });

  const summary = items.reduce(
    (acc, it) => {
      const d = state[it.id]?.decision ?? 'kept';
      acc[d] += 1;
      return acc;
    },
    { kept: 0, returned: 0, refused: 0 } as Record<Decision, number>,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="size-4" /> Door visit · per-item
          </DialogTitle>
          <DialogDescription>
            Mark each item as kept, returned (sent back at the door), or refused (agent rejects
            return — requires reason + photo). Closing the door commits these decisions and
            transitions the order.
          </DialogDescription>
        </DialogHeader>

        {open && doorWindowExpiresAt && (
          <AcceptanceCountdown
            deadlineAt={doorWindowExpiresAt}
            label="Try-on window"
            className="-mt-2 mb-3"
          />
        )}

        <ul className="divide-y divide-line max-h-[50vh] overflow-y-auto -mx-1">
          {items.map((it) => {
            const s = state[it.id] ?? { decision: 'kept', reason: '', photoUrl: '' };
            return (
              <li key={it.id} className="px-1 py-3 space-y-2">
                <div className="flex gap-3">
                  <div className="size-12 shrink-0 rounded border border-line bg-bg-2 grid place-items-center overflow-hidden">
                    {it.galleryImageSnap ? (
                      <img src={it.galleryImageSnap} alt={it.listingNameSnap} className="size-full object-cover" />
                    ) : (
                      <ImageOff className="size-4 text-ink-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink truncate">{it.listingNameSnap}</div>
                    <div className="text-[11.5px] text-ink-3 mt-0.5">
                      {it.attributesLabelSnap} · qty {it.qty} · {formatPaise(it.unitPricePaise)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DECISIONS.map((d) => {
                    const active = s.decision === d.value;
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() =>
                          setState((curr) => ({ ...curr, [it.id]: { ...s, decision: d.value } }))
                        }
                        className={cn(
                          'rounded-md border px-2.5 py-1 text-[12px] transition-colors',
                          active
                            ? d.tone === 'success'
                              ? 'border-success bg-success-soft text-success'
                              : d.tone === 'warning'
                                ? 'border-warning bg-warning-soft text-warning'
                                : 'border-danger bg-danger-soft text-danger'
                            : 'border-line bg-bg text-ink-2 hover:border-line-2',
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                {s.decision === 'refused' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
                    <div>
                      <Label htmlFor={`r-${it.id}`} required>Reason</Label>
                      <Input
                        id={`r-${it.id}`}
                        value={s.reason}
                        onChange={(e) =>
                          setState((curr) => ({ ...curr, [it.id]: { ...s, reason: e.target.value } }))
                        }
                        placeholder="e.g. Customer never opened it"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`p-${it.id}`} required>Photo</Label>
                      <input
                        id={`p-${it.id}`}
                        type="file"
                        accept="image/*"
                        className="block w-full text-[12.5px] text-ink-2"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          uploadMedia(f, { folder: 'door-visits' })
                            .then((r) =>
                              setState((curr) => ({
                                ...curr,
                                [it.id]: { ...s, photoUrl: r.url },
                              })),
                            )
                            .catch(() => toast.error('Upload failed'));
                          e.target.value = '';
                        }}
                      />
                      {s.photoUrl && (
                        <img src={s.photoUrl} alt="proof" className="mt-2 size-20 rounded object-cover" />
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="text-[12.5px] text-ink-3">
          Summary: {summary.kept} kept · {summary.returned} returned · {summary.refused} refused
          {summary.kept > 0 ? ' → order will move to delivered.' : ' → order will move to returning_to_store.'}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => extend.mutate()}
            loading={extend.isPending}
            disabled={Boolean(doorWindowExtendedAt)}
            title={
              doorWindowExtendedAt
                ? 'One extension already used'
                : 'Gives the customer one more try-on window'
            }
            iconLeft={<Check className="size-3.5" />}
          >
            {doorWindowExtendedAt ? 'Window extended' : 'Extend window'}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="accent"
            disabled={!allRefusedComplete}
            loading={close.isPending}
            onClick={() => close.mutate()}
            iconLeft={<X className="size-3.5" />}
          >
            Close door
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
