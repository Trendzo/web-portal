/**
 * Backend theme-validation failures (422 `details.failures`) → display strings.
 *
 * Shared by the publish panel and the editor's save handler: both hit the same
 * validator (`backend/src/shared/cms/theme-validate.ts`), and both used to
 * collapse a precise per-field rejection — "diwali-2026 — chrome.header.overlayUrl:
 * must point at our media CDN" — into a bare "Theme failed validation" toast.
 *
 * The shape is server-owned, so parse defensively rather than trusting it.
 */

export type ThemeFailure = { slug: string; field?: string; message: string };

export function formatThemeFailure(f: unknown): string {
  if (
    f &&
    typeof f === 'object' &&
    typeof (f as { message?: unknown }).message === 'string'
  ) {
    const { slug, field, message } = f as { slug?: unknown; field?: unknown; message: string };
    const where = typeof field === 'string' && field ? `${field}: ` : '';
    return typeof slug === 'string' && slug ? `${slug} — ${where}${message}` : `${where}${message}`;
  }
  return String(JSON.stringify(f)).slice(0, 160);
}

/** Pull the failure list out of an ApiError's `details`, or null when absent. */
export function readThemeFailures(details: unknown): string[] | null {
  if (!details || typeof details !== 'object') return null;
  const failures = (details as { failures?: unknown }).failures;
  if (!Array.isArray(failures) || failures.length === 0) return null;
  return failures.map(formatThemeFailure);
}
