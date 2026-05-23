import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta } from '@/lib/report';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FreshnessLabel } from '@/components/ui/freshness-label';

type Feature = {
  feature: string;
  uniqueUsers: number;
  totalUsage: number;
  costPaise: number;
  costPerSubmissionPaise?: number;
  breakdown?: Record<string, number>;
  note?: string;
};

type FeatureUsage = { windowDays: number; features: Feature[] };

export default function AdminReportFeatureUsage() {
  const path = '/admin/reports/feature-usage';
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', 'feature-usage'],
    queryFn: () => api<FeatureUsage>(path),
  });
  const meta = unwrapMeta(data);
  const features = data?.features ?? [];
  const exportCsv = useServerCsv('feature_usage', path);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Feature usage"
        description="Adoption and cost for virtual try-on and AI catalog generation. Decide what to scale or sunset."
        actions={
          <>
            <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
            <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>
              Export CSV
            </Button>
          </>
        }
      />

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Feature</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Unique users</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Total usage</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Cost / submission</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Total cost</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Status breakdown</th>
                </tr>
              </thead>
              <tbody>
                {features.map((f) => (
                  <tr key={f.feature} className="border-t border-line align-top">
                    <td className="px-3 py-2 text-ink">
                      {f.feature}
                      {f.note && <div className="text-[11px] text-ink-4 mt-0.5">{f.note}</div>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{f.uniqueUsers.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{f.totalUsage.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {f.costPerSubmissionPaise ? formatPaise(f.costPerSubmissionPaise) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaise(f.costPaise)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(f.breakdown ?? {}).map(([k, v]) => (
                          <Badge key={k} tone="neutral" flat>
                            {k} · {v}
                          </Badge>
                        ))}
                      </div>
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
