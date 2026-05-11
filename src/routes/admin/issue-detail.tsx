import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowUpRight, Gavel, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, issueStatusMeta } from '@/lib/status';
import type { IssueDecision, IssueDetail } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { CopyableId } from '@/components/ui/copyable-id';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';

const DECISION_OPTIONS: ReadonlyArray<{ value: IssueDecision; label: string }> = [
  { value: 'refund', label: 'Refund' },
  { value: 'fresh_delivery', label: 'Fresh delivery' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'no_refund', label: 'No refund' },
  { value: 'split', label: 'Split' },
];

export default function AdminIssueDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [deciding, setDeciding] = useState(false);
  const [decision, setDecision] = useState<IssueDecision>('no_refund');
  const [decisionNote, setDecisionNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'issues', id],
    queryFn: () => api<IssueDetail>(`/admin/disputes/${id}`),
    enabled: Boolean(id),
  });

  const decide = useMutation({
    mutationFn: () =>
      api(`/admin/disputes/${id}/decide`, { method: 'POST', body: { decision, decisionNote } }),
    onSuccess: () => {
      toast.success('Decision recorded');
      setDeciding(false);
      void qc.invalidateQueries({ queryKey: ['admin', 'issues', id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Decision failed'),
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
            <Link to="/admin/issues">Back</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <Badge tone="info" flat>{data.kind ?? 'dispute'}</Badge>
        <CopyableId value={data.id} label="issue id" />
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
                <div className="mb-1 text-[11.5px] font-medium uppercase tracking-wider text-ink-4">Decision note</div>
                <p className="rounded-md bg-bg-2 px-3 py-2 text-[13px] text-ink-2">{data.decisionNote}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <SectionHeading kicker="Context" title="Linked target" />
              <MetaList
                cols={1}
                items={[
                  {
                    label: 'Target',
                    value: (
                      <Link
                        to={`/admin/orders/${data.targetId}`}
                        className="hover:text-accent inline-flex items-center gap-1 font-mono text-[12.5px]"
                      >
                        {data.targetId} <ArrowUpRight className="size-3" />
                      </Link>
                    ),
                  },
                  { label: 'Kind', value: data.targetKind },
                  { label: 'Opened by', value: `${data.openedByActorType} · ${data.openedByActorId.slice(0, 12)}…`, mono: true },
                  { label: 'Decided by', value: data.decidedByAdmin?.email ?? '—' },
                  { label: 'Decision', value: data.decision ?? '—' },
                ]}
              />
            </CardContent>
          </Card>

          {data.status !== 'decided' && (
            <Card>
              <CardContent className="p-6">
                <SectionHeading kicker="Controls" title="Triage" />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="accent"
                    size="sm"
                    iconLeft={<Gavel className="size-3.5" />}
                    onClick={() => setDeciding(true)}
                  >
                    Decide dispute
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={<ShieldCheck className="size-3.5" />}
                    onClick={() =>
                      api(`/admin/disputes/${id}/escalate`, { method: 'POST', body: {} })
                        .then(() => {
                          toast.success('Escalated');
                          void qc.invalidateQueries({ queryKey: ['admin', 'issues', id] });
                        })
                        .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed'))
                    }
                  >
                    Escalate
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={deciding} onOpenChange={setDeciding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decide dispute</DialogTitle>
            <DialogDescription>Records the resolution and books the liability line on the retailer's monthly statement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Decision</Label>
              <Select value={decision} onValueChange={(v) => setDecision(v as IssueDecision)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DECISION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Note (required)</Label>
              <Textarea rows={3} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} placeholder="Explain the reasoning…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeciding(false)}>Cancel</Button>
            <Button
              variant="accent"
              disabled={decisionNote.trim().length < 3}
              loading={decide.isPending}
              onClick={() => decide.mutate()}
            >
              Confirm decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
