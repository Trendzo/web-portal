/* Backend response types — kept narrow to what the dashboard reads.
   Mirror src/db/schema/* on the backend; widen only as new fields are surfaced in UI. */

export type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };

export type AdminSubRole = 'super_admin' | 'ops_admin' | 'support';
export type RetailerSubRole = 'owner' | 'manager' | 'staff';

export type ConsumerStatus = 'active' | 'suspended' | 'closed';
export type RetailerStatus =
  | 'pending_approval'
  | 'under_review'
  | 'approved_no_store'
  | 'onboarding'
  | 'active'
  | 'paused'
  | 'suspended'
  | 'terminated'
  | 'deactivated';
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
  templateId: string | null;
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

export type InventoryAdjustment = {
  id: string;
  variantId: string;
  delta: number;
  newStock: number;
  reason: string;
  actorKind: string;
  actorId: string | null;
  refKind: string | null;
  refId: string | null;
  note: string | null;
  at: string;
};

/** What `GET /retailer/orders` returns per row. */
export type RetailerOrder = {
  id: string;
  status: string;
  consumerName: string;
  consumerPhone: string;
  deliveryMethod: string;
  paymentMethod: string;
  itemCount: number;
  grandTotalPaise: number;
  placedAt: string;
  acceptedAt: string | null;
  deliveredAt: string | null;
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
  status: ConsumerStatus;
  signupAt: string;
};

export type ConsumerProfile = ConsumerSummary & {
  genderPreference: 'her' | 'him' | 'unisex' | null;
};

// ─────────────────────── Issues (formerly "Disputes" — see §19) ───────────────────────
// `kind: 'dispute'` keeps the historical adversarial workflow; `'query'` is the
// upcoming lighter ticket type. Status union is widened with the doc-aligned
// awaiting_* states so future §19 work can populate them without another rename.

export type IssueKind = 'query' | 'dispute';

export type IssueStatus =
  | 'open'
  | 'requested_evidence'
  | 'awaiting_consumer'
  | 'awaiting_retailer'
  | 'awaiting_admin'
  | 'decided'
  | 'escalated'
  | 'resolved'
  | 'closed';

export type IssueDecision = 'refund' | 'fresh_delivery' | 'pickup' | 'no_refund' | 'split';

export type IssueListRow = {
  id: string;
  /** Optional today; populated when §19 ships. Defaults to `'dispute'` for legacy rows. */
  kind?: IssueKind;
  orderId: string | null;
  returnId: string | null;
  targetKind: 'order' | 'return';
  targetId: string;
  openedByActorType: ActorType;
  openedByActorId: string;
  openedAt: string;
  description: string;
  evidence: string[];
  status: IssueStatus;
  decision: IssueDecision | null;
  decisionNote: string | null;
  decidedAt: string | null;
  decidedByAdminId: string | null;
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

  group: { id: string; status: OrderGroupStatus; placedAt: string; siblingOrders: OrderListRow[] };
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

// ─────────────────────────────────────────────────────────────────────
// §1 Identity & Access — staff, admin team, sub-role permissions, notifications
// ─────────────────────────────────────────────────────────────────────

export type RetailerStaff = {
  id: string;
  storeId: string | null;
  email: string;
  legalName: string;
  phone: string;
  gstin: string;
  subRole: RetailerSubRole;
  status: 'pending_approval' | 'active' | 'deactivated';
  createdAt: string;
};

export type RetailerStaffInvite = {
  id: string;
  email: string;
  subRole: RetailerSubRole;
  invitedAt: string;
  expiresAt: string;
};

export type AdminTeamMember = {
  id: string;
  email: string;
  name: string;
  subRole: AdminSubRole;
  active: boolean;
  lastActiveAt: string | null;
  createdAt: string;
};

/** Action × sub-role permission grid edited by super-admin under §1. */
export type SubRolePermissionMatrix<Role extends string> = {
  actions: string[];
  subRoles: Role[];
  cells: Record<string, Record<Role, boolean>>;
};

export type NotificationKind = 'order' | 'refund' | 'kyc' | 'system' | 'issue' | 'payout';

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  deepLink: string | null;
  readAt: string | null;
  createdAt: string;
};

export type BannerKind = 'impersonation' | 'kyc' | 'maintenance' | 'floor_breach' | 'suspended';

// ─────────────────────────────────────────────────────────────────────
// §2 Retailer Onboarding — application pipeline, clarification thread, store profile
// ─────────────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | 'pending'
  | 'under_review'
  | 'docs_requested'
  | 'approved'
  | 'rejected';

export type Application = {
  id: string;
  legalName: string;
  email: string;
  phone: string;
  gstin: string;
  pan: string | null;
  addressLine: string;
  pincode: string;
  stateCode: string;
  submittedAt: string;
  status: ApplicationStatus;
  pennyDropResult: 'matched' | 'failed' | 'not_attempted';
  gstinVerification: 'valid' | 'invalid' | 'not_attempted';
  documentsCount: number;
  clarificationCount: number;
  documents?: ApplicationDocument[];
};

export type ApplicationDocument = {
  id: string;
  kind: 'storefront_photo' | 'address_proof' | 'pan' | 'gst_certificate' | 'bank_proof' | 'other';
  url: string;
};

export type ClarificationMessage = {
  id: string;
  applicationId: string;
  authorKind: 'admin' | 'retailer';
  authorLabel: string;
  body: string;
  attachments: string[];
  fieldKey: string | null;
  createdAt: string;
};

export type StoreHoursDay = { from: string; to: string; closed: boolean };
export type StoreHours = {
  monday: StoreHoursDay;
  tuesday: StoreHoursDay;
  wednesday: StoreHoursDay;
  thursday: StoreHoursDay;
  friday: StoreHoursDay;
  saturday: StoreHoursDay;
  sunday: StoreHoursDay;
};

export type BankAccount = {
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string | null;
  pennyDropStatus: 'matched' | 'name_mismatch' | 'failed' | 'not_attempted';
  pennyDropAt: string | null;
};

export type RequiredDocumentType =
  | 'gstin_certificate'
  | 'pan_card'
  | 'address_proof'
  | 'cancelled_cheque'
  | 'shop_act_license';

export type StoreDocument = {
  id: string;
  kind: RequiredDocumentType;
  label: string;
  status: 'verified' | 'pending_review' | 'missing' | 'rejected';
  uploadedAt: string | null;
  fileUrl: string | null;
};

// ─────────────────────────────────────────────────────────────────────
// §3 KYC & Compliance — re-verification, change requests, enforcement, exports/deletions
// ─────────────────────────────────────────────────────────────────────

export type KycDocumentStatus = 'verified' | 'pending_review' | 'missing' | 'rejected';

export type KycDocument = {
  id: string;
  kind: RequiredDocumentType;
  label: string;
  status: KycDocumentStatus;
  uploadedAt: string | null;
  fileUrl: string | null;
};

export type KycReverificationStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'overdue';

export type KycReverification = {
  id: string;
  retailerId: string;
  dueAt: string;
  gracePeriodEndsAt: string;
  status: KycReverificationStatus;
  lastVerifiedAt: string | null;
  documents: KycDocument[];
};

export type ChangeRequestField = 'legal_name' | 'address' | 'bank_account' | 'gstin';
export type ChangeRequestStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

export type ChangeRequest = {
  id: string;
  retailerId: string;
  field: ChangeRequestField;
  currentValue: string;
  requestedValue: string;
  reason: string;
  status: ChangeRequestStatus;
  submittedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
};

export type EnforcementStep = 'warning_1' | 'warning_2' | 'warning_3' | 'suspension' | 'termination' | 'lifted';

export type PolicyEnforcementAction = {
  id: string;
  storeId: string;
  step: EnforcementStep;
  breachKind: 'acceptance_rate' | 'fulfilment_sla' | 'dispute_rate' | 'return_rate' | 'kyc_overdue' | 'policy_violation';
  metric: Record<string, unknown> | null;
  actedAt: string;
  actedByAdminId: string | null;
  reason: string | null;
  liftsActionId: string | null;
};

/** @deprecated use PolicyEnforcementAction */
export type PolicyEnforcement = PolicyEnforcementAction;

export type DataExportStatus = 'pending' | 'building' | 'ready' | 'expired' | 'failed';

export type DataExportRequest = {
  id: string;
  consumerId: string;
  requestedAt: string;
  status: DataExportStatus;
  readyAt: string | null;
  downloadUrl: string | null;
  expiresAt: string | null;
  failureReason: string | null;
};

export type AccountDeletionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type AccountDeletionRequest = {
  id: string;
  consumerId: string;
  requestedAt: string;
  status: AccountDeletionStatus;
  scheduledFor: string;
  cancelledAt: string | null;
};

// ─────────────────────────────────────────────────────────────────────
// §4 Store Operations — pause state, holiday calendar, notification prefs
// ─────────────────────────────────────────────────────────────────────

export type StoreVisibilityWhilePaused = 'block_orders_only' | 'hide_from_catalog';

export type StorePauseState = {
  paused: boolean;
  visibility: StoreVisibilityWhilePaused;
  pausedAt: string | null;
  reason: string | null;
};

export type HolidayDate = {
  date: string; // YYYY-MM-DD
  label: string | null;
};

export type NotificationChannel = 'push' | 'email' | 'sms' | 'in_app';
export type DashboardTileKey = 'sales' | 'orders' | 'inventory' | 'top_products' | 'recent_products' | 'compliance';

export type NotificationPrefs = {
  channels: Record<NotificationChannel, boolean>;
  dailyDigest: boolean;
  language: 'en' | 'hi' | 'mr' | 'ta';
  enabledDashboardTiles: DashboardTileKey[];
};

// ─────────────────────────────────────────────────────────────────────
// §5 Catalog and Listings — attribute templates, audit, moderation flags
// ─────────────────────────────────────────────────────────────────────

export type AttributeAxisType = 'enum' | 'free_text' | 'numeric' | 'color';

export type AttributeTemplate = {
  id: string;
  name: string;
  isPlatformDefault?: boolean;
  axes: Array<{
    name: string;
    type: AttributeAxisType;
    allowedValues: string[];
  }>;
  usedByListingCount: number;
  updatedAt: string | null;
};

export type ListingAuditEntry = {
  id: string;
  listingId: string;
  action: string;
  actorKind: 'retailer' | 'admin' | 'system';
  actorId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
  note: string | null;
};

export type CatalogFlagSource = 'automation' | 'user_report' | 'admin_review';
export type CatalogFlagStatus = 'open' | 'under_appeal' | 'resolved_taken_down' | 'resolved_restored' | 'resolved_dismissed';

export type CatalogFlag = {
  id: string;
  listingId: string;
  source: CatalogFlagSource;
  reasonCode: string;
  details: string | null;
  reportedByConsumerId: string | null;
  ruleKey: string | null;
  status: CatalogFlagStatus;
  openedAt: string;
  resolvedAt: string | null;
};

/** @deprecated use CatalogFlagSource */
export type CatalogFlagKind = 'auto_flagged' | 'user_reported' | 'under_appeal';

// ─────────────────────────────────────────────────────────────────────
// §7 AI Catalog Generation
// ─────────────────────────────────────────────────────────────────────

export type AiSubmissionStatus =
  | 'submitted'
  | 'processing'
  | 'ready_for_review'
  | 'accepted'
  | 'rejected'
  | 'regenerating'
  | 'failed';
export type AiSubmissionMode = 'with_model' | 'without_model';

export type AiSubmission = {
  id: string;
  storeId: string;
  listingId: string | null;
  mode: AiSubmissionMode;
  rawPhotos: string[];
  outputUrls: string[];
  status: AiSubmissionStatus;
  costPaise: number | null;
  parentSubmissionId: string | null;
  thirdPartyRequestId: string | null;
  at: string;
};

export type AiQuota = {
  used: number;
  total: number;
  remaining: number;
};

// ─────────────────────────────────────────────────────────────────────
// §12 Fees and Charges
// ─────────────────────────────────────────────────────────────────────

export type FeesConfig = {
  defaultPlatformFeeBp: number;
  surgeMultiplier: number;
  gstRateBp: number;
  tcsRateBp: number;
  intraStateSplit: { cgstBp: number; sgstBp: number };
  interStateSplit: { igstBp: number };
  delivery: Record<DeliveryMethod, { baseFeePaise: number; perKmFeePaise: number }>;
  platformFeeOverrides: Array<{ retailerId: string; retailerName: string; platformFeeBp: number; reason: string }>;
};

export type RetailerFeeView = {
  platformFeeBp: number;
  payoutCadenceDays: number;
  delegationModeEnabled: boolean;
  handlingFeePaise: number;
  convenienceFeePaise: number;
  gstRateBp: number;
  tcsRateBp: number;
};

// ─────────────────────────────────────────────────────────────────────
// §13 Promotion performance + targeted drops + anomalies
// ─────────────────────────────────────────────────────────────────────

export type PromotionPerformance = {
  promotionId: string;
  name: string;
  redemptions: number;
  gmvInfluencePaise: number;
  aovLiftBp: number;
  refundRateBp: number;
  anomalyFlagged: boolean;
};

export type TargetedDrop = {
  id: string;
  name: string;
  promotionId: string;
  promotionName: string;
  cohortKind: 'specific_consumers' | 'tier' | 'segment';
  audienceSize: number;
  pushedAt: string;
  redemptionCount: number;
};

export type PromotionAnomaly = {
  id: string;
  promotionId: string;
  promotionName: string;
  kind: 'velocity_spike' | 'concentrated_consumers' | 'refund_spike' | 'suspect_traffic';
  detectedAt: string;
  severity: 'low' | 'medium' | 'high';
  metric: string;
  value: string;
  threshold: string;
  status: 'open' | 'acknowledged' | 'resolved';
  consumersInvolved: number;
};

// ─────────────────────────────────────────────────────────────────────
// §14 Wallet payouts (account closure escheat)
// ─────────────────────────────────────────────────────────────────────

export type WalletPayoutStatus = 'pending_claim' | 'awaiting_bank' | 'paid' | 'escheated' | 'failed';

export type WalletPayout = {
  id: string;
  consumerId: string;
  consumerEmail: string;
  balancePaise: number;
  closedAt: string;
  claimWindowEndsAt: string;
  status: WalletPayoutStatus;
  bankAccountMasked: string | null;
  paidAt: string | null;
};

// ─────────────────────────────────────────────────────────────────────
// §15 Payment capture reconciliation + failures
// ─────────────────────────────────────────────────────────────────────

export type PaymentReconciliationStatus = 'matched' | 'mismatch' | 'missing_capture' | 'missing_settlement';

export type PaymentReconRow = {
  id: string;
  orderId: string;
  gateway: 'razorpay' | 'phonepe' | 'cashfree' | 'manual';
  capturePaise: number;
  settlementPaise: number;
  status: PaymentReconciliationStatus;
  capturedAt: string;
  settledAt: string | null;
  diffPaise: number;
};

export type PaymentFailureRow = {
  id: string;
  orderId: string;
  consumerEmail: string;
  amountPaise: number;
  method: PaymentMethod;
  failureCode: string;
  failureMessage: string;
  attemptCount: number;
  reservationStillHeld: boolean;
  failedAt: string;
};

// ─────────────────────────────────────────────────────────────────────
// §16 Refunds — post-payout recovery
// ─────────────────────────────────────────────────────────────────────

export type PostPayoutRecoveryStatus = 'planned' | 'debited' | 'failed' | 'cancelled';

export type PostPayoutRecoveryRow = {
  id: string;
  refundId: string;
  orderId: string;
  retailerId: string;
  retailerName: string;
  payoutCycleId: string;
  refundedPaise: number;
  plannedDebitPaise: number;
  status: PostPayoutRecoveryStatus;
  reason: string | null;
  createdAt: string;
  scheduledFor: string;
  settledAt: string | null;
};

// ─────────────────────────────────────────────────────────────────────
// §17 Consumer Invoicing
// ─────────────────────────────────────────────────────────────────────

export type TaxInvoiceKind = 'invoice' | 'supplementary' | 'commission';

export type TaxInvoice = {
  id: string;
  number: string;
  kind: TaxInvoiceKind;
  status: 'draft' | 'issued' | 'credited';
  orderId: string;
  storeId: string;
  consumerName: string;
  issuedAt: string | null;
  totalPaise: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  pdfUrl: string | null;
  linkedInvoiceId: string | null;
  createdAt: string;
};

export type InvoiceNumberingConfig = {
  legalEntityId: string;
  legalEntityName: string;
  prefix: string;
  pattern: string;
  nextSequence: number;
  resetCycle: 'never' | 'fiscal_year' | 'monthly';
};

export type GstReturnFile = {
  id: string;
  period: string;
  kind: 'gstr1' | 'gstr3b' | 'tcs_reconciliation';
  generatedAt: string | null;
  downloadUrl: string | null;
  status: 'pending' | 'generating' | 'ready' | 'failed';
};

// ─────────────────────────────────────────────────────────────────────
// §18 Retailer Billing & Settlement
// ─────────────────────────────────────────────────────────────────────

export type CommissionInvoice = {
  id: string;
  number: string;
  orderId: string;
  storeId: string;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  totalPaise: number;
  issuedAt: string;
  pdfUrl: string | null;
};

export type BillingStatement = {
  id: string;
  period: string;
  storeId: string;
  status: 'open' | 'closing' | 'closed';
  ordersCount: number;
  grossPaise: number;
  commissionPaise: number;
  tcsPaise: number;
  refundsPaise: number;
  holdsPaise: number;
  adjustmentsPaise: number;
  netPaise: number;
  generatedAt: string;
};

export type BillingStatementDetail = BillingStatement & {
  liabilityBookings: Array<{ id: string; issueId: string; description: string; amountPaise: number }>;
};

export type PayoutCycleStatus = 'pending' | 'processing' | 'paid' | 'failed';

export type PayoutCycle = {
  id: string;
  storeId: string;
  period: string;
  cycleStart: string;
  cycleEnd: string;
  grossPaise: number;
  commissionPaise: number;
  commissionTaxPaise: number;
  refundsHeldPaise: number;
  adjustmentsPaise: number;
  netPaise: number;
  amountPaise: number;
  status: PayoutCycleStatus;
  bankAccountMasked: string;
  bankConfirmationRef: string | null;
  retryCount: number;
  initiatedAt: string | null;
  settledAt: string | null;
  statementUrl: string | null;
  createdAt: string;
  deductions?: Array<{ kind: string; label: string; amountPaise: number }>;
};

export type EarlyDisbursementStatus = 'pending' | 'approved' | 'rejected';

export type EarlyDisbursementRequest = {
  id: string;
  storeId: string;
  storeName: string;
  amountPaise: number;
  reason: string;
  requestedAt: string;
  status: EarlyDisbursementStatus;
  decidedAt: string | null;
  decisionNote: string | null;
};

export type BillingMonthSummary = {
  period: string;
  status: 'open' | 'closing' | 'closed';
  storesIncluded: number;
  totalGrossPaise: number;
  totalCommissionPaise: number;
  totalNetPaise: number;
  closedAt: string | null;
  gstReturnStatus: 'pending' | 'generating' | 'ready' | 'failed';
};

export type AdminPayoutRow = {
  id: string;
  storeId: string;
  storeName: string;
  period: string;
  amountPaise: number;
  status: PayoutCycleStatus;
  bankAccountMasked: string;
  bankConfirmationRef: string | null;
  retryCount: number;
  initiatedAt: string | null;
  settledAt: string | null;
  createdAt: string;
};

export type TailOfCycleRow = {
  storeId: string;
  storeName: string;
  period: string;
  unreconciledPaise: number;
  reasonHints: string[];
};

// ─────────────────────────────────────────────────────────────────────
// §19 Issue detail (extends IssueListRow already in place)
// ─────────────────────────────────────────────────────────────────────

export type IssueAttachment = { id: string; url: string; label: string };

export type IssueMessage = {
  id: string;
  issueId: string;
  authorKind: 'admin' | 'retailer' | 'consumer' | 'system';
  authorLabel: string;
  body: string;
  attachments: IssueAttachment[];
  createdAt: string;
};

export type IssueDetail = IssueListRow & {
  target: Record<string, unknown> | null;
  decidedByAdmin: { id: string; email: string } | null;
};

// ─────────────────────────────────────────────────────────────────────
// §20 Consumer Management — bans + community/reviews moderation
// ─────────────────────────────────────────────────────────────────────

export type ConsumerBanFlags = {
  community: boolean;
  rewards: boolean;
  reviews: boolean;
};

export type CommunityFlag = {
  id: string;
  consumerId: string;
  consumerLabel: string;
  postId: string;
  excerpt: string;
  reason: 'spam' | 'harassment' | 'nsfw' | 'misinfo' | 'other';
  reportedBy: string;
  reportedAt: string;
  status: 'open' | 'approved' | 'taken_down';
};

export type ReviewFlag = {
  id: string;
  consumerId: string;
  consumerLabel: string;
  reviewId: string;
  listingId: string;
  listingName: string;
  rating: number;
  excerpt: string;
  reason: 'spam' | 'fake' | 'abuse' | 'irrelevant' | 'other';
  reportedAt: string;
  status: 'open' | 'approved' | 'taken_down' | 'edited';
};

// ─────────────────────────────────────────────────────────────────────
// §21 Analytics & Reporting (rollup row shapes)
// ─────────────────────────────────────────────────────────────────────

export type SalesReportRow = {
  bucket: string;
  ordersCount: number;
  grossPaise: number;
  netPaise: number;
};

export type FulfilmentMetricRow = {
  bucket: string;
  acceptanceRateBp: number;
  avgTimeToAcceptMs: number;
  avgTimeToPackMs: number;
  avgTimeToHandoverMs: number;
  avgEndToEndMs: number;
};

export type ReturnsReportRow = {
  bucket: string;
  returnRateBp: number;
  totalReturns: number;
  topListing: string;
  topReason: string;
};

export type LeaderboardRow = {
  retailerId: string;
  retailerName: string;
  acceptanceRateBp: number;
  fulfilmentScoreBp: number;
  returnRateBp: number;
  disputeRateBp: number;
  rank: number;
};

export type FunnelStep = {
  label: string;
  count: number;
  dropoffPctFromPrevious: number;
};

export type FeatureUsageRow = {
  feature: string;
  uniqueUsers: number;
  totalUsage: number;
  costPaise: number;
};

export type OperationalRow = {
  metric: string;
  value: string;
  trendBp: number;
};

export type ComplianceFloorRow = {
  retailerName: string;
  metric: string;
  value: string;
  threshold: string;
  daysBelow: number;
};

export type InventoryHealthRow = {
  listingId: string;
  listingName: string;
  variantSku: string | null;
  stock: number;
  reservedDays: number;
  status: 'low_stock' | 'out_of_stock' | 'overstock' | 'aged';
  lastSoldAt: string | null;
};
