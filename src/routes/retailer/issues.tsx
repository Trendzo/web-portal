import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { formatAge, issueDecisionLabel, issueStatusMeta } from '@/lib/status';
import type { IssueListRow, IssueStatus } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
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

const STATUS_OPTIONS: ReadonlyArray<{ value: IssueStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'requested_evidence', label: 'Evidence requested' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'decided', label: 'Decided' },
];

export default function RetailerIssues() {
  const [status, setStatus] = useState<IssueStatus | 'all'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'issues', status],
    queryFn: () => {
      const qs = status === 'all' ? '' : `?status=${status}`;
      return api<IssueListRow[]>(`/retailer/disputes${qs}`);
    },
    refetchInterval: 10000,
  });

  const list = data ?? [];

  return (
    <Page>
      <PageHeader
        title="Issues"
        description="Issues linked to your store's orders and returns. Contact platform admin to respond."
      />

      <div className="mb-4 flex items-center gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[12px] text-ink-3">{list.length} issue{list.length === 1 ? '' : 's'}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : list.length === 0 ? (
        <Empty
          kicker="No issues"
          title="No issues for your store."
          description="Platform admin opens issues against orders or returns in your store."
        />
      ) : (
        <ul className="space-y-3">
          {list.map((d) => {
            const meta = issueStatusMeta(d.status);
            const needsResponse = d.status === 'awaiting_retailer';
            return (
              <Card key={d.id} className={needsResponse ? 'border-accent/40 accent-strip relative' : undefined}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone={meta.tone} pulse={needsResponse}>{meta.label}</Badge>
                        {needsResponse && <Badge tone="warning" pulse>Needs your response</Badge>}
                        <Badge tone="info" flat>{d.kind ?? 'dispute'}</Badge>
                        <CopyableId value={d.id} label="issue id" />
                        <span className="text-[11.5px] text-ink-3">{formatAge(d.openedAt)}</span>
                      </div>

                      <div className="mt-2 flex items-center gap-1 text-[12px] text-ink-3">
                        <AlertTriangle className="size-3 shrink-0" />
                        <span className="capitalize">{d.targetKind}</span>:&nbsp;
                        {d.targetKind === 'order' ? (
                          <Link
                            to={`/retailer/orders/${d.targetId}`}
                            className="font-mono hover:text-accent inline-flex items-center gap-0.5"
                          >
                            {d.targetId} <ArrowUpRight className="size-3" />
                          </Link>
                        ) : (
                          <span className="font-mono text-ink">{d.targetId}</span>
                        )}
                      </div>

                      <p className="mt-2 text-[13px] text-ink line-clamp-2">{d.description}</p>

                      <div className="mt-2">
                        <Link to={`/retailer/issues/${d.id}`} className="text-[12px] text-accent hover:underline inline-flex items-center gap-1">
                          Open thread <ArrowUpRight className="size-3" />
                        </Link>
                      </div>

                      {d.decision && (
                        <div className="mt-1.5 text-[12px]">
                          <span className="text-ink-3">Decision: </span>
                          <span className="font-medium text-ink">{issueDecisionLabel(d.decision)}</span>
                        </div>
                      )}
                    </div>
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
