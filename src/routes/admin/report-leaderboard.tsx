import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta } from '@/lib/report';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import { FreshnessLabel } from '@/components/ui/freshness-label';

type Row = {
  rank: number;
  retailerId: string;
  retailerName: string;
  ordersTotal: number;
  itemsTotal: number;
  acceptanceRateBp: number;
  fulfilmentScoreBp: number;
  disputeRateBp: number;
  returnRateBp: number;
  score: number;
};

type Leaderboard = {
  windowDays: number;
  best: Row[];
  worst: Row[];
  all: Row[];
};

function bp(n: number) { return `${(n / 100).toFixed(1)}%`; }

export default function AdminReportLeaderboard() {
  const path = '/admin/reports/leaderboard';
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', 'leaderboard'],
    queryFn: () => api<Leaderboard>(`${path}?topN=10`),
  });
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('leaderboard', path, { topN: '10' });

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Retailer leaderboard"
        description="Best and worst performers across acceptance, fulfilment, returns, and disputes (30d)."
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
      ) : data.best.length === 0 && data.worst.length === 0 ? (
        <Empty kicker="No data" title="Not enough orders this period." />
      ) : (
        <div className="space-y-8">
          <section>
            <SectionHeading kicker="Top performers" title="Best stores" />
            <Table rows={data.best} />
          </section>
          <section>
            <SectionHeading kicker="Bottom performers" title="Need attention" />
            <Table rows={data.worst} />
          </section>
        </div>
      )}
    </Page>
  );
}

function Table({ rows }: { rows: Row[] }) {
  return (
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
              <th className="px-3 py-2 text-right font-medium text-ink-3">Score</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.retailerId} className="border-t border-line">
                <td className="px-3 py-2 font-mono text-ink-3">{r.rank}</td>
                <td className="px-3 py-2 text-ink">{r.retailerName}</td>
                <td className="px-3 py-2 text-right font-mono">{bp(r.acceptanceRateBp)}</td>
                <td className="px-3 py-2 text-right font-mono">{bp(r.fulfilmentScoreBp)}</td>
                <td className="px-3 py-2 text-right font-mono">{bp(r.returnRateBp)}</td>
                <td className="px-3 py-2 text-right font-mono">{bp(r.disputeRateBp)}</td>
                <td className="px-3 py-2 text-right font-mono">{(r.score / 100).toFixed(1)}</td>
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
  );
}
