import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useCsvExport } from '@/lib/csv';
import type { ComplianceFloorRow } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminReportCompliance() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', 'compliance'],
    queryFn: () => api<ComplianceFloorRow[]>('/admin/reports/compliance'),
  });
  const rows = data ?? [];

  const exportCsv = useCsvExport<ComplianceFloorRow>('compliance_floor', [
    { key: 'name', header: 'Retailer', accessor: (r) => r.retailerName },
    { key: 'metric', header: 'Metric', accessor: (r) => r.metric },
    { key: 'value', header: 'Value', accessor: (r) => r.value },
    { key: 'threshold', header: 'Threshold', accessor: (r) => r.threshold },
    { key: 'days', header: 'Days below', accessor: (r) => r.daysBelow },
  ]);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Performance-floor breaches"
        description="Retailers below the floor. Click to escalate via Policy Enforcement."
        actions={
          <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv(rows)}>Export CSV</Button>
        }
      />

      {isLoading ? <Skeleton className="h-32" /> : rows.length === 0 ? (
        <Empty kicker="All clear" title="No retailers below floor." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Retailer</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Metric</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Value</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Threshold</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Days below</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.retailerName}_${r.metric}`} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{r.retailerName}</td>
                    <td className="px-3 py-2"><Badge tone="warning" flat>{r.metric}</Badge></td>
                    <td className="px-3 py-2 text-right font-mono text-danger">{r.value}</td>
                    <td className="px-3 py-2 text-right font-mono text-ink-3">{r.threshold}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.daysBelow}d</td>
                    <td className="px-3 py-1.5 text-right">
                      <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                        <Link to="/admin/policy-enforcement">Escalate</Link>
                      </Button>
                    </td>
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
