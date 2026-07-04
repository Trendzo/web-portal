import { create } from 'zustand';
import type { CartLine, DiscountMode, PosCustomer, PosLookupRow, PricingMode, Tender } from './pos-types';

/** Line discount in paise, derived from its mode/value and capped at the line's gross. */
function linePaise(l: CartLine): number {
  const base = l.unitMrpPaise * l.qty;
  const raw = l.discountMode === 'pct' ? (base * l.discountValue) / 100 : l.discountValue * 100;
  return Math.min(base, Math.max(0, Math.round(raw)));
}

/** Bill discount in paise. Percent applies to the net subtotal (items gross − line discounts). */
function billPaise(lines: CartLine[], mode: DiscountMode, value: number): number {
  const net = lines.reduce((s, l) => s + l.unitMrpPaise * l.qty - l.lineDiscountPaise, 0);
  const raw = mode === 'pct' ? (net * value) / 100 : value * 100;
  return Math.min(net, Math.max(0, Math.round(raw)));
}

/** Re-sync every derived paise field after any line/mode/value change. */
function commit(lines: CartLine[], billMode: DiscountMode, billValue: number) {
  const synced = lines.map((l) => ({ ...l, lineDiscountPaise: linePaise(l) }));
  return { lines: synced, billDiscountPaise: billPaise(synced, billMode, billValue) };
}

/**
 * The draft counter-bill. Long-lived client UI state mutated by many sibling components
 * (scan input, line rows, totals, payment panel, hotkeys), so it lives in a dedicated
 * Zustand store rather than component state or React Query. Totals are NOT computed here —
 * a server /quote call is the source of truth (see useQuote).
 */
type PosCartState = {
  lines: CartLine[];
  /** Derived-and-synced from billDiscountMode/billDiscountValue; the paise value sent to the server. */
  billDiscountPaise: number;
  billDiscountMode: DiscountMode;
  /** Raw user input: rupees when flat, percent when pct. */
  billDiscountValue: number;
  customer: PosCustomer;
  tenders: Tender[];
  pricingMode: PricingMode;
  /** Set when the cart was resumed from a parked bill, so completion finalises that row. */
  heldSaleId: string | null;
  /** Bumped on reset so a fresh idempotency key is generated per bill. */
  billNonce: number;

  addRow: (row: PosLookupRow) => void;
  setQty: (variantId: string, qty: number) => void;
  setLineDiscountValue: (variantId: string, value: number) => void;
  setLineDiscountMode: (variantId: string, mode: DiscountMode) => void;
  removeLine: (variantId: string) => void;
  setBillDiscountValue: (value: number) => void;
  setBillDiscountMode: (mode: DiscountMode) => void;
  setCustomer: (c: PosCustomer) => void;
  setTenders: (t: Tender[]) => void;
  setPricingMode: (m: PricingMode) => void;
  loadFromHeld: (
    heldSaleId: string,
    lines: Omit<CartLine, 'discountMode' | 'discountValue'>[],
    customer: PosCustomer,
    billDiscountPaise: number,
  ) => void;
  reset: () => void;
  isEmpty: () => boolean;
};

export const usePosCart = create<PosCartState>((set, get) => ({
  lines: [],
  billDiscountPaise: 0,
  billDiscountMode: 'flat',
  billDiscountValue: 0,
  customer: {},
  tenders: [],
  pricingMode: 'tax_inclusive',
  heldSaleId: null,
  billNonce: 1,

  addRow: (row) =>
    set((s) => {
      const existing = s.lines.find((l) => l.variantId === row.variantId);
      if (existing) {
        return {
          lines: s.lines.map((l) =>
            l.variantId === row.variantId ? { ...l, qty: l.qty + 1 } : l,
          ),
        };
      }
      const line: CartLine = {
        variantId: row.variantId,
        listingId: row.listingId,
        name: row.name,
        brand: row.brand,
        attributesLabel: row.attributesLabel,
        sku: row.sku,
        unitMrpPaise: row.pricePaise,
        qty: 1,
        lineDiscountPaise: 0,
        discountMode: 'flat',
        discountValue: 0,
        availableQty: row.availableQty,
      };
      return commit([...s.lines, line], s.billDiscountMode, s.billDiscountValue);
    }),

  setQty: (variantId, qty) =>
    set((s) => {
      const lines = s.lines.flatMap((l) =>
        l.variantId === variantId ? (qty <= 0 ? [] : [{ ...l, qty }]) : [l],
      );
      return commit(lines, s.billDiscountMode, s.billDiscountValue);
    }),

  setLineDiscountValue: (variantId, value) =>
    set((s) => {
      const lines = s.lines.map((l) =>
        l.variantId === variantId ? { ...l, discountValue: Math.max(0, value) } : l,
      );
      return commit(lines, s.billDiscountMode, s.billDiscountValue);
    }),

  // Switching unit resets the raw value so "₹50" never silently becomes "50%".
  setLineDiscountMode: (variantId, mode) =>
    set((s) => {
      const lines = s.lines.map((l) =>
        l.variantId === variantId ? { ...l, discountMode: mode, discountValue: 0 } : l,
      );
      return commit(lines, s.billDiscountMode, s.billDiscountValue);
    }),

  removeLine: (variantId) =>
    set((s) =>
      commit(
        s.lines.filter((l) => l.variantId !== variantId),
        s.billDiscountMode,
        s.billDiscountValue,
      ),
    ),

  setBillDiscountValue: (value) =>
    set((s) => ({
      billDiscountValue: Math.max(0, value),
      billDiscountPaise: billPaise(s.lines, s.billDiscountMode, Math.max(0, value)),
    })),

  setBillDiscountMode: (mode) =>
    set({
      billDiscountMode: mode,
      billDiscountValue: 0,
      billDiscountPaise: 0,
    }),

  setCustomer: (customer) => set({ customer }),
  setTenders: (tenders) => set({ tenders }),
  setPricingMode: (pricingMode) => set({ pricingMode }),

  loadFromHeld: (heldSaleId, lines, customer, billDiscountPaise) =>
    set(() => {
      const hydrated: CartLine[] = lines.map((l) => ({
        ...l,
        discountMode: 'flat',
        discountValue: l.lineDiscountPaise / 100,
      }));
      return {
        heldSaleId,
        customer,
        tenders: [],
        billDiscountMode: 'flat',
        billDiscountValue: billDiscountPaise / 100,
        ...commit(hydrated, 'flat', billDiscountPaise / 100),
      };
    }),

  reset: () =>
    set((s) => ({
      lines: [],
      billDiscountPaise: 0,
      billDiscountMode: 'flat',
      billDiscountValue: 0,
      customer: {},
      tenders: [],
      heldSaleId: null,
      billNonce: s.billNonce + 1,
    })),

  isEmpty: () => get().lines.length === 0,
}));
