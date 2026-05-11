import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeading } from '@/components/ui/page';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const TIERS = [
  { key: 'loyaltyBronze', label: 'Bronze' },
  { key: 'loyaltyGold', label: 'Gold' },
  { key: 'loyaltySilver', label: 'Silver' },
  { key: 'loyaltyPlatinum', label: 'Platinum' },
] as const;

/** Eligibility / scope section for promotion create and edit forms.
 *  Reads/writes to the react-hook-form context under a `scope.*` namespace.
 *  Pass `adminMode` to show item-scope (listingIds / categoryIds / brandIds). */
export function EligibilitySection({ adminMode = false }: { adminMode?: boolean }) {
  const { register } = useFormContext();
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-rule rounded-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-2 transition-colors"
      >
        <SectionHeading title="Eligibility conditions" hint="Cart minimums, shopper filters, time windows — all optional" />
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

          {/* Item scope — admin only */}
          {adminMode && (
            <div>
              <p className="kicker text-ink-3 mb-3">Item scope (leave blank to match all)</p>
              <div className="space-y-3">
                <div>
                  <Label hint="Comma-separated listing IDs">Listing IDs</Label>
                  <Input
                    mono
                    placeholder="lst_abc123, lst_def456"
                    {...register('scope.listingIds')}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label hint="Comma-separated category IDs">Category IDs</Label>
                    <Input mono placeholder="cat_001, cat_002" {...register('scope.categoryIds')} />
                  </div>
                  <div>
                    <Label hint="Comma-separated brand IDs">Brand IDs</Label>
                    <Input mono placeholder="brd_001, brd_002" {...register('scope.brandIds')} />
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

  if (typeof scope.listingIds === 'string' && scope.listingIds.trim()) {
    out.listingIds = scope.listingIds.split(',').map((s: string) => s.trim()).filter(Boolean);
  }
  if (typeof scope.categoryIds === 'string' && scope.categoryIds.trim()) {
    out.categoryIds = scope.categoryIds.split(',').map((s: string) => s.trim()).filter(Boolean);
  }
  if (typeof scope.brandIds === 'string' && scope.brandIds.trim()) {
    out.brandIds = scope.brandIds.split(',').map((s: string) => s.trim()).filter(Boolean);
  }

  return out;
}
