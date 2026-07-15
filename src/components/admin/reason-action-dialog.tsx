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

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** When true, render the confirm button in danger style. */
  danger?: boolean;
  /** Min length for the reason — defaults to 3. */
  minReasonLength?: number;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

/**
 * Reason-collecting confirmation dialog. Used everywhere admin needs to
 * record *why* before a one-way action — reject, suspend, terminate, force,
 * override. Resets reason on close so reuse across targets is safe.
 */
export function ReasonActionDialog({
  open,
  title,
  description,
  confirmLabel,
  danger = false,
  minReasonLength = 3,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  const trimmed = reason.trim();
  const error = trimmed.length === 0 ? '' : trimmed.length < minReasonLength ? `Reason must be at least ${minReasonLength} characters` : '';
  const disabled = trimmed.length < minReasonLength || Boolean(error);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="reason-action-input" required={minReasonLength > 0}>
            {minReasonLength > 0 ? 'Reason' : 'Reason (optional)'}
          </Label>
          <Input
            id="reason-action-input"
            placeholder="Internal reason (logged)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
          <FieldError>{error}</FieldError>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant={danger ? 'danger' : 'ink'}
            disabled={disabled}
            loading={loading ?? false}
            onClick={() => onConfirm(trimmed)}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
