import { useAuth } from './auth';

/**
 * Returns true if the active session is granted the given permission `action` key.
 * When no session is active, when the session has no permissions map (older clients
 * pre-rehydration), or when the action is missing from the map, returns false.
 *
 * The map is hydrated at sign-in from `GET /<kind>/me/permissions` and persists
 * alongside the rest of the session in localStorage.
 */
export function usePermission(action: string): boolean {
  return useAuth((s) => s.session?.permissions?.[action] === true);
}

/** True if ANY of the supplied actions are granted. */
export function useHasAnyPermission(actions: string[]): boolean {
  return useAuth((s) => {
    const map = s.session?.permissions;
    if (!map) return false;
    for (const a of actions) {
      if (map[a] === true) return true;
    }
    return false;
  });
}

/** Direct read for non-React contexts. */
export function hasPermission(action: string): boolean {
  return useAuth.getState().session?.permissions?.[action] === true;
}
