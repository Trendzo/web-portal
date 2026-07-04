import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, ImageOff, Plus, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { canPublishProducts, deriveGate } from '@/lib/gate';
import { listingStatusMeta, formatPaise } from '@/lib/status';
import { cn } from '@/lib/cn';
import { LOW_STOCK_THRESHOLD, stockToneOf } from '@/lib/inventory';
import type { Category, InventoryRow, Listing, ListingStatus, RetailerProfile, Store } from '@/lib/types';
import { GateNotice } from '@/components/retailer/gate-notice';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// Reuse the exact Inventory building blocks so the two pages stay in lock-step.
import { FlagPill, HealthTab, HistoryTab, StatTile, type FlagFilter } from './inventory';

const STATUS_OPTIONS: ReadonlyArray<{ value: ListingStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All products' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'retired', label: 'Retired' },
];

type MeResponse = { retailer: RetailerProfile; store: Store | null };

export default function RetailerListings() {
  const [status, setStatus] = useState<ListingStatus | 'all'>('all');
  const [q, setQ] = useState('');
  const [flag, setFlag] = useState<FlagFilter>('all');
  const [categoryId, setCategoryId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Drives the gate banner. Only mutations on this page are gated server-side, but
  // we mirror the rule client-side so the user knows in advance.
  const me = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<MeResponse>('/retailer/me'),
  });
  const gate = deriveGate(me.data?.retailer, me.data?.store);
  const canPublish = canPublishProducts(gate);

  const qc = useQueryClient();
  const bulkStatus = useMutation({
    mutationFn: (body: { ids: string[]; status: 'active' | 'draft' | 'retired' }) =>
      api<{ updated: number; skipped: number }>('/retailer/listings/bulk-status', { method: 'POST', body }),
    onSuccess: (data) => {
      toast.success(`Updated ${data.updated} product${data.updated === 1 ? '' : 's'}${data.skipped > 0 ? ` · ${data.skipped} skipped` : ''}`);
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Bulk update failed'),
  });

  // Category list for the filter dropdown (matches Inventory's dropdown).
  const categoriesQ = useQuery({
    queryKey: ['retailer', 'categories'],
    queryFn: () => api<Category[]>('/retailer/categories'),
    enabled: canPublish,
  });

  // The Health tab lets the operator edit the low-stock threshold; read the saved
  // value the same way Inventory does (a 1-row inventory page carries it).
  const invMeta = useQuery({
    queryKey: ['retailer', 'inventory', 'threshold'],
    queryFn: () => api<{ lowStockThreshold: number }>('/retailer/inventory?page=1&pageSize=1'),
    enabled: canPublish,
  });
  const threshold = invMeta.data?.lowStockThreshold ?? LOW_STOCK_THRESHOLD;

  const listings = useQuery({
    queryKey: ['retailer', 'listings', status],
    queryFn: () => {
      const params = new URLSearchParams({ sort: 'updated_desc' });
      if (status !== 'all') params.set('status', status);
      return api<Listing[]>(`/retailer/listings?${params}`);
    },
    enabled: canPublish,
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'active' | 'draft' }) =>
      api('/retailer/listings/bulk-status', { method: 'POST', body: { ids: [id], status: next } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] }),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  const deleteListing = useMutation({
    mutationFn: (id: string) => api(`/retailer/listings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Listing deleted');
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  // Flatten each product's variants into the InventoryRow shape the Health tab and
  // the stat tiles expect. Single data source — no extra fetch, unlike Inventory.
  const invRows = useMemo<InventoryRow[]>(
    () =>
      (listings.data ?? []).flatMap((l) =>
        (l.variants ?? []).map((v) => ({
          id: v.id,
          listingId: l.id,
          listingName: l.name,
          listingStatus: l.status,
          brandName: l.brand?.name ?? null,
          sku: v.sku,
          attributesLabel: v.attributesLabel,
          pricePaise: v.pricePaise,
          compareAtPrice: v.compareAtPrice,
          stock: v.stock,
          reserved: v.reserved,
          isActive: v.isActive,
        })),
      ),
    [listings.data],
  );

  // Product-level match helpers for the flag pills: a product "is low" when any of
  // its variants is low, etc. Mirrors the Inventory flags, lifted to the product row.
  const matchesFlag = (l: Listing, f: FlagFilter): boolean => {
    const vs = l.variants ?? [];
    if (f === 'low') return vs.some((v) => stockToneOf(v, threshold) === 'low');
    if (f === 'out') return vs.some((v) => stockToneOf(v, threshold) === 'out');
    if (f === 'oversold') return vs.some((v) => v.reserved > v.stock);
    return true;
  };

  // Scope = search + category (used both for the pill counts and as the base the
  // flag filter narrows further). Keeps pill badges honest against the visible set.
  const scoped = (listings.data ?? []).filter((l) => {
    if (q.trim()) {
      const n = q.toLowerCase();
      if (!(l.name.toLowerCase().includes(n) || (l.brand?.name.toLowerCase().includes(n) ?? false)))
        return false;
    }
    if (categoryId && l.categoryId !== categoryId) return false;
    return true;
  });
  const filtered = scoped.filter((l) => matchesFlag(l, flag));

  const flagCounts = useMemo(() => {
    let low = 0;
    let out = 0;
    let oversold = 0;
    for (const l of scoped) {
      if (matchesFlag(l, 'low')) low += 1;
      if (matchesFlag(l, 'out')) out += 1;
      if (matchesFlag(l, 'oversold')) oversold += 1;
    }
    return { low, out, oversold };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, threshold]);

  // Catalog-wide tiles, computed from every loaded variant (full set, not paged).
  const stats = useMemo(() => {
    let units = 0;
    let low = 0;
    let out = 0;
    for (const r of invRows) {
      units += r.stock;
      const tone = stockToneOf(r, threshold);
      if (tone === 'out') out += 1;
      else if (tone === 'low') low += 1;
    }
    return { variants: invRows.length, units, low, out };
  }, [invRows, threshold]);

  const noFilters = !q && !categoryId && flag === 'all';

  return (
    <Page>
      <PageHeader
        title={<>Products</>}
        description={
          <>
            Each row is a product. Variants (size, colour, SKU, stock) live inside each
            one — open it to manage them.
          </>
        }
        actions={
          canPublish ? (
            <Button asChild variant="ink" caps iconLeft={<Plus className="size-3.5" />}>
              <Link to="/retailer/listings/new">New product</Link>
            </Button>
          ) : undefined
        }
      />

      {!canPublish ? (
        <GateNotice gate={gate} />
      ) : (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {/* Stat tiles — a quick scan of catalog state before touching the table. */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Variants" value={stats.variants} />
              <StatTile label="Units on hand" value={stats.units} />
              <StatTile label="Low stock" value={stats.low} tone={stats.low > 0 ? 'warning' : 'neutral'} />
              <StatTile label="Out of stock" value={stats.out} tone={stats.out > 0 ? 'danger' : 'neutral'} />
            </div>

            {/* Filter row */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-md flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <Input
                  placeholder="Search by name or brand…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="!pl-8"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <FlagPill label="All" value="all" current={flag} onSelect={setFlag} count={scoped.length} />
                <FlagPill label="Low" value="low" current={flag} onSelect={setFlag} count={flagCounts.low} tone="warning" />
                <FlagPill label="Out" value="out" current={flag} onSelect={setFlag} count={flagCounts.out} tone="danger" />
                <FlagPill label="Oversold" value="oversold" current={flag} onSelect={setFlag} count={flagCounts.oversold} tone="danger" />
                <Select value={categoryId || '__all__'} onValueChange={(v) => setCategoryId(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="sm:w-40"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All categories</SelectItem>
                    {(categoriesQ.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={(v) => setStatus(v as ListingStatus | 'all')}>
                  <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {listings.isLoading ? (
              <div className="overflow-hidden rounded border border-rule">
                {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[52px] rounded-none" />)}
              </div>
            ) : listings.isError ? (
              <Empty
                kicker="Connection lost"
                title="Couldn't load products."
                description={listings.error instanceof ApiError ? listings.error.message : 'Try again.'}
                action={<Button variant="outline" onClick={() => listings.refetch()}>Retry</Button>}
              />
            ) : filtered.length === 0 ? (
              <Empty
                kicker={noFilters ? 'No products yet' : 'No matches'}
                title={noFilters ? 'No products yet.' : 'Nothing matches your filters.'}
                description={
                  noFilters
                    ? 'Add your first product to begin selling.'
                    : 'Try a different keyword or clear the filters.'
                }
                action={
                  noFilters ? (
                    <Button asChild variant="ink" caps iconLeft={<Plus className="size-3.5" />}>
                      <Link to="/retailer/listings/new">Add first product</Link>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQ('');
                        setCategoryId('');
                        setFlag('all');
                        setStatus('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  )
                }
              />
            ) : (
              <div className="surface-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13.5px]">
                    <thead className="bg-bg-2/70 sticky top-0 z-10 backdrop-blur">
                      <tr className="border-b border-line">
                        <th className="kicker text-ink-3 px-3 py-2.5 text-left w-[3%]">
                          <input
                            type="checkbox"
                            checked={filtered.length > 0 && filtered.every((l) => selected.has(l.id))}
                            onChange={(e) =>
                              setSelected(e.target.checked ? new Set(filtered.map((l) => l.id)) : new Set())
                            }
                            className="size-3.5 accent-ink cursor-pointer"
                          />
                        </th>
                        <th className="kicker text-ink-3 px-3 py-2.5 text-left w-[5%]" />
                        <th className="kicker text-ink-3 px-3 py-2.5 text-left w-[27%]">Product</th>
                        <th className="kicker text-ink-3 px-3 py-2.5 text-left w-[16%]">SKU</th>
                        <th className="kicker text-ink-3 px-3 py-2.5 text-right w-[15%]">Price</th>
                        <th className="kicker text-ink-3 px-3 py-2.5 text-right w-[9%]">Stock</th>
                        <th className="kicker text-ink-3 px-3 py-2.5 text-right w-[9%]">Status</th>
                        <th className="kicker text-ink-3 px-3 py-2.5 text-right w-[16%]" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filtered.map((l) => (
                        <ListingRow
                          key={l.id}
                          listing={l}
                          threshold={threshold}
                          selected={selected.has(l.id)}
                          onSelectChange={(checked) =>
                            setSelected((s) => {
                              const next = new Set(s);
                              if (checked) next.add(l.id);
                              else next.delete(l.id);
                              return next;
                            })
                          }
                          onToggleStatus={(next) => toggleStatus.mutate({ id: l.id, next })}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="health">
            <HealthTab rows={invRows} savedThreshold={threshold} />
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      )}

      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          ids={[...selected]}
          allDraft={[...selected].every((id) => filtered.find((l) => l.id === id)?.status === 'draft')}
          onActivate={() => bulkStatus.mutate({ ids: [...selected], status: 'active' })}
          onDraft={() => bulkStatus.mutate({ ids: [...selected], status: 'draft' })}
          onArchive={() => bulkStatus.mutate({ ids: [...selected], status: 'retired' })}
          onDelete={() => {
            if (!window.confirm('Delete all selected draft listings? This cannot be undone.')) return;
            Promise.all([...selected].map((id) => deleteListing.mutateAsync(id))).catch(() => null);
          }}
          pending={bulkStatus.isPending || deleteListing.isPending}
        />
      )}
    </Page>
  );
}

function BulkActionBar({ count, ids: _ids, allDraft, onActivate, onDraft, onArchive: _onArchive, onDelete, pending }: {
  count: number; ids: string[]; allDraft: boolean;
  onActivate: () => void; onDraft: () => void; onArchive: () => void; onDelete: () => void; pending?: boolean;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-line bg-bg/95 backdrop-blur px-3 py-2 shadow-lg flex items-center gap-2">
      <span className="text-[12.5px] text-ink-2 px-2">{count} selected</span>
      <Button size="sm" variant="outline" disabled={pending} onClick={onDraft}>Move to draft</Button>
      <Button size="sm" variant="accent" loading={pending ?? false} onClick={onActivate}>Make active</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => _onArchive()}>Archive</Button>
      {allDraft && (
        <Button size="sm" variant="danger" disabled={pending} onClick={onDelete}>Delete</Button>
      )}
    </div>
  );
}

function ListingRow({ listing, threshold, selected, onSelectChange, onToggleStatus }: {
  listing: Listing;
  threshold: number;
  selected: boolean;
  onSelectChange: (checked: boolean) => void;
  onToggleStatus?: (next: 'active' | 'draft') => void;
}) {
  const navigate = useNavigate();
  const meta = listingStatusMeta(listing.status);
  const variants = listing.variants ?? [];
  const variantCount = variants.length;
  const totalStock = variants.reduce((acc, v) => acc + v.stock, 0);

  // Left-rule tone mirrors the flag pills: out beats low beats ok, product-wide.
  const tone: 'ok' | 'low' | 'out' = variants.some((v) => stockToneOf(v, threshold) === 'out')
    ? 'out'
    : variants.some((v) => stockToneOf(v, threshold) === 'low')
      ? 'low'
      : 'ok';

  // Price shown as the first→last variant range (single value when they're equal).
  const prices = variants.map((v) => v.pricePaise);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const priceLabel =
    minPrice == null
      ? '—'
      : minPrice === maxPrice
        ? formatPaise(minPrice)
        : `${formatPaise(minPrice)} – ${formatPaise(maxPrice!)}`;

  const firstSku = variants[0]?.sku ?? null;
  const extraSku = variantCount > 1 ? variantCount - 1 : 0;

  const hero =
    listing.galleryUrls?.[0] ??
    variants.find((v) => v.imageUrls && v.imageUrls.length > 0)?.imageUrls[0] ??
    null;

  return (
    <tr
      className={cn(
        'group cursor-pointer hover:bg-bg-2/60 transition-colors',
        selected && 'bg-accent/5',
        tone === 'low' && 'border-l-2 border-l-warning',
        tone === 'out' && 'border-l-2 border-l-danger',
      )}
      onClick={() => navigate(`/retailer/listings/${listing.id}`)}
    >
      <td className="px-3 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelectChange(e.target.checked)}
          className="size-3.5 accent-ink cursor-pointer"
        />
      </td>
      <td className="px-3 py-3 align-middle">
        <div className="size-9 overflow-hidden rounded-xs border border-rule bg-paper-2 shrink-0">
          {hero ? (
            <img
              src={hero}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="grid size-full place-items-center text-ink-4">
              <ImageOff className="size-3.5" />
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-3 align-middle">
        <div className="flex flex-col">
          <span className="font-display italic text-[15px] leading-snug text-ink truncate max-w-xs">
            {listing.name}
          </span>
          <span className="mt-0.5 text-[11px] text-ink-3 truncate">
            <span className="font-medium text-ink-2">{listing.brand?.name ?? 'Unbranded'}</span>
            {' · '}{listing.category?.label ?? listing.categoryId}
            {' · '}<span className="capitalize">{listing.gender}</span>
          </span>
        </div>
      </td>
      <td className="px-3 py-3 align-middle font-mono text-[12.5px] text-ink-2">
        {firstSku ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="truncate">{firstSku}</span>
            {extraSku > 0 && <span className="text-ink-4">+{extraSku}</span>}
          </span>
        ) : (
          <span className="text-ink-4">—</span>
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right font-mono tabular text-[12.5px] text-ink whitespace-nowrap">
        {priceLabel}
      </td>
      <td className="px-3 py-3 align-middle text-right font-mono tabular text-[12.5px] text-ink">
        {String(totalStock).padStart(3, '0')}
      </td>
      <td className="px-3 py-3 align-middle text-right">
        <Badge tone={meta.tone} nodot>{meta.label}</Badge>
        {listing.status === 'taken_down' && listing.takedownReason && (
          <div className="mt-1 text-[11px] text-warning truncate max-w-56 ml-auto" title={listing.takedownReason}>
            {listing.takedownReason}
          </div>
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right">
        <div className="flex items-center justify-end gap-2">
          {onToggleStatus && (listing.status === 'active' || listing.status === 'draft') && (
            <Button
              size="sm"
              variant={listing.status === 'active' ? 'outline' : 'accent'}
              onClick={(e) => {
                e.stopPropagation();
                const next = listing.status === 'active' ? 'draft' : 'active';
                if (next === 'active') {
                  const missing: string[] = [];
                  if (!listing.variants?.length) missing.push('at least one variant');
                  if (!listing.galleryUrls?.length) missing.push('at least one image');
                  if (missing.length > 0) {
                    toast.error(`Can't publish — add ${missing.join(' and ')} first. Open product to add.`);
                    return;
                  }
                }
                onToggleStatus(next);
              }}
            >
              {listing.status === 'active' ? 'Unpublish' : 'Publish'}
            </Button>
          )}
          <ArrowUpRight className="size-3.5 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
      </td>
    </tr>
  );
}
