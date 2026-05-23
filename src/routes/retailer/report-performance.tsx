import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta, unwrapRows } from '@/lib/report';
import { FreshnessLabel } from '@/components/ui/freshness-label';
import type { FulfilmentMetricRow } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function pctFromBp(bp: number): string {
  return `${(bp / 100).toFixed(1)}%`;
}
function fmtMs(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default function RetailerReportPerformance() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'reports', 'performance'],
    queryFn: () => api<unknown>('/retailer/reports/performance'),
  });
  const rows = unwrapRows<FulfilmentMetricRow>(data);
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('performance_report', '/retailer/reports/performance');

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Performance report"
        description="Acceptance rate and fulfilment timings vs the Performance Floor. Drives Compliance escalation."
        actions={
          <>
            <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
            <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>Export CSV</Button>
          </>
        }
      />

      {isLoading ? <Skeleton className="h-40" /> : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Date</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Acceptance</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Accept</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Pack</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Handover</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">End-to-end</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.bucket} className="border-t border-line">
                    <td className="px-3 py-2 font-mono text-ink-2">{r.bucket}</td>
                    <td className="px-3 py-2 text-right font-mono">{pctFromBp(r.acceptanceRateBp)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtMs(r.avgTimeToAcceptMs)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtMs(r.avgTimeToPackMs)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtMs(r.avgTimeToHandoverMs)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtMs(r.avgEndToEndMs)}</td>
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
