import { useEffect, useState, type ReactNode } from 'react';
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

type Props = {
  open: boolean;
  title: string;
  description: string;
  /** The exact string the user must type before the confirm button enables. */
  confirmText: string;
  /** Label shown above the type-to-confirm input. Defaults to the listing name pattern. */
  typeLabel?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** When true, also collect a reason. Off by default. */
  requireReason?: boolean;
  minReasonLength?: number;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

/**
 * Irreversible-action confirmation. The user must type the target's name verbatim
 * (case-sensitive) to enable the confirm button. Used for retire/delete-style ops
 * where a typo'd click could destroy work.
 */
export function TypeConfirmDialog({
  open,
  title,
  description,
  confirmText,
  typeLabel,
  confirmLabel,
  danger = false,
  requireReason = true,
  minReasonLength = 3,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) {
      setTyped('');
      setReason('');
    }
  }, [open]);

  const matches = typed === confirmText;
  const trimmedReason = reason.trim();
  const reasonError =
    !requireReason
      ? ''
      : trimmedReason.length === 0
        ? ''
        : trimmedReason.length < minReasonLength
          ? `Reason must be at least ${minReasonLength} characters`
          : '';
  const reasonOk = !requireReason || (trimmedReason.length >= minReasonLength && !reasonError);
  const disabled = !matches || !reasonOk;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="type-confirm-input" required>
              {typeLabel ?? <>Type <span className="font-mono text-ink">{confirmText}</span> to confirm</>}
            </Label>
            <Input
              id="type-confirm-input"
              mono
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmText}
              autoFocus
            />
          </div>
          {requireReason && (
            <div>
              <Label htmlFor="type-confirm-reason" required>Reason</Label>
              <Input
                id="type-confirm-reason"
                placeholder="Internal reason (logged + notified to retailer)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <FieldError>{reasonError}</FieldError>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant={danger ? 'danger' : 'ink'}
            disabled={disabled}
            loading={loading ?? false}
            onClick={() => onConfirm(trimmedReason)}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
