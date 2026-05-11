import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { AccountDeletionRequest, AccountDeletionStatus } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';

const STATUS_TONE: Record<AccountDeletionStatus, 'warning' | 'info' | 'success' | 'neutral'> = {
  pending: 'warning',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'neutral',
};

export default function AdminAccountDeletions() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'account-deletions'],
    queryFn: () => api<AccountDeletionRequest[]>('/admin/compliance/account-deletions'),
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
          {list.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CopyableId value={d.consumerId} label="consumer" />
                    <Badge tone={STATUS_TONE[d.status]}>{d.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="mt-1 text-[11.5px] text-ink-4">
                    Requested {formatAge(d.requestedAt)} · Scheduled {new Date(d.scheduledFor).toLocaleDateString()}
                    {d.cancelledAt && <> · Cancelled {formatAge(d.cancelledAt)}</>}
                  </div>
                </div>
                {d.status === 'pending' && (
                  <Button variant="outline" size="sm">Cancel deletion</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </ul>
      )}
    </Page>
  );
}
