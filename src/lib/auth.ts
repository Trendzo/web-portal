import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AdminProfile, RetailerProfile } from './types';

/** localStorage key for the persisted auth slice. Exported so account-switch
 *  and sign-out flows can write directly without round-tripping through the
 *  React-visible store (see `prepareAccountChangeForReload`). */
export const AUTH_STORAGE_KEY = 'closetx-dashboard.auth';
const AUTH_STORAGE_VERSION = 3;

/** Admin viewing the platform as a specific store — every action audit-logged
 *  against both the admin id and the impersonated store. */
export type ImpersonationContext = {
  storeId: string;
  retailerId: string;
  /** Unix ms when impersonation started. */
  since: number;
};

/**
 * One signed-in identity (admin OR retailer). The store can hold many of these and
 * switch between them — the *active* one is what `session` points at.
 *
 * `impersonating` only applies to the admin variant; retailers never impersonate.
 */
export type Session =
  | { kind: 'admin'; token: string; admin: AdminProfile; impersonating?: ImpersonationContext }
  | { kind: 'retailer'; token: string; retailer: RetailerProfile };

export type AccountId = string;

/** Stable identifier per account — `{kind}:{backend-id}`. */
export function accountIdOf(s: Session): AccountId {
  return s.kind === 'admin' ? `admin:${s.admin.id}` : `retailer:${s.retailer.id}`;
}

export function accountHomeOf(s: Session): string {
  return s.kind === 'admin' ? '/admin/dashboard' : '/retailer/dashboard';
}

export function accountLabelOf(s: Session): { primary: string; secondary: string } {
  if (s.kind === 'admin') {
    return { primary: s.admin.email, secondary: s.admin.subRole.replace('_', ' ') };
  }
  return { primary: s.retailer.legalName, secondary: s.retailer.email };
}

type AuthStore = {
  /** Every signed-in account on this device. */
  accounts: Session[];
  /** Which account is currently active. `null` when nobody is signed in. */
  activeId: AccountId | null;
  /** Mirror of `accounts.find(activeId)` — kept in sync on every mutation so existing
   *  `useAuth(s => s.session)` selectors continue to work without further changes. */
  session: Session | null;
  /** True once `persist` has finished rehydrating from localStorage. Gates auth-
   *  dependent UI (e.g. <RoleGate>) so it doesn't redirect to login on the first
   *  render of a fresh document, before the persisted session has arrived. */
  hasHydrated: boolean;

  /** Add (or refresh, by id) an account and make it active. */
  signIn: (s: Session) => void;
  /** Sign out the active account; if siblings exist, the next one becomes active. */
  signOut: () => void;
  /** Sign out every account on the device. */
  signOutAll: () => void;
  /** Make a different already-signed-in account the active one. No-op if id is unknown. */
  switchTo: (id: AccountId) => void;
  /** Patch fields on the currently-active retailer profile (e.g. after creating a store). */
  patchRetailer: (patch: Partial<RetailerProfile>) => void;
  /** Internal: flipped to `true` once `persist` finishes rehydrating from localStorage. */
  setHasHydrated: (v: boolean) => void;
};

function setActive(accounts: Session[], id: AccountId | null) {
  const session = id ? (accounts.find((a) => accountIdOf(a) === id) ?? null) : null;
  return { activeId: session ? id : null, session };
}

export const useAuth = create<AuthStore>()(
  persist(
    (set, get) => ({
      accounts: [],
      activeId: null,
      session: null,
      hasHydrated: false,

      signIn: (s) => {
        const id = accountIdOf(s);
        const cur = get().accounts;
        const exists = cur.findIndex((a) => accountIdOf(a) === id);
        const accounts = exists >= 0 ? cur.map((a, i) => (i === exists ? s : a)) : [...cur, s];
        set({ accounts, ...setActive(accounts, id) });
      },

      switchTo: (id) => {
        const accounts = get().accounts;
        if (!accounts.some((a) => accountIdOf(a) === id)) return;
        set(setActive(accounts, id));
      },

      signOut: () => {
        const { accounts, activeId } = get();
        if (!activeId) return;
        const remaining = accounts.filter((a) => accountIdOf(a) !== activeId);
        const next = remaining[0];
        set({
          accounts: remaining,
          ...setActive(remaining, next ? accountIdOf(next) : null),
        });
      },

      signOutAll: () =>
        set({ accounts: [], activeId: null, session: null }),

      patchRetailer: (patch) => {
        const cur = get().session;
        if (cur?.kind !== 'retailer') return;
        const id = accountIdOf(cur);
        const updated: Session = { ...cur, retailer: { ...cur.retailer, ...patch } };
        const accounts = get().accounts.map((a) => (accountIdOf(a) === id ? updated : a));
        set({ accounts, ...setActive(accounts, id) });
      },

      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      version: AUTH_STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // `hasHydrated` is a runtime signal, not data — never let an old persisted
      // value of `false` leak back in and clobber the post-rehydration `true`.
      partialize: (state) => ({
        accounts: state.accounts,
        activeId: state.activeId,
        session: state.session,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      // v1 schema was `{ session }`. Promote it into the v2 multi-account shape so
      // anyone who signed in before the upgrade keeps their session.
      // v2 → v3 added the optional `impersonating` field on admin sessions —
      // absent on every existing record, so the v2 shape passes through unchanged.
      migrate: (persisted, fromVersion) => {
        if (fromVersion < 2 && persisted && typeof persisted === 'object') {
          const old = persisted as { session?: Session | null };
          if (old.session) {
            const id = accountIdOf(old.session);
            return {
              accounts: [old.session],
              activeId: id,
              session: old.session,
            } as Partial<AuthStore>;
          }
          return { accounts: [], activeId: null, session: null } as Partial<AuthStore>;
        }
        return persisted as Partial<AuthStore>;
      },
    },
  ),
);

/** Convenience: read the current bearer token (or null) without subscribing. */
export function getToken(): string | null {
  return useAuth.getState().session?.token ?? null;
}

/** Subscribe to the active session's impersonation context. Returns null when
 *  the active session is a retailer or when no impersonation is in flight. */
export function useImpersonation(): ImpersonationContext | null {
  return useAuth((s) => (s.session?.kind === 'admin' ? (s.session.impersonating ?? null) : null));
}

/** Mutate the active admin session's impersonation context and reload to the
 *  given home path without a login flash. No-op if active session is not admin. */
export function startImpersonationAndReload(ctx: ImpersonationContext, redirectTo = '/retailer/dashboard'): void {
  const { accounts, activeId, session } = useAuth.getState();
  if (!session || session.kind !== 'admin' || !activeId) return;
  const updated: Session = { ...session, impersonating: ctx };
  const nextAccounts = accounts.map((a) => (accountIdOf(a) === activeId ? updated : a));
  prepareAccountChangeForReload({ accounts: nextAccounts, activeId });
  window.location.assign(redirectTo);
}

/** Clear impersonation on the active admin session and reload to admin home
 *  without a login flash. */
export function exitImpersonationAndReload(redirectTo = '/admin/dashboard'): void {
  const { accounts, activeId, session } = useAuth.getState();
  if (!session || session.kind !== 'admin' || !activeId) return;
  const { impersonating: _drop, ...rest } = session;
  const updated: Session = rest;
  const nextAccounts = accounts.map((a) => (accountIdOf(a) === activeId ? updated : a));
  prepareAccountChangeForReload({ accounts: nextAccounts, activeId });
  window.location.assign(redirectTo);
}

/**
 * Write the desired post-reload auth state straight to localStorage WITHOUT
 * touching the in-memory React store. Use this immediately before
 * `window.location.assign(...)` in account-switch and sign-out flows.
 *
 * Why this exists: calling `useAuth.setState(...)` (e.g. via `switchTo` or
 * `signOut`) mutates the store synchronously, so React re-renders the
 * currently-mounted RoleGate with the new session. If the new session is the
 * wrong `kind` for the current route — which is exactly the case mid-switch —
 * the gate fires `<Navigate to="/admin/login" />` before the browser has had
 * a chance to process `window.location.assign`. The login page paints for one
 * frame, producing a visible flash. Writing to storage directly bypasses the
 * React render path entirely; the next document picks up the right session
 * during its own hydration.
 */
export function prepareAccountChangeForReload(next: {
  accounts: Session[];
  activeId: AccountId | null;
}): void {
  const session = next.activeId
    ? next.accounts.find((a) => accountIdOf(a) === next.activeId) ?? null
    : null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    const wrapper = raw ? JSON.parse(raw) : { state: {}, version: AUTH_STORAGE_VERSION };
    wrapper.state = {
      ...(wrapper.state ?? {}),
      accounts: next.accounts,
      activeId: next.activeId,
      session,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(wrapper));
  } catch {
    // Storage unavailable — caller falls back to the in-memory path. The flash
    // is preferable to silently dropping the switch.
  }
}
