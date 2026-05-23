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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ReturnRow {
  id: string;
  storeDecision: 'pending' | 'accepted' | 'rejected';
  openedAt: string;
  reasonText: string | null;
  orderItem: {
    id: string;
    order: { id: string };
  };
}

export default function AdminStoreReturns() {
  const { id: retailerId, storeId } = useParams<{ id: string; storeId: string }>();
  const qc = useQueryClient();
  const [decision, setDecision] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'store-returns', storeId, decision],
    queryFn: () =>
      api<ReturnRow[]>(
        `/admin/stores/${storeId}/returns${decision === 'all' ? '' : `?decision=${decision}`}`,
      ),
    enabled: Boolean(storeId),
  });
  const rows = data ?? [];

  const verify = useMutation({
    mutationFn: ({ returnId, dec }: { returnId: string; dec: 'accepted' | 'rejected' }) =>
      api(`/admin/stores/${storeId}/returns/${returnId}/verify`, {
        method: 'POST',
        body: { decision: dec },
      }),
    onSuccess: (_d, vars) => {
      toast.success(`Return ${vars.dec}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'store-returns', storeId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Verify failed'),
  });

  return (
    <Page>
      <PageHeader
        kicker="Store"
        title="Returns"
        description="Counter return verification. Accept or reject from this list."
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to={`/admin/retailers/${retailerId}/stores/${storeId}`}>Back</Link>
          </Button>
        }
      />
      <div className="mb-3 flex items-center gap-2">
        <Select value={decision} onValueChange={(v) => setDecision(v as typeof decision)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All decisions</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[12px] text-ink-3">{rows.length} returns</span>
      </div>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6"><p className="text-[13px] text-ink-3 italic">No returns.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-ink">{r.id}</span>
                    <Badge
                      tone={r.storeDecision === 'accepted' ? 'success' : r.storeDecision === 'rejected' ? 'danger' : 'warning'}
                    >
                      {r.storeDecision}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[12px] text-ink-3">
                    Order <span className="font-mono">{r.orderItem.order.id}</span> · opened{' '}
                    {new Date(r.openedAt).toLocaleString('en-IN')}
                  </div>
                  {r.reasonText && (
                    <div className="mt-1 text-[12px] text-ink-2">Reason: {r.reasonText}</div>
                  )}
                </div>
                {r.storeDecision === 'pending' && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-danger border-danger/40"
                      onClick={() => verify.mutate({ returnId: r.id, dec: 'rejected' })}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="ink"
                      size="sm"
                      onClick={() => verify.mutate({ returnId: r.id, dec: 'accepted' })}
                    >
                      Accept
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
