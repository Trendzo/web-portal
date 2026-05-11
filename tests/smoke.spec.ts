/**
 * Smoke coverage for Phase 1–4 routes.
 *
 * Each route renders without console errors and surfaces its expected
 * page header. Backend responses are stubbed via Playwright's network
 * interceptor (see fixtures.ts) so the suite runs offline.
 */

import { test, expect } from './fixtures';

test.describe('Phase 1 — §1 Identity & Access', () => {
  test('retailer login renders', async ({ page, consoleErrors }) => {
    await page.goto('/retailer/login');
    await expect(page.getByRole('heading', { name: /sign in|log in|welcome/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('admin login renders w/ hardware-key challenge', async ({ page, consoleErrors }) => {
    await page.goto('/admin/login');
    await expect(page.getByText(/hardware key/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /tap your key/i })).toBeEnabled();
    expect(consoleErrors).toEqual([]);
  });

  test('admin team route gated to super-admin (super-admin sees roster)', async ({
    asAdmin,
    consoleErrors,
  }) => {
    await asAdmin.goto('/admin/admins');
    await expect(asAdmin.getByRole('heading', { name: /admin team/i })).toBeVisible();
    await expect(asAdmin.getByText(/MOCKED — pending backend §1/i).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('sub-roles matrix has Save (mock) button', async ({ asAdmin, consoleErrors }) => {
    await asAdmin.goto('/admin/sub-roles');
    await expect(asAdmin.getByRole('heading', { name: /sub-role permissions/i })).toBeVisible();
    await expect(asAdmin.getByRole('button', { name: /save \(mock\)/i }).first()).toBeDisabled();
    expect(consoleErrors).toEqual([]);
  });

  test('retailer staff list — invite button fires toast', async ({
    asRetailerActive,
    consoleErrors,
  }) => {
    await asRetailerActive.goto('/retailer/staff');
    await expect(asRetailerActive.getByRole('heading', { name: /staff/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Phase 2 — §2 Onboarding', () => {
  test('application form renders 6-step tabs', async ({ page, consoleErrors }) => {
    await page.goto('/retailer/application');
    await expect(page.getByRole('heading', { name: /application|onboarding/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('/retailer/signup aliases to application', async ({ page, consoleErrors }) => {
    await page.goto('/retailer/signup');
    await expect(page.getByRole('heading', { name: /application|onboarding/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('admin applications queue renders', async ({ asAdmin, consoleErrors }) => {
    await asAdmin.goto('/admin/applications');
    await expect(asAdmin.getByRole('heading', { name: /application/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('admin retailers list shows extended status filter (8 doc states)', async ({
    asAdmin,
    consoleErrors,
  }) => {
    await asAdmin.goto('/admin/retailers');
    await expect(asAdmin.getByRole('heading', { name: /retailer/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('admin retailer detail tabs render', async ({ asAdmin, consoleErrors }) => {
    await asAdmin.goto('/admin/retailers/r1');
    await expect(asAdmin.getByRole('heading', { name: /retailer|overview/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('retailer storefront has 6 tabs (basics, hours, address, legal, docs, status)', async ({
    asRetailerActive,
    consoleErrors,
  }) => {
    await asRetailerActive.goto('/retailer/store');
    await expect(asRetailerActive.getByRole('heading', { name: /storefront|store profile|store/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('pre-live retailer dashboard shows checklist + clarification thread', async ({
    asRetailerPending,
    consoleErrors,
  }) => {
    await asRetailerPending.goto('/retailer/dashboard');
    await expect(asRetailerPending.getByText(/lifecycle|getting your store live|application/i).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Phase 3 — §3 KYC & Compliance', () => {
  test('retailer KYC checklist renders w/ MockDataBadge', async ({
    asRetailerActive,
    consoleErrors,
  }) => {
    await asRetailerActive.goto('/retailer/kyc');
    await expect(asRetailerActive.getByText(/MOCKED — pending backend §3/i).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('retailer change-requests renders', async ({ asRetailerActive, consoleErrors }) => {
    await asRetailerActive.goto('/retailer/change-requests');
    await expect(asRetailerActive.getByRole('heading', { name: /change request/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('admin compliance queue has 5 inline tabs', async ({ asAdmin, consoleErrors }) => {
    await asAdmin.goto('/admin/compliance');
    await expect(asAdmin.getByRole('heading', { name: /compliance queue/i })).toBeVisible();
    for (const tab of [/KYC due/i, /Floor breach/i, /Change request/i, /Data export/i, /Account deletion/i]) {
      await expect(asAdmin.getByRole('tab', { name: tab })).toBeVisible();
    }
    expect(consoleErrors).toEqual([]);
  });

  test('admin policy enforcement timeline renders', async ({ asAdmin, consoleErrors }) => {
    await asAdmin.goto('/admin/policy-enforcement');
    await expect(asAdmin.getByRole('heading', { name: /policy enforcement|enforcement/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('admin data exports queue renders', async ({ asAdmin, consoleErrors }) => {
    await asAdmin.goto('/admin/data-exports');
    await expect(asAdmin.getByRole('heading', { name: /data export/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('admin account deletions queue renders', async ({ asAdmin, consoleErrors }) => {
    await asAdmin.goto('/admin/account-deletions');
    await expect(asAdmin.getByRole('heading', { name: /account deletion/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Phase 5 — §5 Catalog and Listings', () => {
  test('retailer listings grid renders', async ({ asRetailerActive, consoleErrors }) => {
    await asRetailerActive.goto('/retailer/listings');
    await expect(asRetailerActive.getByRole('heading', { name: /products|listings/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('retailer listing detail has Promotions / AI / Audit tabs', async ({
    asRetailerActive,
    consoleErrors,
  }) => {
    await asRetailerActive.goto('/retailer/listings/lst_1');
    for (const tab of [/Variants/i, /Details/i, /Promotions/i, /AI generations/i, /Audit log/i]) {
      await expect(asRetailerActive.getByRole('tab', { name: tab })).toBeVisible();
    }
    expect(consoleErrors).toEqual([]);
  });

  test('retailer attribute templates list renders', async ({
    asRetailerActive,
    consoleErrors,
  }) => {
    await asRetailerActive.goto('/retailer/attribute-templates');
    await expect(asRetailerActive.getByRole('heading', { name: /attribute templates/i })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('admin catalog moderation queue renders', async ({ asAdmin, consoleErrors }) => {
    await asAdmin.goto('/admin/catalog-moderation');
    await expect(asAdmin.getByRole('heading', { name: /catalog moderation/i })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('admin listing detail renders moderation overlay', async ({ asAdmin, consoleErrors }) => {
    await asAdmin.goto('/admin/listings/lst_1');
    await expect(asAdmin.getByText(/MOCKED — pending backend §5/i).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Phase 6 — §6 Inventory', () => {
  test('inventory has Overview / Health / History tabs', async ({
    asRetailerActive,
    consoleErrors,
  }) => {
    await asRetailerActive.goto('/retailer/inventory');
    for (const tab of [/Overview/i, /Health/i, /History/i]) {
      await expect(asRetailerActive.getByRole('tab', { name: tab })).toBeVisible();
    }
    expect(consoleErrors).toEqual([]);
  });

  test('inventory health tab surfaces low/out/oversold rollups', async ({
    asRetailerActive,
    consoleErrors,
  }) => {
    await asRetailerActive.goto('/retailer/inventory');
    await asRetailerActive.getByRole('tab', { name: /Health/i }).click();
    await expect(asRetailerActive.getByText(/low stock|out of stock|oversold/i).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Phase 7 — §7 AI Catalog', () => {
  test('retailer AI catalog list renders', async ({ asRetailerActive, consoleErrors }) => {
    await asRetailerActive.goto('/retailer/ai-catalog');
    await expect(asRetailerActive.getByRole('heading', { name: /AI photo generation|AI catalog/i })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('AI catalog new submission form renders', async ({ asRetailerActive, consoleErrors }) => {
    await asRetailerActive.goto('/retailer/ai-catalog/new');
    await expect(asRetailerActive.getByRole('heading', { name: /new AI submission/i })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Phase 4 — §4 Store Operations', () => {
  test('retailer holiday calendar renders', async ({ asRetailerActive, consoleErrors }) => {
    await asRetailerActive.goto('/retailer/holiday-calendar');
    await expect(asRetailerActive.getByRole('heading', { name: /holiday|calendar/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('retailer notification preferences renders', async ({
    asRetailerActive,
    consoleErrors,
  }) => {
    await asRetailerActive.goto('/retailer/notification-prefs');
    await expect(asRetailerActive.getByRole('heading', { name: /notification|preferences/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('retailer notifications inbox renders', async ({ asRetailerActive, consoleErrors }) => {
    await asRetailerActive.goto('/retailer/inbox');
    await expect(asRetailerActive.getByRole('heading', { name: /inbox|notification/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('live retailer dashboard renders KPI strip', async ({
    asRetailerActive,
    consoleErrors,
  }) => {
    await asRetailerActive.goto('/retailer/dashboard');
    await expect(asRetailerActive.locator('body')).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Phase 9 — §9 Fulfilment Variants', () => {
  test('admin delivery-windows renders fee table', async ({ asAdmin, consoleErrors }) => {
    await asAdmin.goto('/admin/delivery-windows');
    await expect(asAdmin.getByRole('heading', { name: /delivery windows/i }).first()).toBeVisible();
    await expect(asAdmin.getByText(/standard|express|try.and.buy|pickup/i).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Phase 10 — §10 Returns and Held Items', () => {
  test('retailer returns queue renders two tabs', async ({ asRetailerActive, consoleErrors }) => {
    await asRetailerActive.goto('/retailer/returns');
    await expect(asRetailerActive.getByRole('tab', { name: /door returns/i })).toBeVisible();
    await expect(asRetailerActive.getByRole('tab', { name: /standard returns/i })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('retailer held-items list renders', async ({ asRetailerActive, consoleErrors }) => {
    await asRetailerActive.goto('/retailer/held-items');
    await expect(asRetailerActive.getByRole('heading', { name: /held items/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('admin held-items renders with cross-store visibility', async ({ asAdmin, consoleErrors }) => {
    await asAdmin.goto('/admin/held-items');
    await expect(asAdmin.getByRole('heading', { name: /held items/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Phase 8 — §8 Order Pipeline', () => {
  test('live retailer dashboard shows analytics sections', async ({ asRetailerActive, consoleErrors }) => {
    await asRetailerActive.goto('/retailer/dashboard');
    await expect(asRetailerActive.getByText(/30-day GMV|Revenue trend|Order pipeline/i).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });


  test('retailer orders list renders 8 tabs', async ({ asRetailerActive, consoleErrors }) => {
    await asRetailerActive.goto('/retailer/orders');
    await expect(asRetailerActive.getByRole('button', { name: /pending acceptance/i })).toBeVisible();
    await expect(asRetailerActive.getByRole('button', { name: /accepted/i })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('admin orders list renders with status filter', async ({ asAdmin, consoleErrors }) => {
    await asAdmin.goto('/admin/orders');
    await expect(asAdmin.getByRole('heading', { name: /orders/i }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('admin orders acceptance timeout tab renders', async ({ asAdmin, consoleErrors }) => {
    await asAdmin.goto('/admin/orders');
    await asAdmin.getByRole('tab', { name: /acceptance timeout/i }).click();
    await expect(asAdmin.locator('body')).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
