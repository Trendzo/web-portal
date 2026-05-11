import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { PostPayoutRecoveryRow } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CopyableId } from '@/components/ui/copyable-id';

const TONE: Record<PostPayoutRecoveryRow['status'], 'warning' | 'success' | 'danger' | 'neutral'> = {
  planned: 'warning',
  debited: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

export default function AdminPostPayoutRecovery() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'post-payout-recovery'],
    queryFn: () => api<PostPayoutRecoveryRow[]>('/admin/post-payout-recovery'),
  });
  const list = data ?? [];

  return (
    <Page>
      <PageHeader
        title="Post-payout recovery"
        description="Refunds issued for orders whose payouts have already settled. Each row plans a debit on the retailer's next payout cycle."
      />

      <Tabs defaultValue="planned">
        <TabsList>
          <TabsTrigger value="planned">Planned <span className="ml-1.5 text-ink-3">{list.filter((r) => r.status === 'planned').length}</span></TabsTrigger>
          <TabsTrigger value="debited">Debited <span className="ml-1.5 text-ink-3">{list.filter((r) => r.status === 'debited').length}</span></TabsTrigger>
          <TabsTrigger value="failed">Failed <span className="ml-1.5 text-ink-3">{list.filter((r) => r.status === 'failed').length}</span></TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        {(['planned', 'debited', 'failed', 'all'] as const).map((tab) => (
          <TabsContent key={tab} value={tab}>
            <List loading={isLoading} list={tab === 'all' ? list : list.filter((r) => r.status === tab)} />
          </TabsContent>
        ))}
      </Tabs>
    </Page>
  );
}

function List({ loading, list }: { loading: boolean; list: PostPayoutRecoveryRow[] }) {
  if (loading) return <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (list.length === 0) return <Empty kicker="All clear" title="No rows in this bucket." />;
  return (
    <ul className="space-y-2">
      {list.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{r.retailerName}</span>
                  <Badge tone={TONE[r.status]} pulse={r.status === 'planned' || r.status === 'failed'}>{r.status}</Badge>
                  <Badge tone="neutral" flat>{formatPaise(r.plannedDebitPaise)} debit</Badge>
                </div>
                <div className="mt-1 text-[12px] text-ink-3">
                  Refund <CopyableId value={r.refundId} label="refund id" /> · Order <CopyableId value={r.orderId} label="order id" />
                </div>
                <div className="mt-1 text-[11.5px] text-ink-4">
                  Created {formatAge(r.createdAt)} · Scheduled debit {new Date(r.scheduledFor).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {r.settledAt && <> · Settled {formatAge(r.settledAt)}</>}
                </div>
                {r.reason && <div className="mt-1 text-[12px] italic text-ink-2">{r.reason}</div>}
              </div>
              <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                <Link to={`/admin/orders/${r.orderId}`}>Open order</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </ul>
  );
}
