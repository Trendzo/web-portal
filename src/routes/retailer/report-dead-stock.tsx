import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta, unwrapRows } from '@/lib/report';
import { useStoreScope } from '@/lib/store-scope';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { FreshnessLabel } from '@/components/ui/freshness-label';

type Row = {
  listingId: string;
  listingName: string;
  status: string;
  totalStock: number;
  lastSoldAt: string | null;
};

export default function ReportDeadStock() {
  const scope = useStoreScope();
  const [days, setDays] = useState(30);
  const params = useMemo(
    () => ({ daysWithoutSale: String(days), limit: '50' }),
    [days],
  );

  const path = `${scope.basePath}/listings/dead-stock`;
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'dead-stock', scope.basePath, params],
    queryFn: () => api<unknown>(`${path}?${new URLSearchParams(params).toString()}`),
  });
  const rows = unwrapRows<Row>(data);
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('dead_stock', path, params);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Dead stock"
        description="Listings with stock but no sales in the threshold window. Mark down or retire."
        actions={
          <>
            <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
            <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>
              Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-2 max-w-xs">
        <label className="kicker text-ink-3">Days without sale</label>
        <Input
          type="number"
          min={1}
          value={days}
          onChange={(e) => setDays(Math.max(1, parseInt(e.target.value || '30', 10)))}
          className="w-20"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Empty kicker="Clean shelves" title="No dead stock at this threshold." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Listing</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Stock</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Last sold</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.listingId} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{r.listingName}</td>
                    <td className="px-3 py-2"><Badge tone="neutral" flat>{r.status}</Badge></td>
                    <td className="px-3 py-2 text-right font-mono">{r.totalStock}</td>
                    <td className="px-3 py-2 text-ink-3 font-mono text-[11.5px]">
                      {r.lastSoldAt ? new Date(r.lastSoldAt).toLocaleDateString('en-IN') : 'never'}
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
