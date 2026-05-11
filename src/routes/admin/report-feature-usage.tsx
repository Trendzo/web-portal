import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useCsvExport } from '@/lib/csv';
import { formatPaise } from '@/lib/status';
import type { FeatureUsageRow } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminReportFeatureUsage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', 'feature-usage'],
    queryFn: () => api<FeatureUsageRow[]>('/admin/reports/feature-usage'),
  });
  const rows = data ?? [];

  const exportCsv = useCsvExport<FeatureUsageRow>('feature_usage', [
    { key: 'feature', header: 'Feature', accessor: (r) => r.feature },
    { key: 'unique', header: 'Unique users', accessor: (r) => r.uniqueUsers },
    { key: 'usage', header: 'Total usage', accessor: (r) => r.totalUsage },
    { key: 'cost', header: 'Cost (₹)', accessor: (r) => (r.costPaise / 100).toFixed(2) },
  ]);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Feature usage"
        description="Adoption + cost of consumer features (try-on, AI catalog, daily check-in, lucky draw)."
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
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Feature</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Unique users</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Total usage</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.feature} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{r.feature}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.uniqueUsers.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.totalUsage.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaise(r.costPaise)}</td>
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
