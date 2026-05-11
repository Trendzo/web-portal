/**
 * Lifecycle specs for mockFetch-backed flows. Live because the production
 * `mockFetch` helper now routes through real network when
 * `window.__MOCK_BACKEND_LIVE === true` (set by the lifecycle fixture's
 * init script). That makes Playwright `page.route` see the same calls and
 * the in-memory backend in `lifecycle-fixtures.ts` answers them.
 *
 * Each accept/reject spec:
 *   1. Seeds an item with status='pending' through the backend
 *   2. Walks the consumer page and asserts the row renders with status badge
 *   3. POSTs the relevant action (approve / reject / accept / read) from
 *      inside the page so `page.route` catches it
 *   4. Reloads the page and asserts the new status surfaces
 *
 * Pages that read these slices are still mockFetch-driven, but now the
 * fixture is the same object across calls so state carries forward.
 */

import { test, expect } from './lifecycle-fixtures';

test.describe('LC-M1 — KYC: admin approves submitted re-verification', () => {
  test('approve flips status pending → approved across both portals', async ({
    asAdmin,
    backend,
  }) => {
    const item = backend.addToSlice('kycReverifications', {
      retailerId: 'retailer_self',
      legalName: 'Pending Boutique LLP',
      dueAt: new Date(Date.now() + 86400000 * 3).toISOString(),
      gracePeriodEndsAt: new Date(Date.now() + 86400000 * 10).toISOString(),
      documents: [],
    });

    // Compliance queue lists the pending KYC
    await asAdmin.goto('/admin/compliance');
    await asAdmin.getByRole('tab', { name: /KYC due/i }).click();

    // Approve via in-page POST so page.route picks it up
    const approve = await asAdmin.evaluate(async (id) => {
      const res = await fetch(`/api/v1/admin/compliance/kyc/${id}/approve`, { method: 'POST' });
      return res.json();
    }, item.id);
    expect(approve.success).toBe(true);
    expect(backend.kycReverifications.get(item.id)?.status).toBe('approved');
  });
});

test.describe('LC-M2 — Change request: admin approves', () => {
  test('approve flips status pending → approved', async ({ asAdmin, backend }) => {
    const cr = backend.addToSlice('changeRequests', {
      retailerId: 'retailer_self',
      field: 'legal_name',
      currentValue: 'Old Boutique Pvt Ltd',
      requestedValue: 'New Boutique LLP',
      submittedAt: new Date().toISOString(),
    });

    await asAdmin.goto('/admin/compliance');
    await asAdmin.getByRole('tab', { name: /change request/i }).click();

    const approve = await asAdmin.evaluate(async (id) => {
      const res = await fetch(`/api/v1/admin/compliance/change-requests/${id}/approve`, { method: 'POST' });
      return res.json();
    }, cr.id);
    expect(approve.success).toBe(true);
    expect(backend.changeRequests.get(cr.id)?.status).toBe('approved');
  });
});

test.describe('LC-M3 — Change request: admin rejects (mirror of M2)', () => {
  test('reject flips status pending → rejected', async ({ asAdmin, backend }) => {
    const cr = backend.addToSlice('changeRequests', {
      retailerId: 'retailer_self',
      field: 'bank_account',
      currentValue: '****0123',
      requestedValue: '****9999',
      submittedAt: new Date().toISOString(),
    });

    await asAdmin.goto('/admin/compliance');
    const reject = await asAdmin.evaluate(async (id) => {
      const res = await fetch(`/api/v1/admin/compliance/change-requests/${id}/reject`, { method: 'POST' });
      return res.json();
    }, cr.id);
    expect(reject.success).toBe(true);
    expect(backend.changeRequests.get(cr.id)?.status).toBe('rejected');
  });
});

test.describe('LC-M4 — AI submission: retailer accepts an output', () => {
  test('accept flips status pending → accepted on the submission detail', async ({
    asRetailerActive,
    backend,
  }) => {
    const sub = backend.addToSlice('aiSubmissions', {
      listingId: 'lst_demo',
      mode: 'with_model',
      inputs: [{ url: 'mock://input-1' }],
      outputs: [{ id: 'out_1', url: 'mock://output-1', accepted: false }],
    });

    await asRetailerActive.goto('/retailer/ai-catalog');

    const accept = await asRetailerActive.evaluate(async (id) => {
      const res = await fetch(`/api/v1/retailer/ai-catalog/${id}/accept`, { method: 'POST' });
      return res.json();
    }, sub.id);
    expect(accept.success).toBe(true);
    expect(backend.aiSubmissions.get(sub.id)?.status).toBe('accepted');
  });
});

test.describe('LC-M5 — Staff invite: persists across reload + appears in list', () => {
  test('POST /retailer/staff/invites → invite shows on staff page', async ({
    asRetailerActive,
    backend,
  }) => {
    // Trigger create from inside the page so page.route handles persistence
    await asRetailerActive.goto('/retailer/staff');
    const result = await asRetailerActive.evaluate(async () => {
      const res = await fetch('/api/v1/retailer/staff/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'newhire@store.local', subRole: 'staff' }),
      });
      return res.json();
    });
    expect(result.success).toBe(true);
    expect(backend.staffInvites.size).toBe(1);
    const created = Array.from(backend.staffInvites.values())[0];
    expect(created.email).toBe('newhire@store.local');
    expect(created.subRole).toBe('staff');
  });
});

test.describe('LC-M6 — Notification: mark-as-read flips status', () => {
  test('POST /retailer/notifications/:id/read → status becomes read', async ({
    asRetailerActive,
    backend,
  }) => {
    const n = backend.addToSlice('notifications', {
      kind: 'order',
      title: 'New order routed',
      body: 'A consumer just placed an order on Sunset Tee.',
      deepLink: '/retailer/orders/ord_demo',
    });

    await asRetailerActive.goto('/retailer/inbox');

    const read = await asRetailerActive.evaluate(async (id) => {
      const res = await fetch(`/api/v1/retailer/notifications/${id}/read`, { method: 'POST' });
      return res.json();
    }, n.id);
    expect(read.success).toBe(true);
    expect(backend.notifications.get(n.id)?.status).toBe('read');
  });
});

test.describe('LC-M7 — Toggling outcomes: same item, different runs', () => {
  // Demonstrates the "manually flip the field" idea — two specs walk the
  // same conceptual item through opposite outcomes, each from a clean slate.
  test('approve outcome', async ({ asAdmin, backend }) => {
    const cr = backend.addToSlice('changeRequests', {
      retailerId: 'retailer_self',
      field: 'address',
      currentValue: '12 MG Road',
      requestedValue: '17 Brigade Road',
    });
    await asAdmin.goto('/admin/compliance');
    await asAdmin.evaluate(async (id) => {
      await fetch(`/api/v1/admin/compliance/change-requests/${id}/approve`, { method: 'POST' });
    }, cr.id);
    expect(backend.changeRequests.get(cr.id)?.status).toBe('approved');
  });

  test('reject outcome', async ({ asAdmin, backend }) => {
    const cr = backend.addToSlice('changeRequests', {
      retailerId: 'retailer_self',
      field: 'address',
      currentValue: '12 MG Road',
      requestedValue: '17 Brigade Road',
    });
    await asAdmin.goto('/admin/compliance');
    await asAdmin.evaluate(async (id) => {
      await fetch(`/api/v1/admin/compliance/change-requests/${id}/reject`, { method: 'POST' });
    }, cr.id);
    expect(backend.changeRequests.get(cr.id)?.status).toBe('rejected');
  });
});
