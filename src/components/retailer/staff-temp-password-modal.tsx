import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  info: { email: string; tempPassword: string } | null;
  onClose: () => void;
};

/**
 * One-time temp-password reveal. Backend returns the cleartext password
 * exactly once on `POST /retailer/staff/:id/reset-password`; this dialog is
 * the only surface that shows it. Closing the dialog discards the value —
 * a reload will not bring it back.
 */
export function StaffTempPasswordModal({ info, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyToClipboard() {
    if (!info) return;
    await navigator.clipboard.writeText(info.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={info !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Temporary password</DialogTitle>
          <DialogDescription>
            This password will not be shown again. Hand it to{' '}
            <span className="font-medium text-ink">{info?.email ?? ''}</span> in person or
            via a side channel; they should change it after first sign-in.
          </DialogDescription>
        </DialogHeader>
        {info && (
          <div className="rounded-md border border-line bg-bg-2/40 px-3 py-2 flex items-center justify-between gap-2">
            <code className="font-mono text-[13px] text-ink break-all">{info.tempPassword}</code>
            <Button
              size="sm"
              variant="outline"
              iconLeft={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              onClick={() => void copyToClipboard()}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="ink" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
