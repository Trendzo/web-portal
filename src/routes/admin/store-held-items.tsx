import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface HeldRow {
  id: string;
  status: 'holding' | 'expired' | 'resolved';
  holdingWindowExpiresAt: string;
}

export default function AdminStoreHeldItems() {
  const { id: retailerId, storeId } = useParams<{ id: string; storeId: string }>();
  const qc = useQueryClient();
  const [dispose, setDispose] = useState<HeldRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'store-held-items', storeId],
    queryFn: () => api<HeldRow[]>(`/admin/stores/${storeId}/held-items`),
    enabled: Boolean(storeId),
  });
  const rows = data ?? [];

  const act = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: 'collect-at-counter' | 'redeliver' }) =>
      api(`/admin/stores/${storeId}/held-items/${id}/${verb}`, { method: 'POST', body: {} }),
    onSuccess: (_d, vars) => {
      toast.success(`Held item ${vars.verb}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'store-held-items', storeId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
  });

  return (
    <Page>
      <PageHeader
        kicker="Store"
        title="Held items"
        description="Items held after a return/cancel. Mark collected, schedule redelivery, or force a final disposition."
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to={`/admin/retailers/${retailerId}/stores/${storeId}`}>Back</Link>
          </Button>
        }
      />
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6"><p className="text-[13px] text-ink-3 italic">No held items.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-ink">{r.id}</span>
                    <Badge tone={r.status === 'holding' ? 'warning' : r.status === 'expired' ? 'danger' : 'success'}>
                      {r.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[12px] text-ink-3">
                    Holding window expires {new Date(r.holdingWindowExpiresAt).toLocaleString('en-IN')}
                  </div>
                </div>
                {r.status === 'holding' && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => act.mutate({ id: r.id, verb: 'collect-at-counter' })}>
                      Collected
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => act.mutate({ id: r.id, verb: 'redeliver' })}>
                      Redeliver
                    </Button>
                    <Button variant="outline" size="sm" className="text-danger border-danger/40" onClick={() => setDispose(r)}>
                      Force dispose
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <DisposeDialog
        target={dispose}
        storeId={storeId ?? ''}
        onClose={() => setDispose(null)}
        onDone={() => {
          setDispose(null);
          void qc.invalidateQueries({ queryKey: ['admin', 'store-held-items', storeId] });
        }}
      />
    </Page>
  );
}

function DisposeDialog({
  target,
  storeId,
  onClose,
  onDone,
}: {
  target: HeldRow | null;
  storeId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [disposition, setDisposition] = useState<'restocked' | 'forfeited_to_store' | 'written_off'>('restocked');
  const [note, setNote] = useState('');
  const submit = useMutation({
    mutationFn: () =>
      api(`/admin/stores/${storeId}/held-items/${target?.id}/record-disposition`, {
        method: 'POST',
        body: { disposition, note: note.trim() || undefined },
      }),
    onSuccess: () => {
      toast.success('Disposition recorded');
      setNote('');
      onDone();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });
  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o) { setNote(''); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Force disposition</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="disposition" required>Disposition</Label>
            <Select value={disposition} onValueChange={(v) => setDisposition(v as 'restocked' | 'forfeited_to_store' | 'written_off')}>
              <SelectTrigger id="disposition"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="restocked">Restocked</SelectItem>
                <SelectItem value="forfeited_to_store">Forfeited to store</SelectItem>
                <SelectItem value="written_off">Written off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setNote(''); onClose(); }}>Cancel</Button>
          <Button variant="ink" loading={submit.isPending} onClick={() => submit.mutate()}>
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
