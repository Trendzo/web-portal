import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, PackageX, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { formatAge, heldItemDispositionLabel, heldItemStatusMeta } from '@/lib/status';
import type { HeldItem, HeldItemStatus } from '@/lib/types';
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

const STATUS_OPTIONS: ReadonlyArray<{ value: HeldItemStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'holding', label: 'Holding' },
  { value: 'expired', label: 'Window expired' },
  { value: 'resolved', label: 'Resolved' },
];

type DialogState =
  | { kind: 'extend'; heldId: string }
  | { kind: 'dispose'; heldId: string }
  | null;

export default function AdminHeldItems() {
  const [status, setStatus] = useState<HeldItemStatus | 'all'>('holding');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [extendDays, setExtendDays] = useState(7);
  const [reason, setReason] = useState('');
  const [disposition, setDisposition] = useState<'restocked' | 'forfeited_to_store' | 'written_off'>('restocked');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'held-items', status],
    queryFn: () => {
      const qs = status === 'all' ? '' : `?status=${status}`;
      return api<HeldItem[]>(`/admin/held-items${qs}`);
    },
    refetchInterval: 8000,
  });

  const extend = useMutation({
    mutationFn: ({ heldId, daysExtra, reason }: { heldId: string; daysExtra: number; reason: string }) =>
      api(`/admin/held-items/${heldId}/extend`, { method: 'POST', body: { daysExtra, reason } }),
    onSuccess: () => {
      toast.success('Window extended');
      setDialog(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'held-items'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Extend failed'),
  });

  const dispose = useMutation({
    mutationFn: ({ heldId, disposition, reason }: { heldId: string; disposition: 'restocked' | 'forfeited_to_store' | 'written_off'; reason: string }) =>
      api(`/admin/held-items/${heldId}/force-dispose`, {
        method: 'POST',
        body: { disposition, reason },
      }),
    onSuccess: () => {
      toast.success('Disposed');
      setDialog(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'held-items'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Dispose failed'),
  });

  const expire = useMutation({
    mutationFn: (heldId: string) =>
      api(`/admin/held-items/${heldId}/mark-expired`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Marked expired');
      void qc.invalidateQueries({ queryKey: ['admin', 'held-items'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Expire failed'),
  });

  const list = data ?? [];

  return (
    <Page>
      <PageHeader
        title="Held items"
        description="Items rejected at store verification — sit at the store for the holding window. Extend, force-dispose, or expire from here."
      />

      <div className="mb-4 flex items-center gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
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
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : list.length === 0 ? (
        <Empty
          kicker="All clear"
          title="No held items in this view."
          description="Items end up here when a store rejects a return at verification."
        />
      ) : (
        <ul className="space-y-2">
          {list.map((h) => {
            const meta = heldItemStatusMeta(h.status);
            const expiresIn = new Date(h.holdingWindowExpiresAt).getTime() - Date.now();
            const expiringSoon = expiresIn > 0 && expiresIn < 3 * 24 * 60 * 60 * 1000;
            const expired = expiresIn <= 0 && h.status === 'holding';
            return (
              <Card key={h.id} className={expired || expiringSoon ? 'border-warning/40' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <CopyableId value={h.id} label="held id" />
                        {h.extendedByAdminId && (
                          <Badge tone="info">Extended</Badge>
                        )}
                      </div>
                      <div className="text-[12.5px] text-ink-3 mt-2 flex items-center gap-2">
                        <Clock className="size-3" />
                        {h.status === 'holding'
                          ? expired
                            ? <span className="text-warning">Window expired (manual mark needed)</span>
                            : <>Window expires {formatAge(h.holdingWindowExpiresAt)}</>
                          : h.disposition
                            ? <>{heldItemDispositionLabel(h.disposition)} · {h.resolvedAt ? formatAge(h.resolvedAt) : ''}</>
                            : <>Status: {h.status}</>
                        }
                      </div>
                      {h.extensionReason && (
                        <div className="text-[11.5px] text-ink-3 italic mt-1">Extension reason: {h.extensionReason}</div>
                      )}
                    </div>
                    {h.status === 'holding' && (
                      <div className="flex gap-1.5 shrink-0 flex-wrap">
                        {!h.extendedByAdminId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={<Calendar className="size-3" />}
                            onClick={() => {
                              setDialog({ kind: 'extend', heldId: h.id });
                              setExtendDays(7);
                              setReason('');
                            }}
                          >
                            Extend
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          iconLeft={<PackageX className="size-3" />}
                          onClick={() => {
                            setDialog({ kind: 'dispose', heldId: h.id });
                            setDisposition('restocked');
                            setReason('');
                          }}
                        >
                          Force dispose
                        </Button>
                        {expired && (
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={<X className="size-3" />}
                            loading={expire.isPending}
                            onClick={() => expire.mutate(h.id)}
                          >
                            Mark expired
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}

      {/* Extend dialog */}
      <Dialog open={dialog?.kind === 'extend'} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend holding window</DialogTitle>
            <DialogDescription>One-time per item. Adds the chosen number of days to the current expiry.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="days" required>Days extra</Label>
              <Input
                id="days"
                type="number"
                min={1}
                max={60}
                value={extendDays}
                onChange={(e) => setExtendDays(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="reason" required>Reason</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer travelling"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="accent"
              disabled={extendDays < 1 || reason.trim().length < 3}
              loading={extend.isPending}
              onClick={() => dialog?.kind === 'extend' && extend.mutate({ heldId: dialog.heldId, daysExtra: extendDays, reason: reason.trim() })}
            >
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispose dialog */}
      <Dialog open={dialog?.kind === 'dispose'} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force dispose held item</DialogTitle>
            <DialogDescription>Resolves the item one way or another. Restocked bumps the variant's stock back up.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Disposition</Label>
              <div className="mt-1 flex gap-1.5">
                {(['restocked', 'forfeited_to_store', 'written_off'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDisposition(d)}
                    className={
                      'rounded-md border px-2.5 py-1 text-[12px] transition-colors ' +
                      (disposition === d
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-bg text-ink-2 hover:border-line-2')
                    }
                  >
                    {heldItemDispositionLabel(d)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="dreason" required>Reason</Label>
              <Input
                id="dreason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Item still saleable"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="accent"
              disabled={reason.trim().length < 3}
              loading={dispose.isPending}
              onClick={() => dialog?.kind === 'dispose' && dispose.mutate({ heldId: dialog.heldId, disposition, reason: reason.trim() })}
            >
              Dispose
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
