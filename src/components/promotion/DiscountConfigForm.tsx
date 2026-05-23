import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import type { DiscountType } from '@/lib/types';
import { discountTypeLabel } from '@/lib/status';

export type ListingPickerItem = {
  id: string;
  name: string;
  variants?: { id: string; label: string }[];
};

/**
 * Discriminated config form. Renders the right input panel for the chosen
 * `discountType`, and resets `config` defaults when the type changes so we never
 * submit a half-typed leftover from a different shape.
 *
 * Caller passes the listings available to scope the promo to. Empty array means
 * "no listings available yet" — typically because the admin hasn't picked a
 * store or the retailer's catalog is empty.
 */
export function DiscountConfigForm({ listings = [], listingsLoading = false }: {
  listings?: ListingPickerItem[];
  listingsLoading?: boolean;
}) {
  const { register, watch, setValue, formState: { errors } } = useFormContext();
  const discountType = (watch('discountType') as DiscountType) || 'percent';

  // Reset config to a sensible default whenever discountType flips. Avoids carrying
  // a `bxgy` config into a `flat_amount` schema and producing a 422.
  useEffect(() => {
    setValue('config', defaultConfigFor(discountType));
  }, [discountType, setValue]);

  const listingOptions: MultiSelectOption[] = listings.map((l) => ({
    value: l.id,
    label: l.name,
    hint: l.id,
  }));

  const buyListingId = (watch('config.buyListingId') as string) || '';
  const getListingId = (watch('config.getListingId') as string) || '';
  const buyListingIds = ((watch('config.buyListingIds') as string[]) || []);
  const getListingIds = ((watch('config.getListingIds') as string[]) || []);
  const bundleListingIds = ((watch('config.bundleListingIds') as string[]) || []);

  return (
    <div className="space-y-6">
      <div>
        <Label required>Discount type</Label>
        <Select
          value={discountType}
          onValueChange={(v) => setValue('discountType', v as DiscountType)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="flat_amount">{discountTypeLabel('flat_amount')}</SelectItem>
            <SelectItem value="percent">{discountTypeLabel('percent')}</SelectItem>
            <SelectItem value="percent_upto">{discountTypeLabel('percent_upto')}</SelectItem>
            <SelectItem value="bogo">{discountTypeLabel('bogo')}</SelectItem>
            <SelectItem value="bxgy">{discountTypeLabel('bxgy')}</SelectItem>
            <SelectItem value="bundle">{discountTypeLabel('bundle')}</SelectItem>
            <SelectItem value="tiered_cart">{discountTypeLabel('tiered_cart')}</SelectItem>
            <SelectItem value="free_shipping">{discountTypeLabel('free_shipping')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Per-type panels */}
      <div className="rounded-xs border border-rule bg-paper-2/40 p-5 space-y-5">
        <div className="kicker text-ink-3">Configuration · {discountTypeLabel(discountType)}</div>

        {discountType === 'flat_amount' && (
          <div>
            <Label required hint="paise (₹100 = 10000)">Amount off</Label>
            <Input mono type="number" min={1} placeholder="e.g. 20000" {...register('config.amountPaise', { valueAsNumber: true })} />
            <FieldError>{(errors as any)?.config?.amountPaise?.message}</FieldError>
          </div>
        )}

        {discountType === 'percent' && (
          <div>
            <Label required hint="0 < percent ≤ 100">Percent off</Label>
            <Input mono type="number" min={1} max={100} step="0.01" placeholder="e.g. 15" {...register('config.percent', { valueAsNumber: true })} />
            <FieldError>{(errors as any)?.config?.percent?.message}</FieldError>
          </div>
        )}

        {discountType === 'percent_upto' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label required>Percent off</Label>
              <Input mono type="number" min={1} max={100} step="0.01" placeholder="e.g. 50" {...register('config.percent', { valueAsNumber: true })} />
            </div>
            <div>
              <Label required hint="paise — hard ceiling">Maximum amount</Label>
              <Input mono type="number" min={1} placeholder="e.g. 50000" {...register('config.maxAmountPaise', { valueAsNumber: true })} />
            </div>
          </div>
        )}

        {discountType === 'bogo' && (
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <Label required>Buy listing</Label>
              <Select
                value={buyListingId}
                onValueChange={(v) => setValue('config.buyListingId', v)}
                disabled={listingsLoading || listings.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={listingsLoading ? 'Loading…' : listings.length === 0 ? 'No listings available' : 'Pick a listing'} />
                </SelectTrigger>
                <SelectContent>
                  {listings.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      <span className="font-medium">{l.name}</span>
                      <span className="ml-2 font-mono text-[11px] text-ink-3">{l.id}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label hint="optional — defaults to buy">Get listing</Label>
              <Select
                value={getListingId || '__none__'}
                onValueChange={(v) => setValue('config.getListingId', v === '__none__' ? '' : v)}
                disabled={listingsLoading || listings.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Same as buy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Same as buy listing</SelectItem>
                  {listings.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      <span className="font-medium">{l.name}</span>
                      <span className="ml-2 font-mono text-[11px] text-ink-3">{l.id}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label required hint="100 = free">Discount %</Label>
              <Input mono type="number" min={0} max={100} placeholder="100" {...register('config.discountPercent', { valueAsNumber: true })} />
            </div>
          </div>
        )}

        {discountType === 'bxgy' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label required>Buy qty</Label>
                <Input mono type="number" min={1} placeholder="2" {...register('config.buyQty', { valueAsNumber: true })} />
              </div>
              <div>
                <Label required>Get qty</Label>
                <Input mono type="number" min={1} placeholder="1" {...register('config.getQty', { valueAsNumber: true })} />
              </div>
            </div>
            <div>
              <Label required hint="100 = free">Discount %</Label>
              <Input mono type="number" min={0} max={100} placeholder="100" {...register('config.discountPercent', { valueAsNumber: true })} />
            </div>
            <div className="sm:col-span-2">
              <Label required>Buy from listings</Label>
              <MultiSelect
                options={listingOptions}
                value={buyListingIds}
                onChange={(next) => setValue('config.buyListingIds', next)}
                placeholder={listingsLoading ? 'Loading…' : listings.length === 0 ? 'No listings available' : 'Pick listings'}
                disabled={listings.length === 0 && !listingsLoading}
                loading={listingsLoading}
              />
            </div>
            <div className="sm:col-span-2">
              <Label hint="optional; defaults to buy list">Get from listings</Label>
              <MultiSelect
                options={listingOptions}
                value={getListingIds}
                onChange={(next) => setValue('config.getListingIds', next.length ? next : undefined)}
                placeholder="Same as buy"
                disabled={listings.length === 0 && !listingsLoading}
                loading={listingsLoading}
              />
            </div>
          </div>
        )}

        {discountType === 'bundle' && (
          <div className="space-y-5">
            <div>
              <Label required hint="Cart must contain all to qualify">Bundle listings</Label>
              <MultiSelect
                options={listingOptions}
                value={bundleListingIds}
                onChange={(next) => setValue('config.bundleListingIds', next)}
                placeholder={listingsLoading ? 'Loading…' : listings.length === 0 ? 'No listings available' : 'Pick listings'}
                disabled={listings.length === 0 && !listingsLoading}
                loading={listingsLoading}
              />
            </div>
            <div>
              <Label required>Discount %</Label>
              <Input mono type="number" min={1} max={100} step="0.01" placeholder="20" {...register('config.discountPercent', { valueAsNumber: true })} />
            </div>
          </div>
        )}

        {discountType === 'tiered_cart' && (
          <TieredCartPanel />
        )}

        {discountType === 'free_shipping' && (
          <div>
            <Label hint="optional cart minimum, paise">Min cart for free shipping</Label>
            <Input mono type="number" min={0} placeholder="e.g. 50000" {...register('config.minCartPaise', { valueAsNumber: true, setValueAs: numOrUndef })} />
          </div>
        )}
      </div>
    </div>
  );
}

function TieredCartPanel() {
  const { register, watch, setValue } = useFormContext();
  const tiers = (watch('config.tiers') as Array<{ minCartPaise: number; discountPercent: number }>) || [
    { minCartPaise: 0, discountPercent: 5 },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 items-end gap-3 kicker text-ink-3">
        <div className="col-span-5">Min cart (paise)</div>
        <div className="col-span-5">Discount %</div>
      </div>
      {tiers.map((_t, i) => (
        <div key={i} className="grid grid-cols-12 items-center gap-3">
          <Input
            mono
            type="number"
            min={0}
            className="col-span-5"
            {...register(`config.tiers.${i}.minCartPaise` as const, { valueAsNumber: true })}
          />
          <Input
            mono
            type="number"
            min={1}
            max={100}
            step="0.01"
            className="col-span-5"
            {...register(`config.tiers.${i}.discountPercent` as const, { valueAsNumber: true })}
          />
          <button
            type="button"
            className="col-span-2 text-[12px] uppercase tracking-[0.16em] text-ink-3 hover:text-danger"
            onClick={() => {
              const next = tiers.slice();
              next.splice(i, 1);
              setValue('config.tiers', next.length ? next : [{ minCartPaise: 0, discountPercent: 5 }]);
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-[12px] uppercase tracking-[0.16em] text-ink hover:underline underline-offset-4"
        onClick={() =>
          setValue('config.tiers', [...tiers, { minCartPaise: 0, discountPercent: 5 }])
        }
      >
        + Add tier
      </button>
    </div>
  );
}

// ─── helpers ───

function defaultConfigFor(t: DiscountType): Record<string, unknown> {
  switch (t) {
    case 'flat_amount':
      return { amountPaise: 10000 };
    case 'percent':
      return { percent: 10 };
    case 'percent_upto':
      return { percent: 50, maxAmountPaise: 50000 };
    case 'bogo':
      return { buyListingId: '', discountPercent: 100 };
    case 'bxgy':
      return { buyQty: 2, getQty: 1, buyListingIds: [], discountPercent: 100 };
    case 'bundle':
      return { bundleListingIds: [], discountPercent: 20 };
    case 'tiered_cart':
      return { tiers: [{ minCartPaise: 0, discountPercent: 5 }] };
    case 'free_shipping':
      return {};
  }
}

function numOrUndef(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
