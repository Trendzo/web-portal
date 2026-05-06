import { useEffect, useState } from 'react';
import { ImageOff, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import type { OrderItem } from '@/lib/types';
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

/**
 * Open-return dialog. Used by both admin (on-behalf-of-consumer) and retailer (counter return).
 * Per-item checkbox + optional reason; submits to whichever endpoint the parent provides.
 */
export function ReturnDialog({
  items,
  open,
  onOpenChange,
  endpoint,
  title,
  description,
  onSuccess,
}: {
  items: OrderItem[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** e.g. `/admin/orders/${orderId}/returns/open` or `/retailer/orders/${orderId}/returns/open-counter` */
  endpoint: string;
  title: string;
  description: string;
  onSuccess: () => void;
}) {
  const [picked, setPicked] = useState<Record<string, { selected: boolean; reason: string }>>({});

  useEffect(() => {
    if (open) {
      const init: Record<string, { selected: boolean; reason: string }> = {};
      for (const it of items) {
        init[it.id] = { selected: false, reason: '' };
      }
      setPicked(init);
    }
  }, [open, items]);

  const submit = useMutation({
    mutationFn: () =>
      api(endpoint, {
        method: 'POST',
        body: {
          items: items
            .filter((it) => picked[it.id]?.selected)
            .map((it) => {
              const reason = picked[it.id]?.reason.trim();
              return {
                orderItemId: it.id,
                ...(reason && { reasonText: reason }),
              };
            }),
        },
      }),
    onSuccess: () => {
      toast.success('Return opened');
      onSuccess();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Open return failed'),
  });

  const selectedCount = Object.values(picked).filter((p) => p.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="size-4" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ul className="divide-y divide-line max-h-[50vh] overflow-y-auto -mx-1">
          {items.map((it) => {
            const p = picked[it.id] ?? { selected: false, reason: '' };
            return (
              <li
                key={it.id}
                className={cn(
                  'px-1 py-3 cursor-pointer transition-colors',
                  p.selected ? 'bg-accent-soft/40' : 'hover:bg-bg-2/50',
                )}
                onClick={() =>
                  setPicked((curr) => ({ ...curr, [it.id]: { ...p, selected: !p.selected } }))
                }
              >
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
                      {it.attributesLabelSnap} · qty {it.qty} · {formatPaise(it.netLinePaise)}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={p.selected}
                    readOnly
                    className="size-4 mt-1 accent-accent"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {p.selected && (
                  <div className="mt-2 pl-1" onClick={(e) => e.stopPropagation()}>
                    <Label htmlFor={`r-${it.id}`}>Reason (optional)</Label>
                    <Input
                      id={`r-${it.id}`}
                      value={p.reason}
                      onChange={(e) =>
                        setPicked((curr) => ({ ...curr, [it.id]: { ...p, reason: e.target.value } }))
                      }
                      placeholder="e.g. Wrong size"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="text-[12.5px] text-ink-3">{selectedCount} item(s) selected for return</div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="accent"
            disabled={selectedCount === 0}
            loading={submit.isPending}
            onClick={() => submit.mutate()}
          >
            Open return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

