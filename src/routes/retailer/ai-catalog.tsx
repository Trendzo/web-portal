import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Plus, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { AiQuota, AiSubmission, AiSubmissionStatus } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const STATUS_LABEL: Record<AiSubmissionStatus, { label: string; tone: 'warning' | 'info' | 'success' | 'danger' | 'neutral' }> = {
  submitted: { label: 'Submitted', tone: 'neutral' },
  processing: { label: 'Processing', tone: 'info' },
  ready_for_review: { label: 'Ready for review', tone: 'warning' },
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'neutral' },
  regenerating: { label: 'Regenerating', tone: 'info' },
  failed: { label: 'Failed', tone: 'danger' },
};

const TABS: AiSubmissionStatus[] = ['submitted', 'processing', 'ready_for_review', 'accepted', 'rejected', 'failed'];

export default function RetailerAiCatalog() {
  const submissions = useQuery({
    queryKey: ['retailer', 'ai-catalog'],
    queryFn: () => api<AiSubmission[]>('/retailer/ai-catalog'),
  });
  const quota = useQuery({
    queryKey: ['retailer', 'ai-catalog', 'quota'],
    queryFn: () => api<AiQuota>('/retailer/ai-catalog/quota'),
  });
  const list = submissions.data ?? [];

  return (
    <Page>
      <PageHeader
        kicker="AI Catalog"
        title="AI photo generation"
        description="Submit input photos; the AI returns shot variants for review. Accepted outputs auto-attach to the listing gallery."
        actions={
          <div className="flex items-center gap-2">
            {quota.data && <QuotaPill quota={quota.data} />}
            <Button asChild iconLeft={<Plus className="size-3.5" />}>
              <Link to="/retailer/ai-catalog/new">New submission</Link>
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="submitted">
        <TabsList className="overflow-x-auto whitespace-nowrap">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {STATUS_LABEL[t].label}
              <span className="ml-1.5 text-ink-3">{list.filter((s) => s.status === t).length}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t} value={t}>
            <SubmissionList loading={submissions.isLoading} list={list.filter((s) => s.status === t)} />
          </TabsContent>
        ))}
      </Tabs>
    </Page>
  );
}

function QuotaPill({ quota }: { quota: AiQuota }) {
  const tone = quota.remaining < 5
    ? 'border-danger/40 text-danger bg-danger-soft'
    : quota.remaining < 15
    ? 'border-warning/40 text-warning bg-warning-soft'
    : 'border-line text-ink-2 bg-bg-2';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${tone}`}>
      <Sparkles className="size-3.5" />
      {quota.used}/{quota.total} used
    </span>
  );
}

function SubmissionList({ loading, list }: { loading: boolean; list: AiSubmission[] }) {
  if (loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (list.length === 0) return <Empty kicker="Empty" title="No submissions in this state." />;
  return (
    <ul className="space-y-2">
      {list.map((s) => {
        const st = STATUS_LABEL[s.status];
        return (
          <Card key={s.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-ink">
                      {s.listingId ? `Listing ${s.listingId.slice(-6)}` : '— No target listing —'}
                    </span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <Badge tone="neutral" flat>{s.mode === 'with_model' ? 'With model' : 'Without model'}</Badge>
                  </div>
                  <div className="mt-1 text-[12px] text-ink-3">
                    {s.rawPhotos.length} input{s.rawPhotos.length === 1 ? '' : 's'} · {s.outputUrls.length} output{s.outputUrls.length === 1 ? '' : 's'} · Submitted {formatAge(s.at)}
                  </div>
                </div>
                {s.status === 'ready_for_review' ? (
                  <Button asChild variant="accent" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                    <Link to={`/retailer/ai-catalog/${s.id}`}>Review</Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                    <Link to={`/retailer/ai-catalog/${s.id}`}>Open</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </ul>
  );
}
