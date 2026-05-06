/* Backend response types — kept narrow to what the dashboard reads.
   Mirror src/db/schema/* on the backend; widen only as new fields are surfaced in UI. */

export type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };

export type AdminSubRole = 'super_admin' | 'ops_admin' | 'support';
export type RetailerSubRole = 'owner' | 'manager' | 'staff';

export type RetailerStatus = 'pending_approval' | 'active' | 'deactivated';
export type StoreStatus = 'onboarding' | 'active' | 'paused' | 'suspended' | 'terminated';
export type ListingStatus = 'draft' | 'active' | 'retired';
export type Gender = 'her' | 'him' | 'unisex';
export type ListingBadge = 'new' | 'hot' | 'trending' | 'none';
export type ListingPolicy = 'return' | 'replace' | 'final_sale';

export type AdminProfile = {
  id: string;
  email: string;
  subRole: AdminSubRole;
};

export type RetailerProfile = {
  id: string;
  email: string;
  legalName: string;
  phone: string;
  gstin: string;
  status: RetailerStatus;
  storeId: string | null;
};

export type Store = {
  id: string;
  legalName: string;
  gstin: string;
  address: string;
  stateCode: string;
  lat: number;
  lng: number;
  status: StoreStatus;
  platformFeeBp: number;
  payoutCadenceDays: number;
};

export type Brand = {
  id: string;
  slug: string;
  name: string;
  tintColor: string | null;
  logoUrl: string | null;
  domain: string | null;
  isActive: boolean;
};

export type Category = {
  id: string;
  slug: string;
  label: string;
  parentId: string | null;
  iconName: string | null;
  tintColor: string | null;
  imageUrl: string | null;
  gender: Gender;
  sortOrder: number;
  isActive: boolean;
};

export type Variant = {
  id: string;
  listingId: string;
  sku: string | null;
  attributes: Record<string, string>;
  attributesLabel: string;
  imageUrls: string[];
  stock: number;
  reserved: number;
  pricePaise: number;
};

export type Listing = {
  id: string;
  storeId: string;
  brandId: string | null;
  categoryId: string;
  name: string;
  description: string | null;
  hsn: string | null;
  gender: Gender;
  badge: ListingBadge;
  listingPolicy: ListingPolicy;
  galleryUrls: string[];
  status: ListingStatus;
  ratingAvg: string;
  ratingCount: number;
  createdAt: string;
  brand?: Brand;
  category?: Category;
  variants?: Variant[];
};

/** One row of the retailer's flat inventory roster — variant + the bits of its
 *  parent listing the operator needs to scan and act on. */
export type InventoryRow = {
  id: string;
  listingId: string;
  listingName: string;
  listingStatus: ListingStatus;
  brandName: string | null;
  sku: string | null;
  attributesLabel: string;
  pricePaise: number;
  stock: number;
  reserved: number;
};

/** Shape returned by `POST /retailer/inventory/import`. */
export type InventoryImportResult = {
  applied: number;
  skipped: number;
  errors: { row: number; sku: string; reason: string }[];
};

export type AdminRetailerView = RetailerProfile & {
  subRole: RetailerSubRole;
  createdAt: string;
};

/**
 * What `/admin/stores` returns — the store row plus a small summary of the owning
 * retailer, so the UI can show approval-order dependencies (admin can't approve a
 * store until its retailer is `active`).
 */
export type AdminStoreView = Store & {
  retailer: {
    id: string;
    email: string;
    legalName: string;
    status: RetailerStatus;
  } | null;
};

export type CollectionKind = 'outfit' | 'occasion' | 'drop' | 'edit' | 'trend';
export type CollectionStatus = 'draft' | 'active' | 'archived';

export type Collection = {
  id: string;
  slug: string;
  name: string;
  kind: CollectionKind;
  gender: Gender;
  description: string | null;
  heroImageUrl: string | null;
  accentColors: string[];
  sortOrder: number;
  isFeatured: boolean;
  status: CollectionStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

/** Index row — `listingCount` rolled up server-side. */
export type CollectionIndexRow = Collection & { listingCount: number };

export type CategoryRow = Category & { listingCount: number };
export type BrandRow = Brand & { listingCount: number };

/** Detail — collection plus the ordered listing roster. */
export type CollectionDetail = Collection & {
  listings: (Listing & { sortOrder: number })[];
};

// ─────────────────────────────────────────────────────────────────────
// Promotions / coupons / vouchers / loyalty / pricing engine
// ─────────────────────────────────────────────────────────────────────

export type Mechanism = 'offer' | 'coupon' | 'voucher';
export type DiscountType =
  | 'flat_amount'
  | 'percent'
  | 'percent_upto'
  | 'bogo'
  | 'bxgy'
  | 'bundle'
  | 'tiered_cart'
  | 'free_shipping';
export type IssuerType = 'admin' | 'retailer' | 'system';
export type AppliedTo = 'retailer_promo' | 'platform_promo' | 'coupon' | 'shipping' | 'loyalty';
export type PromotionStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'expired'
  | 'exhausted'
  | 'revoked';
export type ClubbingDefault = 'allowed' | 'disallowed' | 'always_allowed';

export type DeliveryMethod = 'express' | 'standard' | 'pickup' | 'try_and_buy';
export type PaymentMethod = 'upi' | 'card' | 'cod' | 'wallet' | 'gift_card';

/** Discount config shapes per discountType. Mirrors backend schemas.ts. */
export type FlatAmountConfig = { amountPaise: number };
export type PercentConfig = { percent: number };
export type PercentUptoConfig = { percent: number; maxAmountPaise: number };
export type BogoConfig = {
  buyListingId: string;
  getListingId?: string;
  discountPercent: number;
};
export type BxgyConfig = {
  buyQty: number;
  getQty: number;
  buyListingIds: string[];
  getListingIds?: string[];
  discountPercent: number;
};
export type BundleConfig = { bundleListingIds: string[]; discountPercent: number };
export type TieredCartConfig = {
  tiers: Array<{ minCartPaise: number; discountPercent: number }>;
};
export type FreeShippingConfig = { minCartPaise?: number };

export type PromotionConfig =
  | FlatAmountConfig
  | PercentConfig
  | PercentUptoConfig
  | BogoConfig
  | BxgyConfig
  | BundleConfig
  | TieredCartConfig
  | FreeShippingConfig;

export type Scope = {
  listingIds?: string[];
  categoryIds?: string[];
  brandIds?: string[];
  storeIds?: string[];
  excludeListingIds?: string[];
  excludeCategoryIds?: string[];
  excludeBrandIds?: string[];
  allowedDaysOfWeek?: number[];
  allowedTimesOfDay?: Array<{ from: string; to: string }>;
  minCartPaise?: number;
  minItemCount?: number;
  allowedDeliveryMethods?: DeliveryMethod[];
  allowedPaymentMethods?: PaymentMethod[];
  firstOrderOnly?: boolean;
  loyaltyTierFilter?: Array<'bronze' | 'silver' | 'gold' | 'platinum'>;
  specificConsumerIds?: string[];
  excludeConsumerIds?: string[];
};

export type Promotion = {
  id: string;
  storeId: string | null;
  name: string;
  mechanism: Mechanism;
  discountType: DiscountType;
  issuerType: IssuerType;
  appliedTo: AppliedTo;
  scope: Scope;
  config: PromotionConfig;
  stackableWith: string[];
  nonStackable: string[];
  totalUses: number | null;
  redeemedCount: number;
  perConsumerLimit: number | null;
  validFrom: string; // ISO
  validUntil: string; // ISO
  status: PromotionStatus;
  /** Server-derived runtime status (factors in dates + counters). */
  effectiveStatus: PromotionStatus;
  createdAt: string;
};

export type VoucherCode = {
  id: string;
  promotionId: string;
  code: string;
  totalUses: number | null;
  redeemedCount: number;
  createdAt: string;
};

export type ClubbingMatrixCell = {
  appliedToA: AppliedTo;
  appliedToB: AppliedTo;
  defaultValue: ClubbingDefault;
  note: string | null;
  /** Whether this cell is persisted in the DB or just engine-default. */
  seeded: boolean;
};

export type ConsumerWallet = {
  id: string;
  consumerId: string;
  balancePaise: number;
  version: number;
  updatedAt: string;
};

export type WalletTxKind = 'top_up' | 'debit' | 'refund_credit' | 'gift_card_credit' | 'adjustment';
export type WalletTransaction = {
  id: string;
  walletId: string;
  kind: WalletTxKind;
  amountPaise: number;
  balanceAfterPaise: number;
  walletVersionAfter: number;
  refOrderId: string | null;
  refRefundId: string | null;
  refGiftCardId: string | null;
  note: string | null;
  at: string;
};

export type LoyaltyTxKind = 'earn' | 'redeem' | 'refund_credit' | 'adjustment' | 'bonus';
export type LoyaltyTransaction = {
  id: string;
  consumerId: string;
  kind: LoyaltyTxKind;
  points: number;
  balanceAfterPoints: number;
  refOrderId: string | null;
  note: string | null;
  expiresAt: string | null;
  at: string;
};

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type LoyaltyConfigRow = {
  value: unknown;
  description: string | null;
  updatedAt: string;
};
export type LoyaltyConfig = Partial<Record<
  | 'loyalty_point_value_paise'
  | 'loyalty_earn_rate_bp'
  | 'min_redeemable_points'
  | 'max_redeem_fraction_bp'
  | 'welcome_points'
  | 'referrer_points'
  | 'referred_points'
  | 'quiz_completion_points'
  | 'daily_reward_table',
  LoyaltyConfigRow
>>;

export type ConsumerSummary = {
  id: string;
  email: string;
  phone: string;
  name: string;
  status: string;
  signupAt: string;
};

// ─────────────────────── Orders ───────────────────────

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'routing'
  | 'accepted'
  | 'packed'
  | 'picked_up'
  | 'out_for_delivery'
  | 'at_door'
  | 'undelivered'
  | 'returning_to_store'
  | 'returned_to_store'
  | 'delivered'
  | 'cancelled'
  | 'payment_failed'
  | 'closed';

export type OrderGroupStatus =
  | 'in_flight'
  | 'partially_delivered'
  | 'all_delivered'
  | 'partially_cancelled'
  | 'all_cancelled';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'superseded';
export type DeliveryAttemptOutcome = 'delivered' | 'undelivered' | 'returning_to_store';
export type ActorType = 'consumer' | 'retailer' | 'admin' | 'delivery_agent' | 'system';

export type OrderItemOutcome =
  | 'pending_delivery'
  | 'delivered_kept'
  | 'at_door_kept'
  | 'at_door_returned'
  | 'at_door_refused'
  | 'at_store_pending_verification'
  | 'store_accepted_return'
  | 'store_rejected_held'
  | 'held_collected_at_counter'
  | 'held_redelivered'
  | 'held_abandoned'
  | 'held_window_expired'
  | 'dispute_open'
  | 'dispute_resolved_refund'
  | 'dispute_resolved_fresh_delivery'
  | 'dispute_resolved_pickup'
  | 'dispute_resolved_no_refund'
  | 'cancelled';

export type OrderListRow = {
  id: string;
  groupId?: string;
  status: OrderStatus;
  storeId?: string;
  storeName?: string;
  consumerId?: string;
  consumerName: string;
  consumerPhone?: string;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  itemCount: number;
  grandTotalPaise: number;
  placedAt: string;
  acceptedAt: string | null;
  deliveredAt: string | null;
};

export type OrderItem = {
  id: string;
  orderId: string;
  listingId: string;
  variantId: string;
  listingNameSnap: string;
  brandSnap: string;
  categorySnap: string;
  hsnSnap: string | null;
  galleryImageSnap: string | null;
  attributesLabelSnap: string;
  qty: number;
  unitPricePaise: number;
  lineSubtotalPaise: number;
  retailerPromoAllocPaise: number;
  platformPromoAllocPaise: number;
  couponAllocPaise: number;
  pointsAllocPaise: number;
  gstRateBp: number;
  gstAllocPaise: number;
  netLinePaise: number;
  outcome: OrderItemOutcome;
};

export type OrderTransition = {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: ActorType;
  actorId: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  at: string;
};

export type Payment = {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amountPaise: number;
  status: PaymentStatus;
  gatewayRef: string | null;
  previousPaymentId: string | null;
  initiatedAt: string;
  settledAt: string | null;
};

export type DeliveryAttempt = {
  id: string;
  orderId: string;
  deliveryAgentId: string | null;
  attemptNumber: number;
  outcome: DeliveryAttemptOutcome;
  notes: string | null;
  proofPhotos: string[];
  attemptedAt: string;
};

export type AvailableTransition = {
  from: OrderStatus;
  to: OrderStatus;
  actors: ActorType[];
};

export type OrderDetail = {
  id: string;
  groupId: string;
  status: OrderStatus;
  storeId: string;
  consumerId: string;
  addressId: string | null;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  paymentMethodLabel: string;

  consumerNameSnap: string;
  consumerEmailSnap: string;
  consumerPhoneSnap: string;
  addressLine1Snap: string | null;
  addressLine2Snap: string | null;
  addressCitySnap: string | null;
  addressPincodeSnap: string | null;
  addressStateCodeSnap: string | null;

  storeNameSnap: string;
  storeAddressSnap: string;
  storeGstinSnap: string;
  storeStateCodeSnap: string;

  itemsSubtotalPaise: number;
  retailerPromoPaise: number;
  platformPromoPaise: number;
  couponPaise: number;
  pointsRedeemedPaise: number;
  walletAppliedPaise: number;
  taxPaise: number;
  taxSplitKind: 'intra_state' | 'inter_state';
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  deliveryFeePaise: number;
  handlingFeePaise: number;
  convenienceFeePaise: number;
  grandTotalPaise: number;
  platformFeeBpSnap: number;

  placedAt: string;
  acceptedAt: string | null;
  deliveredAt: string | null;
  closedAt: string | null;
  piiScrubbedAt: string | null;
  idempotencyKey: string;

  group: { id: string; status: OrderGroupStatus; placedAt: string };
  items: OrderItem[];
  payments: Payment[];
  transitions: OrderTransition[];
  deliveryAttempts: DeliveryAttempt[];
  availableTransitions: AvailableTransition[];
  returns?: Return[];
  refunds?: Refund[];
  heldItems?: HeldItem[];
};

export type PlaceOrderResult = {
  orderId: string;
  groupId: string;
  status: OrderStatus;
  pricing: PricingBreakdown;
  alreadyExisted: boolean;
};

export type TestConsumerCreated = {
  consumer: { id: string; email: string; phone: string; name: string };
  addressId: string;
};

export type PricingBreakdown = {
  lineSubtotalPaise: number;
  appliedPromotions: Array<{
    promotionId: string;
    mechanism: Mechanism;
    discountType: DiscountType;
    appliedTo: AppliedTo;
    amountPaise: number;
    voucherCodeId?: string;
  }>;
  excludedPromotions: Array<{ promotionId: string; reason: string }>;
  retailerPromoDiscountPaise: number;
  platformPromoDiscountPaise: number;
  couponDiscountPaise: number;
  loyaltyDiscountPaise: number;
  shippingSubsidyPaise: number;
  postPromoSubtotalPaise: number;
  taxBasePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  deliveryFeePaise: number;
  handlingFeePaise: number;
  convenienceFeePaise: number;
  tcsPaise: number;
  totalPaise: number;
  loyaltyEarnedPoints: number;
  loyaltyRedeemedPoints: number;
};

// ─────────────────────── Returns / Refunds / Held ───────────────────────

export type ReturnKind = 'door_return' | 'standard_return';
export type AgentDisposition = 'kept' | 'returned' | 'refused';
export type StoreReturnDecision = 'pending' | 'accepted' | 'rejected';

export type Return = {
  id: string;
  orderItemId: string;
  kind: ReturnKind;
  openedAt: string;
  reasonText: string | null;
  photos: string[];
  agentDisposition: AgentDisposition | null;
  storeDecision: StoreReturnDecision;
  storeDecidedAt: string | null;
  verificationWindowExpiresAt: string | null;
};

export type ReturnWithItem = Return & {
  orderItem: OrderItem & { order: OrderDetail };
};

export type RefundStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'partially_disbursed'
  | 'failed';

export type RefundDisbursementStatus = 'pending' | 'succeeded' | 'failed';
export type RefundDestination = 'original_tender' | 'wallet';

export type RefundLine = {
  id: string;
  refundId: string;
  orderItemId: string;
  refundedAmountPaise: number;
  couponClawbackPaise: number;
  pointsClawbackPaise: number;
  taxRefundPaise: number;
};

export type RefundDisbursement = {
  id: string;
  refundId: string;
  destination: RefundDestination;
  sourcePaymentId: string | null;
  amountPaise: number;
  status: RefundDisbursementStatus;
  gatewayRef: string | null;
  previousDisbursementId: string | null;
  initiatedAt: string;
  settledAt: string | null;
};

export type Refund = {
  id: string;
  orderId: string;
  totalRefundPaise: number;
  status: RefundStatus;
  reason: string | null;
  createdAt: string;
  completedAt: string | null;
  lines: RefundLine[];
  disbursements: RefundDisbursement[];
};

export type HeldItemStatus = 'holding' | 'expired' | 'resolved';
export type HeldItemDisposition =
  | 'returned_to_consumer'
  | 'redelivered'
  | 'forfeited_to_store'
  | 'restocked'
  | 'written_off';

export type HeldItem = {
  id: string;
  returnId: string;
  storeId: string;
  consumerId: string;
  status: HeldItemStatus;
  disposition: HeldItemDisposition | null;
  holdingWindowExpiresAt: string;
  extendedByAdminId: string | null;
  extensionReason: string | null;
  resolvedAt: string | null;
  return?: ReturnWithItem;
};
