import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCcw, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { PayoutCycle } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';

type AdminPayout = PayoutCycle & { storeName: string };

export default function AdminPayoutDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payouts-pipeline', id],
    queryFn: () => api<AdminPayout>(`/admin/payouts/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading) return <Page><Skeleton className="h-72" /></Page>;
  if (!data) return <Page><PageHeader title="Payout not found" /></Page>;

  return (
    <Page>
      <PageHeader
        kicker="Settlement"
        title={`${data.storeName} · ${data.period}`}
        description={`${formatPaise(data.amountPaise)} · status ${data.status}`}
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/admin/payouts-pipeline">Back</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge
          tone={data.status === 'failed' ? 'danger' : data.status === 'paid' ? 'success' : 'warning'}
          pulse={data.status === 'failed'}
        >
          {data.status.replace(/_/g, ' ')}
        </Badge>
        <Badge tone="neutral" flat>{data.retryCount} retries</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Bank" title="Disbursal channel" />
            <MetaList
              cols={1}
              items={[
                { label: 'Account', value: data.bankAccountMasked },
                { label: 'UTR', value: data.bankConfirmationRef ?? '—', mono: true },
                ...(data.initiatedAt ? [{ label: 'Initiated', value: `${new Date(data.initiatedAt).toLocaleString('en-IN')} · ${formatAge(data.initiatedAt)}` }] : []),
                ...(data.settledAt ? [{ label: 'Settled', value: `${new Date(data.settledAt).toLocaleString('en-IN')} · ${formatAge(data.settledAt)}` }] : []),
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" iconLeft={<RefreshCcw className="size-3.5" />} onClick={() => toast.info('Retry queued (not yet wired)')}>
                Retry payout
              </Button>
              <Button variant="outline" iconLeft={<Upload className="size-3.5" />} onClick={() => toast.info('Bank confirmation upload not yet wired')}>
                Upload bank confirmation
              </Button>
              <Button variant="ghost" onClick={() => toast.info('Hold action not yet wired')}>
                Hold payout
              </Button>
              <Button variant="ghost" onClick={() => toast.info('Override not yet wired')}>
                Override amount
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Deductions" title="What came off the gross" />
            {data.deductions && data.deductions.length > 0 ? (
              <ul className="divide-y divide-line">
                {data.deductions.map((d) => (
                  <li key={d.kind} className="flex items-center justify-between py-2 text-[13px]">
                    <span className="text-ink-2">{d.label}</span>
                    <span className="font-mono text-ink">−{formatPaise(d.amountPaise)}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between py-2 text-[13px] font-semibold">
                  <span className="text-ink">Net payout</span>
                  <span className="font-mono text-ink">{formatPaise(data.netPaise)}</span>
                </li>
              </ul>
            ) : (
              <p className="text-[13px] text-ink-3">No deductions on this cycle.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
