/**
 * §13 retailer/admin clubbing pre-warning. Resolves the platform clubbing matrix
 * + the in-progress promo's overrides + every existing active promo, and shows
 * a row per existing promo with the resulting stacking verdict.
 */
import { useQuery } from '@tanstack/react-query';
import { Check, Info, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { Promotion } from '@/lib/types';

type AppliedTo = 'retailer_promo' | 'platform_promo' | 'coupon' | 'shipping' | 'loyalty';
type Mechanism = 'offer' | 'coupon' | 'voucher';
type DiscountType =
  | 'flat_amount' | 'percent' | 'percent_upto' | 'bogo' | 'bxgy' | 'bundle' | 'tiered_cart' | 'free_shipping';
type IssuerType = 'retailer' | 'admin' | 'system';
type DefaultValue = 'allowed' | 'disallowed' | 'always_allowed';

interface ClubbingCell {
  appliedToA: AppliedTo;
  appliedToB: AppliedTo;
  defaultValue: DefaultValue;
  note: string | null;
  seeded: boolean;
}

export function defaultAppliedTo(
  mechanism: Mechanism,
  issuer: IssuerType,
  discountType: DiscountType,
): AppliedTo {
  if (discountType === 'free_shipping') return 'shipping';
  if (mechanism === 'coupon' || mechanism === 'voucher') return 'coupon';
  return issuer === 'retailer' ? 'retailer_promo' : 'platform_promo';
}

export function StackingPreview({
  mechanism,
  discountType,
  issuer,
  stackableWith,
  nonStackable,
  policyEndpoint,
  promosEndpoint,
}: {
  mechanism: Mechanism;
  discountType: DiscountType;
  issuer: IssuerType;
  stackableWith: string[];
  nonStackable: string[];
  policyEndpoint: string;
  promosEndpoint: string;
}) {
  const policy = useQuery({
    queryKey: ['clubbing-policy', policyEndpoint],
    queryFn: () => api<ClubbingCell[]>(policyEndpoint),
  });
  const promos = useQuery({
    queryKey: ['promos-for-stacking', promosEndpoint],
    queryFn: () => api<Promotion[]>(promosEndpoint),
  });

  const meAppliedTo = defaultAppliedTo(mechanism, issuer, discountType);
  const matrix = new Map<string, DefaultValue>();
  for (const c of policy.data ?? []) {
    matrix.set(`${c.appliedToA}:${c.appliedToB}`, c.defaultValue);
    matrix.set(`${c.appliedToB}:${c.appliedToA}`, c.defaultValue);
  }

  const activePromos = (promos.data ?? []).filter(
    (p) => p.effectiveStatus === 'active' || p.effectiveStatus === 'scheduled',
  );

  if (policy.isLoading || promos.isLoading) {
    return (
      <div className="rounded-md border border-line bg-bg-2/30 px-4 py-3 text-[12.5px] text-ink-3">
        Loading stacking preview…
      </div>
    );
  }

  if (activePromos.length === 0) {
    return (
      <div className="rounded-md border border-line bg-bg-2/30 px-4 py-3 text-[12.5px] text-ink-3 inline-flex items-center gap-2">
        <Info className="size-3.5" />
        No other active or scheduled promotions — nothing to stack against.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-line bg-bg-2/30 px-4 py-3">
      <div className="kicker mb-2 text-ink-3">Stacking preview · this promo vs your active promos</div>
      <ul className="space-y-1.5">
        {activePromos.map((p) => {
          const pAppliedTo = defaultAppliedTo(
            p.mechanism as Mechanism,
            (p.issuerType ?? 'retailer') as IssuerType,
            p.discountType as DiscountType,
          );
          const platformVerdict = matrix.get(`${meAppliedTo}:${pAppliedTo}`) ?? 'allowed';
          const forceAllow = stackableWith.includes(p.id);
          const forceBlock = nonStackable.includes(p.id);
          const stacks = forceAllow
            ? true
            : forceBlock
              ? false
              : platformVerdict !== 'disallowed';
          const source = forceAllow
            ? 'your override (stackable_with)'
            : forceBlock
              ? 'your override (non_stackable)'
              : platformVerdict === 'always_allowed'
                ? 'platform (always allowed)'
                : platformVerdict === 'disallowed'
                  ? 'platform default'
                  : 'platform default';
          return (
            <li key={p.id} className="flex items-center gap-2 text-[12.5px]">
              {stacks ? (
                <Check className="size-3.5 text-success shrink-0" />
              ) : (
                <X className="size-3.5 text-danger shrink-0" />
              )}
              <span className="font-medium text-ink truncate">{p.name}</span>
              <span className="font-mono text-[11px] text-ink-3">
                {pAppliedTo.replace('_', ' ')}
              </span>
              <span className={`ml-auto text-[11.5px] ${stacks ? 'text-success' : 'text-danger'}`}>
                {stacks ? 'Stacks' : 'Blocks'}
              </span>
              <span className="text-[11px] text-ink-4">· {source}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
