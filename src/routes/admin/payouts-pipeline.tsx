import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { AdminPayoutRow } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminPayoutsPipeline() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payouts-pipeline'],
    queryFn: () => api<AdminPayoutRow[]>('/admin/payouts'),
  });
  const list = data ?? [];
  const failed = list.filter((p) => p.status === 'failed');
  const others = list.filter((p) => p.status !== 'failed');

  return (
    <Page>
      <PageHeader
        kicker="Settlement"
        title="Payouts pipeline"
        description="Every retailer's payouts. Failed cycles need bank-detail update or manual retry — the queue is pinned at the top."
      />

      <Tabs defaultValue="failed">
        <TabsList>
          <TabsTrigger value="failed">Failed queue <span className="ml-1.5 text-danger font-mono">{failed.length}</span></TabsTrigger>
          <TabsTrigger value="all">All payouts <span className="ml-1.5 text-ink-3">{list.length}</span></TabsTrigger>
        </TabsList>
        <TabsContent value="failed">
          {isLoading ? <Skeleton className="h-32" /> : failed.length === 0 ? <Empty kicker="All clear" title="No failed payouts." /> : <Table list={failed} />}
        </TabsContent>
        <TabsContent value="all">
          {isLoading ? <Skeleton className="h-32" /> : <Table list={[...failed, ...others]} />}
        </TabsContent>
      </Tabs>
    </Page>
  );
}

function Table({ list }: { list: AdminPayoutRow[] }) {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-[12.5px]">
          <thead className="bg-bg-2/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Store</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Period</th>
              <th className="px-3 py-2 text-right font-medium text-ink-3">Amount</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Status</th>
              <th className="px-3 py-2 text-right font-medium text-ink-3">Retries</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Initiated</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-3 py-2 text-ink">{p.storeName}</td>
                <td className="px-3 py-2 font-mono text-ink-2">{p.period}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPaise(p.amountPaise)}</td>
                <td className="px-3 py-2">
                  <Badge
                    tone={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : p.status === 'processing' ? 'info' : 'warning'}
                    pulse={p.status === 'failed'}
                  >
                    {p.status.replace(/_/g, ' ')}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">{p.retryCount}</td>
                <td className="px-3 py-2 text-[11.5px] text-ink-3">{p.initiatedAt ? formatAge(p.initiatedAt) : '—'}</td>
                <td className="px-3 py-1.5 text-right">
                  <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                    <Link to={`/admin/payouts-pipeline/${p.id}`}>Open</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
