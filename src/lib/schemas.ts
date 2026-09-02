/**
 * Runtime Zod schemas mirroring `lib/types.ts`. Use with `apiValidated()` to
 * reject malformed backend responses at the boundary rather than crashing
 * deep inside a React render.
 *
 * Add a new schema here whenever a route fetches a single entity (or a
 * tuple-shaped object) and reads load-bearing fields off it during render.
 * Lists return `[]` on empty and don't need wrapping unless the row shape
 * itself is being mutated by callers.
 */

import { z } from 'zod';

// Mirrors the backend retailer_account_status enum EXACTLY. The old version carried
// four store-lifecycle members the account can never have (approved_no_store /
// onboarding / paused / suspended) while OMITTING 'closed' — so any owner-closed
// account crashed the admin retailer page with "Malformed retailer payload".
export const RetailerStatusSchema = z.enum([
  'pending_approval',
  'active',
  'terminated',
  'closed',
]);

export const RetailerSubRoleSchema = z.enum(['owner', 'manager', 'staff']);

export const AdminRetailerViewSchema = z.object({
  id: z.string(),
  email: z.string(),
  legalName: z.string(),
  phone: z.string(),
  gstin: z.string(),
  status: RetailerStatusSchema,
  storeId: z.string().nullable(),
  subRole: RetailerSubRoleSchema,
  createdAt: z.string(),
  suspendReason: z.string().nullable().optional(),
  posBillingEnabled: z.boolean().optional(),
  posActivationPending: z.boolean().optional(),
});

export type AdminRetailerView = z.infer<typeof AdminRetailerViewSchema>;

// ── Festival themes ─────────────────────────────────────────────────────
// Mirrors the ThemeDraft block in lib/types.ts. Color strings are deliberately
// NOT hex-regexed here: a backend quirk should degrade to an odd preview color,
// not an invalid_response error card. Enums stay strict — an unknown header
// kind would crash the preview's render switch.

const ThemeTokensSchema = z
  .object({
    accent: z.string().optional(),
    accentInk: z.string().optional(),
    accentSoft: z.string().optional(),
    surfaceAlt: z.string().optional(),
    hairline: z.string().optional(),
  })
  .passthrough();

const ThemeHeaderSchema = z
  .object({
    kind: z.enum(['default', 'solid', 'gradient', 'image']),
    color: z.string().optional(),
    gradient: z.tuple([z.string(), z.string()]).optional(),
    ink: z.string().optional(),
    wordmarkUrl: z.string().optional(),
    overlayUrl: z.string().optional(),
    overlayHeight: z.number().optional(),
  })
  .passthrough();

const ThemeChromeSchema = z
  .object({
    statusBarStyle: z.enum(['light', 'dark']),
    header: ThemeHeaderSchema,
    tabBar: z.object({ activeInk: z.string().optional(), badgeBg: z.string().optional() }).passthrough(),
  })
  .passthrough();

const ThemeDecorSchema = z
  .object({
    kind: z.enum(['none', 'image', 'lottie']),
    url: z.string().optional(),
    placement: z.literal('header').optional(),
    loop: z.boolean().optional(),
    maxPlays: z.number().optional(),
    respectReduceMotion: z.literal(true),
  })
  .passthrough();

const ThemeCopySchema = z
  .object({ greeting: z.string().optional(), searchPlaceholder: z.string().optional() })
  .passthrough();

export const ThemeDraftSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isEnabled: z.boolean(),
  priority: z.number(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  cities: z.array(z.string()).nullable(),
  platforms: z.array(z.enum(['ios', 'android'])).nullable(),
  minAppVersion: z.string().nullable(),
  tokens: ThemeTokensSchema,
  chrome: ThemeChromeSchema,
  decor: ThemeDecorSchema,
  copy: ThemeCopySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  createdByAdminId: z.string().nullable(),
  updatedByAdminId: z.string().nullable(),
  inLatestPublication: z.boolean().optional(),
});

export const ThemeDraftListSchema = z.array(ThemeDraftSchema);

export const ThemePublicationListSchema = z.array(
  z.object({
    id: z.string(),
    version: z.number(),
    note: z.string().nullable(),
    publishedAt: z.string(),
    publishedByAdminId: z.string().nullable(),
  }),
);

const SnapshotThemeSchema = z.object({
  slug: z.string(),
  name: z.string(),
  priority: z.number(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  cities: z.array(z.string()).nullable(),
  platforms: z.array(z.enum(['ios', 'android'])).nullable(),
  minAppVersion: z.string().nullable(),
  updatedAt: z.string(),
  tokens: ThemeTokensSchema,
  chrome: ThemeChromeSchema,
  decor: ThemeDecorSchema,
  copy: ThemeCopySchema,
});

export const ThemePreviewSchema = z.object({
  source: z.enum(['draft', 'published']),
  version: z.number().nullable(),
  winner: SnapshotThemeSchema.nullable(),
  response: z.object({
    schemaVersion: z.number(),
    publicationVersion: z.number(),
    generatedAt: z.string(),
    refreshAfterSeconds: z.number(),
    theme: SnapshotThemeSchema.pick({
      slug: true, startsAt: true, endsAt: true, tokens: true, chrome: true, decor: true, copy: true,
    }).nullable(),
  }),
});
