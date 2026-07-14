import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, ExternalLink, FileText, ImageIcon, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { kycDocumentStatusMeta, kycReverificationStatusMeta, formatAge } from '@/lib/status';
import type { KycReverification, RequiredDocumentType } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { CopyableId } from '@/components/ui/copyable-id';
import { ReasonActionDialog } from '@/components/admin/reason-action-dialog';
import { PermissionGate } from '@/components/shell/PermissionGate';

// Same canonical 5 the retailer-side renders, in the same order. Even if the
// backend returns documents in a different order, the admin reviewer sees them
// in the order the retailer was asked to upload them.
const DOC_SLOTS: { kind: RequiredDocumentType; label: string }[] = [
  { kind: 'gstin_certificate', label: 'GSTIN certificate' },
  { kind: 'pan_card', label: 'PAN card' },
  { kind: 'address_proof', label: 'Address proof' },
  { kind: 'cancelled_cheque', label: 'Cancelled cheque' },
  { kind: 'shop_act_license', label: 'Shop-act license' },
];

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
}

export default function AdminComplianceDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [rejectDoc, setRejectDoc] = useState<{ docId: string; label: string } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'compliance', id],
    queryFn: () => api<KycReverification>(`/admin/compliance/kyc/${id}`),
    enabled: Boolean(id),
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['admin', 'compliance', id] });
    void qc.invalidateQueries({ queryKey: ['admin', 'compliance'] });
  }

  /** Review ONE document. This is what makes a partial rejection possible — the retailer
   *  then only has to replace what actually failed. */
  const decideDoc = useMutation({
    mutationFn: ({ docId, decision, note }: { docId: string; decision: 'verified' | 'rejected'; note?: string }) =>
      api(`/admin/compliance/kyc/${id}/documents/${docId}/decide`, {
        method: 'POST',
        body: { decision, ...(note ? { note } : {}) },
      }),
    onSuccess: (_d, v) => {
      toast.success(v.decision === 'verified' ? 'Document verified' : 'Document rejected');
      setRejectDoc(null);
      refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
  });

  const decide = useMutation({
    mutationFn: ({ decision, reason }: { decision: 'approved' | 'rejected'; reason?: string }) =>
      api(`/admin/compliance/kyc/${id}/decide`, { method: 'POST', body: { decision, reason } }),
    onSuccess: (_data, { decision }) => {
      toast.success(decision === 'approved' ? 'KYC approved' : 'KYC sent back');
      setRejecting(false);
      refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
  });

  if (isLoading) return <Page><Skeleton className="h-72" /></Page>;
  if (isError || !data) {
    return (
      <Page>
        <PageHeader title="KYC cycle not found" />
        <Empty kicker="Not found" title="No KYC re-verification matches this id." />
      </Page>
    );
  }
  const meta = kycReverificationStatusMeta(data.status);
  const dueIn = Math.round((new Date(data.dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const graceIn = Math.round(
    (new Date(data.gracePeriodEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  // Index by kind so we iterate slot-first, then look up.
  const docByKind = new Map(data.documents.map((d) => [d.kind, d]));
  const submittedCount = data.documents.filter((d) => d.status !== 'missing').length;
  const verifiedCount = data.documents.filter((d) => d.status === 'verified').length;
  const rejectedCount = data.documents.filter((d) => d.status === 'rejected').length;
  const missingCount = DOC_SLOTS.length - submittedCount;

  // Documents are only reviewable while the cycle sits with the reviewer.
  const underReview = data.status === 'submitted';
  // The cycle decision is DERIVED from the per-document review — approve requires every
  // required doc verified; sending it back requires at least one rejected.
  const allVerified = DOC_SLOTS.every(({ kind }) => docByKind.get(kind)?.status === 'verified');
  const canApprove = underReview && allVerified;
  const canSendBack = underReview && rejectedCount > 0;

  return (
    <Page>
      <PageHeader
        kicker="Compliance"
        title={data.storeName ?? 'KYC re-verification'}
        description={
          <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
            {data.storeId && <CopyableId value={data.storeId} label="store id" />}
            <span className="text-ink-4">·</span>
            <span>Cycle {data.id}</span>
            <span className="text-ink-4">·</span>
            <span>
              Due {new Date(data.dueAt).toLocaleDateString()} ·{' '}
              {dueIn < 0 ? `${-dueIn} days overdue` : `in ${dueIn} days`}
            </span>
          </span>
        }
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/admin/compliance">Back to queue</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <Badge tone={dueIn < 0 ? 'danger' : dueIn < 7 ? 'warning' : 'neutral'} flat>
          {dueIn < 0 ? `${-dueIn} days overdue` : `Due in ${dueIn} days`}
        </Badge>
        <Badge tone="neutral" flat>
          Grace ends in {graceIn}d
        </Badge>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Required" value={DOC_SLOTS.length} />
        <StatTile label="Uploaded" value={submittedCount} tone={submittedCount > 0 ? 'info' : 'neutral'} />
        <StatTile label="Verified" value={verifiedCount} tone={verifiedCount > 0 ? 'success' : 'neutral'} />
        <StatTile
          label={rejectedCount > 0 ? 'Rejected' : 'Missing'}
          value={rejectedCount > 0 ? rejectedCount : missingCount}
          tone={rejectedCount > 0 ? 'danger' : missingCount > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <SectionHeading kicker="Documents" title="Submitted by retailer" />
            <p className="mt-1 text-[12.5px] text-ink-3">
              {underReview
                ? 'Review each document individually. Reject the ones that need replacing — the retailer only re-uploads those.'
                : 'This cycle is not under review, so documents cannot be actioned.'}
            </p>
            <ul className="mt-4 space-y-2">
              {DOC_SLOTS.map(({ kind, label }) => {
                const d = docByKind.get(kind);
                const fileUrl = d?.fileUrl ?? null;
                const status = d?.status ?? 'missing';
                const docMeta = kycDocumentStatusMeta(status);
                const previewable = fileUrl && isImageUrl(fileUrl);
                const actionable = underReview && !!d && status !== 'missing';
                const busy = decideDoc.isPending && decideDoc.variables?.docId === d?.id;
                return (
                  <li
                    key={kind}
                    className="flex items-start justify-between gap-3 rounded-lg border border-line bg-bg px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {previewable ? (
                        <a
                          href={fileUrl!}
                          target="_blank"
                          rel="noreferrer"
                          className="size-14 shrink-0 overflow-hidden rounded-md border border-line bg-bg-2"
                        >
                          <img
                            src={fileUrl!}
                            alt={label}
                            className="size-full object-cover transition-transform hover:scale-105"
                          />
                        </a>
                      ) : (
                        <span className="flex size-14 shrink-0 items-center justify-center rounded-md border border-line bg-bg-2 text-ink-3">
                          {fileUrl ? <FileText className="size-5" /> : <ImageIcon className="size-5 opacity-30" />}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-medium text-ink">{label}</div>
                        <div className="mt-0.5 text-[11.5px] text-ink-3">
                          {d?.uploadedAt ? `Uploaded ${formatAge(d.uploadedAt)}` : 'Not uploaded'}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Badge tone={docMeta.tone}>{docMeta.label}</Badge>
                          {d?.reviewedAt && (
                            <span className="text-[11px] text-ink-4">
                              reviewed {formatAge(d.reviewedAt)}
                            </span>
                          )}
                        </div>
                        {d?.reviewerNote && (
                          <p className="mt-1.5 rounded-md border border-danger/30 bg-danger/5 px-2 py-1 text-[12px] text-danger">
                            {d.reviewerNote}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {fileUrl && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          iconRight={<ExternalLink className="size-3.5" />}
                        >
                          <a href={fileUrl} target="_blank" rel="noreferrer">View</a>
                        </Button>
                      )}
                      {actionable && (
                        <PermissionGate action="kyc.decide">
                          <Button
                            variant="outline"
                            size="sm"
                            loading={busy && decideDoc.variables?.decision === 'verified'}
                            disabled={status === 'verified' || decideDoc.isPending}
                            iconLeft={<Check className="size-3.5" />}
                            className="text-success border-success/40 hover:bg-success/5"
                            onClick={() => decideDoc.mutate({ docId: d!.id, decision: 'verified' })}
                          >
                            Verify
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={status === 'rejected' || decideDoc.isPending}
                            iconLeft={<X className="size-3.5" />}
                            className="text-danger border-danger/40 hover:bg-danger/5"
                            onClick={() => setRejectDoc({ docId: d!.id, label })}
                          >
                            Reject
                          </Button>
                        </PermissionGate>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Decision" title="Approve or send back" />
            <MetaList
              cols={1}
              items={[
                { label: 'Submitted', value: data.submittedAt ? formatAge(data.submittedAt) : '—' },
                { label: 'Last verified', value: data.lastVerifiedAt ? formatAge(data.lastVerifiedAt) : '—' },
                { label: 'Decided', value: data.decidedAt ? formatAge(data.decidedAt) : '—' },
                ...(data.decisionReason ? [{ label: 'Last decision note', value: data.decisionReason }] : []),
              ]}
            />
            <PermissionGate action="kyc.decide">
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  variant="accent"
                  loading={decide.isPending && decide.variables?.decision === 'approved'}
                  disabled={!canApprove || decide.isPending}
                  title={
                    !underReview
                      ? 'The retailer has not submitted this cycle for review.'
                      : !allVerified
                        ? 'Verify every required document first.'
                        : undefined
                  }
                  onClick={() => decide.mutate({ decision: 'approved' })}
                >
                  Approve re-verification
                </Button>
                <Button
                  variant="outline"
                  className="text-danger border-danger/40 hover:bg-danger/5"
                  disabled={!canSendBack || decide.isPending}
                  title={
                    !underReview
                      ? 'The retailer has not submitted this cycle for review.'
                      : rejectedCount === 0
                        ? 'Reject at least one document so the retailer knows what to fix.'
                        : undefined
                  }
                  onClick={() => setRejecting(true)}
                >
                  Send back
                </Button>
              </div>
            </PermissionGate>
            {!underReview && (
              <p className="mt-3 text-[11.5px] text-ink-3">
                {data.status === 'approved' || data.status === 'rejected'
                  ? 'This cycle has been decided.'
                  : 'Waiting for the retailer to upload and submit their documents.'}
              </p>
            )}
            {underReview && !allVerified && rejectedCount === 0 && (
              <p className="mt-3 text-[11.5px] text-warning">
                Review each document above — verify the good ones, reject the ones that need replacing.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cycle-level send-back. The rejected documents already carry their own notes; this
          is the covering message for the whole cycle. */}
      <ReasonActionDialog
        open={rejecting}
        title="Send back for changes?"
        description={`${rejectedCount} document${rejectedCount === 1 ? '' : 's'} will be sent back. The retailer re-uploads only those and re-submits — nothing else is discarded.`}
        confirmLabel="Send back"
        danger
        loading={decide.isPending}
        onClose={() => setRejecting(false)}
        onConfirm={(reason) => decide.mutate({ decision: 'rejected', reason })}
      />

      {/* Per-document rejection — the note tells the retailer what's wrong with THIS file. */}
      <ReasonActionDialog
        open={rejectDoc !== null}
        title={`Reject ${rejectDoc?.label ?? 'document'}?`}
        description="Explain what's wrong with this document. The retailer sees this note and re-uploads just this file."
        confirmLabel="Reject document"
        danger
        loading={decideDoc.isPending}
        onClose={() => setRejectDoc(null)}
        onConfirm={(note) =>
          rejectDoc && decideDoc.mutate({ docId: rejectDoc.docId, decision: 'rejected', note })
        }
      />
    </Page>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}) {
  const toneCls =
    tone === 'success' ? 'border-success/30 bg-success-soft/40 text-success-strong'
    : tone === 'warning' ? 'border-warning/30 bg-warning-soft/40 text-warning'
    : tone === 'danger' ? 'border-danger/30 bg-danger/5 text-danger'
    : tone === 'info' ? 'border-line-2 bg-bg-2 text-ink'
    : 'border-line text-ink';
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneCls}`}>
      <div className="kicker">{label}</div>
      <div className="mt-0.5 font-mono tabular-nums text-[20px] leading-none">{value}</div>
    </div>
  );
}
