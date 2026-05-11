import { test as base, type Page } from '@playwright/test';

const ADMIN_SESSION = {
  kind: 'admin' as const,
  token: 'test-admin-token',
  admin: { id: 'admin_super', email: 'super@closetx.local', subRole: 'super_admin' as const },
};

const RETAILER_SESSION_ACTIVE = {
  kind: 'retailer' as const,
  token: 'test-retailer-token',
  retailer: {
    id: 'retailer_self',
    email: 'owner@store.local',
    legalName: 'Test Store Pvt Ltd',
    phone: '+91 90000 00000',
    gstin: '29ABCDE1234F1Z5',
    status: 'active' as const,
    storeId: 'store_active_1',
  },
};

const RETAILER_SESSION_PENDING = {
  kind: 'retailer' as const,
  token: 'test-retailer-token-pending',
  retailer: {
    ...RETAILER_SESSION_ACTIVE.retailer,
    id: 'retailer_pending',
    email: 'newcomer@store.local',
    status: 'pending_approval' as const,
    storeId: null,
  },
};

const ME_RESPONSE_ACTIVE = {
  retailer: RETAILER_SESSION_ACTIVE.retailer,
  store: {
    id: 'store_active_1',
    legalName: 'Test Store Pvt Ltd',
    gstin: '29ABCDE1234F1Z5',
    address: '12 MG Road, Bengaluru',
    stateCode: '29',
    lat: 12.97,
    lng: 77.59,
    status: 'active' as const,
    platformFeeBp: 1500,
    payoutCadenceDays: 7,
  },
};

const ME_RESPONSE_PENDING = {
  retailer: RETAILER_SESSION_PENDING.retailer,
  store: null,
};

function envelope(data: unknown) {
  return JSON.stringify({ success: true, data });
}

async function stubAllApi(page: Page, role: 'admin' | 'retailer-active' | 'retailer-pending' | 'guest') {
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    // Default: empty success for any non-GET (POST/PATCH/DELETE) so mutations
    // resolve cleanly during interactive tests.
    if (method !== 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: envelope({ ok: true }),
      });
      return;
    }
    let payload: unknown = [];
    if (url.endsWith('/retailer/me')) {
      payload = role === 'retailer-pending' ? ME_RESPONSE_PENDING : ME_RESPONSE_ACTIVE;
    } else if (url.endsWith('/admin/me')) {
      payload = ADMIN_SESSION.admin;
    } else if (/\/listings\?|\/listings$/.test(url)) {
      // List endpoint — return a single synthetic listing so detail pages
      // (which fetch the full list and filter by id) find a match.
      payload = [
        {
          id: 'lst_1',
          storeId: 'store_active_1',
          brandId: null,
          categoryId: 'cat_apparel',
          name: 'Synthetic Tee',
          description: 'Mocked listing for smoke tests.',
          hsn: null,
          gender: 'unisex',
          badge: 'none',
          listingPolicy: 'return',
          galleryUrls: [],
          status: 'active',
          ratingAvg: '0',
          ratingCount: 0,
          createdAt: new Date().toISOString(),
          variants: [],
        },
      ];
    } else if (/\/listings\/[^/?]+\/audit/.test(url)) {
      payload = [];
    } else if (/\/listings\/[^/?]+(?:\?|$)/.test(url) && route.request().method() === 'GET') {
      payload = {
        id: 'lst_1',
        storeId: 'store_active_1',
        brandId: null,
        categoryId: 'cat_apparel',
        name: 'Synthetic Tee',
        description: 'Mocked listing for smoke tests.',
        hsn: null,
        gender: 'unisex',
        badge: 'none',
        listingPolicy: 'return',
        galleryUrls: [],
        status: 'active',
        ratingAvg: '0',
        ratingCount: 0,
        createdAt: new Date().toISOString(),
        variants: [],
      };
    } else if (/\/orders/.test(url)) {
      payload = [];
    } else if (/\/retailers\/[^/?]+(?:\?|$)/.test(url) && route.request().method() === 'GET') {
      // Single-retailer endpoint — return one synthetic retailer record
      // matching `AdminRetailerViewSchema`. The boundary now validates this
      // shape via `apiValidated()`; deviations would render the explicit
      // error card instead of crashing.
      payload = {
        id: 'r1',
        email: 'r1@store.local',
        legalName: 'Synthetic Retailer 1',
        phone: '+91 90000 00001',
        gstin: '29ABCDE1234F1Z5',
        status: 'active',
        storeId: 'store_active_1',
        subRole: 'owner',
        createdAt: new Date().toISOString(),
      };
    } else if (/\/retailers/.test(url) && route.request().method() === 'GET') {
      payload = [];
    } else if (/\/inventory/.test(url)) {
      payload = [];
    } else if (/\/promotions/.test(url)) {
      payload = [];
    } else if (/\/refunds/.test(url) || /\/disputes/.test(url) || /\/issues/.test(url) || /\/held-items/.test(url)) {
      payload = [];
    } else if (/\/consumers/.test(url)) {
      payload = { items: [], total: 0 };
    } else if (/\/applications/.test(url)) {
      payload = [];
    } else if (/\/me$/.test(url)) {
      payload = role === 'admin' ? ADMIN_SESSION.admin : ME_RESPONSE_ACTIVE;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope(payload),
    });
  });
}

async function seedSession(page: Page, role: 'admin' | 'retailer-active' | 'retailer-pending' | 'guest') {
  if (role === 'guest') return;
  const session =
    role === 'admin'
      ? ADMIN_SESSION
      : role === 'retailer-pending'
      ? RETAILER_SESSION_PENDING
      : RETAILER_SESSION_ACTIVE;
  const accountId =
    session.kind === 'admin' ? `admin:${session.admin.id}` : `retailer:${session.retailer.id}`;
  const wrapper = {
    state: {
      accounts: [session],
      activeId: accountId,
      session,
    },
    version: 3,
  };
  await page.addInitScript((data) => {
    localStorage.setItem('closetx-dashboard.auth', data);
  }, JSON.stringify(wrapper));
}

export type Role = 'admin' | 'retailer-active' | 'retailer-pending' | 'guest';

type Fx = {
  asAdmin: Page;
  asRetailerActive: Page;
  asRetailerPending: Page;
  consoleErrors: string[];
};

export const test = base.extend<Fx>({
  asAdmin: async ({ page }, use) => {
    await seedSession(page, 'admin');
    await stubAllApi(page, 'admin');
    await use(page);
  },
  asRetailerActive: async ({ page }, use) => {
    await seedSession(page, 'retailer-active');
    await stubAllApi(page, 'retailer-active');
    await use(page);
  },
  asRetailerPending: async ({ page }, use) => {
    await seedSession(page, 'retailer-pending');
    await stubAllApi(page, 'retailer-pending');
    await use(page);
  },
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await use(errors);
  },
});

export { expect } from '@playwright/test';
