/**
 * Stateful Playwright fixtures for full-lifecycle tests.
 *
 * Why a separate fixture file: render/E2E specs (`fixtures.ts`) stub each
 * endpoint with a static envelope. Lifecycle specs need POST/PATCH/DELETE
 * to mutate persistent state and subsequent GETs to read the new state, so
 * Playwright's request handler is wrapped around an in-memory store that
 * lives for the duration of one test.
 *
 * Coverage: every endpoint reached by `api<>(...)` (the network-bound path).
 * Pages backed by in-process `mockFetch()` cannot be intercepted from here —
 * those flows fall back to UI-only assertions.
 */

import { test as base, type Page, type Route } from '@playwright/test';

// ─── Domain shapes (kept in lockstep with src/lib/types.ts) ────────────────

export type RetailerStatus =
  | 'pending_approval'
  | 'approved_no_store'
  | 'onboarding'
  | 'active'
  | 'paused'
  | 'suspended'
  | 'terminated';

type StoreStatus = 'onboarding' | 'active' | 'paused' | 'suspended' | 'terminated';

type AdminRetailerView = {
  id: string;
  email: string;
  legalName: string;
  phone: string;
  gstin: string;
  status: RetailerStatus;
  storeId: string | null;
  subRole: 'owner';
  createdAt: string;
};

type Brand = {
  id: string;
  slug: string;
  name: string;
  tintColor: string | null;
  logoUrl: string | null;
  domain: string | null;
  isActive: boolean;
};

type Category = {
  id: string;
  slug: string;
  label: string;
  parentId: string | null;
  iconName: string | null;
  tintColor: string | null;
  imageUrl: string | null;
  gender: 'her' | 'him' | 'unisex';
  sortOrder: number;
  isActive: boolean;
};

type Variant = {
  id: string;
  listingId: string;
  sku: string | null;
  attributes: Record<string, string>;
  attributesLabel: string;
  imageUrls: string[];
  stock: number;
  reserved: number;
  pricePaise: number;
};

type Listing = {
  id: string;
  storeId: string;
  brandId: string | null;
  categoryId: string;
  name: string;
  description: string | null;
  hsn: string | null;
  gender: 'her' | 'him' | 'unisex';
  badge: 'new' | 'hot' | 'trending' | 'none';
  listingPolicy: 'return' | 'replace' | 'final_sale';
  galleryUrls: string[];
  status: 'draft' | 'active' | 'retired';
  ratingAvg: string;
  ratingCount: number;
  createdAt: string;
  brand?: Brand;
  category?: Category;
  variants?: Variant[];
};

type Store = {
  id: string;
  legalName: string;
  gstin: string;
  address: string;
  stateCode: string;
  lat: number;
  lng: number;
  status: StoreStatus;
  platformFeeBp: number;
  payoutCadenceDays: number;
};

type Promotion = {
  id: string;
  storeId: string | null;
  name: string;
  mechanism: 'offer' | 'coupon' | 'voucher';
  discountType: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'expired' | 'exhausted' | 'revoked';
  effectiveStatus?: string;
  config: unknown;
  createdAt: string;
};

// ─── State container ──────────────────────────────────────────────────────

export type Role = 'admin' | 'retailer-active' | 'retailer-pending' | 'guest';

let counter = 0;
const id = (prefix: string) => `${prefix}_${(++counter).toString(36)}`;

type Generic = Record<string, unknown> & { id: string; status?: string };

export class MockBackend {
  retailers = new Map<string, AdminRetailerView>();
  stores = new Map<string, Store>();
  brands: Brand[] = [];
  categories: Category[] = [];
  listings = new Map<string, Listing>();
  variants = new Map<string, Variant>();
  promotions = new Map<string, Promotion>();

  // Generic mockFetch-backed slices (state only — shape mirrored on the wire)
  staff = new Map<string, Generic>();
  staffInvites = new Map<string, Generic>();
  kycReverifications = new Map<string, Generic>();
  changeRequests = new Map<string, Generic>();
  aiSubmissions = new Map<string, Generic>();
  notifications = new Map<string, Generic>();
  holidays = new Map<string, Generic>();
  attributeTemplates = new Map<string, Generic>();

  selfRetailer: AdminRetailerView | null = null;
  selfStore: Store | null = null;

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    this.brands = [
      { id: 'brand_1', slug: 'aurora', name: 'Aurora', tintColor: null, logoUrl: null, domain: null, isActive: true },
      { id: 'brand_2', slug: 'meridian', name: 'Meridian', tintColor: null, logoUrl: null, domain: null, isActive: true },
    ];
    this.categories = [
      { id: 'cat_apparel', slug: 'apparel', label: 'Apparel', parentId: null, iconName: null, tintColor: null, imageUrl: null, gender: 'unisex', sortOrder: 0, isActive: true },
      { id: 'cat_tees', slug: 'tees', label: 'T-Shirts', parentId: 'cat_apparel', iconName: null, tintColor: null, imageUrl: null, gender: 'unisex', sortOrder: 0, isActive: true },
    ];
  }

  setSelfRetailer(role: Role) {
    if (role === 'guest') {
      this.selfRetailer = null;
      this.selfStore = null;
      return;
    }
    if (role === 'admin') {
      // Admin doesn't have a self-retailer; /retailer/me would redirect, but
      // some specs jump between admin and retailer — keep an active retailer
      // available so the retailer pane renders if needed.
      this.selfRetailer = this.makeActiveRetailer();
      this.selfStore = this.makeActiveStore(this.selfRetailer.storeId!);
      return;
    }
    if (role === 'retailer-pending') {
      this.selfRetailer = this.makePendingRetailer();
      this.selfStore = null;
      this.retailers.set(this.selfRetailer.id, this.selfRetailer);
      return;
    }
    this.selfRetailer = this.makeActiveRetailer();
    this.selfStore = this.makeActiveStore(this.selfRetailer.storeId!);
    this.retailers.set(this.selfRetailer.id, this.selfRetailer);
    this.stores.set(this.selfStore.id, this.selfStore);
  }

  private makeActiveRetailer(): AdminRetailerView {
    const storeId = 'store_self';
    return {
      id: 'retailer_self',
      email: 'owner@store.local',
      legalName: 'Test Store Pvt Ltd',
      phone: '+91 90000 00000',
      gstin: '29ABCDE1234F1Z5',
      status: 'active',
      storeId,
      subRole: 'owner',
      createdAt: new Date().toISOString(),
    };
  }

  private makePendingRetailer(): AdminRetailerView {
    return {
      id: 'retailer_pending',
      email: 'newcomer@store.local',
      legalName: 'Newcomer Pvt Ltd',
      phone: '+91 90000 00001',
      gstin: '29ABCDE1234F1Z5',
      status: 'pending_approval',
      storeId: null,
      subRole: 'owner',
      createdAt: new Date().toISOString(),
    };
  }

  private makeActiveStore(storeId: string): Store {
    return {
      id: storeId,
      legalName: 'Test Store Pvt Ltd',
      gstin: '29ABCDE1234F1Z5',
      address: '12 MG Road, Bengaluru',
      stateCode: '29',
      lat: 12.97,
      lng: 77.59,
      status: 'active',
      platformFeeBp: 1500,
      payoutCadenceDays: 7,
    };
  }

  // ─── Public seeding helpers used by specs ───────────────────────────────

  addPendingRetailer(partial: Partial<AdminRetailerView> = {}): AdminRetailerView {
    const r: AdminRetailerView = {
      id: id('retailer'),
      email: 'pending@store.local',
      legalName: 'Pending Store Pvt Ltd',
      phone: '+91 90000 00099',
      gstin: '29ABCDE1234F1Z5',
      status: 'pending_approval',
      storeId: null,
      subRole: 'owner',
      createdAt: new Date().toISOString(),
      ...partial,
    };
    this.retailers.set(r.id, r);
    return r;
  }

  addListing(partial: Partial<Listing> = {}): Listing {
    const l: Listing = {
      id: id('lst'),
      storeId: this.selfStore?.id ?? 'store_self',
      brandId: null,
      categoryId: 'cat_tees',
      name: 'Seeded Listing',
      description: null,
      hsn: null,
      gender: 'unisex',
      badge: 'none',
      listingPolicy: 'return',
      galleryUrls: [],
      status: 'draft',
      ratingAvg: '0',
      ratingCount: 0,
      createdAt: new Date().toISOString(),
      ...partial,
    };
    this.listings.set(l.id, l);
    return l;
  }

  addVariant(listingId: string, partial: Partial<Variant> = {}): Variant {
    const v: Variant = {
      id: id('var'),
      listingId,
      sku: 'SEED-1',
      attributes: {},
      attributesLabel: '—',
      imageUrls: [],
      stock: 10,
      reserved: 0,
      pricePaise: 99900,
      ...partial,
    };
    this.variants.set(v.id, v);
    return v;
  }

  addPromotion(partial: Partial<Promotion> = {}): Promotion {
    const status = partial.status ?? 'draft';
    const p: Promotion = {
      id: id('promo'),
      storeId: this.selfStore?.id ?? null,
      name: 'Seeded Promo',
      mechanism: 'offer',
      discountType: 'percent',
      status,
      effectiveStatus: status,
      config: { percent: 10 },
      createdAt: new Date().toISOString(),
      ...partial,
      ...(partial.status ? { effectiveStatus: partial.status } : {}),
    };
    this.promotions.set(p.id, p);
    return p;
  }

  approveRetailer(retailerId: string) {
    const r = this.retailers.get(retailerId);
    if (!r) return;
    r.status = 'active';
  }

  publishListing(listingId: string) {
    const l = this.listings.get(listingId);
    if (!l) return;
    l.status = 'active';
  }

  addToSlice<K extends keyof MockBackend>(sliceName: K, partial: Partial<Generic>): Generic {
    const slice = this[sliceName] as unknown as Map<string, Generic>;
    const item: Generic = {
      id: id(String(sliceName)),
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...partial,
    } as Generic;
    slice.set(item.id, item);
    return item;
  }

  // ─── Network handler ────────────────────────────────────────────────────

  async install(page: Page) {
    await page.route('**/api/v1/**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const path = url.pathname.replace(/^\/api\/v1/, '');
      const method = req.method();
      let body: unknown = undefined;
      if (method !== 'GET' && method !== 'HEAD') {
        try { body = req.postDataJSON(); } catch { body = undefined; }
      }
      try {
        const result = this.dispatch(method, path, url.searchParams, body);
        await this.fulfil(route, result);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('mock-backend dispatch error', e);
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'mock_error', message: String(e) } }),
        });
      }
    });
  }

  private async fulfil(route: Route, result: { status?: number; payload: unknown }) {
    await route.fulfill({
      status: result.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: result.payload }),
    });
  }

  // ─── Routing table ──────────────────────────────────────────────────────

  private dispatch(
    method: string,
    path: string,
    qs: URLSearchParams,
    body: unknown,
  ): { status?: number; payload: unknown } {
    // Auth surface
    if (method === 'GET' && path === '/retailer/me') {
      return { payload: { retailer: this.selfRetailer, store: this.selfStore } };
    }
    if (method === 'GET' && path === '/admin/me') {
      return { payload: { id: 'admin_super', email: 'super@trendzo.local', subRole: 'super_admin' } };
    }

    // Catalog seed
    if (method === 'GET' && path === '/catalog/brands') return { payload: this.brands };
    if (method === 'GET' && path === '/catalog/categories') return { payload: this.categories };
    if (method === 'GET' && path === '/retailer/brands') return { payload: this.brands };

    // Admin retailers
    if (method === 'GET' && path === '/admin/retailers') {
      const status = qs.get('status') as RetailerStatus | null;
      const all = Array.from(this.retailers.values());
      return { payload: status ? all.filter((r) => r.status === status) : all };
    }
    const retailerSingle = path.match(/^\/admin\/retailers\/([^/]+)$/);
    if (method === 'GET' && retailerSingle) {
      const r = this.retailers.get(retailerSingle[1]);
      if (!r) return { status: 404, payload: { code: 'not_found' } };
      return { payload: r };
    }
    const retailerApprove = path.match(/^\/admin\/retailers\/([^/]+)\/approve$/);
    if (method === 'POST' && retailerApprove) {
      const r = this.retailers.get(retailerApprove[1]);
      if (!r) return { status: 404, payload: { code: 'not_found' } };
      r.status = 'active';
      this.retailers.set(r.id, r);
      return { payload: r };
    }
    const retailerReject = path.match(/^\/admin\/retailers\/([^/]+)\/reject$/);
    if (method === 'POST' && retailerReject) {
      const r = this.retailers.get(retailerReject[1]);
      if (!r) return { status: 404, payload: { code: 'not_found' } };
      r.status = 'terminated';
      return { payload: r };
    }
    const retailerSuspend = path.match(/^\/admin\/retailers\/([^/]+)\/(suspend|terminate)$/);
    if (method === 'POST' && retailerSuspend) {
      const r = this.retailers.get(retailerSuspend[1]);
      if (!r) return { status: 404, payload: { code: 'not_found' } };
      r.status = retailerSuspend[2] === 'terminate' ? 'terminated' : 'suspended';
      return { payload: r };
    }

    // Listings
    if (method === 'GET' && (path === '/retailer/listings' || path === '/retailer/listings?')) {
      return this.listListingsHandler(qs);
    }
    if (method === 'GET' && path.startsWith('/retailer/listings?')) {
      return this.listListingsHandler(qs);
    }
    if (method === 'GET' && path === '/retailer/listings') return this.listListingsHandler(qs);
    const listingSingle = path.match(/^\/retailer\/listings\/([^/]+)$/);
    if (method === 'GET' && listingSingle) {
      const l = this.listings.get(listingSingle[1]);
      if (!l) return { status: 404, payload: { code: 'not_found' } };
      return { payload: this.hydrateListing(l) };
    }
    if (method === 'PATCH' && listingSingle) {
      const l = this.listings.get(listingSingle[1]);
      if (!l) return { status: 404, payload: { code: 'not_found' } };
      const patch = (body ?? {}) as Partial<Listing>;
      Object.assign(l, patch);
      this.listings.set(l.id, l);
      return { payload: this.hydrateListing(l) };
    }
    if (method === 'POST' && path === '/retailer/listings') {
      const newL: Listing = {
        id: id('lst'),
        storeId: this.selfStore?.id ?? 'store_self',
        brandId: null,
        categoryId: 'cat_tees',
        name: 'Untitled',
        description: null,
        hsn: null,
        gender: 'unisex',
        badge: 'none',
        listingPolicy: 'return',
        galleryUrls: [],
        status: 'draft',
        ratingAvg: '0',
        ratingCount: 0,
        createdAt: new Date().toISOString(),
        ...(body as Partial<Listing>),
        variants: [],
      };
      this.listings.set(newL.id, newL);
      return { payload: this.hydrateListing(newL) };
    }
    const listingVariants = path.match(/^\/retailer\/listings\/([^/]+)\/variants$/);
    if (method === 'POST' && listingVariants) {
      const listingId = listingVariants[1];
      const v = body as Partial<Variant>;
      const newV: Variant = {
        id: id('var'),
        listingId,
        sku: v.sku ?? null,
        attributes: v.attributes ?? {},
        attributesLabel: v.attributesLabel ?? Object.values(v.attributes ?? {}).join(' / '),
        imageUrls: v.imageUrls ?? [],
        stock: v.stock ?? 0,
        reserved: 0,
        pricePaise: v.pricePaise ?? 0,
      };
      this.variants.set(newV.id, newV);
      return { payload: newV };
    }
    const variantSingle = path.match(/^\/retailer\/variants\/([^/]+)$/);
    if (method === 'PATCH' && variantSingle) {
      const v = this.variants.get(variantSingle[1]);
      if (!v) return { status: 404, payload: { code: 'not_found' } };
      Object.assign(v, body as Partial<Variant>);
      this.variants.set(v.id, v);
      return { payload: v };
    }

    // Inventory
    if (method === 'GET' && path === '/retailer/inventory') {
      const rows = Array.from(this.variants.values()).map((v) => {
        const l = this.listings.get(v.listingId);
        return {
          id: v.id,
          listingId: v.listingId,
          listingName: l?.name ?? '—',
          listingStatus: l?.status ?? 'draft',
          brandName: this.brands.find((b) => b.id === l?.brandId)?.name ?? null,
          sku: v.sku,
          attributesLabel: v.attributesLabel,
          pricePaise: v.pricePaise,
          stock: v.stock,
          reserved: v.reserved,
        };
      });
      return { payload: rows };
    }
    if (method === 'POST' && path === '/retailer/inventory/import') {
      const payload = body as { rows: { sku: string; stock: number }[] } | undefined;
      const rows = payload?.rows ?? [];
      let applied = 0;
      const errors: { row: number; sku: string; reason: string }[] = [];
      rows.forEach((row, idx) => {
        const v = Array.from(this.variants.values()).find((x) => x.sku === row.sku);
        if (!v) {
          errors.push({ row: idx + 1, sku: row.sku, reason: 'sku_not_found' });
          return;
        }
        v.stock = row.stock;
        applied++;
      });
      return { payload: { applied, skipped: errors.length, errors } };
    }

    // Promotions
    if (method === 'GET' && path === '/retailer/promotions') {
      return { payload: Array.from(this.promotions.values()) };
    }
    const promoSingle = path.match(/^\/retailer\/promotions\/([^/]+)$/);
    if (method === 'GET' && promoSingle) {
      const p = this.promotions.get(promoSingle[1]);
      if (!p) return { status: 404, payload: { code: 'not_found' } };
      return { payload: p };
    }
    if (method === 'POST' && path === '/retailer/promotions') {
      const p = body as Partial<Promotion>;
      const status = p.status ?? 'draft';
      const newP: Promotion = {
        id: id('promo'),
        storeId: this.selfStore?.id ?? null,
        name: p.name ?? 'Untitled promo',
        mechanism: p.mechanism ?? 'offer',
        discountType: p.discountType ?? 'percent',
        status,
        effectiveStatus: status,
        config: p.config ?? {},
        createdAt: new Date().toISOString(),
      };
      this.promotions.set(newP.id, newP);
      return { payload: newP };
    }
    if (method === 'PATCH' && promoSingle) {
      const p = this.promotions.get(promoSingle[1]);
      if (!p) return { status: 404, payload: { code: 'not_found' } };
      Object.assign(p, body as Partial<Promotion>);
      return { payload: p };
    }
    const promoLifecycle = path.match(/^\/retailer\/promotions\/([^/]+)\/(activate|pause|resume|revoke)$/);
    if (method === 'POST' && promoLifecycle) {
      const p = this.promotions.get(promoLifecycle[1]);
      if (!p) return { status: 404, payload: { code: 'not_found' } };
      const action = promoLifecycle[2];
      p.status = action === 'activate' ? 'active' : action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'revoked';
      p.effectiveStatus = p.status;
      return { payload: p };
    }

    // Generic mockFetch-backed slices ───────────────────────────────────
    // Each entry maps a path key to the in-memory slice. GET on the bare
    // path returns the array; GET on `/<key>/<id>` returns one; POST on
    // `/<key>` adds; POST on `/<key>/<id>/<action>` applies the named
    // status transition (`approve`, `reject`, `accept`, `read`, etc.).
    type Slice = { key: string; map: Map<string, Generic> };
    const slices: Slice[] = [
      { key: '/retailer/staff', map: this.staff },
      { key: '/retailer/staff/invites', map: this.staffInvites },
      { key: '/retailer/kyc', map: this.kycReverifications },
      { key: '/retailer/kyc/current', map: this.kycReverifications },
      { key: '/admin/compliance/kyc', map: this.kycReverifications },
      { key: '/retailer/change-requests', map: this.changeRequests },
      { key: '/admin/compliance/change-requests', map: this.changeRequests },
      { key: '/retailer/ai-catalog', map: this.aiSubmissions },
      { key: '/retailer/notifications', map: this.notifications },
      { key: '/retailer/holidays', map: this.holidays },
      { key: '/retailer/attribute-templates', map: this.attributeTemplates },
    ];
    for (const s of slices) {
      // GET <key>            → list (skip the `current` alias which returns one)
      // GET <key>/<id>       → one
      // POST <key>           → create
      // POST <key>/<id>/<action> → mutate status
      // PATCH <key>/<id>     → patch fields
      if (path === s.key && method === 'GET') {
        if (s.key.endsWith('/current')) {
          const first = Array.from(s.map.values())[0];
          if (first) return { payload: first };
          // Return a synthetic in-progress KYC if nothing seeded — page
          // expects a single object, not an array.
          return { payload: { id: 'kyc_synth', status: 'pending', dueAt: new Date(Date.now() + 86400000 * 5).toISOString(), gracePeriodEndsAt: new Date(Date.now() + 86400000 * 12).toISOString(), documents: [] } };
        }
        return { payload: Array.from(s.map.values()) };
      }
      if (path === s.key && method === 'POST') {
        const item = body as Partial<Generic>;
        const created: Generic = {
          id: id(s.key.replace(/[/-]/g, '_')),
          status: 'pending',
          createdAt: new Date().toISOString(),
          ...(item ?? {}),
        } as Generic;
        s.map.set(created.id, created);
        return { payload: created };
      }
      const single = path.match(new RegExp(`^${s.key.replace(/[/]/g, '\\/')}/([^/]+)$`));
      if (single && method === 'GET') {
        const item = s.map.get(single[1]);
        if (!item) return { status: 404, payload: { code: 'not_found' } };
        return { payload: item };
      }
      if (single && method === 'PATCH') {
        const item = s.map.get(single[1]);
        if (!item) return { status: 404, payload: { code: 'not_found' } };
        Object.assign(item, body as Partial<Generic>);
        return { payload: item };
      }
      const action = path.match(new RegExp(`^${s.key.replace(/[/]/g, '\\/')}/([^/]+)/(approve|reject|accept|read|activate|pause|resume|revoke|dismiss)$`));
      if (action && method === 'POST') {
        const item = s.map.get(action[1]);
        if (!item) return { status: 404, payload: { code: 'not_found' } };
        const verb = action[2];
        item.status =
          verb === 'approve' ? 'approved' :
          verb === 'reject' ? 'rejected' :
          verb === 'accept' ? 'accepted' :
          verb === 'read' ? 'read' :
          verb === 'activate' ? 'active' :
          verb === 'pause' ? 'paused' :
          verb === 'resume' ? 'active' :
          verb === 'revoke' ? 'revoked' :
          verb === 'dismiss' ? 'dismissed' :
          item.status;
        item.decidedAt = new Date().toISOString();
        return { payload: item };
      }
    }

    // Default: empty success
    return { payload: this.defaultPayloadForGet(path, method) };
  }

  private listListingsHandler(qs: URLSearchParams): { payload: Listing[] } {
    const status = qs.get('status');
    const all = Array.from(this.listings.values()).map((l) => this.hydrateListing(l));
    return { payload: status && status !== 'all' ? all.filter((l) => l.status === status) : all };
  }

  private hydrateListing(l: Listing): Listing {
    return {
      ...l,
      brand: this.brands.find((b) => b.id === l.brandId),
      category: this.categories.find((c) => c.id === l.categoryId),
      variants: Array.from(this.variants.values()).filter((v) => v.listingId === l.id),
    };
  }

  private defaultPayloadForGet(path: string, method: string): unknown {
    if (method !== 'GET') return { ok: true };
    if (/\/orders/.test(path) || /\/refunds/.test(path) || /\/disputes/.test(path) || /\/issues/.test(path) || /\/held-items/.test(path)) {
      return [];
    }
    if (/\/applications/.test(path)) return [];
    if (/\/consumers/.test(path)) return { items: [], total: 0 };
    return [];
  }
}

// ─── Session seeding (localStorage) ───────────────────────────────────────

const ADMIN_SESSION = {
  kind: 'admin' as const,
  token: 'test-admin-token',
  admin: { id: 'admin_super', email: 'super@trendzo.local', subRole: 'super_admin' as const },
};

function buildSession(role: Role, retailer: AdminRetailerView | null) {
  if (role === 'admin') return ADMIN_SESSION;
  if (!retailer) return null;
  return {
    kind: 'retailer' as const,
    token: 'test-retailer-token',
    retailer: {
      id: retailer.id,
      email: retailer.email,
      legalName: retailer.legalName,
      phone: retailer.phone,
      gstin: retailer.gstin,
      status: retailer.status,
      storeId: retailer.storeId,
    },
  };
}

async function seedSession(page: Page, role: Role, retailer: AdminRetailerView | null) {
  if (role === 'guest') return;
  const session = buildSession(role, retailer);
  if (!session) return;
  const accountId = session.kind === 'admin' ? `admin:${session.admin.id}` : `retailer:${session.retailer.id}`;
  const wrapper = { state: { accounts: [session], activeId: accountId, session }, version: 3 };
  await page.addInitScript((data) => {
    localStorage.setItem('trendzo-dashboard.auth', data);
    // Tell mockFetch to route through real fetch so page.route catches it.
    (window as unknown as { __MOCK_BACKEND_LIVE: boolean }).__MOCK_BACKEND_LIVE = true;
  }, JSON.stringify(wrapper));
}

// ─── Fixture surface ──────────────────────────────────────────────────────

type Fx = {
  backend: MockBackend;
  asAdmin: Page;
  asRetailerActive: Page;
  asRetailerPending: Page;
};

export const test = base.extend<Fx>({
  backend: async ({}, use) => {
    await use(new MockBackend());
  },
  asAdmin: async ({ page, backend }, use) => {
    backend.setSelfRetailer('admin');
    await seedSession(page, 'admin', null);
    await backend.install(page);
    await use(page);
  },
  asRetailerActive: async ({ page, backend }, use) => {
    backend.setSelfRetailer('retailer-active');
    await seedSession(page, 'retailer-active', backend.selfRetailer);
    await backend.install(page);
    await use(page);
  },
  asRetailerPending: async ({ page, backend }, use) => {
    backend.setSelfRetailer('retailer-pending');
    await seedSession(page, 'retailer-pending', backend.selfRetailer);
    await backend.install(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
