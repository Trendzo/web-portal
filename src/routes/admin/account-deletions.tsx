import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { accountDeletionStatusMeta, formatAge } from '@/lib/status';
import type { AccountDeletionRequest } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';

export default function AdminAccountDeletions() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'account-deletions'],
    queryFn: () => api<AccountDeletionRequest[]>('/admin/compliance/account-deletions'),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'account-deletions'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'compliance', 'deletions'] });
  };

  const complete = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/compliance/account-deletions/${id}/complete`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Deletion completed · consumer PII anonymised');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Complete failed'),
  });
  const cancel = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/compliance/account-deletions/${id}/cancel`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Deletion cancelled');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Cancel failed'),
  });

  const list = data ?? [];

  return (
    <Page>
      <PageHeader
        kicker="Compliance"
        title="Account deletions"
        description="Consumer-initiated deletions. Anonymise on the scheduled date; cancel inside the grace window if the consumer changes their mind."
      />

      {isLoading ? (
        <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : list.length === 0 ? (
        <Empty kicker="Nothing pending" title="No deletion requests in queue." />
      ) : (
        <ul className="space-y-2">
          {list.map((d) => {
            const meta = accountDeletionStatusMeta(d.status);
            const scheduledIn = Math.round(
              (new Date(d.scheduledFor).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            );
            return (
              <Card key={d.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-medium text-ink truncate">
                        {d.consumerName ?? d.consumerEmail ?? `Consumer ${d.consumerId}`}
                      </span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {d.status === 'pending' && (
                        <Badge tone={scheduledIn < 1 ? 'danger' : scheduledIn < 3 ? 'warning' : 'neutral'} flat>
                          {scheduledIn < 0
                            ? `${-scheduledIn} days overdue`
                            : scheduledIn === 0
                              ? 'Today'
                              : `In ${scheduledIn} days`}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-3">
                      {d.consumerEmail ?? '—'}
                      {d.consumerPhone ? ` · ${d.consumerPhone}` : ''}
                      <span className="ml-2"><CopyableId value={d.consumerId} label="consumer id" /></span>
                    </div>
                    <div className="mt-1 text-[11.5px] text-ink-4">
                      Requested {formatAge(d.requestedAt)} · Scheduled {new Date(d.scheduledFor).toLocaleString()}
                      {d.cancelledAt && <> · Cancelled {formatAge(d.cancelledAt)}</>}
                      {d.completedAt && <> · Completed {formatAge(d.completedAt)}</>}
                    </div>
                  </div>
                  {d.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        loading={complete.isPending && complete.variables === d.id}
                        onClick={() => {
                          if (!window.confirm('Complete deletion now? Consumer PII will be anonymised.')) return;
                          complete.mutate(d.id);
                        }}
                      >
                        Complete now
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:bg-danger/5"
                        loading={cancel.isPending && cancel.variables === d.id}
                        onClick={() => {
                          if (!window.confirm('Cancel this deletion request?')) return;
                          cancel.mutate(d.id);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
