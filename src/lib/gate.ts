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
  | { state: 'store_blocked'; status: StoreStatus };

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
  if (store.status === 'onboarding') return { state: 'store_pending' };
  if (store.status === 'active') return { state: 'ready' };
  return { state: 'store_blocked', status: store.status };
}

export function canPublishProducts(gate: Gate): boolean {
  return gate.state === 'ready';
}
