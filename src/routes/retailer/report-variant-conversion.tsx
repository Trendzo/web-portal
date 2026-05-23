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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import { FreshnessLabel } from '@/components/ui/freshness-label';

type Row = {
  variantId: string;
  listingId: string;
  label: string;
  views: number;
  cartAdds: number;
  cartQty: number;
  deliveredItems: number;
  viewToCartBp: number;
  cartToDeliveredBp: number;
  viewToDeliveredBp: number;
};

function bp(n: number) { return `${(n / 100).toFixed(1)}%`; }

export default function ReportVariantConversion() {
  const scope = useStoreScope();
  const [listingId, setListingId] = useState('');
  const params = useMemo(() => {
    const p: Record<string, string> = { limit: '100' };
    if (listingId.trim()) p.listingId = listingId.trim();
    return p;
  }, [listingId]);

  const path = `${scope.basePath}/listings/conversion`;
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'variant-conversion', scope.basePath, params],
    queryFn: () => api<unknown>(`${path}?${new URLSearchParams(params).toString()}`),
  });
  const rows = unwrapRows<Row>(data);
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('variant_conversion', path, params);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Variant conversion"
        description="Impressions → cart-adds → delivered, per variant. Diagnose drop-offs at size or color level."
        actions={
          <>
            <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
            <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>
              Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Filter by listing ID (optional)"
          value={listingId}
          onChange={(e) => setListingId(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Empty kicker="No data" title="No variant events in this window." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Variant</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Views</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Cart adds</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Delivered</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">View → Cart</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Cart → Delivered</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">View → Delivered</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.variantId} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{r.label}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.views.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.cartAdds.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.deliveredItems.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{bp(r.viewToCartBp)}</td>
                    <td className="px-3 py-2 text-right font-mono">{bp(r.cartToDeliveredBp)}</td>
                    <td className="px-3 py-2 text-right font-mono">{bp(r.viewToDeliveredBp)}</td>
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
