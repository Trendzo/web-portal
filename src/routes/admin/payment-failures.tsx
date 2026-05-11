import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, BellRing, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge, formatPaise, paymentMethodLabel } from '@/lib/status';
import type { PaymentFailureRow } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';

export default function AdminPaymentFailures() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payment-failures'],
    queryFn: () => api<PaymentFailureRow[]>('/admin/payment-failures'),
  });
  const list = data ?? [];

  return (
    <Page>
      <PageHeader
        kicker="Payments"
        title="Payment failures"
        description="Capture-failure feed. Notify the consumer to retry or release the inventory reservation so other shoppers can buy."
      />

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : list.length === 0 ? (
        <Empty kicker="All clear" title="No payment failures right now." />
      ) : (
        <ul className="space-y-2">
          {list.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-ink">{f.consumerEmail}</span>
                      <Badge tone="danger" pulse>{f.failureCode}</Badge>
                      <Badge tone="neutral" flat>{paymentMethodLabel(f.method)}</Badge>
                      <Badge tone="warning" flat>{f.attemptCount} attempt{f.attemptCount === 1 ? '' : 's'}</Badge>
                      {f.reservationStillHeld && <Badge tone="warning" pulse>Reservation held</Badge>}
                    </div>
                    <div className="mt-1 text-[12px] text-ink-3">
                      <CopyableId value={f.orderId} label="order id" /> · {formatPaise(f.amountPaise)} · failed {formatAge(f.failedAt)}
                    </div>
                    <div className="mt-1 text-[12px] text-ink-2 italic">{f.failureMessage}</div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 sm:flex-row">
                    <Button size="sm" variant="outline" iconLeft={<BellRing className="size-3.5" />} onClick={() => toast.success('Consumer notified (mock)')}>
                      Notify consumer
                    </Button>
                    {f.reservationStillHeld && (
                      <Button size="sm" variant="outline" iconLeft={<Lock className="size-3.5" />} onClick={() => toast.success('Reservation released (mock)')}>
                        Release reservation
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                      <Link to={`/admin/orders/${f.orderId}`}>Open order</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </ul>
      )}
    </Page>
  );
}
