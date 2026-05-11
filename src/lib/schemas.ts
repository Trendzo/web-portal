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

export const RetailerStatusSchema = z.enum([
  'pending_approval',
  'under_review',
  'approved_no_store',
  'onboarding',
  'active',
  'paused',
  'suspended',
  'terminated',
  'deactivated',
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
});

export type AdminRetailerView = z.infer<typeof AdminRetailerViewSchema>;
