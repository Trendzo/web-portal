import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpRight, Gavel, MessageSquare, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { actorLabel, formatAge, issueDecisionLabel, issueStatusMeta } from '@/lib/status';
import type { IssueDecision, IssueListRow, IssueStatus } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STATUS_OPTIONS: ReadonlyArray<{ value: IssueStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'requested_evidence', label: 'Evidence requested' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'decided', label: 'Decided' },
];

const DECISION_OPTIONS: ReadonlyArray<{ value: IssueDecision; label: string }> = [
  { value: 'refund', label: 'Refund' },
  { value: 'fresh_delivery', label: 'Fresh delivery' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'no_refund', label: 'No refund' },
  { value: 'split', label: 'Split' },
];

type DialogKind = 'request-evidence' | 'decide' | 'escalate';
type DialogState = { kind: DialogKind; issueId: string } | null;

export default function AdminIssues() {
  const [status, setStatus] = useState<IssueStatus | 'all'>('all');
  const [kind, setKind] = useState<'all' | 'query' | 'dispute'>('all');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState<IssueDecision>('no_refund');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'issues', status],
    queryFn: () => {
      const qs = status === 'all' ? '' : `?status=${status}`;
      return api<IssueListRow[]>(`/admin/disputes${qs}`);
    },
    refetchInterval: 8000,
  });

  const requestEvidence = useMutation({
    mutationFn: ({ issueId, note }: { issueId: string; note: string }) =>
      api(`/admin/disputes/${issueId}/request-evidence`, { method: 'POST', body: { note } }),
    onSuccess: () => {
      toast.success('Evidence requested');
      setDialog(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'issues'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Request failed'),
  });

  const decide = useMutation({
    mutationFn: ({ issueId, decision, decisionNote }: { issueId: string; decision: IssueDecision; decisionNote: string }) =>
      api(`/admin/disputes/${issueId}/decide`, { method: 'POST', body: { decision, decisionNote } }),
    onSuccess: () => {
      toast.success('Issue decided');
      setDialog(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'issues'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Decision failed'),
  });

  const escalate = useMutation({
    mutationFn: ({ issueId, note }: { issueId: string; note?: string }) =>
      api(`/admin/disputes/${issueId}/escalate`, { method: 'POST', body: note ? { note } : {} }),
    onSuccess: () => {
      toast.success('Issue escalated');
      setDialog(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'issues'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Escalation failed'),
  });

  const list = data ?? [];
  const visibleList = list.filter((d) => kind === 'all' || (d.kind ?? 'dispute') === kind);

  function openDialog(kind: DialogKind, issueId: string) {
    setNote('');
    setDecision('no_refund');
    setDialog({ kind, issueId } as DialogState);
  }

  return (
    <Page>
      <PageHeader
        title="Issues"
        description="Open, evidence-gathering, escalated, and decided issues across all orders and returns."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            <SelectItem value="query">Query</SelectItem>
            <SelectItem value="dispute">Dispute</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[12px] text-ink-3">{visibleList.length} of {list.length} issue{list.length === 1 ? '' : 's'}</span>
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[12px] text-ink-3">{selected.size} selected</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                toast.success(`Bulk-closed ${selected.size} stale issue${selected.size === 1 ? '' : 's'} (mock)`);
                setSelected(new Set());
              }}
            >
              Bulk close stale
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : visibleList.length === 0 ? (
        <Empty
          kicker="No issues"
          title="No issues match this filter."
          description="Issues are opened by admin against an order or return."
        />
      ) : (
        <ul className="space-y-3">
          {visibleList.map((d) => {
            const meta = issueStatusMeta(d.status);
            const canRequestEvidence = d.status === 'open';
            const canDecide = d.status === 'open' || d.status === 'requested_evidence' || d.status === 'escalated';
            const canEscalate = d.status === 'open' || d.status === 'requested_evidence';
            return (
              <Card key={d.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="checkbox"
                          checked={selected.has(d.id)}
                          onChange={(e) => {
                            setSelected((s) => {
                              const next = new Set(s);
                              if (e.target.checked) next.add(d.id);
                              else next.delete(d.id);
                              return next;
                            });
                          }}
                          className="size-4 cursor-pointer accent-accent"
                          aria-label="Select issue"
                        />
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <Badge tone="info" flat>{d.kind ?? 'dispute'}</Badge>
                        <CopyableId value={d.id} label="issue id" />
                        <span className="text-[11.5px] text-ink-3">{formatAge(d.openedAt)}</span>
                      </div>

                      <div className="mt-2 flex items-center gap-1 text-[12px] text-ink-3">
                        <AlertTriangle className="size-3 shrink-0" />
                        <span className="capitalize">{d.targetKind}</span>:&nbsp;
                        <Link
                          to={`/admin/${d.targetKind === 'order' ? 'orders' : 'returns'}/${d.targetId}`}
                          className="font-mono hover:text-accent inline-flex items-center gap-0.5"
                        >
                          {d.targetId} <ArrowUpRight className="size-3" />
                        </Link>
                      </div>

                      <div className="mt-1 text-[12px] text-ink-3">
                        Opened by{' '}
                        <span className="text-ink font-medium">{actorLabel(d.openedByActorType)}</span>
                        <span className="font-mono text-[11px] ml-1 text-ink-4">{d.openedByActorId}</span>
                      </div>

                      <p className="mt-2 text-[13px] text-ink line-clamp-2">{d.description}</p>

                      {d.decision && (
                        <div className="mt-1.5 text-[12px]">
                          <span className="text-ink-3">Decision: </span>
                          <span className="font-medium text-ink">{issueDecisionLabel(d.decision)}</span>
                          {d.decisionNote && (
                            <span className="text-ink-3 italic"> — {d.decisionNote}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {(canRequestEvidence || canDecide || canEscalate) && (
                      <div className="flex gap-1.5 shrink-0 flex-col sm:flex-row items-end sm:items-start">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/admin/issues/${d.id}`}>Open</Link>
                        </Button>
                        {canRequestEvidence && (
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={<MessageSquare className="size-3" />}
                            onClick={() => openDialog('request-evidence', d.id)}
                          >
                            Request evidence
                          </Button>
                        )}
                        {canEscalate && (
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={<TrendingUp className="size-3" />}
                            onClick={() => openDialog('escalate', d.id)}
                          >
                            Escalate
                          </Button>
                        )}
                        {canDecide && (
                          <Button
                            size="sm"
                            variant="outline"
                            iconLeft={<Gavel className="size-3" />}
                            onClick={() => openDialog('decide', d.id)}
                          >
                            Decide
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}

      <Dialog open={dialog?.kind === 'request-evidence'} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request additional evidence</DialogTitle>
            <DialogDescription>
              Moves the issue to "Evidence requested". Your note will be recorded.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="ev-note" required>Note</Label>
            <Textarea
              id="ev-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What evidence is needed and from whom?"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="accent"
              disabled={note.trim().length < 5}
              loading={requestEvidence.isPending}
              onClick={() => {
                if (dialog?.kind === 'request-evidence') {
                  requestEvidence.mutate({ issueId: dialog.issueId, note: note.trim() });
                }
              }}
            >
              Request evidence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.kind === 'decide'} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decide issue</DialogTitle>
            <DialogDescription>
              This action is final. Choose a resolution and record your reasoning.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label required>Decision</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {DECISION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDecision(opt.value)}
                    className={
                      'rounded-md border px-2.5 py-1 text-[12px] transition-colors ' +
                      (decision === opt.value
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-bg text-ink-2 hover:border-line-2')
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="dec-note" required>Decision note</Label>
              <Textarea
                id="dec-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explain the reasoning behind this decision."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="accent"
              disabled={note.trim().length < 10}
              loading={decide.isPending}
              onClick={() => {
                if (dialog?.kind === 'decide') {
                  decide.mutate({ issueId: dialog.issueId, decision, decisionNote: note.trim() });
                }
              }}
            >
              Confirm decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.kind === 'escalate'} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalate issue</DialogTitle>
            <DialogDescription>
              Flags this issue as needing senior review. You can still decide after escalation.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="esc-note">Note (optional)</Label>
            <Textarea
              id="esc-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why is this being escalated?"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="accent"
              loading={escalate.isPending}
              onClick={() => {
                if (dialog?.kind === 'escalate') {
                  const trimmed = note.trim();
                  escalate.mutate(trimmed ? { issueId: dialog.issueId, note: trimmed } : { issueId: dialog.issueId });
                }
              }}
            >
              Escalate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
