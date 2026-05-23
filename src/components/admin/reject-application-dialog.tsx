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
import { Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import type { ApplicationDocumentKind } from '@/lib/types';

const DOC_KINDS: { value: ApplicationDocumentKind; label: string }[] = [
  { value: 'gst_certificate', label: 'GST certificate' },
  { value: 'pan', label: 'PAN' },
  { value: 'address_proof', label: 'Address proof' },
  { value: 'bank_proof', label: 'Bank proof (cancelled cheque)' },
  { value: 'storefront_photo', label: 'Storefront photo' },
  { value: 'other', label: 'Other' },
];

type Props = {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (payload: { reason: string; mustReuploadDocKinds: ApplicationDocumentKind[] }) => void;
};

/**
 * Reject-application dialog. Captures the rejection reason **and** an optional set of
 * document kinds the applicant must re-upload before resubmitting. The retailer's
 * re-application form picks up these flags and hard-requires fresh uploads for them.
 */
export function RejectApplicationDialog({ open, loading, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [picked, setPicked] = useState<Set<ApplicationDocumentKind>>(new Set());

  useEffect(() => {
    if (!open) {
      setReason('');
      setPicked(new Set());
    }
  }, [open]);

  const trimmed = reason.trim();
  const error =
    trimmed.length === 0 ? '' : trimmed.length < 3 ? 'Reason must be at least 3 characters' : '';
  const disabled = trimmed.length < 3 || Boolean(error);

  function toggle(kind: ApplicationDocumentKind) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject application</DialogTitle>
          <DialogDescription>
            The applicant is notified with this reason and can re-apply on the same email.
            Optionally flag which documents must be re-uploaded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="reject-app-reason" required>Reason</Label>
            <Textarea
              id="reject-app-reason"
              rows={3}
              placeholder="Explain what needs to change before re-applying."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              autoFocus
            />
            <FieldError>{error}</FieldError>
          </div>

          <div>
            <Label hint="Optional — pick the document kinds the applicant must replace">
              Documents to re-upload
            </Label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {DOC_KINDS.map((d) => (
                <label
                  key={d.value}
                  className="flex items-center gap-2 rounded-md border border-line bg-bg-2/40 px-2.5 py-1.5 text-[12.5px] text-ink-2 cursor-pointer hover:bg-bg-2/70"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={picked.has(d.value)}
                    onChange={() => toggle(d.value)}
                  />
                  <span>{d.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            disabled={disabled}
            loading={loading ?? false}
            onClick={() =>
              onConfirm({
                reason: trimmed,
                mustReuploadDocKinds: Array.from(picked),
              })
            }
          >
            Reject application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
