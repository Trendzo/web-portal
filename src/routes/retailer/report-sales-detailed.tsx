import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta } from '@/lib/report';
import { useStoreScope } from '@/lib/store-scope';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Segmented } from '@/components/ui/segmented';
import { Empty } from '@/components/ui/empty';
import { FreshnessLabel } from '@/components/ui/freshness-label';

type Granularity = 'day' | 'week' | 'month';
type Breakdown = 'none' | 'status' | 'delivery_method' | 'category';

type Row = {
  bucket: string;
  key?: string;
  ordersCount?: number;
  itemsCount?: number;
  grossPaise: number;
};

export default function ReportSalesDetailed() {
  const scope = useStoreScope();
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [breakdown, setBreakdown] = useState<Breakdown>('none');

  const params = useMemo(
    () => ({ granularity, ...(breakdown === 'none' ? {} : { breakdown }) }),
    [granularity, breakdown],
  );

  const path = `${scope.basePath}/sales-detailed`;
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'sales-detailed', scope.basePath, granularity, breakdown],
    queryFn: () =>
      api<{ granularity: Granularity; breakdown: string | null; rows: Row[] }>(
        `${path}?${new URLSearchParams(params as Record<string, string>).toString()}`,
      ),
  });

  const rows = data?.rows ?? [];
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('sales_detailed', path, params);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Sales detail"
        description="Top-line orders and gross revenue broken down by status, delivery method, or category."
        actions={
          <>
            <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Download className="size-3.5" />}
              onClick={() => exportCsv()}
            >
              Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented<Granularity>
          value={granularity}
          onChange={setGranularity}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
        <Segmented<Breakdown>
          value={breakdown}
          onChange={setBreakdown}
          options={[
            { value: 'none', label: 'None' },
            { value: 'status', label: 'Status' },
            { value: 'delivery_method', label: 'Delivery' },
            { value: 'category', label: 'Category' },
          ]}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Empty kicker="No data" title="No sales in this window." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Bucket</th>
                  {breakdown !== 'none' && (
                    <th className="px-3 py-2 text-left font-medium text-ink-3">
                      {breakdown === 'delivery_method' ? 'Delivery' : breakdown}
                    </th>
                  )}
                  {breakdown === 'category' ? (
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Items</th>
                  ) : (
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Orders</th>
                  )}
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Gross</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.bucket}-${r.key ?? ''}-${i}`} className="border-t border-line">
                    <td className="px-3 py-2 font-mono text-ink-2">{r.bucket}</td>
                    {breakdown !== 'none' && (
                      <td className="px-3 py-2 text-ink">{r.key ?? '—'}</td>
                    )}
                    <td className="px-3 py-2 text-right font-mono">
                      {(r.ordersCount ?? r.itemsCount ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaise(r.grossPaise)}</td>
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
