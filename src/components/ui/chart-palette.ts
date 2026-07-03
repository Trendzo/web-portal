/**
 * Shared chart styling primitives — one home for the categorical palette and the
 * "same-hue gradient" recipe every analytics chart paints with. Keeping the recipe
 * here means the premium soft-depth look (subtle vertical/radial hue shift + soft
 * hover halo) stays identical across line, bar, hbar and donut charts.
 */

/**
 * Cohesive categorical ramp for non-semantic splits (best sellers, listing revenue,
 * HSN, etc.) where each row/series just needs a distinct-but-harmonious colour.
 * Built from the design tokens (info, success, warning, accent…) plus a few
 * complementary hues so 8 categories never collide.
 */
export const CHART_COLORS = [
  'var(--color-info)', // blue
  'var(--color-success)', // emerald
  'var(--color-warning)', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  'var(--color-ink-2)', // graphite (neutral anchor)
] as const;

/** Pick a stable palette colour by index (wraps). */
export function chartColor(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length]!;
}

/**
 * Gradient stop recipe for a base colour. We don't try to compute a darker hue from
 * a CSS var at runtime (can't read `var(...)` in JS) — instead we fade opacity:
 * a brighter top stop over the panel's light surface reads as a soft same-hue
 * lightening, giving depth without a second colour. `soft` is used for fills under
 * lines / chart tracks.
 */
export const GRAD = {
  /** Top → bottom opacity for a solid fill (bars, donut slices). */
  fill: { top: 0.95, bottom: 1 },
  /** Area-fill under a line. */
  area: { top: 0.22, bottom: 0 },
  /** Muted track behind an hbar. */
  track: 0.12,
} as const;

/** Deterministic, collision-free gradient id from a chart instance id + key. */
export function gradId(instance: string, key: string | number): string {
  return `cg-${instance}-${key}`;
}
