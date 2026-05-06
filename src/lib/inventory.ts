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

export function isLowStock(v: { stock: number; reserved: number }): boolean {
  const a = availableOf(v);
  return a > 0 && a <= LOW_STOCK_THRESHOLD;
}

/** Single source of truth for the row-level "is something off" tone — used by both
 *  the Inventory table accent rule and the Products read-only stock chip. */
export type StockTone = 'ok' | 'low' | 'out';
export function stockToneOf(v: { stock: number; reserved: number }): StockTone {
  if (isOutOfStock(v)) return 'out';
  if (isLowStock(v)) return 'low';
  return 'ok';
}

// ─────────────────────────────────────────────────────────────────────
// CSV parsing — strictly for the import dialog. Excel-style: commas separate
// fields, double-quote wraps fields containing commas/quotes/newlines, "" inside
// a quoted field encodes a literal quote. Header row is required and we only
// read `sku` and `stock` columns; extras are ignored.
// ─────────────────────────────────────────────────────────────────────

export type ParsedImportRow = { sku: string; stock: number };
export type ParseError = { row: number; message: string };
export type ParseResult = { rows: ParsedImportRow[]; errors: ParseError[] };

/** RFC-4180-ish parser. Handles quoted fields and embedded newlines. */
export function parseInventoryCsv(text: string): ParseResult {
  // Excel and Numbers prepend a UTF-8 BOM to CSV exports. Without stripping it,
  // the first header cell becomes "﻿sku" and column detection silently fails
  // with "Header must include sku". Strip exactly one BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const fields = tokenise(text);
  if (fields.length === 0) return { rows: [], errors: [{ row: 0, message: 'Empty file' }] };

  const header = fields[0]!.map((s) => s.trim().toLowerCase());
  const skuCol = header.indexOf('sku');
  const stockCol = header.indexOf('stock');
  if (skuCol < 0 || stockCol < 0) {
    return {
      rows: [],
      errors: [{ row: 1, message: 'Header must include "sku" and "stock" columns' }],
    };
  }

  const rows: ParsedImportRow[] = [];
  const errors: ParseError[] = [];
  for (let i = 1; i < fields.length; i++) {
    const cells = fields[i]!;
    const sku = (cells[skuCol] ?? '').trim();
    const stockRaw = (cells[stockCol] ?? '').trim();
    if (!sku && !stockRaw) continue; // skip blank lines silently
    if (!sku) {
      errors.push({ row: i + 1, message: 'Missing SKU' });
      continue;
    }
    const stock = Number(stockRaw);
    if (!Number.isInteger(stock) || stock < 0) {
      errors.push({ row: i + 1, message: `Invalid stock "${stockRaw}"` });
      continue;
    }
    rows.push({ sku, stock });
  }
  return { rows, errors };
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
    case 'below_reserved':
      return 'Would drop below reserved stock';
    default:
      return reason;
  }
}
