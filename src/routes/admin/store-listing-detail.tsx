import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useStoreRetailerId } from '@/hooks/useStoreRetailerId';
import { toast } from 'sonner';
import { ArrowLeft, ImageOff } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { listingStatusMeta } from '@/lib/status';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { FieldError } from '@/components/ui/label';

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

export default function AdminStoreListingDetail() {
  const { storeId, listingId } = useParams<{ storeId: string; listingId: string }>();
  const retailerId = useStoreRetailerId(storeId);
  const qc = useQueryClient();

  // Reuse the store-listings list query — variants are already embedded, so no
  // dedicated detail endpoint is needed. The list is likely already warm from
  // navigating here; refetch keeps this page correct on a direct/refresh hit.
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'store-listings', storeId, 'all'],
    queryFn: () => api<ListingRow[]>(`/admin/stores/${storeId}/listings`),
    enabled: Boolean(storeId),
  });
  const listing = (data ?? []).find((l) => l.id === listingId) ?? null;

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['admin', 'store-listings', storeId] });
  }

  const meta = listing ? listingStatusMeta(listing.status) : null;
  const hero = listing?.galleryUrls?.[0] ?? null;

  return (
    <Page>
      <PageHeader
        kicker="Store · Listing"
        title={listing?.name ?? 'Listing'}
        description="Full listing detail. Edit SKU, price, or active flag on each variant in place — changes are audited and the retailer notified."
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to={`/admin/retailers/${retailerId}/stores/${storeId}/listings`}>Back to listings</Link>
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !listing ? (
        <Card><CardContent className="p-8 text-center text-[13px] text-ink-3 italic">Listing not found.</CardContent></Card>
      ) : (
        <>
          <Card className="mb-5">
            <CardContent className="flex flex-wrap items-start gap-4 p-5">
              <div className="size-20 shrink-0 overflow-hidden rounded border border-rule bg-bg-2">
                {hero ? (
                  <img src={hero} alt="" className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-ink-4"><ImageOff className="size-5" /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-medium text-ink">{listing.name}</span>
                  {meta && <Badge tone={meta.tone}>{meta.label}</Badge>}
                </div>
                <div className="mt-1 text-[12.5px] text-ink-3">
                  <span className="font-medium text-ink-2">{listing.brand?.name ?? 'Unbranded'}</span>
                  {' · '}{listing.category?.label ?? 'Uncategorised'}
                  {' · '}<span className="capitalize">{listing.gender}</span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-ink-4">{listing.id}</div>
              </div>
            </CardContent>
          </Card>

          <div className="overflow-hidden rounded border border-rule">
            <table className="w-full text-[13px]">
              <thead className="border-b border-rule bg-bg-2/60">
                <tr>
                  <th className="py-2 px-3 text-left kicker text-ink-3">Variant</th>
                  <th className="py-2 px-3 text-left kicker text-ink-3">SKU</th>
                  <th className="py-2 px-3 text-right kicker text-ink-3">Price</th>
                  <th className="py-2 px-3 text-right kicker text-ink-3">Stock</th>
                  <th className="py-2 px-3 text-left kicker text-ink-3">Status</th>
                  <th className="py-2 px-3 w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {listing.variants.map((v) => (
                  <VariantEditRow
                    key={v.id}
                    storeId={storeId ?? ''}
                    variant={v}
                    onSaved={invalidate}
                  />
                ))}
                {listing.variants.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-[12.5px] text-ink-3 italic">No variants.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11.5px] text-ink-4">
            Stock adjustments live on the Inventory page. Editing here notifies the retailer with a deep link to the listing.
          </p>
        </>
      )}
    </Page>
  );
}

/**
 * Edit-in-place variant row. Reuses the PATCH `/variants/:id` mutation + the
 * change-detection logic formerly in AdminVariantEditDialog, rendered inline
 * instead of behind a modal.
 */
function VariantEditRow({
  storeId,
  variant,
  onSaved,
}: {
  storeId: string;
  variant: VariantSummary;
  onSaved: () => void;
}) {
  const [sku, setSku] = useState(variant.sku ?? '');
  const [priceRupees, setPriceRupees] = useState((variant.pricePaise / 100).toString());
  const [isActive, setIsActive] = useState(variant.isActive);

  // Re-sync when the underlying variant changes (e.g. after invalidate refetch).
  useEffect(() => {
    setSku(variant.sku ?? '');
    setPriceRupees((variant.pricePaise / 100).toString());
    setIsActive(variant.isActive);
  }, [variant.sku, variant.pricePaise, variant.isActive]);

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      const trimmedSku = sku.trim().toUpperCase();
      if (trimmedSku !== (variant.sku ?? '')) body.sku = trimmedSku || null;
      const paise = Math.round(parseFloat(priceRupees) * 100);
      if (Number.isFinite(paise) && paise > 0 && paise !== variant.pricePaise) body.pricePaise = paise;
      if (isActive !== variant.isActive) body.isActive = isActive;
      if (Object.keys(body).length === 0) throw new ApiError(400, 'no_changes', 'No changes to save');
      return api(`/admin/stores/${storeId}/variants/${variant.id}`, { method: 'PATCH', body });
    },
    onSuccess: () => {
      toast.success('Variant updated · retailer notified');
      onSaved();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const paise = Math.round(parseFloat(priceRupees) * 100);
  const priceValid = Number.isFinite(paise) && paise > 0;
  const dirty =
    sku.trim().toUpperCase() !== (variant.sku ?? '') ||
    (priceValid && paise !== variant.pricePaise) ||
    isActive !== variant.isActive;

  return (
    <tr className="hover:bg-bg-2/40">
      <td className={`px-3 py-2 ${isActive ? 'text-ink' : 'text-ink-3'}`}>{variant.attributesLabel}</td>
      <td className="px-3 py-2">
        <Input
          mono
          className="h-8 uppercase"
          value={sku}
          onChange={(e) => setSku(e.target.value.toUpperCase())}
          placeholder="Optional"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <Input
          mono
          type="number"
          min={0.01}
          step={0.01}
          className="h-8 w-24 text-right"
          value={priceRupees}
          onChange={(e) => setPriceRupees(e.target.value)}
        />
        {!priceValid && <FieldError>&gt; 0</FieldError>}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-2">{variant.stock}</td>
      <td className="px-3 py-2">
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          title={isActive ? 'Active — visible to buyers' : 'Inactive — hidden from buyers'}
          onClick={() => setIsActive((s) => !s)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${isActive ? 'bg-success' : 'bg-ink-4'}`}
        >
          <span
            className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0'}`}
          />
        </button>
      </td>
      <td className="px-3 py-2 text-right">
        <Button
          size="sm"
          variant="ink"
          disabled={!dirty || !priceValid}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          Save
        </Button>
      </td>
    </tr>
  );
}
