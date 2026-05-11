import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, FileText } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { kycReverificationStatusMeta, formatAge } from '@/lib/status';
import type { KycReverification } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { ReasonActionDialog } from '@/components/admin/reason-action-dialog';

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

  return (
    <Page>
      <PageHeader
        kicker="Compliance"
        title={`KYC re-verification — retailer ${data.retailerId}`}
        description={`Last verified ${data.lastVerifiedAt ? formatAge(data.lastVerifiedAt) : 'never'} · Due ${new Date(data.dueAt).toLocaleDateString()}`}
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/admin/compliance">Back to queue</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Documents" title="Submitted by retailer" />
            <ul className="space-y-2">
              {data.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg border border-line bg-bg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-ink-3" />
                    <div>
                      <div className="text-[13.5px] font-medium text-ink">{d.label}</div>
                      <div className="text-[11.5px] text-ink-3">
                        {d.uploadedAt ? `Uploaded ${formatAge(d.uploadedAt)}` : 'Missing'}
                      </div>
                    </div>
                  </div>
                  <Badge tone={d.status === 'verified' ? 'success' : d.status === 'pending_review' ? 'warning' : d.status === 'rejected' ? 'danger' : 'neutral'}>
                    {d.status.replace(/_/g, ' ')}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Decision" title="Approve or send back" />
            <MetaList
              cols={1}
              items={[
                { label: 'Documents verified', value: `${data.documents.filter((d) => d.status === 'verified').length}/${data.documents.length}` },
                { label: 'Documents pending', value: `${data.documents.filter((d) => d.status === 'pending_review').length}` },
                { label: 'Documents missing', value: `${data.documents.filter((d) => d.status === 'missing').length}` },
              ]}
            />
            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                variant="accent"
                loading={decide.isPending}
                disabled={data.status === 'approved'}
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
