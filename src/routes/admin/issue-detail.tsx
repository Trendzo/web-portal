import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Flag,
  Gavel,
  MessageSquare,
  ShieldCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, issueStatusMeta } from '@/lib/status';
import type { AwaitingParty, IssueDecision, IssueDetail, IssueKind } from '@/lib/types';
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
import { Input, Textarea } from '@/components/ui/input';
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

const KIND_OPTIONS: ReadonlyArray<{ value: IssueKind; label: string }> = [
  { value: 'query', label: 'Query' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'dispute', label: 'Dispute' },
];

function awaitingBadgeTone(p: AwaitingParty): 'warning' | 'info' | 'danger' {
  if (p === 'consumer') return 'warning';
  if (p === 'retailer') return 'danger';
  return 'info';
}

function senderBadgeTone(s: string): 'neutral' | 'info' | 'warning' | 'danger' {
  if (s === 'admin') return 'info';
  if (s === 'consumer') return 'warning';
  if (s === 'retailer') return 'danger';
  return 'neutral';
}

type DetailDialog =
  | null
  | { kind: 'decide' }
  | { kind: 'assign' }
  | { kind: 'change-kind' }
  | { kind: 'flag-party' }
  | { kind: 'request-evidence' };

export default function AdminIssueDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<DetailDialog>(null);
  const [decision, setDecision] = useState<IssueDecision>('no_refund');
  const [decisionNote, setDecisionNote] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [assignId, setAssignId] = useState('');
  const [newKind, setNewKind] = useState<IssueKind>('query');
  const [flagParty, setFlagParty] = useState<'consumer' | 'retailer'>('consumer');
  const [flagReason, setFlagReason] = useState('');
  const [evFromParty, setEvFromParty] = useState<'consumer' | 'retailer'>('consumer');
  const [evNote, setEvNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'issues', id],
    queryFn: () => api<IssueDetail>(`/admin/issues/${id}`),
    enabled: Boolean(id),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin', 'issues', id] });
  const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Action failed');

  const decide = useMutation({
    mutationFn: () =>
      api(`/admin/issues/${id}/decide`, { method: 'POST', body: { decision, decisionNote } }),
    onSuccess: () => { toast.success('Decision recorded'); setDialog(null); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const sendReply = useMutation({
    mutationFn: (body: string) =>
      api(`/admin/issues/${id}/messages`, { method: 'POST', body: { body, attachments: [] } }),
    onSuccess: () => { toast.success('Reply sent'); setReplyBody(''); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const assign = useMutation({
    mutationFn: (adminId: string) =>
      api(`/admin/issues/${id}/assign`, { method: 'POST', body: { adminId } }),
    onSuccess: () => { toast.success('Issue assigned'); setDialog(null); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const changeKind = useMutation({
    mutationFn: (k: IssueKind) =>
      api(`/admin/issues/${id}/change-kind`, { method: 'POST', body: { kind: k } }),
    onSuccess: () => { toast.success('Kind updated'); setDialog(null); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const flagPartyMut = useMutation({
    mutationFn: (body: { party: 'consumer' | 'retailer'; reason: string }) =>
      api(`/admin/issues/${id}/flag-party`, { method: 'POST', body }),
    onSuccess: () => { toast.success('Party flagged'); setDialog(null); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const closeIssue = useMutation({
    mutationFn: () =>
      api(`/admin/issues/${id}/close`, { method: 'POST', body: {} }),
    onSuccess: () => { toast.success('Issue closed'); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const requestEvidence = useMutation({
    mutationFn: (body: { fromParty: 'consumer' | 'retailer'; note: string }) =>
      api(`/admin/issues/${id}/request-evidence`, { method: 'POST', body }),
    onSuccess: () => { toast.success('Evidence requested'); setDialog(null); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading || !data) return <Page><Skeleton className="h-72" /></Page>;
  const meta = issueStatusMeta(data.status);
  const isDecided = data.status === 'decided';
  const canClose = !isDecided && data.status !== 'closed' && data.status !== 'resolved';

  return (
    <Page>
      <PageHeader
        kicker="Issues"
        title={`Issue · ${data.kind ?? 'dispute'}`}
        description={`Opened ${formatAge(data.createdAt)} · ${data.orderId ? `Order ${data.orderId}` : data.returnId ? `Return ${data.returnId}` : ''}`}
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/admin/issues">Back</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <Badge tone="info" flat>{data.kind ?? 'dispute'}</Badge>
        {data.awaitingParty && (
          <Badge tone={awaitingBadgeTone(data.awaitingParty)}>Awaiting {data.awaitingParty}</Badge>
        )}
        <CopyableId value={data.id} label="issue id" />
        {data.payoutAdjustmentPaise != null && data.payoutAdjustmentPaise !== 0 && (
          <Badge tone="warning" flat>
            Payout adj: {(data.payoutAdjustmentPaise / 100).toFixed(2)}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {/* ── Left column ── */}
        <div className="space-y-6">
          {/* Description card */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <SectionHeading kicker="Description" title="Consumer's account" />
              <p className="text-[13.5px] text-ink-2">{data.description || '—'}</p>

              {(data.evidence?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-ink-4">Evidence files</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(data.evidence ?? []).map((e) => (
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

          {/* Message thread */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <SectionHeading kicker="Conversation" title="Message thread" />
              {(data.messages?.length ?? 0) === 0 ? (
                <p className="text-[13px] text-ink-3">No messages yet.</p>
              ) : (
                <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                  {(data.messages ?? []).map((m) => (
                    <div key={m.id} className="rounded-md border border-line p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge tone={senderBadgeTone(m.senderType)} flat className="text-[10.5px]">
                          {m.senderType}
                        </Badge>
                        <span className="text-[11.5px] text-ink-3 font-mono">{m.senderId}</span>
                        <span className="ml-auto text-[11px] text-ink-4">{formatAge(m.at)}</span>
                      </div>
                      <p className="text-[13px] text-ink-2 whitespace-pre-wrap">{m.body}</p>
                      {(m.attachments?.length ?? 0) > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(m.attachments ?? []).map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer" className="text-[11px] text-accent underline truncate max-w-[200px]">
                              {url.split('/').pop()}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Reply form */}
              <div className="pt-2 border-t border-line">
                <Textarea
                  rows={2}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Type a reply..."
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="accent"
                    iconLeft={<MessageSquare className="size-3" />}
                    disabled={replyBody.trim().length < 1}
                    loading={sendReply.isPending}
                    onClick={() => sendReply.mutate(replyBody.trim())}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Evidence photos */}
          {data.evidencePhotos && data.evidencePhotos.length > 0 && (
            <Card>
              <CardContent className="p-6 space-y-3">
                <SectionHeading kicker="Evidence" title="Photos" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {data.evidencePhotos.map((p, i) => (
                    <div key={i} className="relative rounded-md overflow-hidden border border-line">
                      <img src={p.url} alt={p.label ?? `Evidence ${i + 1}`} className="w-full h-32 object-cover" />
                      <span className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-0.5 text-[10.5px] text-white truncate">
                        {p.source}{p.label ? ` — ${p.label}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Party context */}
          {data.partyContext && (
            ((data.partyContext.consumerFlags?.length ?? 0) > 0 || (data.partyContext.retailerEnforcements?.length ?? 0) > 0) && (
              <Card>
                <CardContent className="p-6 space-y-3">
                  <SectionHeading kicker="Context" title="Party history" />
                  {(data.partyContext.consumerFlags ?? []).map((f, i) => (
                    <div key={`cf-${i}`} className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-[12.5px]">
                      <span className="font-medium text-yellow-800">Consumer flag:</span>{' '}
                      <span className="text-yellow-700">{f.kind} — {f.reason}</span>
                      <span className="ml-2 text-[11px] text-yellow-600">{formatAge(f.at)}</span>
                    </div>
                  ))}
                  {(data.partyContext.retailerEnforcements ?? []).map((e, i) => (
                    <div key={`re-${i}`} className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[12.5px]">
                      <span className="font-medium text-red-800">Retailer enforcement:</span>{' '}
                      <span className="text-red-700">{e.step} ({e.breachKind}){e.reason ? ` — ${e.reason}` : ''}</span>
                      <span className="ml-2 text-[11px] text-red-600">{formatAge(e.actedAt)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          )}
        </div>

        {/* ── Right column ── */}
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
                  { label: 'Assigned to', value: data.assignedAdminId ?? '—', mono: true },
                  { label: 'Decided by', value: data.decidedByAdmin?.email ?? '—' },
                  { label: 'Decision', value: data.decision ?? '—' },
                ]}
              />
            </CardContent>
          </Card>

          {/* Action buttons */}
          <Card>
            <CardContent className="p-6">
              <SectionHeading kicker="Controls" title="Actions" />
              <div className="flex flex-wrap gap-2">
                {!isDecided && data.status !== 'closed' && data.status !== 'resolved' && (
                  <Button
                    variant="accent"
                    size="sm"
                    iconLeft={<Gavel className="size-3.5" />}
                    onClick={() => { setDecisionNote(''); setDecision('no_refund'); setDialog({ kind: 'decide' }); }}
                  >
                    Decide
                  </Button>
                )}
                {!isDecided && data.status !== 'closed' && data.status !== 'resolved' && (
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={<ShieldCheck className="size-3.5" />}
                    onClick={() =>
                      api(`/admin/issues/${id}/escalate`, { method: 'POST', body: {} })
                        .then(() => { toast.success('Escalated'); invalidate(); })
                        .catch((e) => toast.error(errMsg(e)))
                    }
                  >
                    Escalate
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<UserPlus className="size-3.5" />}
                  onClick={() => { setAssignId(data.assignedAdminId ?? ''); setDialog({ kind: 'assign' }); }}
                >
                  Assign
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isDecided}
                  onClick={() => { setNewKind((data.kind as IssueKind) ?? 'dispute'); setDialog({ kind: 'change-kind' }); }}
                >
                  Change kind
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<Flag className="size-3.5" />}
                  onClick={() => { setFlagParty('consumer'); setFlagReason(''); setDialog({ kind: 'flag-party' }); }}
                >
                  Flag party
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<Camera className="size-3.5" />}
                  onClick={() => { setEvFromParty('consumer'); setEvNote(''); setDialog({ kind: 'request-evidence' }); }}
                >
                  Request evidence
                </Button>
                {canClose && (
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={<XCircle className="size-3.5" />}
                    loading={closeIssue.isPending}
                    onClick={() => closeIssue.mutate()}
                  >
                    Close
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transitions timeline */}
          {(data.transitions?.length ?? 0) > 0 && (
            <Card>
              <CardContent className="p-6">
                <SectionHeading kicker="History" title="Status transitions" />
                <div className="space-y-1.5 text-[12px]">
                  {(data.transitions ?? []).map((t) => (
                    <div key={t.id} className="flex items-baseline gap-1.5">
                      <span className="text-ink-4 shrink-0">{formatAge(t.at)}</span>
                      <span className="text-ink-3">{t.fromStatus ?? '—'} → {t.toStatus}</span>
                      <span className="ml-auto text-ink-4 text-[11px]">{t.actorType}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Decide dialog ── */}
      <Dialog open={dialog?.kind === 'decide'} onOpenChange={(o) => { if (!o) setDialog(null); }}>
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
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
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

      {/* ── Assign dialog ── */}
      <Dialog open={dialog?.kind === 'assign'} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign issue</DialogTitle>
            <DialogDescription>Set the admin responsible for this issue.</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="assign-id" required>Admin ID</Label>
            <Input id="assign-id" value={assignId} onChange={(e) => setAssignId(e.target.value)} placeholder="Admin account ID" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="accent"
              disabled={!assignId.trim()}
              loading={assign.isPending}
              onClick={() => assign.mutate(assignId.trim())}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Change kind dialog ── */}
      <Dialog open={dialog?.kind === 'change-kind'} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change issue kind</DialogTitle>
            <DialogDescription>Re-classify this issue.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Kind</Label>
            <Select value={newKind} onValueChange={(v) => setNewKind(v as IssueKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="accent"
              loading={changeKind.isPending}
              onClick={() => changeKind.mutate(newKind)}
            >
              Change kind
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Flag party dialog ── */}
      <Dialog open={dialog?.kind === 'flag-party'} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag party</DialogTitle>
            <DialogDescription>Record a compliance concern against the consumer or retailer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Party</Label>
              <Select value={flagParty} onValueChange={(v) => setFlagParty(v as typeof flagParty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consumer">Consumer</SelectItem>
                  <SelectItem value="retailer">Retailer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="flag-reason" required>Reason</Label>
              <Textarea id="flag-reason" rows={2} value={flagReason} onChange={(e) => setFlagReason(e.target.value)} placeholder="Why are you flagging this party?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="accent"
              disabled={flagReason.trim().length < 3}
              loading={flagPartyMut.isPending}
              onClick={() => flagPartyMut.mutate({ party: flagParty, reason: flagReason.trim() })}
            >
              Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Request evidence dialog ── */}
      <Dialog open={dialog?.kind === 'request-evidence'} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request evidence</DialogTitle>
            <DialogDescription>Ask a party to submit additional evidence for this issue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>From party</Label>
              <Select value={evFromParty} onValueChange={(v) => setEvFromParty(v as typeof evFromParty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consumer">Consumer</SelectItem>
                  <SelectItem value="retailer">Retailer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ev-note" required>Note</Label>
              <Textarea id="ev-note" rows={2} value={evNote} onChange={(e) => setEvNote(e.target.value)} placeholder="What evidence is needed?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="accent"
              disabled={evNote.trim().length < 3}
              loading={requestEvidence.isPending}
              onClick={() => requestEvidence.mutate({ fromParty: evFromParty, note: evNote.trim() })}
            >
              Request evidence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
