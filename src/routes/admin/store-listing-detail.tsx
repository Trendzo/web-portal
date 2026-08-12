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
  barcode: string | null;
  attributesLabel: string;
  attributes: Record<string, string>;
  imageUrls: string[];
  stock: number;
  reserved: number;
  pricePaise: number;
  compareAtPrice: number | null;
  isActive: boolean;
  groupId: string;
}

interface VariantGroup {
  id: string;
  name: string;
  colorHex: string | null;
  isDefault: boolean;
}

/** The full listing row from GET /admin/stores/:storeId/listings/:listingId. */
interface ListingDetail {
  id: string;
  storeId: string;
  name: string;
  status: 'draft' | 'active' | 'retired' | 'taken_down';
  statusBeforeTakedown: string | null;
  gender: string;
  description: string | null;
  descriptionLong: string | null;
  hsn: string | null;
  listingPolicy: string;
  variantMode: string;
  galleryUrls: string[];
  occasion: string[];
  ageGroups: string[];
  ratingAvg: string | number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
  brand: { name: string } | null;
  category: { label: string } | null;
  variants: VariantSummary[];
  variantGroups: VariantGroup[];
}

const inr = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const POLICY_LABEL: Record<string, string> = {
  return: 'Returnable',
  replace: 'Replacement only',
  final_sale: 'Final sale — no returns',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function AdminStoreListingDetail() {
  const { storeId, listingId } = useParams<{ storeId: string; listingId: string }>();
  const retailerId = useStoreRetailerId(storeId);
  const qc = useQueryClient();

  // The dedicated detail endpoint returns the WHOLE listing row (both
  // descriptions, policy, HSN, occasion, age groups, rating, timestamps) plus
  // variants and variant groups. The list endpoint this page used to reuse
  // carries only a card-sized subset, which is why most fields were missing.
  const { data: listing, isLoading } = useQuery({
    queryKey: ['admin', 'store-listing', storeId, listingId],
    queryFn: () => api<ListingDetail>(`/admin/stores/${storeId}/listings/${listingId}`),
    enabled: Boolean(storeId && listingId),
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['admin', 'store-listing', storeId, listingId] });
    void qc.invalidateQueries({ queryKey: ['admin', 'store-listings', storeId] });
  }

  const meta = listing ? listingStatusMeta(listing.status) : null;
  const hero = listing?.galleryUrls?.[0] ?? null;
  const groupName = new Map((listing?.variantGroups ?? []).map((g) => [g.id, g]));
  const totalStock = (listing?.variants ?? []).reduce((n, v) => n + v.stock, 0);
  const totalReserved = (listing?.variants ?? []).reduce((n, v) => n + v.reserved, 0);
  const activeCount = (listing?.variants ?? []).filter((v) => v.isActive).length;
  const rating = Number(listing?.ratingAvg ?? 0);

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
                  {listing.statusBeforeTakedown && (
                    <Badge tone="warning">was {listing.statusBeforeTakedown}</Badge>
                  )}
                </div>
                <div className="mt-1 text-[12.5px] text-ink-3">
                  <span className="font-medium text-ink-2">{listing.brand?.name ?? 'Unbranded'}</span>
                  {' · '}{listing.category?.label ?? 'Uncategorised'}
                  {' · '}<span className="capitalize">{listing.gender}</span>
                  {' · '}<span className="capitalize">{listing.variantMode.replace('_', ' ')}</span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-ink-4">{listing.id}</div>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
                <Stat label="Variants" value={`${activeCount}/${listing.variants.length} active`} />
                <Stat
                  label="Stock"
                  value={String(totalStock)}
                  {...(totalReserved ? { hint: `${totalReserved} reserved` } : {})}
                />
                <Stat
                  label="Rating"
                  value={listing.ratingCount ? rating.toFixed(2) : '—'}
                  hint={listing.ratingCount ? `${listing.ratingCount} ratings` : 'no ratings'}
                />
                <Stat label="Policy" value={POLICY_LABEL[listing.listingPolicy] ?? listing.listingPolicy} />
              </div>
            </CardContent>
          </Card>

          {/* Full gallery — the retailer's whole shot list, not just the hero. */}
          {listing.galleryUrls.length > 0 && (
            <Card className="mb-5">
              <CardContent className="p-5">
                <div className="kicker mb-3 text-ink-3">Gallery · {listing.galleryUrls.length}</div>
                <div className="flex flex-wrap gap-2">
                  {listing.galleryUrls.map((url, i) => (
                    <a
                      key={`${url}-${i}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="relative block h-28 w-24 overflow-hidden rounded border border-rule bg-bg-2"
                    >
                      <img src={url} alt="" className="size-full object-cover" />
                      {i === 0 && (
                        <span className="absolute left-1 top-1 rounded bg-ink px-1 text-[9px] font-medium uppercase text-white">
                          Primary
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-5">
            <CardContent className="grid gap-5 p-5 md:grid-cols-2">
              <div>
                <div className="kicker mb-2 text-ink-3">Short description</div>
                {listing.description ? (
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">
                    {listing.description}
                  </p>
                ) : (
                  <Missing>No short description — required to publish</Missing>
                )}
              </div>
              <div>
                <div className="kicker mb-2 text-ink-3">Full description</div>
                {listing.descriptionLong ? (
                  // Stored as sanitize-on-write rich text (shared/sanitize/rich-text.ts),
                  // so it is safe to render verbatim.
                  <div
                    className="prose-sm text-[13px] leading-relaxed text-ink-2 [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2"
                    dangerouslySetInnerHTML={{ __html: listing.descriptionLong }}
                  />
                ) : (
                  <Missing>No full description — required to publish</Missing>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:col-span-2">
                <Stat label="HSN (GST)" value={listing.hsn || '—'} />
                <Stat label="Store" value={listing.storeId} mono />
                <Stat label="Occasion" value={listing.occasion.length ? listing.occasion.join(', ') : '—'} />
                <Stat label="Age groups" value={listing.ageGroups.length ? listing.ageGroups.join(', ') : '—'} />
                <Stat label="Created" value={when(listing.createdAt)} />
                <Stat label="Last updated" value={when(listing.updatedAt)} />
              </div>
            </CardContent>
          </Card>

          <div className="overflow-hidden rounded border border-rule">
            <table className="w-full text-[13px]">
              <thead className="border-b border-rule bg-bg-2/60">
                <tr>
                  <th className="py-2 px-3 text-left kicker text-ink-3">Variant</th>
                  <th className="py-2 px-3 text-left kicker text-ink-3">Group</th>
                  <th className="py-2 px-3 text-left kicker text-ink-3">SKU</th>
                  <th className="py-2 px-3 text-left kicker text-ink-3">Barcode</th>
                  <th className="py-2 px-3 text-right kicker text-ink-3">Price</th>
                  <th className="py-2 px-3 text-right kicker text-ink-3">MRP</th>
                  <th className="py-2 px-3 text-right kicker text-ink-3">Stock</th>
                  <th className="py-2 px-3 text-right kicker text-ink-3">Reserved</th>
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
                    group={groupName.get(v.groupId) ?? null}
                    onSaved={invalidate}
                  />
                ))}
                {listing.variants.length === 0 && (
                  <tr><td colSpan={10} className="px-3 py-6 text-center text-[12.5px] text-ink-3 italic">No variants.</td></tr>
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
/** Small label/value pair used across the header and details cards. */
function Stat({
  label,
  value,
  hint,
  mono,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="kicker text-ink-3">{label}</div>
      <div className={`truncate text-[13px] text-ink ${mono ? 'font-mono text-[11.5px]' : ''}`} title={value}>
        {value}
      </div>
      {hint && <div className="text-[11px] text-ink-4">{hint}</div>}
    </div>
  );
}

/** Absent field that blocks publishing — flagged rather than shown as blank. */
function Missing({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] italic text-warning">{children}</p>;
}

function VariantEditRow({
  storeId,
  variant,
  group,
  onSaved,
}: {
  storeId: string;
  variant: VariantSummary;
  group: VariantGroup | null;
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
      <td className={`px-3 py-2 ${isActive ? 'text-ink' : 'text-ink-3'}`}>
        <div className="flex items-center gap-2">
          {variant.imageUrls[0] && (
            <img
              src={variant.imageUrls[0]}
              alt=""
              className="size-8 shrink-0 rounded border border-rule object-cover"
            />
          )}
          <span>{variant.attributesLabel}</span>
        </div>
      </td>
      <td className="px-3 py-2 text-[12.5px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          {group?.colorHex && (
            <span
              className="inline-block size-3 shrink-0 rounded-full border border-rule"
              style={{ backgroundColor: group.colorHex }}
            />
          )}
          {group?.name ?? '—'}
        </span>
      </td>
      <td className="px-3 py-2">
        <Input
          mono
          className="h-8 uppercase"
          value={sku}
          onChange={(e) => setSku(e.target.value.toUpperCase())}
          placeholder="Auto-generated"
        />
      </td>
      <td className="px-3 py-2 font-mono text-[11.5px] text-ink-3">{variant.barcode || '—'}</td>
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
      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-3">
        {variant.compareAtPrice ? inr(variant.compareAtPrice) : '—'}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-2">{variant.stock}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-3">
        {variant.reserved || '—'}
      </td>
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
