import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, PackageOpen, Truck } from 'lucide-react';
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

const STATUS_OPTIONS: ReadonlyArray<{ value: HeldItemStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'holding', label: 'Holding' },
  { value: 'expired', label: 'Expired' },
  { value: 'resolved', label: 'Resolved' },
];

export default function RetailerHeldItems() {
  const [status, setStatus] = useState<HeldItemStatus | 'all'>('holding');
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
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
