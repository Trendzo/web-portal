import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { PayoutCycle, PayoutCycleStatus } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

const TONE: Record<PayoutCycleStatus, 'warning' | 'info' | 'success' | 'danger'> = {
  pending: 'warning',
  processing: 'info',
  paid: 'success',
  failed: 'danger',
};

export default function RetailerPayouts() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'payouts'],
    queryFn: () => api<PayoutCycle[]>('/retailer/payouts'),
  });
  const list = data ?? [];

  return (
    <Page>
      <PageHeader
        kicker="Settlement"
        title="Payouts"
        description="Each cycle settles to your bank on the cadence admin set. Failed disbursals retry automatically; persistent failures need bank-detail update."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/retailer/early-disbursement">Request early disbursement</Link>
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : list.length === 0 ? (
        <Empty kicker="None" title="No payouts yet." />
      ) : (
        <ul className="space-y-2">
          {list.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold text-ink">{p.period}</span>
                    <Badge tone={TONE[p.status]} pulse={p.status === 'failed' || p.status === 'pending'}>
                      {p.status}
                    </Badge>
                    <span className="font-mono text-[14px] text-ink">{formatPaise(p.amountPaise)}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-ink-3">
                    Bank {p.bankAccountMasked}
                    {p.bankConfirmationRef && <> · UTR {p.bankConfirmationRef}</>}
                    {p.retryCount > 0 && <> · {p.retryCount} retr{p.retryCount === 1 ? 'y' : 'ies'}</>}
                  </div>
                  {p.initiatedAt && (
                    <div className="mt-1 text-[11.5px] text-ink-4">
                      Initiated {formatAge(p.initiatedAt)}
                      {p.settledAt && <> · Settled {formatAge(p.settledAt)}</>}
                    </div>
                  )}
                </div>
                <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                  <Link to={`/retailer/payouts/${p.id}`}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </ul>
      )}
    </Page>
  );
}
