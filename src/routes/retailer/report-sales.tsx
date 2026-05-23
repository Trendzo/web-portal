import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta, unwrapRows } from '@/lib/report';
import { FreshnessLabel } from '@/components/ui/freshness-label';
import type { SalesReportRow } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function RetailerReportSales() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'reports', 'sales'],
    queryFn: () => api<unknown>('/retailer/reports/sales'),
  });
  const rows = unwrapRows<SalesReportRow>(data);
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('sales_report', '/retailer/reports/sales');

  const totals = rows.reduce(
    (acc, r) => ({ orders: acc.orders + r.ordersCount, gross: acc.gross + r.grossPaise, net: acc.net + r.netPaise }),
    { orders: 0, gross: 0, net: 0 },
  );

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Sales report"
        description="Daily orders, gross merchandise value, and net (after discounts and refunds). Last 14 days."
        actions={
          <>
            <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
            <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>Export CSV</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Orders" value={totals.orders.toLocaleString('en-IN')} />
        <Kpi label="Gross" value={formatPaise(totals.gross)} />
        <Kpi label="Net" value={formatPaise(totals.net)} />
      </div>

      {isLoading ? <Skeleton className="h-40" /> : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Date</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Orders</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Gross</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.bucket} className="border-t border-line">
                    <td className="px-3 py-2 font-mono text-ink-2">{r.bucket}</td>
                    <td className="px-3 py-2 text-right">{r.ordersCount}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaise(r.grossPaise)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaise(r.netPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </Page>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11.5px] uppercase tracking-wide text-ink-3">{label}</div>
        <div className="mt-1 font-mono text-[18px] text-ink">{value}</div>
      </CardContent>
    </Card>
  );
}
