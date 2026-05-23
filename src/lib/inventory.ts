/**
 * Inventory helpers — shared between the Inventory page, the Products page (which
 * shows stock read-only with a deep-link), and the listing-detail variant view.
 *
 * The threshold is intentionally a single global number: matches the spec direction
 * for Phase A. When per-variant thresholds ship later, swap callers to a function
 * that looks up the variant's own threshold and falls back to this constant.
 */

/** Stock counts at-or-below this number flag the variant as low. */
export const LOW_STOCK_THRESHOLD = 5;

/** Available = on-hand minus what's already reserved against open orders. This is
 *  the number that actually matters for "can I sell more right now". */
export function availableOf(v: { stock: number; reserved: number }): number {
  return Math.max(0, v.stock - v.reserved);
}

export function isOutOfStock(v: { stock: number; reserved: number }): boolean {
  return availableOf(v) === 0;
}

export function isLowStock(v: { stock: number; reserved: number }, threshold = LOW_STOCK_THRESHOLD): boolean {
  const a = availableOf(v);
  return a > 0 && a <= threshold;
}

/** Single source of truth for the row-level "is something off" tone — used by both
 *  the Inventory table accent rule and the Products read-only stock chip.
 *  Pass `threshold` to override the global default with a per-store value. */
export type StockTone = 'ok' | 'low' | 'out';
export function stockToneOf(
  v: { stock: number; reserved: number },
  threshold = LOW_STOCK_THRESHOLD,
): StockTone {
  if (isOutOfStock(v)) return 'out';
  if (isLowStock(v, threshold)) return 'low';
  return 'ok';
}

// ─────────────────────────────────────────────────────────────────────
// CSV parsing — strictly for the import dialog. Excel-style: commas separate
// fields, double-quote wraps fields containing commas/quotes/newlines, "" inside
// a quoted field encodes a literal quote. Header row is required and we only
// read `sku` and `stock` columns; extras are ignored.
//
// Round-trip with the backend: this parser is the consumer of the CSVs produced
// by `GET /retailer/inventory/template` and `GET /retailer/inventory/export`.
// Those both emit the canonical 7-column shape (sku, product_name, variant_label,
// stock, reserved, price_paise, status) with a UTF-8 BOM. We strip the BOM and
// look up columns by name, so the file dropped back into Import works without
// any column reshuffling. Editing in Excel or Numbers (which adds its own BOM
// on save) is also fine — we only strip one BOM, but Excel never doubles it.
// ─────────────────────────────────────────────────────────────────────

export type ParsedImportRow = {
  sku?: string;
  productName?: string;
  variantLabel?: string;
  /** Pipe-encoded `Key=Value` pairs; backend decodes via the canonical
   *  attributesKey form. Stored as the raw cell string for round-trip safety. */
  attributes?: string;
  brand?: string;
  category?: string;
  gender?: 'her' | 'him' | 'unisex';
  pricePaise?: number;
  stock: number;
};
export type ParseError = { row: number; message: string };
export type ParseResult = { rows: ParsedImportRow[]; errors: ParseError[]; skipped: number };

/** RFC-4180-ish parser. Handles quoted fields and embedded newlines. */
export function parseInventoryCsv(text: string): ParseResult {
  // Excel and Numbers prepend a UTF-8 BOM to CSV exports. Without stripping it,
  // the first header cell becomes "﻿sku" and column detection silently fails
  // with "Header must include sku". Strip exactly one BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const fields = tokenise(text);
  if (fields.length === 0) return { rows: [], errors: [{ row: 0, message: 'Empty file' }], skipped: 0 };

  const header = fields[0]!.map((s) => s.trim().toLowerCase());
  const skuCol = header.indexOf('sku');
  const stockCol = header.indexOf('stock');
  const productNameCol = header.indexOf('product_name');
  const variantLabelCol = header.indexOf('variant_label');
  const attributesCol = header.indexOf('attributes');
  const brandCol = header.indexOf('brand');
  const categoryCol = header.indexOf('category');
  const genderCol = header.indexOf('gender');
  const pricePaiseCol = header.indexOf('price_paise');
  if (skuCol < 0 || stockCol < 0) {
    return {
      rows: [],
      errors: [{ row: 1, message: 'Header must include "sku" and "stock" columns' }],
      skipped: 0,
    };
  }

  const rows: ParsedImportRow[] = [];
  const errors: ParseError[] = [];
  let skipped = 0;
  for (let i = 1; i < fields.length; i++) {
    const cells = fields[i]!;
    const sku = (cells[skuCol] ?? '').trim();
    const stockRaw = (cells[stockCol] ?? '').trim();
    const productName = productNameCol >= 0 ? (cells[productNameCol] ?? '').trim() : '';
    const variantLabel = variantLabelCol >= 0 ? (cells[variantLabelCol] ?? '').trim() : '';
    const attributes = attributesCol >= 0 ? (cells[attributesCol] ?? '').trim() : '';
    const brand = brandCol >= 0 ? (cells[brandCol] ?? '').trim() : '';
    const category = categoryCol >= 0 ? (cells[categoryCol] ?? '').trim() : '';
    const genderRaw = genderCol >= 0 ? (cells[genderCol] ?? '').trim().toLowerCase() : '';
    const priceRaw = pricePaiseCol >= 0 ? (cells[pricePaiseCol] ?? '').trim() : '';
    // Truly blank lines: silent skip.
    if (!sku && !stockRaw && !productName && !variantLabel && !attributes && !brand && !category && !genderRaw && !priceRaw) continue;
    // Need *some* way to identify or create the variant. Without sku AND
    // without productName, the classifier can't match or create anything.
    if (!sku && !productName) {
      skipped++;
      continue;
    }
    const stock = Number(stockRaw);
    if (!Number.isInteger(stock) || stock < 0) {
      errors.push({ row: i + 1, message: `Invalid stock "${stockRaw}"` });
      continue;
    }
    const row: ParsedImportRow = { stock };
    if (sku) row.sku = sku;
    if (productName) row.productName = productName;
    if (variantLabel) row.variantLabel = variantLabel;
    if (attributes) row.attributes = attributes;
    if (brand) row.brand = brand;
    if (category) row.category = category;
    if (genderRaw === 'her' || genderRaw === 'him' || genderRaw === 'unisex') row.gender = genderRaw;
    if (priceRaw) {
      const price = Number(priceRaw);
      if (Number.isFinite(price) && price >= 0 && Number.isInteger(price)) row.pricePaise = price;
    }
    rows.push(row);
  }
  return { rows, errors, skipped };
}

function tokenise(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  // Trailing cell — flush the last row only if there's something there.
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Translate the backend's per-row `reason` codes into operator-friendly copy. */
export function importReasonLabel(reason: string): string {
  switch (reason) {
    case 'sku_not_found':
      return 'No variant has that SKU';
    case 'sku_ambiguous':
      return 'SKU matches multiple variants';
    case 'sku_conflict':
      return 'SKU on row clashes with the existing variant SKU';
    case 'sku_taken_in_batch':
      return 'Same SKU appears on multiple rows in this file';
    case 'variant_not_found':
      return 'No variant matches that product / variant label';
    case 'name_label_ambiguous':
      return 'Product / variant label matches multiple variants — add a SKU to disambiguate';
    case 'listing_name_ambiguous':
      return 'Product name matches multiple listings — add a SKU to disambiguate';
    case 'below_reserved':
      return 'Would drop below reserved stock';
    case 'brand_not_found':
      return 'Brand slug/name not recognised';
    case 'brand_ambiguous':
      return 'Brand matches multiple records — use the slug';
    case 'category_not_found':
      return 'Category slug/label not recognised';
    case 'category_ambiguous':
      return 'Category matches multiple records — use the slug';
    case 'gender_missing':
      return 'gender (her/him/unisex) required to create a new listing';
    case 'gender_invalid':
      return 'gender must be her, him, or unisex';
    case 'attributes_missing':
      return 'attributes required to create a new variant';
    case 'attributes_invalid':
      return 'attributes cell malformed — use Key=Value|Key=Value';
    case 'attribute_conflict':
      return 'Attributes already exist on another variant of this listing';
    case 'attribute_conflict_in_batch':
      return 'Two rows target the same listing + attributes combination';
    case 'price_missing':
      return 'price_paise required when creating a variant';
    case 'price_invalid':
      return 'price_paise must be a non-negative integer';
    case 'missing_create_fields':
      return 'Need brand, category, gender, attributes and price_paise to create a new listing';
    default:
      return reason;
  }
}
