import type {
  ActorType,
  ClubbingDefault,
  CollectionKind,
  CollectionStatus,
  DeliveryMethod,
  DiscountType,
  ListingStatus,
  Mechanism,
  OrderGroupStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
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

// ─── Orders ───

export type OrderStatusMeta = {
  label: string;
  /** One of the centralised tones for the Badge component. */
  tone: Tone;
  /** Short kicker/eyebrow for status hero blocks (uppercase tracked). */
  kicker: string;
  /** When true, Badge should show the pulse-dot to flag "needs eyes here". */
  pulse: boolean;
  /** Bucket the status into one of three high-level UX buckets. */
  bucket: 'open' | 'needs-action' | 'in-transit' | 'done' | 'cancelled' | 'failed';
};

export function orderStatusMeta(s: OrderStatus): OrderStatusMeta {
  switch (s) {
    case 'pending':
      return { label: 'Awaiting payment', tone: 'warning', kicker: 'Pending', pulse: true, bucket: 'open' };
    case 'confirmed':
      return { label: 'Confirmed', tone: 'info', kicker: 'Confirmed', pulse: false, bucket: 'open' };
    case 'routing':
      return { label: 'Awaiting acceptance', tone: 'warning', kicker: 'Routing', pulse: true, bucket: 'needs-action' };
    case 'accepted':
      return { label: 'Accepted', tone: 'info', kicker: 'Accepted', pulse: true, bucket: 'needs-action' };
    case 'packed':
      return { label: 'Packed — ready for pickup', tone: 'info', kicker: 'Packed', pulse: true, bucket: 'needs-action' };
    case 'picked_up':
      return { label: 'Picked up by agent', tone: 'info', kicker: 'Picked up', pulse: false, bucket: 'in-transit' };
    case 'out_for_delivery':
      return { label: 'Out for delivery', tone: 'info', kicker: 'On the way', pulse: false, bucket: 'in-transit' };
    case 'at_door':
      return { label: 'At customer door', tone: 'info', kicker: 'At door', pulse: true, bucket: 'in-transit' };
    case 'undelivered':
      return { label: 'Delivery failed', tone: 'warning', kicker: 'Undelivered', pulse: true, bucket: 'needs-action' };
    case 'returning_to_store':
      return { label: 'Returning to store', tone: 'warning', kicker: 'Returning', pulse: false, bucket: 'in-transit' };
    case 'returned_to_store':
      return { label: 'Awaiting verification', tone: 'warning', kicker: 'Verify', pulse: true, bucket: 'needs-action' };
    case 'delivered':
      return { label: 'Delivered', tone: 'success', kicker: 'Delivered', pulse: false, bucket: 'done' };
    case 'closed':
      return { label: 'Closed', tone: 'neutral', kicker: 'Closed', pulse: false, bucket: 'done' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'danger', kicker: 'Cancelled', pulse: false, bucket: 'cancelled' };
    case 'payment_failed':
      return { label: 'Payment failed', tone: 'danger', kicker: 'Payment failed', pulse: true, bucket: 'failed' };
  }
}

export function orderGroupStatusMeta(s: OrderGroupStatus): { label: string; tone: Tone } {
  switch (s) {
    case 'in_flight':
      return { label: 'In flight', tone: 'info' };
    case 'partially_delivered':
      return { label: 'Partially delivered', tone: 'warning' };
    case 'all_delivered':
      return { label: 'All delivered', tone: 'success' };
    case 'partially_cancelled':
      return { label: 'Partially cancelled', tone: 'warning' };
    case 'all_cancelled':
      return { label: 'All cancelled', tone: 'danger' };
  }
}

export function paymentStatusMeta(s: PaymentStatus): { label: string; tone: Tone } {
  switch (s) {
    case 'pending':
      return { label: 'Pending', tone: 'warning' };
    case 'succeeded':
      return { label: 'Succeeded', tone: 'success' };
    case 'failed':
      return { label: 'Failed', tone: 'danger' };
    case 'superseded':
      return { label: 'Superseded', tone: 'neutral' };
  }
}

export function deliveryMethodLabel(m: DeliveryMethod): string {
  switch (m) {
    case 'express':
      return 'Express';
    case 'standard':
      return 'Standard';
    case 'pickup':
      return 'Store pickup';
    case 'try_and_buy':
      return 'Try & buy';
  }
}

export function paymentMethodLabel(m: PaymentMethod): string {
  switch (m) {
    case 'upi':
      return 'UPI';
    case 'card':
      return 'Card';
    case 'cod':
      return 'Cash on delivery';
    case 'wallet':
      return 'Wallet';
    case 'gift_card':
      return 'Gift card';
  }
}

export function actorLabel(a: ActorType): string {
  switch (a) {
    case 'consumer':
      return 'Customer';
    case 'retailer':
      return 'Store';
    case 'admin':
      return 'Admin';
    case 'delivery_agent':
      return 'Agent';
    case 'system':
      return 'System';
  }
}

/** Human-readable age — "5m ago", "2h ago", "3d ago". */
export function formatAge(input: string | Date | number): string {
  const ts = input instanceof Date ? input.getTime() : new Date(input).getTime();
  const ms = Date.now() - ts;
  if (ms < 60_000) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── Returns / Refunds / Held ───

export function returnDecisionMeta(d: 'pending' | 'accepted' | 'rejected'): { label: string; tone: Tone } {
  switch (d) {
    case 'pending':
      return { label: 'Awaiting verification', tone: 'warning' };
    case 'accepted':
      return { label: 'Accepted', tone: 'success' };
    case 'rejected':
      return { label: 'Rejected', tone: 'danger' };
  }
}

export function refundStatusMeta(s: 'pending' | 'processing' | 'succeeded' | 'partially_disbursed' | 'failed'): { label: string; tone: Tone } {
  switch (s) {
    case 'pending':
      return { label: 'Pending', tone: 'warning' };
    case 'processing':
      return { label: 'Processing', tone: 'info' };
    case 'succeeded':
      return { label: 'Succeeded', tone: 'success' };
    case 'partially_disbursed':
      return { label: 'Partial', tone: 'warning' };
    case 'failed':
      return { label: 'Failed', tone: 'danger' };
  }
}

export function refundDisbursementStatusMeta(s: 'pending' | 'succeeded' | 'failed'): { label: string; tone: Tone } {
  switch (s) {
    case 'pending':
      return { label: 'Pending', tone: 'warning' };
    case 'succeeded':
      return { label: 'Succeeded', tone: 'success' };
    case 'failed':
      return { label: 'Failed', tone: 'danger' };
  }
}

export function heldItemStatusMeta(s: 'holding' | 'expired' | 'resolved'): { label: string; tone: Tone } {
  switch (s) {
    case 'holding':
      return { label: 'Holding', tone: 'warning' };
    case 'expired':
      return { label: 'Window expired', tone: 'neutral' };
    case 'resolved':
      return { label: 'Resolved', tone: 'success' };
  }
}

export function heldItemDispositionLabel(d: 'returned_to_consumer' | 'redelivered' | 'forfeited_to_store' | 'restocked' | 'written_off'): string {
  switch (d) {
    case 'returned_to_consumer':
      return 'Returned to consumer';
    case 'redelivered':
      return 'Redelivered';
    case 'forfeited_to_store':
      return 'Forfeited to store';
    case 'restocked':
      return 'Restocked';
    case 'written_off':
      return 'Written off';
  }
}
