import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useCsvExport } from '@/lib/csv';
import type { LeaderboardRow } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function pctBp(n: number): string { return `${(n / 100).toFixed(1)}%`; }

export default function AdminReportLeaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', 'leaderboard'],
    queryFn: () => api<LeaderboardRow[]>('/admin/reports/leaderboard'),
  });
  const rows = data ?? [];

  const exportCsv = useCsvExport<LeaderboardRow>('leaderboard', [
    { key: 'rank', header: 'Rank', accessor: (r) => r.rank },
    { key: 'name', header: 'Retailer', accessor: (r) => r.retailerName },
    { key: 'accept', header: 'Acceptance', accessor: (r) => pctBp(r.acceptanceRateBp) },
    { key: 'fulfil', header: 'Fulfilment', accessor: (r) => pctBp(r.fulfilmentScoreBp) },
    { key: 'returns', header: 'Returns', accessor: (r) => pctBp(r.returnRateBp) },
    { key: 'disputes', header: 'Disputes', accessor: (r) => pctBp(r.disputeRateBp) },
  ]);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Retailer leaderboard"
        description="Top retailers by acceptance × fulfilment × inverse-return × inverse-dispute. Drives weekly partner highlights."
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
                  <th className="px-3 py-2 text-left font-medium text-ink-3">#</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Retailer</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Acceptance</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Fulfilment</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Returns</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Disputes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.retailerId} className="border-t border-line">
                    <td className="px-3 py-2 font-mono text-ink-3">{r.rank}</td>
                    <td className="px-3 py-2 text-ink">{r.retailerName}</td>
                    <td className="px-3 py-2 text-right font-mono">{pctBp(r.acceptanceRateBp)}</td>
                    <td className="px-3 py-2 text-right font-mono">{pctBp(r.fulfilmentScoreBp)}</td>
                    <td className="px-3 py-2 text-right font-mono">{pctBp(r.returnRateBp)}</td>
                    <td className="px-3 py-2 text-right font-mono">{pctBp(r.disputeRateBp)}</td>
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
