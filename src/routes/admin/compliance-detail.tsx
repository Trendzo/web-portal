import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink, FileText, ImageIcon } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { kycReverificationStatusMeta, formatAge } from '@/lib/status';
import type { KycReverification, RequiredDocumentType } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { CopyableId } from '@/components/ui/copyable-id';
import { ReasonActionDialog } from '@/components/admin/reason-action-dialog';

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

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'compliance', id],
    queryFn: () => api<KycReverification>(`/admin/compliance/kyc/${id}`),
    enabled: Boolean(id),
  });

  const decide = useMutation({
    mutationFn: ({ decision, reason }: { decision: 'approved' | 'rejected'; reason?: string }) =>
      api(`/admin/compliance/kyc/${id}/decide`, { method: 'POST', body: { decision, reason } }),
    onSuccess: (_data, { decision }) => {
      toast.success(decision === 'approved' ? 'KYC approved' : 'KYC rejected');
      setRejecting(false);
      void qc.invalidateQueries({ queryKey: ['admin', 'compliance', id] });
      void qc.invalidateQueries({ queryKey: ['admin', 'compliance'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
  });

  if (isLoading || !data) return <Page><Skeleton className="h-72" /></Page>;
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
              Open each document in a new tab to review. Approve the whole cycle once every required document looks good.
            </p>
            <ul className="mt-4 space-y-2">
              {DOC_SLOTS.map(({ kind, label }) => {
                const d = docByKind.get(kind);
                const fileUrl = d?.fileUrl ?? null;
                const status = d?.status ?? 'missing';
                const statusTone =
                  status === 'verified' ? 'success'
                  : status === 'pending_review' ? 'warning'
                  : status === 'rejected' ? 'danger'
                  : 'neutral';
                const previewable = fileUrl && isImageUrl(fileUrl);
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
                        <div className="mt-1.5">
                          <Badge tone={statusTone}>{status.replace(/_/g, ' ')}</Badge>
                        </div>
                      </div>
                    </div>
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
            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                variant="accent"
                loading={decide.isPending}
                disabled={data.status === 'approved' || submittedCount < DOC_SLOTS.length}
                title={submittedCount < DOC_SLOTS.length ? 'Retailer hasn\'t uploaded every document yet.' : undefined}
                onClick={() => decide.mutate({ decision: 'approved' })}
              >
                Approve re-verification
              </Button>
              <Button
                variant="outline"
                className="text-danger border-danger/40 hover:bg-danger/5"
                disabled={data.status === 'approved' || data.status === 'rejected'}
                onClick={() => setRejecting(true)}
              >
                Reject
              </Button>
            </div>
            {data.status === 'pending' && submittedCount === 0 && (
              <p className="mt-3 text-[11.5px] text-warning">
                Retailer hasn't uploaded any document yet. No action available until at least one document arrives.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <ReasonActionDialog
        open={rejecting}
        title="Reject re-verification?"
        description="The retailer will be asked to re-submit. Persistent rejection escalates the warning ladder."
        confirmLabel="Reject"
        danger
        onClose={() => setRejecting(false)}
        onConfirm={(reason) => decide.mutate({ decision: 'rejected', reason })}
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
