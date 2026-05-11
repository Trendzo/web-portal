import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { CatalogFlag } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CopyableId } from '@/components/ui/copyable-id';

export default function AdminCatalogModeration() {
  const automation = useQuery({
    queryKey: ['admin', 'catalog-moderation', 'automation'],
    queryFn: () => api<CatalogFlag[]>('/admin/catalog/moderation?source=automation'),
  });
  const userReport = useQuery({
    queryKey: ['admin', 'catalog-moderation', 'user_report'],
    queryFn: () => api<CatalogFlag[]>('/admin/catalog/moderation?source=user_report'),
  });
  const appeal = useQuery({
    queryKey: ['admin', 'catalog-moderation', 'under_appeal'],
    queryFn: () => api<CatalogFlag[]>('/admin/catalog/moderation?status=under_appeal'),
  });

  return (
    <Page>
      <PageHeader
        kicker="Catalog"
        title="Catalog moderation"
        description="Listings flagged by automation, reported by consumers, or under appeal. Review, dismiss, or take down."
      />

      <Tabs defaultValue="automation">
        <TabsList>
          <TabsTrigger value="automation">Auto-flagged</TabsTrigger>
          <TabsTrigger value="user_report">User reported</TabsTrigger>
          <TabsTrigger value="under_appeal">Under appeal</TabsTrigger>
        </TabsList>

        <TabsContent value="automation">
          <FlagList loading={automation.isLoading} list={automation.data ?? []} />
        </TabsContent>
        <TabsContent value="user_report">
          <FlagList loading={userReport.isLoading} list={userReport.data ?? []} />
        </TabsContent>
        <TabsContent value="under_appeal">
          <FlagList loading={appeal.isLoading} list={appeal.data ?? []} />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

function FlagList({ loading, list }: { loading: boolean; list: CatalogFlag[] }) {
  if (loading) return <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-20" />)}</div>;
  if (list.length === 0) return <Empty kicker="All clear" title="No open flags in this bucket." />;
  return (
    <ul className="space-y-2">
      {list.map((f) => (
        <Card key={f.id}>
          <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <AlertTriangle className="size-3.5 text-warning" />
                <CopyableId value={f.listingId} label="listing" />
                <Badge tone="warning">{f.source.replace(/_/g, ' ')}</Badge>
                <Badge tone="neutral" flat>{f.reasonCode}</Badge>
              </div>
              <div className="mt-1 text-[12px] text-ink-3">
                Opened {formatAge(f.openedAt)}
                {f.reportedByConsumerId && <> · Consumer {f.reportedByConsumerId.slice(0, 12)}…</>}
                {f.ruleKey && <> · Rule {f.ruleKey}</>}
              </div>
              {f.details && (
                <p className="mt-1 text-[12.5px] italic text-ink-2">{f.details}</p>
              )}
            </div>
            <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
              <Link to={`/admin/listings/${f.listingId}`}>Review</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </ul>
  );
}
