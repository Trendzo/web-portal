import { test, expect } from './fixtures';

/**
 * Festival Themes admin — smoke. Route-mocked (test routes are registered after
 * the fixture's catch-all, so they win); the DIWALI literal doubles as a drift
 * guard for ThemeDraftSchema: if the zod mirror rejects it, apiValidated throws
 * and the list assertion below fails.
 */

const NOW = Date.now();
const DIWALI = {
  id: 'cmst_test1',
  slug: 'diwali-2026',
  name: 'Diwali 2026',
  description: null,
  isEnabled: true,
  priority: 100,
  startsAt: new Date(NOW - 3600_000).toISOString(),
  endsAt: new Date(NOW + 86400_000).toISOString(),
  cities: null,
  platforms: null,
  minAppVersion: null,
  tokens: { accent: '#C1121F', accentInk: '#FFFFFF' },
  chrome: {
    statusBarStyle: 'light',
    header: { kind: 'gradient', gradient: ['#7B1E1E', '#C1121F'], ink: '#FFFFFF' },
    tabBar: {},
  },
  decor: { kind: 'none', respectReduceMotion: true },
  copy: { greeting: 'Happy Diwali' },
  createdAt: new Date(NOW - 86400_000).toISOString(),
  updatedAt: new Date(NOW - 7200_000).toISOString(),
  createdByAdminId: null,
  updatedByAdminId: null,
  inLatestPublication: true,
};

const PUBLICATION = {
  id: 'cmstp_1',
  version: 1,
  note: 'launch',
  publishedAt: new Date(NOW - 3600_000).toISOString(),
  publishedByAdminId: null,
};

function ok(data: unknown) {
  return { contentType: 'application/json', body: JSON.stringify({ success: true, data }) };
}

test('themes page renders the list with a live badge; create dialog opens', async ({ asAdmin }) => {
  await asAdmin.route('**/api/v1/admin/cms/themes**', (route) => {
    const url = route.request().url();
    if (url.includes('/publications')) return route.fulfill(ok([PUBLICATION]));
    if (url.includes('/preview')) {
      return route.fulfill(
        ok({
          source: 'published',
          version: 1,
          winner: null,
          response: {
            schemaVersion: 1,
            publicationVersion: 1,
            generatedAt: new Date(NOW).toISOString(),
            refreshAfterSeconds: 1800,
            theme: null,
          },
        }),
      );
    }
    return route.fulfill(ok([DIWALI]));
  });

  await asAdmin.goto('/admin/themes');
  await expect(asAdmin.getByRole('heading', { name: /festival themes/i })).toBeVisible();
  await expect(asAdmin.getByText('Diwali 2026')).toBeVisible();
  // Status derivation end-to-end: enabled + published + inside window ⇒ Live.
  await expect(asAdmin.getByText(/^live$/i).first()).toBeVisible();

  await asAdmin.getByRole('button', { name: /new theme/i }).click();
  await expect(asAdmin.getByRole('dialog')).toBeVisible();
  await expect(asAdmin.getByLabel(/name/i).first()).toBeVisible();
});
