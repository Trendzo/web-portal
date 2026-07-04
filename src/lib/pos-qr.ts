// @ts-nocheck — self-contained QR encoder verified end-to-end by a jsQR decoder round-trip.
// It does dense typed-array / matrix index math with compound operators; under
// `noUncheckedIndexedAccess` every access reads as `T | undefined`, which would require ~40
// non-null assertions that add noise without catching real bugs. Exempt this one algorithm file.
/**
 * Minimal QR Code renderer → SVG markup string. No external dependency (mirrors pos-barcode.ts).
 *
 * Scope: byte (8-bit) mode, error-correction level M, versions 1–10. That covers any SKU /
 * barcode / short URL a product label needs (v10-M holds ~213 bytes). Larger payloads throw.
 *
 * The algorithm is the standard QR pipeline: encode → Reed–Solomon EC → interleave → place on a
 * masked module matrix with finder/timing/alignment/format/version function patterns.
 */

// ── GF(256) arithmetic (primitive polynomial 0x11d) ──
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
function gmul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

/** Monic Reed–Solomon generator polynomial of the given degree (coeffs high→low, g[0]=1). */
function rsGenPoly(degree: number): number[] {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const ng = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      ng[j] ^= g[j];
      ng[j + 1] ^= gmul(g[j], EXP[i]);
    }
    g = ng;
  }
  return g;
}

/** Return the `ecLen` error-correction codewords for `data`. */
function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenPoly(ecLen);
  const res = data.concat(new Array(ecLen).fill(0));
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) for (let j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], coef);
  }
  return res.slice(data.length);
}

// ── Per-version tables (ECC level M) ──
// Each block spec is [numBlocks, totalCodewords, dataCodewords].
const RS_M: Record<number, [number, number, number][]> = {
  1: [[1, 26, 16]],
  2: [[1, 44, 28]],
  3: [[1, 70, 44]],
  4: [[2, 50, 32]],
  5: [[2, 67, 43]],
  6: [[4, 43, 27]],
  7: [[4, 49, 31]],
  8: [[2, 60, 38], [2, 61, 39]],
  9: [[3, 58, 36], [2, 59, 37]],
  10: [[4, 69, 43], [1, 70, 44]],
};
const ALIGN: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

function blocksFor(version: number): { total: number; data: number }[] {
  const out: { total: number; data: number }[] = [];
  for (const [n, total, data] of RS_M[version]) for (let i = 0; i < n; i++) out.push({ total, data });
  return out;
}
function dataCodewordCount(version: number): number {
  return blocksFor(version).reduce((s, b) => s + b.data, 0);
}

// ── BCH format/version information ──
function formatInfo(mask: number): number {
  // ECC level M → indicator bits 0b00.
  const data = (0b00 << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= 0b10100110111 << (i - 10);
  return ((data << 10) | rem) ^ 0b101010000010010;
}
function versionInfo(version: number): number {
  let rem = version << 12;
  for (let i = 17; i >= 12; i--) if ((rem >> i) & 1) rem ^= 0b1111100100101 << (i - 12);
  return (version << 12) | rem;
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

// ── Data bit stream (byte mode) ──
function encodeBytes(bytes: number[], version: number): number[] {
  const totalData = dataCodewordCount(version);
  const bits: number[] = [];
  const put = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  put(0b0100, 4); // byte mode
  put(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);

  const cap = totalData * 8;
  put(0, Math.min(4, cap - bits.length)); // terminator
  while (bits.length % 8 !== 0) bits.push(0);
  const pad = [0xec, 0x11];
  for (let i = 0; bits.length < cap; i++) put(pad[i % 2], 8);

  const cw: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    cw.push(v);
  }
  return cw;
}

/** Split data codewords into RS blocks, append EC, and interleave into the final stream. */
function finalCodewords(dataCw: number[], version: number): number[] {
  const specs = blocksFor(version);
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let idx = 0;
  for (const b of specs) {
    const d = dataCw.slice(idx, idx + b.data);
    idx += b.data;
    dataBlocks.push(d);
    ecBlocks.push(rsEncode(d, b.total - b.data));
  }
  const out: number[] = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  const maxEc = Math.max(...ecBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < maxEc; i++) for (const b of ecBlocks) if (i < b.length) out.push(b[i]);
  return out;
}

// ── Matrix construction ──
type Matrix = { size: number; m: (number | null)[][]; fn: boolean[][] };

function newMatrix(size: number): Matrix {
  return {
    size,
    m: Array.from({ length: size }, () => new Array<number | null>(size).fill(null)),
    fn: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
  };
}
function setFn(mx: Matrix, r: number, c: number, dark: boolean) {
  mx.m[r][c] = dark ? 1 : 0;
  mx.fn[r][c] = true;
}
function placeFinder(mx: Matrix, r0: number, c0: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = r0 + r;
      const cc = c0 + c;
      if (rr < 0 || rr >= mx.size || cc < 0 || cc >= mx.size) continue;
      const dark =
        r >= 0 && r <= 6 && (c === 0 || c === 6) ||
        c >= 0 && c <= 6 && (r === 0 || r === 6) ||
        r >= 2 && r <= 4 && c >= 2 && c <= 4;
      setFn(mx, rr, cc, dark);
    }
  }
}
function placeFunctionPatterns(mx: Matrix, version: number) {
  placeFinder(mx, 0, 0);
  placeFinder(mx, 0, mx.size - 7);
  placeFinder(mx, mx.size - 7, 0);
  // Timing patterns.
  for (let i = 8; i < mx.size - 8; i++) {
    const dark = i % 2 === 0;
    if (mx.m[6][i] === null) setFn(mx, 6, i, dark);
    if (mx.m[i][6] === null) setFn(mx, i, 6, dark);
  }
  // Alignment patterns.
  const pos = ALIGN[version];
  for (const r of pos) {
    for (const c of pos) {
      if (mx.fn[r][c]) continue; // overlaps a finder
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFn(mx, r + dr, c + dc, dark);
        }
      }
    }
  }
  // Dark module.
  setFn(mx, mx.size - 8, 8, true);
  // Reserve format-info areas (value filled later).
  for (let i = 0; i < 9; i++) {
    if (!mx.fn[8][i]) setFn(mx, 8, i, false);
    if (!mx.fn[i][8]) setFn(mx, i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!mx.fn[8][mx.size - 1 - i]) setFn(mx, 8, mx.size - 1 - i, false);
    if (!mx.fn[mx.size - 1 - i][8]) setFn(mx, mx.size - 1 - i, 8, false);
  }
  // Reserve version-info areas (v7+).
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        setFn(mx, i, mx.size - 11 + j, false);
        setFn(mx, mx.size - 11 + j, i, false);
      }
    }
  }
}

function placeData(mx: Matrix, codewords: number[]) {
  const bits: number[] = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  let idx = 0;
  let upward = true;
  for (let col = mx.size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip the vertical timing column
    for (let i = 0; i < mx.size; i++) {
      const row = upward ? mx.size - 1 - i : i;
      for (let j = 0; j < 2; j++) {
        const c = col - j;
        if (mx.m[row][c] !== null) continue;
        mx.m[row][c] = idx < bits.length ? bits[idx] : 0;
        idx++;
      }
    }
    upward = !upward;
  }
}

function applyMask(mx: Matrix, mask: number): Matrix {
  const out = newMatrix(mx.size);
  const fn = MASKS[mask];
  for (let r = 0; r < mx.size; r++) {
    for (let c = 0; c < mx.size; c++) {
      out.fn[r][c] = mx.fn[r][c];
      const v = mx.m[r][c] ?? 0;
      out.m[r][c] = mx.fn[r][c] ? v : v ^ (fn(r, c) ? 1 : 0);
    }
  }
  return out;
}

function drawFormat(mx: Matrix, mask: number) {
  const bits = formatInfo(mask);
  for (let i = 0; i < 15; i++) {
    const bit = (bits >> i) & 1;
    // Copy 1 (around top-left finder).
    if (i < 6) mx.m[8][i] = bit;
    else if (i === 6) mx.m[8][7] = bit;
    else if (i === 7) mx.m[8][8] = bit;
    else if (i === 8) mx.m[7][8] = bit;
    else mx.m[14 - i][8] = bit;
    // Copy 2 (split along top-right and bottom-left).
    if (i < 8) mx.m[8][mx.size - 1 - i] = bit;
    else mx.m[mx.size - 15 + i][8] = bit;
  }
  mx.m[mx.size - 8][8] = 1; // dark module
}

function drawVersion(mx: Matrix, version: number) {
  if (version < 7) return;
  const bits = versionInfo(version);
  for (let i = 0; i < 18; i++) {
    const bit = (bits >> i) & 1;
    const r = Math.floor(i / 3);
    const c = i % 3;
    mx.m[r][mx.size - 11 + c] = bit;
    mx.m[mx.size - 11 + c][r] = bit;
  }
}

// ── Mask penalty scoring (spec rules 1–4) ──
function penalty(mx: Matrix): number {
  const n = mx.size;
  const at = (r: number, c: number) => mx.m[r][c] ?? 0;
  let score = 0;
  // Rule 1: runs of ≥5 same-colour modules per row/column.
  for (let r = 0; r < n; r++) {
    let runV = -1, runLen = 0, prevV = -1, prevLen = 0;
    for (let c = 0; c < n; c++) {
      const v = at(r, c);
      if (v === runV) runLen++;
      else { if (runLen >= 5) score += runLen - 2; runV = v; runLen = 1; }
      const h = at(c, r);
      if (h === prevV) prevLen++;
      else { if (prevLen >= 5) score += prevLen - 2; prevV = h; prevLen = 1; }
    }
    if (runLen >= 5) score += runLen - 2;
    if (prevLen >= 5) score += prevLen - 2;
  }
  // Rule 2: 2×2 blocks of the same colour.
  for (let r = 0; r < n - 1; r++)
    for (let c = 0; c < n - 1; c++) {
      const v = at(r, c);
      if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) score += 3;
    }
  // Rule 3: finder-like 1:1:3:1:1 patterns.
  const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const match = (get: (k: number) => number, base: number, pat: number[]) => {
    for (let k = 0; k < 11; k++) if (get(base + k) !== pat[k]) return false;
    return true;
  };
  for (let r = 0; r < n; r++)
    for (let c = 0; c <= n - 11; c++) {
      if (match((k) => at(r, k), c, pat1) || match((k) => at(r, k), c, pat2)) score += 40;
    }
  for (let c = 0; c < n; c++)
    for (let r = 0; r <= n - 11; r++) {
      if (match((k) => at(k, c), r, pat1) || match((k) => at(k, c), r, pat2)) score += 40;
    }
  // Rule 4: overall dark-module balance.
  let dark = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) dark += at(r, c);
  const pct = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

function pickVersion(byteLen: number): number {
  for (let v = 1; v <= 10; v++) {
    const cap = dataCodewordCount(v);
    const headerBits = 4 + (v < 10 ? 8 : 16);
    const needed = Math.ceil((headerBits + byteLen * 8) / 8);
    if (needed <= cap) return v;
  }
  throw new Error('QR payload too large for supported versions (max v10-M)');
}

/**
 * Render `text` as a QR code SVG string. `size` is the pixel edge of the (square) output.
 * Includes the mandatory 4-module quiet zone.
 */
export function qrSvg(text: string, opts: { size?: number } = {}): string {
  const bytes = Array.from(new TextEncoder().encode(text));
  const version = pickVersion(bytes.length);
  const dim = 17 + version * 4;

  const base = newMatrix(dim);
  placeFunctionPatterns(base, version);
  placeData(base, finalCodewords(encodeBytes(bytes, version), version));

  // Try all 8 masks, keep the lowest-penalty result.
  let best: Matrix | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const cand = applyMask(base, mask);
    drawFormat(cand, mask);
    drawVersion(cand, version);
    const s = penalty(cand);
    if (s < bestScore) {
      bestScore = s;
      best = cand;
    }
  }
  const mx = best!;

  // Emit dark modules as merged horizontal runs to keep the SVG compact.
  const quiet = 4;
  const total = dim + quiet * 2;
  const rects: string[] = [];
  for (let r = 0; r < dim; r++) {
    let c = 0;
    while (c < dim) {
      if ((mx.m[r][c] ?? 0) === 1) {
        let len = 1;
        while (c + len < dim && (mx.m[r][c + len] ?? 0) === 1) len++;
        rects.push(`<rect x="${c + quiet}" y="${r + quiet}" width="${len}" height="1"/>`);
        c += len;
      } else c++;
    }
  }
  const px = opts.size ?? total;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><g fill="#000">${rects.join('')}</g></svg>`;
}
