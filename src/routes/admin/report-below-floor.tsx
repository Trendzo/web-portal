import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta } from '@/lib/report';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import { FreshnessLabel } from '@/components/ui/freshness-label';

type Breach = { metric: string; valueBp: number; floorBp: number };
type Enforcement = { step: string; breachKind: string; actedAt: string; reason: string | null } | null;

type Row = {
  retailerId: string;
  retailerName: string;
  breaches: Breach[];
  currentEnforcement: Enforcement;
  suggestedAction: string;
};

type BelowFloor = { windowDays: number; rows: Row[] };

function bp(n: number) { return `${(n / 100).toFixed(1)}%`; }

function actionTone(a: string): 'neutral' | 'warning' | 'danger' {
  if (a === 'terminate' || a === 'suspend') return 'danger';
  if (a === 'pause' || a === 'warn_again') return 'warning';
  return 'neutral';
}

export default function AdminReportBelowFloor() {
  const path = '/admin/reports/below-floor';
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', 'below-floor'],
    queryFn: () => api<BelowFloor>(path),
  });
  const rows = data?.rows ?? [];
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('below_floor', path);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Below-floor retailers"
        description="Retailers under acceptance or over dispute floor with their current enforcement state."
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
        <Skeleton className="h-32" />
      ) : rows.length === 0 ? (
        <Empty kicker="All clear" title="No retailers below floor." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Retailer</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Breaches</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Current enforcement</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Suggested action</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.retailerId} className="border-t border-line align-top">
                    <td className="px-3 py-2 text-ink">{r.retailerName}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        {r.breaches.map((b) => (
                          <span key={b.metric} className="font-mono text-[11.5px] text-danger">
                            {b.metric}: {bp(b.valueBp)} (floor {bp(b.floorBp)})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {r.currentEnforcement ? (
                        <div className="flex flex-col gap-1 text-[11.5px]">
                          <Badge tone="warning" flat>{r.currentEnforcement.step}</Badge>
                          <span className="text-ink-3 font-mono">{r.currentEnforcement.breachKind}</span>
                          <span className="text-ink-4">
                            {new Date(r.currentEnforcement.actedAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-ink-4 text-[11.5px]">none</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={actionTone(r.suggestedAction)} flat>{r.suggestedAction}</Badge>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Link
                        to={`/admin/stores/${r.retailerId}/reports/compliance`}
                        className="text-[11.5px] underline underline-offset-2 text-ink-3 hover:text-ink"
                      >
                        Drill in
                      </Link>
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
