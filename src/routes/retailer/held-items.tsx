import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Clock, PackageOpen, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { formatAge, heldItemDispositionLabel, heldItemStatusMeta } from '@/lib/status';
import type { HeldItem, HeldItemDisposition, HeldItemStatus } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS: ReadonlyArray<{ value: HeldItemStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'holding', label: 'Holding' },
  { value: 'expired', label: 'Expired' },
  { value: 'resolved', label: 'Resolved' },
];

export default function RetailerHeldItems() {
  const [status, setStatus] = useState<HeldItemStatus | 'all'>('holding');
  const [dispositionTarget, setDispositionTarget] = useState<HeldItem | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'held-items', status],
    queryFn: () => {
      const qs = status === 'all' ? '' : `?status=${status}`;
      return api<HeldItem[]>(`/retailer/held-items${qs}`);
    },
    refetchInterval: 8000,
  });

  const collect = useMutation({
    mutationFn: (heldId: string) =>
      api(`/retailer/held-items/${heldId}/collect-at-counter`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Marked collected');
      void qc.invalidateQueries({ queryKey: ['retailer', 'held-items'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Collect failed'),
  });

  const redeliver = useMutation({
    mutationFn: (heldId: string) =>
      api(`/retailer/held-items/${heldId}/redeliver`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Redeliver attempt logged');
      void qc.invalidateQueries({ queryKey: ['retailer', 'held-items'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Redeliver failed'),
  });

  const list = data ?? [];

  return (
    <Page>
      <PageHeader
        title="Held items"
        description="Items at your store after a rejected return. Collect at counter when the customer comes in, or redeliver."
      />

      <div className="mb-4 flex items-center gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[12px] text-ink-3">{list.length} item{list.length === 1 ? '' : 's'}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : list.length === 0 ? (
        <Empty kicker="All clear" title="No held items right now." />
      ) : (
        <ul className="space-y-2">
          {list.map((h) => {
            const meta = heldItemStatusMeta(h.status);
            const expiresIn = new Date(h.holdingWindowExpiresAt).getTime() - Date.now();
            const expiringSoon = expiresIn > 0 && expiresIn < 3 * 24 * 60 * 60 * 1000;
            return (
              <Card key={h.id} className={expiringSoon ? 'border-warning/40' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <CopyableId value={h.id} label="held id" />
                      </div>
                      <div className="text-[12.5px] text-ink-3 mt-2 flex items-center gap-2">
                        <Clock className="size-3" />
                        {h.status === 'holding' ? (
                          <>Window expires {formatAge(h.holdingWindowExpiresAt)}</>
                        ) : h.disposition ? (
                          <>{heldItemDispositionLabel(h.disposition)} · {h.resolvedAt ? formatAge(h.resolvedAt) : ''}</>
                        ) : (
                          <>{h.status}</>
                        )}
                      </div>
                    </div>
                    {h.status === 'holding' && (
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          iconLeft={<Truck className="size-3" />}
                          loading={redeliver.isPending}
                          onClick={() => redeliver.mutate(h.id)}
                        >
                          Redeliver
                        </Button>
                        <Button
                          size="sm"
                          variant="accent"
                          iconLeft={<PackageOpen className="size-3" />}
                          loading={collect.isPending}
                          onClick={() => collect.mutate(h.id)}
                        >
                          Collected
                        </Button>
                      </div>
                    )}
                    {h.status === 'expired' && !h.disposition && (
                      <Button
                        size="sm"
                        variant="outline"
                        iconLeft={<Archive className="size-3" />}
                        onClick={() => setDispositionTarget(h)}
                      >
                        Record disposition
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}

      <DispositionDialog
        target={dispositionTarget}
        onClose={() => setDispositionTarget(null)}
        onRecorded={() => {
          setDispositionTarget(null);
          void qc.invalidateQueries({ queryKey: ['retailer', 'held-items'] });
        }}
      />
    </Page>
  );
}

// MOCK_DEPENDENCY: §10 — post-expiry disposition recording (POST endpoint pending)

const DISPOSITIONS: Array<{ value: HeldItemDisposition; label: string; icon: typeof Archive; tone: 'success' | 'neutral' | 'danger' }> = [
  { value: 'restocked', label: 'Restocked to inventory', icon: Archive, tone: 'success' },
  { value: 'written_off', label: 'Written off', icon: Trash2, tone: 'danger' },
  { value: 'forfeited_to_store', label: 'Disposed (kept by store)', icon: PackageOpen, tone: 'neutral' },
];

function DispositionDialog({
  target,
  onClose,
  onRecorded,
}: {
  target: HeldItem | null;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [picked, setPicked] = useState<HeldItemDisposition>('restocked');
  const [note, setNote] = useState('');

  const submit = useMutation({
    mutationFn: () =>
      api(`/retailer/held-items/${target?.id ?? ''}/record-disposition`, {
        method: 'POST',
        body: { disposition: picked, note: note || undefined },
      }),
    onSuccess: () => {
      toast.success('Disposition recorded');
      setNote('');
      onRecorded();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to record'),
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="size-4" /> Post-expiry disposition
          </DialogTitle>
          <DialogDescription>
            The holding window expired. Tell the platform what you did with the item — restock, write
            off, or dispose. Action is recorded for audit; admin reviews disposition trends in enforcement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {DISPOSITIONS.map((d) => {
            const Icon = d.icon;
            const active = picked === d.value;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => setPicked(d.value)}
                className={
                  'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ' +
                  (active ? 'border-accent bg-accent-soft' : 'border-line bg-bg hover:border-line-2')
                }
              >
                <Icon className={'size-4 shrink-0 ' + (d.tone === 'success' ? 'text-success' : d.tone === 'danger' ? 'text-danger' : 'text-ink-2')} />
                <span className="text-[13.5px] text-ink">{d.label}</span>
              </button>
            );
          })}

          <div>
            <Label htmlFor="disp-note">Optional note</Label>
            <Textarea id="disp-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. moved to clearance bin" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="accent" loading={submit.isPending} onClick={() => submit.mutate()}>
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
