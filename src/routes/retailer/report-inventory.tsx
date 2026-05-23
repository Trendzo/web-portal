import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta, unwrapRows } from '@/lib/report';
import { FreshnessLabel } from '@/components/ui/freshness-label';
import type { InventoryHealthRow } from '@/lib/types';
import { formatAge } from '@/lib/status';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_META: Record<InventoryHealthRow['status'], { label: string; tone: 'warning' | 'danger' | 'info' | 'neutral' }> = {
  low_stock: { label: 'Low stock', tone: 'warning' },
  out_of_stock: { label: 'Out of stock', tone: 'danger' },
  overstock: { label: 'Overstock', tone: 'info' },
  aged: { label: 'Aged inventory', tone: 'neutral' },
};

export default function RetailerReportInventory() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'reports', 'inventory-health'],
    queryFn: () => api<unknown>('/retailer/reports/inventory-health'),
  });
  const rows = unwrapRows<InventoryHealthRow>(data);
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('inventory_health', '/retailer/reports/inventory-health');

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Inventory health"
        description="Low / out / overstock / aged SKUs. Triage stock issues before they affect rank or fulfilment."
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
                  <th className="px-3 py-2 text-left font-medium text-ink-3">SKU</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Listing</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Stock</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Last sold</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <tr key={`${r.listingId}_${r.variantSku}`} className="border-t border-line">
                      <td className="px-3 py-2 font-mono text-ink-2">{r.variantSku ?? '—'}</td>
                      <td className="px-3 py-2 text-ink">{r.listingName}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.stock}</td>
                      <td className="px-3 py-2"><Badge tone={meta.tone} flat>{meta.label}</Badge></td>
                      <td className="px-3 py-2 text-ink-3">{r.lastSoldAt ? formatAge(r.lastSoldAt) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </Page>
  );
}
