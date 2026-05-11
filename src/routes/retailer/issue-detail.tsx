import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge, issueStatusMeta } from '@/lib/status';
import type { IssueDetail } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { CopyableId } from '@/components/ui/copyable-id';

export default function RetailerIssueDetail() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'issues', id],
    queryFn: () => api<IssueDetail>(`/retailer/disputes/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading || !data) return <Page><Skeleton className="h-72" /></Page>;
  const meta = issueStatusMeta(data.status);

  return (
    <Page>
      <PageHeader
        kicker="Issues"
        title={`Issue · ${data.kind ?? 'dispute'}`}
        description={`Opened ${formatAge(data.openedAt)} on ${data.targetKind} ${data.targetId}`}
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/retailer/issues">Back</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <Badge tone="info" flat>{data.kind ?? 'dispute'}</Badge>
        <CopyableId value={data.id} label="issue id" />
        <Link
          to={`/retailer/orders/${data.targetId}`}
          className="ml-2 inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink"
        >
          Open order <ArrowUpRight className="size-3" />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardContent className="p-6 space-y-4">
            <SectionHeading kicker="Description" title="Consumer's account" />
            <p className="text-[13.5px] text-ink-2">{data.description || '—'}</p>

            {data.evidence.length > 0 && (
              <div>
                <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-ink-4">Evidence files</div>
                <div className="flex flex-wrap gap-1.5">
                  {data.evidence.map((e) => (
                    <Badge key={e} tone="neutral" flat>{e}</Badge>
                  ))}
                </div>
              </div>
            )}

            {data.decisionNote && (
              <div>
                <div className="mb-1 text-[11.5px] font-medium uppercase tracking-wider text-ink-4">Admin decision note</div>
                <p className="rounded-md bg-bg-2 px-3 py-2 text-[13px] text-ink-2">{data.decisionNote}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Status" title="Resolution" />
            <MetaList
              cols={1}
              items={[
                { label: 'Status', value: <Badge tone={meta.tone}>{meta.label}</Badge> },
                { label: 'Decision', value: data.decision ?? '—' },
                { label: 'Decided at', value: data.decidedAt ? formatAge(data.decidedAt) : '—' },
                { label: 'Target', value: `${data.targetKind} ${data.targetId?.slice(0, 12)}…`, mono: true },
              ]}
            />
            <p className="mt-3 text-[12px] text-ink-3">
              Contact platform support if you need to respond to this issue or submit additional evidence.
            </p>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
