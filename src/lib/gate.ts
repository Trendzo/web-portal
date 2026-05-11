import type { RetailerProfile, Store, StoreStatus } from './types';

/**
 * The retailer's current "publishing" gate. Drives both the GateNotice banner shown
 * upfront and the disabling of mutation triggers (e.g. New product button).
 *
 * The actual backend gate fires in `POST /retailer/listings` — both retailer.status
 * must be `active` AND store.status must be `active` for a listing to be created.
 * This helper mirrors that rule client-side so the user knows in advance.
 */
export type Gate =
  | { state: 'ready' }
  | { state: 'retailer_pending' }
  | { state: 'retailer_deactivated' }
  | { state: 'no_store' }
  | { state: 'store_pending' }
  | { state: 'store_blocked'; status: StoreStatus }
  // Banner-only gates added for §3 / §22. `canPublishProducts` keeps its
  // strict `state === 'ready'` check; these states bubble up to BannerStack
  // for a non-blocking warning instead of disabling the publish path.
  | { state: 'kyc_overdue'; dueAt: string }
  | { state: 'floor_breached'; metric: string }
  | { state: 'suspended'; reason: string | null };

/** Derive the gate from the latest retailer + store snapshot (from `/retailer/me`). */
export function deriveGate(
  retailer: RetailerProfile | null | undefined,
  store: Store | null | undefined,
): Gate {
  if (!retailer) return { state: 'retailer_pending' };
  if (retailer.status === 'deactivated') return { state: 'retailer_deactivated' };
  if (retailer.status === 'pending_approval') return { state: 'retailer_pending' };
  // retailer is active
  if (!store) return { state: 'no_store' };
  // onboarding = provisioned, retailer adds inventory before going live — allow product management
  if (store.status === 'onboarding' || store.status === 'active') return { state: 'ready' };
  return { state: 'store_blocked', status: store.status };
}

export function canPublishProducts(gate: Gate): boolean {
  return gate.state === 'ready';
}
