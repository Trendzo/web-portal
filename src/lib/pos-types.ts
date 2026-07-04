// Shapes for the offline POS (counter billing) surface. Money is always paise (int).

export type PricingMode = 'tax_inclusive' | 'tax_exclusive';
export type DiscountMode = 'flat' | 'pct';
export type TenderMethod = 'cash' | 'card' | 'upi';

export type PosLookupRow = {
  variantId: string;
  listingId: string;
  name: string;
  brand: string | null;
  attributesLabel: string;
  sku: string | null;
  barcode: string | null;
  hsn: string | null;
  pricePaise: number;
  /** Struck-through "was" price (paise). Null when the variant has none. */
  compareAtPaise: number | null;
  availableQty: number;
  imageUrl: string | null;
};

export type PosLookupResult = { exact: PosLookupRow | null; results: PosLookupRow[] };

/** A line in the local cart (pre-quote). */
export type CartLine = {
  variantId: string;
  listingId: string;
  name: string;
  brand: string | null;
  attributesLabel: string;
  sku: string | null;
  unitMrpPaise: number;
  qty: number;
  /** Derived-and-synced from discountMode/discountValue; the paise value sent to the server. */
  lineDiscountPaise: number;
  /** ₹ flat or % — how discountValue is interpreted. */
  discountMode: DiscountMode;
  /** Raw user input: rupees when flat, percent when pct. */
  discountValue: number;
  availableQty: number;
};

export type Tender = {
  method: TenderMethod;
  amountPaise: number;
  tenderedPaise?: number;
  reference?: string;
};

export type PosCustomer = {
  name?: string | null;
  phone?: string | null;
  gstin?: string | null;
};

export type QuoteLine = {
  variantId: string;
  qty: number;
  lineGrossPaise: number;
  lineDiscountPaise: number;
  billDiscountAllocPaise: number;
  gstRateBp: number;
  taxableValuePaise: number;
  gstPaise: number;
  netLinePaise: number;
  availableQty: number;
};

export type PosQuote = {
  lines: QuoteLine[];
  taxSplitKind: 'intra_state';
  itemsGrossPaise: number;
  lineDiscountPaise: number;
  billDiscountPaise: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  roundOffPaise: number;
  payablePaise: number;
};

export type PosSaleResult = {
  saleId: string;
  invoiceId: string;
  invoiceNumber: string;
  payablePaise: number;
  changePaise: number;
  alreadyExisted: boolean;
};

export type PosSaleListRow = {
  id: string;
  status: 'held' | 'completed' | 'voided';
  invoiceNumber: string | null;
  pdfUrl: string | null;
  customerName: string | null;
  customerPhone: string | null;
  payablePaise: number;
  taxPaise: number;
  isReturn: boolean;
  completedAt: string | null;
  createdAt: string;
};

export type PosSaleItem = {
  id: string;
  variantId: string;
  listingId: string;
  listingNameSnap: string;
  brandSnap: string | null;
  attributesLabelSnap: string;
  hsnSnap: string | null;
  skuSnap: string | null;
  qty: number;
  unitMrpPaise: number;
  lineGrossPaise: number;
  lineDiscountPaise: number;
  gstRateBp: number;
  taxableValuePaise: number;
  gstPaise: number;
  netLinePaise: number;
};

export type PosSaleDetail = {
  id: string;
  status: 'held' | 'completed' | 'voided';
  customerNameSnap: string | null;
  customerPhoneSnap: string | null;
  customerGstinSnap: string | null;
  storeLegalNameSnap: string;
  storeGstinSnap: string;
  storeAddressSnap: string;
  storeStateCodeSnap: string;
  itemsGrossPaise: number;
  lineDiscountPaise: number;
  billDiscountPaise: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  taxPaise: number;
  roundOffPaise: number;
  payablePaise: number;
  tenderedPaise: number;
  changePaise: number;
  originalSaleId: string | null;
  completedAt: string | null;
  createdAt: string;
  items: PosSaleItem[];
  payments: {
    id: string;
    method: TenderMethod;
    direction: string;
    amountPaise: number;
    reference: string | null;
  }[];
  invoice: { id: string; invoiceNumber: string; pdfUrl: string | null } | null;
};

export type HeldBill = {
  id: string;
  note: string | null;
  customerName: string | null;
  itemCount: number;
  payablePaise: number;
  heldAt: string | null;
};

export type PosDaySummary = {
  date: string;
  saleCount: number;
  returnCount: number;
  itemCount: number;
  grossPayablePaise: number;
  taxableValuePaise: number;
  taxPaise: number;
  refundsPaise: number;
  byTender: Record<string, number>;
};
