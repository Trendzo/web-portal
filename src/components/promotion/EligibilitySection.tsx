import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeading } from '@/components/ui/page';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import type { ListingPickerItem } from '@/components/promotion/DiscountConfigForm';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const TIERS = [
  { key: 'loyaltyBronze', label: 'Bronze' },
  { key: 'loyaltyGold', label: 'Gold' },
  { key: 'loyaltySilver', label: 'Silver' },
  { key: 'loyaltyPlatinum', label: 'Platinum' },
] as const;
const DELIVERY_METHODS = [
  { key: 'deliveryExpress', label: 'Express' },
  { key: 'deliveryStandard', label: 'Standard' },
  { key: 'deliveryPickup', label: 'Pickup' },
  { key: 'deliveryTryAndBuy', label: 'Try & buy' },
] as const;
const PAYMENT_METHODS = [
  { key: 'paymentUpi', label: 'UPI' },
  { key: 'paymentCard', label: 'Card' },
  { key: 'paymentCod', label: 'COD' },
  { key: 'paymentWallet', label: 'Wallet' },
  { key: 'paymentGiftCard', label: 'Gift card' },
] as const;

export type CategoryPickerItem = { id: string; label: string };
export type BrandPickerItem = { id: string; name: string };
export type StorePickerItem = { id: string; name: string };

/** Eligibility / scope section for promotion create and edit forms.
 *  Reads/writes to the react-hook-form context under a `scope.*` namespace.
 *  Listing / category / brand pickers + their exclude counterparts render for any
 *  caller that supplies the data — both retailer and admin modes. */
export function EligibilitySection({
  listings = [],
  listingsLoading = false,
  categories = [],
  categoriesLoading = false,
  brands = [],
  brandsLoading = false,
  stores = [],
  storesLoading = false,
}: {
  listings?: ListingPickerItem[];
  listingsLoading?: boolean;
  categories?: CategoryPickerItem[];
  categoriesLoading?: boolean;
  brands?: BrandPickerItem[];
  brandsLoading?: boolean;
  /** Admin-only — when populated, exposes a retailer-subset target. */
  stores?: StorePickerItem[];
  storesLoading?: boolean;
}) {
  const { register, watch, setValue } = useFormContext();
  const [open, setOpen] = useState(false);

  const listingOptions: MultiSelectOption[] = listings.map((l) => ({ value: l.id, label: l.name, hint: l.id }));
  const categoryOptions: MultiSelectOption[] = categories.map((c) => ({ value: c.id, label: c.label, hint: c.id }));
  const brandOptions: MultiSelectOption[] = brands.map((b) => ({ value: b.id, label: b.name, hint: b.id }));
  const storeOptions: MultiSelectOption[] = stores.map((s) => ({ value: s.id, label: s.name, hint: s.id }));
  const selectedStores = toArray(watch('scope.storeIds'));

  const selectedListings = toArray(watch('scope.listingIds'));
  const selectedVariants = toArray(watch('scope.variantIds'));
  const selectedCategories = toArray(watch('scope.categoryIds'));
  const selectedBrands = toArray(watch('scope.brandIds'));
  const excludedListings = toArray(watch('scope.excludeListingIds'));
  const excludedVariants = toArray(watch('scope.excludeVariantIds'));
  const excludedCategories = toArray(watch('scope.excludeCategoryIds'));
  const excludedBrands = toArray(watch('scope.excludeBrandIds'));

  // Variant picker scoped to selected listings (or all listings if none selected).
  const variantSourceListings = selectedListings.length > 0
    ? listings.filter((l) => selectedListings.includes(l.id))
    : listings;
  const variantOptions: MultiSelectOption[] = variantSourceListings.flatMap((l) =>
    (l.variants ?? []).map((v) => ({
      value: v.id,
      label: `${l.name} · ${v.label}`,
      hint: v.id,
    })),
  );

  return (
    <div className="border border-rule rounded-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-2 transition-colors"
      >
        <SectionHeading title="Eligibility conditions" hint="Cart minimums, shopper filters, time windows, delivery/payment/region/item scope — all optional" />
        {open ? <ChevronUp className="size-4 text-ink-3 shrink-0" /> : <ChevronDown className="size-4 text-ink-3 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-rule px-4 pb-5 pt-4 space-y-6">
          {/* Cart conditions */}
          <div>
            <p className="kicker text-ink-3 mb-3">Cart conditions</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label hint="Leave blank for no minimum">Minimum cart value (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="e.g. 500"
                  {...register('scope.minCartRupees')}
                />
              </div>
              <div>
                <Label hint="Leave blank for no minimum">Minimum item count</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 2"
                  {...register('scope.minItemCount')}
                />
              </div>
            </div>
          </div>

          {/* Shopper filters */}
          <div>
            <p className="kicker text-ink-3 mb-3">Shopper filters</p>
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="size-4 rounded accent-ink"
                  {...register('scope.firstOrderOnly')}
                />
                <span className="text-[13.5px] text-ink">First order only</span>
              </label>
              <div>
                <p className="text-[12.5px] text-ink-3 mb-2">Loyalty tier (applies to members of selected tiers)</p>
                <div className="flex flex-wrap gap-3">
                  {TIERS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="size-4 rounded accent-ink"
                        {...register(`scope.${key}`)}
                      />
                      <span className="text-[13px] text-ink">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label hint="Newline-separated consumer IDs">Specific consumers</Label>
                  <textarea
                    rows={2}
                    placeholder="cnsr_abc&#10;cnsr_xyz"
                    className="w-full rounded border border-line-2 bg-bg px-2 py-1 text-[12.5px] font-mono"
                    {...register('scope.specificConsumerIdsText')}
                  />
                </div>
                <div>
                  <Label hint="Newline-separated consumer IDs">Exclude consumers</Label>
                  <textarea
                    rows={2}
                    placeholder="cnsr_blocked"
                    className="w-full rounded border border-line-2 bg-bg px-2 py-1 text-[12.5px] font-mono"
                    {...register('scope.excludeConsumerIdsText')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Time window */}
          <div>
            <p className="kicker text-ink-3 mb-3">Active time window</p>
            <div className="space-y-3">
              <div>
                <p className="text-[12.5px] text-ink-3 mb-2">Days of week (leave all unchecked for every day)</p>
                <div className="flex flex-wrap gap-3">
                  {DAYS.map((day, i) => (
                    <label key={day} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="size-4 rounded accent-ink"
                        {...register(`scope.day${i}`)}
                      />
                      <span className="text-[13px] text-ink">{day}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label hint="HH:MM — leave blank for all hours">Active from</Label>
                  <Input type="time" {...register('scope.activeFrom')} />
                </div>
                <div>
                  <Label hint="HH:MM">Active until</Label>
                  <Input type="time" {...register('scope.activeTo')} />
                </div>
              </div>
            </div>
          </div>

          {/* Delivery method */}
          <div>
            <p className="kicker text-ink-3 mb-3">Delivery method (leave all unchecked for any method)</p>
            <div className="flex flex-wrap gap-3">
              {DELIVERY_METHODS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="size-4 rounded accent-ink"
                    {...register(`scope.${key}`)}
                  />
                  <span className="text-[13px] text-ink">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Payment method */}
          <div>
            <p className="kicker text-ink-3 mb-3">Payment method (leave all unchecked for any method)</p>
            <div className="flex flex-wrap gap-3">
              {PAYMENT_METHODS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="size-4 rounded accent-ink"
                    {...register(`scope.${key}`)}
                  />
                  <span className="text-[13px] text-ink">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Region */}
          <div>
            <p className="kicker text-ink-3 mb-3">Region (state codes)</p>
            <Input
              placeholder="e.g. MH, KA, DL — comma-separated"
              {...register('scope.allowedStateCodesText')}
            />
          </div>

          {/* Retailer subset — admin only (callers without store data omit this section). */}
          {(stores.length > 0 || storesLoading) && (
            <div>
              <p className="kicker text-ink-3 mb-3">Retailer subset</p>
              <MultiSelect
                options={storeOptions}
                value={selectedStores}
                onChange={(next) => setValue('scope.storeIds', next)}
                placeholder={storesLoading ? 'Loading…' : 'Leave blank to apply to all stores'}
                loading={storesLoading}
              />
              <p className="mt-1 text-[11px] text-ink-4">
                Promotion is dropped at checkout when the order's store is not on this list.
              </p>
            </div>
          )}

          {/* Item scope — listings / categories / brands include + exclude */}
          {(listings.length > 0 || categories.length > 0 || brands.length > 0 || listingsLoading) && (
            <div>
              <p className="kicker text-ink-3 mb-3">Item scope (leave blank to match all)</p>
              <div className="space-y-3">
                <div>
                  <Label>Listings (include)</Label>
                  <MultiSelect
                    options={listingOptions}
                    value={selectedListings}
                    onChange={(next) => setValue('scope.listingIds', next)}
                    placeholder={listingsLoading ? 'Loading…' : listings.length === 0 ? 'No listings available' : 'Pick listings'}
                    disabled={listings.length === 0 && !listingsLoading}
                    loading={listingsLoading}
                  />
                </div>
                <div>
                  <Label>Listings (exclude)</Label>
                  <MultiSelect
                    options={listingOptions}
                    value={excludedListings}
                    onChange={(next) => setValue('scope.excludeListingIds', next)}
                    placeholder={listingsLoading ? 'Loading…' : 'Pick listings to exclude'}
                    disabled={listings.length === 0 && !listingsLoading}
                    loading={listingsLoading}
                  />
                </div>
                {variantOptions.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>
                        Variants (include)
                        {selectedListings.length > 0 && (
                          <span className="ml-1 text-[11px] text-ink-3">— from {selectedListings.length} listing{selectedListings.length === 1 ? '' : 's'}</span>
                        )}
                      </Label>
                      <MultiSelect
                        options={variantOptions}
                        value={selectedVariants}
                        onChange={(next) => setValue('scope.variantIds', next)}
                        placeholder="Pick specific variants"
                      />
                    </div>
                    <div>
                      <Label>Variants (exclude)</Label>
                      <MultiSelect
                        options={variantOptions}
                        value={excludedVariants}
                        onChange={(next) => setValue('scope.excludeVariantIds', next)}
                        placeholder="Pick variants to exclude"
                      />
                    </div>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Categories (include)</Label>
                    <MultiSelect
                      options={categoryOptions}
                      value={selectedCategories}
                      onChange={(next) => setValue('scope.categoryIds', next)}
                      placeholder={categoriesLoading ? 'Loading…' : 'Pick categories'}
                      loading={categoriesLoading}
                    />
                  </div>
                  <div>
                    <Label>Categories (exclude)</Label>
                    <MultiSelect
                      options={categoryOptions}
                      value={excludedCategories}
                      onChange={(next) => setValue('scope.excludeCategoryIds', next)}
                      placeholder={categoriesLoading ? 'Loading…' : 'Pick categories to exclude'}
                      loading={categoriesLoading}
                    />
                  </div>
                  <div>
                    <Label>Brands (include)</Label>
                    <MultiSelect
                      options={brandOptions}
                      value={selectedBrands}
                      onChange={(next) => setValue('scope.brandIds', next)}
                      placeholder={brandsLoading ? 'Loading…' : 'Pick brands'}
                      loading={brandsLoading}
                    />
                  </div>
                  <div>
                    <Label>Brands (exclude)</Label>
                    <MultiSelect
                      options={brandOptions}
                      value={excludedBrands}
                      onChange={(next) => setValue('scope.excludeBrandIds', next)}
                      placeholder={brandsLoading ? 'Loading…' : 'Pick brands to exclude'}
                      loading={brandsLoading}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === 'string' && v.trim()) {
    return v.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function parseLines(v: unknown, max = 1000): string[] {
  if (typeof v !== 'string' || !v.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of v.split(/[\n,]/)) {
    const t = line.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Converts the flat `scope.*` form values into the Scope object for the API payload. */
export function buildScopePayload(scope: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const minRupees = Number(scope.minCartRupees);
  if (scope.minCartRupees && minRupees > 0) out.minCartPaise = Math.round(minRupees * 100);

  const minItems = Number(scope.minItemCount);
  if (scope.minItemCount && minItems > 0) out.minItemCount = minItems;

  if (scope.firstOrderOnly) out.firstOrderOnly = true;

  const tiers: string[] = [];
  if (scope.loyaltyBronze) tiers.push('bronze');
  if (scope.loyaltySilver) tiers.push('silver');
  if (scope.loyaltyGold) tiers.push('gold');
  if (scope.loyaltyPlatinum) tiers.push('platinum');
  if (tiers.length) out.loyaltyTierFilter = tiers;

  const days: number[] = [];
  for (let i = 0; i < 7; i++) {
    if (scope[`day${i}`]) days.push(i);
  }
  if (days.length) out.allowedDaysOfWeek = days;

  if (scope.activeFrom && scope.activeTo) {
    out.allowedTimesOfDay = [{ from: scope.activeFrom, to: scope.activeTo }];
  }

  const delivery: string[] = [];
  if (scope.deliveryExpress) delivery.push('express');
  if (scope.deliveryStandard) delivery.push('standard');
  if (scope.deliveryPickup) delivery.push('pickup');
  if (scope.deliveryTryAndBuy) delivery.push('try_and_buy');
  if (delivery.length) out.allowedDeliveryMethods = delivery;

  const payment: string[] = [];
  if (scope.paymentUpi) payment.push('upi');
  if (scope.paymentCard) payment.push('card');
  if (scope.paymentCod) payment.push('cod');
  if (scope.paymentWallet) payment.push('wallet');
  if (scope.paymentGiftCard) payment.push('gift_card');
  if (payment.length) out.allowedPaymentMethods = payment;

  if (typeof scope.allowedStateCodesText === 'string') {
    const codes = scope.allowedStateCodesText
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^[A-Z]{2,3}$/.test(s));
    const dedup = Array.from(new Set(codes));
    if (dedup.length) out.allowedStateCodes = dedup;
  }

  const specificConsumers = parseLines(scope.specificConsumerIdsText);
  if (specificConsumers.length) out.specificConsumerIds = specificConsumers;
  const excludeConsumers = parseLines(scope.excludeConsumerIdsText);
  if (excludeConsumers.length) out.excludeConsumerIds = excludeConsumers;

  const listingIds = toArray(scope.listingIds);
  if (listingIds.length) out.listingIds = listingIds;
  const variantIds = toArray(scope.variantIds);
  if (variantIds.length) out.variantIds = variantIds;
  const categoryIds = toArray(scope.categoryIds);
  if (categoryIds.length) out.categoryIds = categoryIds;
  const brandIds = toArray(scope.brandIds);
  if (brandIds.length) out.brandIds = brandIds;
  const storeIds = toArray(scope.storeIds);
  if (storeIds.length) out.storeIds = storeIds;

  const excludeListingIds = toArray(scope.excludeListingIds);
  if (excludeListingIds.length) out.excludeListingIds = excludeListingIds;
  const excludeVariantIds = toArray(scope.excludeVariantIds);
  if (excludeVariantIds.length) out.excludeVariantIds = excludeVariantIds;
  const excludeCategoryIds = toArray(scope.excludeCategoryIds);
  if (excludeCategoryIds.length) out.excludeCategoryIds = excludeCategoryIds;
  const excludeBrandIds = toArray(scope.excludeBrandIds);
  if (excludeBrandIds.length) out.excludeBrandIds = excludeBrandIds;

  return out;
}
