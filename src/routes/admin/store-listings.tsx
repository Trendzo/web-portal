import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ImageOff, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { listingStatusMeta } from '@/lib/status';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStoreRetailerId } from '@/hooks/useStoreRetailerId';

interface VariantSummary {
  id: string;
  sku: string | null;
  attributesLabel: string;
  stock: number;
  pricePaise: number;
  isActive: boolean;
}

interface ListingRow {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'retired';
  gender: string;
  galleryUrls: string[];
  brand: { name: string } | null;
  category: { label: string } | null;
  variants: VariantSummary[];
}

export default function AdminStoreListings() {
  const { storeId } = useParams<{ storeId: string }>();
  const retailerId = useStoreRetailerId(storeId);
  const navigate = useNavigate();
  const [status, setStatus] = useState<'all' | 'draft' | 'active' | 'retired'>('all');
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'store-listings', storeId, status],
    queryFn: () =>
      api<ListingRow[]>(`/admin/stores/${storeId}/listings${status === 'all' ? '' : `?status=${status}`}`),
    enabled: Boolean(storeId),
  });
  const rows = data ?? [];

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const n = q.toLowerCase();
    return rows.filter(
      (l) => l.name.toLowerCase().includes(n) || (l.brand?.name.toLowerCase().includes(n) ?? false),
    );
  }, [rows, q]);

  return (
    <Page>
      <PageHeader
        kicker="Store"
        title="Listings"
        description="Browse product listings for this store."
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to={`/admin/retailers/${retailerId}/stores/${storeId}`}>Back</Link>
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            placeholder="Search by name or brand…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="!pl-7"
          />
        </div>
        <div className="flex items-center gap-3">
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[12px] text-ink-3 whitespace-nowrap">{filtered.length} listing{filtered.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="overflow-hidden rounded border border-rule">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[52px] rounded-none" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded border border-rule bg-bg-2 p-8 text-center text-[13px] text-ink-3 italic">
          {q ? 'No listings match that search.' : 'No listings yet.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-rule">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-rule bg-bg-2/60">
                <th className="w-14 py-2.5 pl-4 pr-2" />
                <th className="py-2.5 pr-4 text-left kicker text-ink-3">Product</th>
                <th className="py-2.5 pr-4 text-left kicker text-ink-3 w-28">Status</th>
                <th className="py-2.5 pr-4 text-right kicker text-ink-3 w-20">Variants</th>
                <th className="py-2.5 pr-4 text-right kicker text-ink-3 w-24">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {filtered.map((l) => {
                const meta = listingStatusMeta(l.status);
                const variantCount = l.variants.length;
                const totalStock = l.variants.reduce((acc, v) => acc + v.stock, 0);
                const hero = l.galleryUrls?.[0] ?? null;
                return (
                  <tr
                    key={l.id}
                    onClick={() => navigate(`/admin/retailers/${retailerId}/stores/${storeId}/listings/${l.id}`)}
                    className="cursor-pointer transition-colors hover:bg-bg-2/40"
                  >
                    <td className="w-14 py-2 pl-4 pr-2">
                      <div className="size-9 shrink-0 overflow-hidden rounded-xs border border-rule bg-bg-2">
                        {hero ? (
                          <img src={hero} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          <div className="grid size-full place-items-center text-ink-4">
                            <ImageOff className="size-3.5" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-col">
                        <span className="truncate max-w-xs text-[13.5px] font-medium text-ink">{l.name}</span>
                        <span className="mt-0.5 truncate text-[11px] text-ink-3">
                          <span className="font-medium text-ink-2">{l.brand?.name ?? 'Unbranded'}</span>
                          {' · '}{l.category?.label ?? 'Uncategorised'}
                          {' · '}<span className="capitalize">{l.gender}</span>
                        </span>
                      </div>
                    </td>
                    <td className="w-28 py-2 pr-4">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className="w-20 py-2 pr-4 text-right">
                      <span className={`font-mono tabular-nums text-[12.5px] ${variantCount > 0 ? 'text-ink' : 'text-ink-4'}`}>
                        {String(variantCount).padStart(2, '0')}
                      </span>
                    </td>
                    <td className="w-24 py-2 pr-4 text-right">
                      <span className="font-mono tabular-nums text-[12.5px] text-ink">
                        {String(totalStock).padStart(3, '0')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
