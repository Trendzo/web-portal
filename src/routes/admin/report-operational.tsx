import { useQuery } from '@tanstack/react-query';
import { Download, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useCsvExport } from '@/lib/csv';
import { cn } from '@/lib/cn';
import type { OperationalRow } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function trendBadge(bp: number) {
  const positive = bp >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11.5px]', positive ? 'text-success' : 'text-danger')}>
      <Icon className="size-3" />
      {(bp / 100).toFixed(1)}%
    </span>
  );
}

export default function AdminReportOperational() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', 'operational'],
    queryFn: () => api<OperationalRow[]>('/admin/reports/operational'),
  });
  const rows = data ?? [];

  const exportCsv = useCsvExport<OperationalRow>('operational', [
    { key: 'metric', header: 'Metric', accessor: (r) => r.metric },
    { key: 'value', header: 'Value', accessor: (r) => r.value },
    { key: 'trend', header: 'Trend %', accessor: (r) => (r.trendBp / 100).toFixed(1) },
  ]);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Operational health"
        description="Throughput + latency + error counts. Watch with oncall alerts."
        actions={
          <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv(rows)}>Export CSV</Button>
        }
      />
      {isLoading ? <Skeleton className="h-40" /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.metric}>
              <CardContent className="p-4">
                <div className="text-[11.5px] uppercase tracking-wide text-ink-3">{r.metric}</div>
                <div className="mt-1 font-mono text-[20px] text-ink leading-none">{r.value}</div>
                <div className="mt-2">{trendBadge(r.trendBp)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
