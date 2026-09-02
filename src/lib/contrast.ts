/**
 * WCAG 2.x contrast math — a verbatim mirror of the backend's
 * `src/shared/cms/contrast.ts`, so the editor's live warnings and the server's
 * publish gate compute identical ratios. (The `contrastInk()` heuristic in
 * collection-detail is a luminance shortcut, NOT WCAG — do not reuse it here.)
 */

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m || !m[1]) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const lin = (channel: number): number => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/** Contrast ratio in [1, 21], or null when either hex is unparseable. Symmetric. */
export function contrastRatio(a: string, b: string): number | null {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return null;
  const la = relativeLuminance(ra);
  const lb = relativeLuminance(rb);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA for normal text — the server blocks publish below this. */
export const AA_TEXT = 4.5;
/** WCAG AA for large text / UI glyphs — used for the status-bar sanity hint. */
export const AA_LARGE = 3;
