import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { PaymentReconRow, PaymentReconciliationStatus } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CopyableId } from '@/components/ui/copyable-id';

const STATUS_TONE: Record<PaymentReconciliationStatus, 'success' | 'warning' | 'danger'> = {
  matched: 'success',
  mismatch: 'warning',
  missing_capture: 'danger',
  missing_settlement: 'danger',
};

export default function AdminPaymentReconciliation() {
  const [tab, setTab] = useState<PaymentReconciliationStatus | 'all'>('mismatch');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payment-reconciliation'],
    queryFn: () => api<PaymentReconRow[]>('/admin/payment-reconciliation'),
  });
  const list = data ?? [];
  const filtered = tab === 'all' ? list : list.filter((r) => r.status === tab);

  return (
    <Page>
      <PageHeader
        kicker="Payments"
        title="Capture reconciliation"
        description="Compare gateway settlement files against per-order capture records. Surface mismatches, missing captures, missing settlements."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as PaymentReconciliationStatus | 'all')}>
        <TabsList>
          <TabsTrigger value="mismatch">Mismatch <span className="ml-1.5 text-ink-3">{list.filter((r) => r.status === 'mismatch').length}</span></TabsTrigger>
          <TabsTrigger value="missing_settlement">Missing settlement <span className="ml-1.5 text-ink-3">{list.filter((r) => r.status === 'missing_settlement').length}</span></TabsTrigger>
          <TabsTrigger value="missing_capture">Missing capture <span className="ml-1.5 text-ink-3">{list.filter((r) => r.status === 'missing_capture').length}</span></TabsTrigger>
          <TabsTrigger value="matched">Matched <span className="ml-1.5 text-ink-3">{list.filter((r) => r.status === 'matched').length}</span></TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : filtered.length === 0 ? (
            <Empty kicker="All clear" title="No rows in this bucket." />
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-bg-2/40">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-ink-3">Order</th>
                      <th className="px-3 py-2 text-left font-medium text-ink-3">Gateway</th>
                      <th className="px-3 py-2 text-right font-medium text-ink-3">Capture</th>
                      <th className="px-3 py-2 text-right font-medium text-ink-3">Settlement</th>
                      <th className="px-3 py-2 text-right font-medium text-ink-3">Diff</th>
                      <th className="px-3 py-2 text-left font-medium text-ink-3">Status</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-t border-line">
                        <td className="px-3 py-2"><CopyableId value={r.orderId} label="order id" /></td>
                        <td className="px-3 py-2 capitalize text-ink-2">{r.gateway}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatPaise(r.capturePaise)}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.settlementPaise > 0 ? formatPaise(r.settlementPaise) : '—'}</td>
                        <td className={`px-3 py-2 text-right font-mono ${r.diffPaise === 0 ? 'text-ink-3' : r.diffPaise > 0 ? 'text-warning' : 'text-danger'}`}>
                          {r.diffPaise === 0 ? '0' : `${r.diffPaise > 0 ? '+' : ''}${formatPaise(r.diffPaise)}`}
                        </td>
                        <td className="px-3 py-2">
                          <Badge tone={STATUS_TONE[r.status]} pulse={r.status !== 'matched'}>{r.status.replace(/_/g, ' ')}</Badge>
                          <div className="mt-0.5 text-[11px] text-ink-4">captured {formatAge(r.capturedAt)}</div>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                            <Link to={`/admin/orders/${r.orderId}`}>Open</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </Page>
  );
}
