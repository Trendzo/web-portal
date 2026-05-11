import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { kycReverificationStatusMeta } from '@/lib/status';
import type { KycReverification } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { MockDataBadge } from '@/components/ui/mock-data-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';

export default function RetailerKyc() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'kyc'],
    queryFn: () => api<KycReverification | null>('/retailer/kyc'),
  });

  const submit = useMutation({
    mutationFn: (id: string) => api(`/retailer/kyc/${id}/submit`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retailer', 'kyc'] });
      toast.success('KYC submitted for review.');
    },
  });

  if (isLoading || !data || !('id' in data)) {
    return (
      <Page>
        <PageHeader kicker="Compliance" title="KYC re-verification" actions={<MockDataBadge label="MOCKED — pending backend §3" />} />
        <Skeleton className="h-72" />
      </Page>
    );
  }

  const meta = kycReverificationStatusMeta(data.status);
  const dueIn = Math.round((new Date(data.dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const graceIn = Math.round((new Date(data.gracePeriodEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <Page>
      <PageHeader
        kicker="Compliance"
        title="KYC re-verification"
        description="Annual compliance check. Upload current documents before the due date to avoid suspension."
        actions={<MockDataBadge label="MOCKED — pending backend §3" />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Status" title="Current re-verification cycle" />
            <div className="mb-4 flex items-center gap-2">
              <Badge tone={meta.tone}>{meta.label}</Badge>
              <span className="text-[12.5px] text-ink-3">
                <CalendarClock className="inline size-3.5 mr-1" />
                Due in {dueIn} day{dueIn === 1 ? '' : 's'} · Grace ends in {graceIn} days
              </span>
            </div>
            <MetaList
              cols={1}
              items={[
                { label: 'Last verified', value: data.lastVerifiedAt ? new Date(data.lastVerifiedAt).toLocaleDateString() : '—' },
                { label: 'Due date', value: new Date(data.dueAt).toLocaleDateString() },
                { label: 'Grace period ends', value: new Date(data.gracePeriodEndsAt).toLocaleDateString() },
              ]}
            />
            <div className="mt-6">
              <Button
                variant="accent"
                iconLeft={<ShieldCheck className="size-4" />}
                loading={submit.isPending}
                onClick={() => submit.mutate(data.id)}
              >
                Submit re-verification
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Documents" title="Required uploads" />
            <ul className="space-y-2">
              {data.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg border border-line bg-bg px-4 py-3">
                  <div>
                    <div className="text-[13.5px] font-medium text-ink">{d.label}</div>
                    <div className="text-[11.5px] text-ink-3">
                      {d.uploadedAt ? `Uploaded ${new Date(d.uploadedAt).toLocaleDateString()}` : 'Not uploaded'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={d.status === 'verified' ? 'success' : d.status === 'pending_review' ? 'warning' : d.status === 'rejected' ? 'danger' : 'neutral'}>
                      {d.status.replace(/_/g, ' ')}
                    </Badge>
                    <Button size="sm" variant="outline" iconLeft={<Upload className="size-3.5" />}>
                      Upload
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
