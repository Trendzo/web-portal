import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta } from '@/lib/report';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FreshnessLabel } from '@/components/ui/freshness-label';

type SummaryRow = { metric: string; value: string; raw: number };
type HourlyRow = { bucket: string; ordersCount: number };

type Operational = {
  windowDays: number;
  summary: SummaryRow[];
  payoutVolume: {
    completedPaise: number;
    pendingPaise: number;
    completedCount: number;
    pendingCount: number;
  };
  hourly: HourlyRow[];
};

export default function AdminReportOperational() {
  const path = '/admin/reports/operational';
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', 'operational'],
    queryFn: () => api<Operational>(path),
  });
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('operational', path);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Operational health"
        description="Throughput, fulfilment latency, payout volume, and disputes. Last 30 days."
        actions={
          <>
            <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
            <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>
              Export CSV
            </Button>
          </>
        }
      />

      {isLoading || !data ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.summary.map((r) => (
              <Card key={r.metric}>
                <CardContent className="p-4">
                  <div className="text-[11.5px] uppercase tracking-wide text-ink-3">{r.metric}</div>
                  <div className="mt-1 font-mono text-[20px] text-ink leading-none">{r.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 mb-3 text-[12.5px] font-medium text-ink-2">Payout volume (30d)</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Completed value" value={formatPaise(data.payoutVolume.completedPaise)} sub={`${data.payoutVolume.completedCount} cycles`} />
            <Kpi label="Pending value" value={formatPaise(data.payoutVolume.pendingPaise)} sub={`${data.payoutVolume.pendingCount} cycles`} />
          </div>

          <div className="mt-6 mb-3 text-[12.5px] font-medium text-ink-2">Orders per hour (last 24h)</div>
          {data.hourly.length === 0 ? (
            <div className="text-[12.5px] text-ink-4">No orders in last 24h.</div>
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-bg-2/40">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-ink-3">Hour</th>
                      <th className="px-3 py-2 text-right font-medium text-ink-3">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hourly.map((r) => (
                      <tr key={r.bucket} className="border-t border-line">
                        <td className="px-3 py-2 font-mono text-ink-2">{r.bucket}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.ordersCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Page>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11.5px] uppercase tracking-wide text-ink-3">{label}</div>
        <div className="mt-1 font-mono text-[18px] text-ink leading-none">{value}</div>
        {sub && <div className="mt-1 text-[11px] text-ink-4">{sub}</div>}
      </CardContent>
    </Card>
  );
}
