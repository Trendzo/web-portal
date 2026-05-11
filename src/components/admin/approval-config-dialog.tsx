import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';

export type ApprovalConfig = {
  platformFeeBp: number;
  payoutCadenceDays: number;
};

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  defaults?: Partial<ApprovalConfig>;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (config: ApprovalConfig) => void;
};

/**
 * Capture the platform fee + payout cadence at storefront approval time.
 * Defaults: 15% / 7 days. Accepts override per-call so admin can bump for
 * tier-1 retailers or shorten cadence for high-volume stores.
 */
export function ApprovalConfigDialog({
  open,
  title = 'Approve storefront',
  description = 'Set the commercial terms before this storefront goes live. Both can be revisited from the retailer detail page.',
  confirmLabel = 'Approve',
  defaults,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const initialFeePercent = defaults?.platformFeeBp != null ? defaults.platformFeeBp / 100 : 15;
  const initialCadence = defaults?.payoutCadenceDays ?? 7;
  const [feePercent, setFeePercent] = useState<string>(String(initialFeePercent));
  const [cadence, setCadence] = useState<string>(String(initialCadence));

  useEffect(() => {
    if (open) {
      setFeePercent(String(initialFeePercent));
      setCadence(String(initialCadence));
    }
  }, [open, initialFeePercent, initialCadence]);

  const feeNum = Number(feePercent);
  const cadenceNum = Number(cadence);
  const feeError =
    !Number.isFinite(feeNum) || feeNum < 0 || feeNum > 100 ? 'Fee must be between 0% and 100%' : '';
  const cadenceError =
    !Number.isInteger(cadenceNum) || cadenceNum < 1 || cadenceNum > 30
      ? 'Cadence must be 1–30 days'
      : '';
  const disabled = Boolean(feeError) || Boolean(cadenceError);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="fee" required hint={`${Math.round(feeNum * 100)} bp`}>
              Platform fee (%)
            </Label>
            <Input
              id="fee"
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={feePercent}
              onChange={(e) => setFeePercent(e.target.value)}
            />
            <FieldError>{feeError}</FieldError>
          </div>
          <div>
            <Label htmlFor="cadence" required>Payout cadence (days)</Label>
            <Input
              id="cadence"
              type="number"
              min="1"
              max="30"
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
            />
            <FieldError>{cadenceError}</FieldError>
          </div>
          <p className="rounded-md bg-bg-2/40 px-3 py-2 text-[12px] text-ink-3">
            ClosetX takes <strong>{Number.isFinite(feeNum) ? feeNum : 0}%</strong> on every order; payouts settle every{' '}
            <strong>{Number.isInteger(cadenceNum) ? cadenceNum : '?'} days</strong>.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="accent"
            disabled={disabled}
            loading={loading ?? false}
            onClick={() =>
              onConfirm({
                platformFeeBp: Math.round(feeNum * 100),
                payoutCadenceDays: cadenceNum,
              })
            }
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
