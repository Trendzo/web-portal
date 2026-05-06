import type {
  ClubbingDefault,
  CollectionKind,
  CollectionStatus,
  DiscountType,
  ListingStatus,
  Mechanism,
  PromotionConfig,
  PromotionStatus,
  RetailerStatus,
  StoreStatus,
} from './types';

/**
 * Centralised status → label + tone map. Tone matches our token palette
 * (`neutral` | `info` | `success` | `warning` | `danger`) so the Badge component
 * can render the right colour without each call-site repeating the cases.
 */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function retailerStatusMeta(s: RetailerStatus): { label: string; tone: Tone } {
  switch (s) {
    case 'pending_approval':
      return { label: 'Pending approval', tone: 'warning' };
    case 'active':
      return { label: 'Active', tone: 'success' };
    case 'deactivated':
      return { label: 'Deactivated', tone: 'danger' };
  }
}

export function storeStatusMeta(s: StoreStatus): { label: string; tone: Tone } {
  switch (s) {
    case 'onboarding':
      return { label: 'Onboarding', tone: 'info' };
    case 'active':
      return { label: 'Active', tone: 'success' };
    case 'paused':
      return { label: 'Paused', tone: 'warning' };
    case 'suspended':
      return { label: 'Suspended', tone: 'danger' };
    case 'terminated':
      return { label: 'Terminated', tone: 'danger' };
  }
}

export function listingStatusMeta(s: ListingStatus): { label: string; tone: Tone } {
  switch (s) {
    case 'draft':
      return { label: 'Draft', tone: 'neutral' };
    case 'active':
      return { label: 'Active', tone: 'success' };
    case 'retired':
      return { label: 'Retired', tone: 'neutral' };
  }
}

export function collectionStatusMeta(s: CollectionStatus): { label: string; tone: Tone } {
  switch (s) {
    case 'draft':
      return { label: 'Draft', tone: 'neutral' };
    case 'active':
      return { label: 'Active', tone: 'success' };
    case 'archived':
      return { label: 'Archived', tone: 'neutral' };
  }
}

export function collectionKindLabel(k: CollectionKind): string {
  switch (k) {
    case 'outfit':
      return 'Outfit';
    case 'occasion':
      return 'Occasion';
    case 'drop':
      return 'Drop';
    case 'edit':
      return 'Edit';
    case 'trend':
      return 'Trend';
  }
}

/** Format paise → ₹ string. */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return rupees.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  });
}

// ─── Promotions ───

export function promotionStatusMeta(s: PromotionStatus): { label: string; tone: Tone } {
  switch (s) {
    case 'draft':
      return { label: 'Draft', tone: 'neutral' };
    case 'scheduled':
      return { label: 'Scheduled', tone: 'info' };
    case 'active':
      return { label: 'Active', tone: 'success' };
    case 'paused':
      return { label: 'Paused', tone: 'warning' };
    case 'expired':
      return { label: 'Expired', tone: 'neutral' };
    case 'exhausted':
      return { label: 'Exhausted', tone: 'neutral' };
    case 'revoked':
      return { label: 'Revoked', tone: 'danger' };
  }
}

export function mechanismLabel(m: Mechanism): string {
  switch (m) {
    case 'offer':
      return 'Offer';
    case 'coupon':
      return 'Coupon';
    case 'voucher':
      return 'Voucher';
  }
}

export function discountTypeLabel(t: DiscountType): string {
  switch (t) {
    case 'flat_amount':
      return 'Flat amount off';
    case 'percent':
      return 'Percent off';
    case 'percent_upto':
      return 'Percent off, capped';
    case 'bogo':
      return 'Buy one, get one';
    case 'bxgy':
      return 'Buy X, get Y';
    case 'bundle':
      return 'Bundle';
    case 'tiered_cart':
      return 'Tiered by cart value';
    case 'free_shipping':
      return 'Free shipping';
  }
}

export function clubbingDefaultMeta(v: ClubbingDefault): { label: string; tone: Tone } {
  switch (v) {
    case 'allowed':
      return { label: 'Allowed', tone: 'success' };
    case 'disallowed':
      return { label: 'Disallowed', tone: 'danger' };
    case 'always_allowed':
      return { label: 'Always allowed', tone: 'info' };
  }
}

/**
 * Render a promotion config as a one-line summary for list views. Doesn't replace
 * full detail view — just enough to scan a list.
 */
export function formatDiscount(discountType: DiscountType, config: PromotionConfig): string {
  switch (discountType) {
    case 'flat_amount':
      return `${formatPaise((config as { amountPaise: number }).amountPaise)} off`;
    case 'percent':
      return `${(config as { percent: number }).percent}% off`;
    case 'percent_upto': {
      const c = config as { percent: number; maxAmountPaise: number };
      return `${c.percent}% off, max ${formatPaise(c.maxAmountPaise)}`;
    }
    case 'bogo':
      return `Buy 1, get 1 ${(config as { discountPercent: number }).discountPercent}% off`;
    case 'bxgy': {
      const c = config as { buyQty: number; getQty: number; discountPercent: number };
      return `Buy ${c.buyQty}, get ${c.getQty} (${c.discountPercent}% off)`;
    }
    case 'bundle':
      return `Bundle: ${(config as { discountPercent: number }).discountPercent}% off`;
    case 'tiered_cart': {
      const c = config as { tiers: Array<{ minCartPaise: number; discountPercent: number }> };
      const top = c.tiers.slice().sort((a, b) => b.discountPercent - a.discountPercent)[0];
      return top ? `Up to ${top.discountPercent}% off (tiered)` : 'Tiered';
    }
    case 'free_shipping':
      return 'Free shipping';
  }
}
