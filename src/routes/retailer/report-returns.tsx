import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useCsvExport } from '@/lib/csv';
import type { ReturnsReportRow } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function pctFromBp(bp: number): string {
  return `${(bp / 100).toFixed(2)}%`;
}

export default function RetailerReportReturns() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'reports', 'returns'],
    queryFn: () => api<ReturnsReportRow[]>('/retailer/reports/returns'),
  });
  const rows = data ?? [];

  const exportCsv = useCsvExport<ReturnsReportRow>('returns_report', [
    { key: 'bucket', header: 'Date', accessor: (r) => r.bucket },
    { key: 'rate', header: 'Return rate', accessor: (r) => pctFromBp(r.returnRateBp) },
    { key: 'total', header: 'Returns', accessor: (r) => r.totalReturns },
    { key: 'top', header: 'Top listing', accessor: (r) => r.topListing },
    { key: 'reason', header: 'Top reason', accessor: (r) => r.topReason },
  ]);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Returns report"
        description="Return rate, count, and top listing/reason by day. Identifies products driving repeat returns."
        actions={
          <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv(rows)}>Export CSV</Button>
        }
      />

      {isLoading ? <Skeleton className="h-40" /> : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Date</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Rate</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Returns</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Top listing</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Top reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.bucket} className="border-t border-line">
                    <td className="px-3 py-2 font-mono text-ink-2">{r.bucket}</td>
                    <td className="px-3 py-2 text-right font-mono">{pctFromBp(r.returnRateBp)}</td>
                    <td className="px-3 py-2 text-right">{r.totalReturns}</td>
                    <td className="px-3 py-2">{r.topListing}</td>
                    <td className="px-3 py-2"><Badge tone="warning" flat>{r.topReason}</Badge></td>
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
