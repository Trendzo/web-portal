import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AdminProfile, RetailerProfile } from './types';

/** localStorage key for the persisted auth slice. Exported so account-switch
 *  and sign-out flows can write directly without round-tripping through the
 *  React-visible store (see `prepareAccountChangeForReload`). */
export const AUTH_STORAGE_KEY = 'trendzo-dashboard.auth';
const AUTH_STORAGE_VERSION = 4;

/** Admin viewing the platform as a specific store — every action audit-logged
 *  against both the admin id and the impersonated store. */
export type ImpersonationContext = {
  storeId: string;
  retailerId: string;
  /** Unix ms when impersonation started. */
  since: number;
};

/** Reverse mapping: a retailer session that was minted by admin impersonation.
 *  The retailer SPA reads this to render the banner + exit affordance. */
export type ImpersonatorContext = {
  adminAccountId: AccountId;
  sessionId: string;
  /** Unix ms when impersonation started. */
  since: number;
  /** Cached human-readable store label for the banner. */
  storeName?: string;
};

/**
 * One signed-in identity (admin OR retailer). The store can hold many of these and
 * switch between them — the *active* one is what `session` points at.
 *
 * `impersonating` only applies to the admin variant; retailers never impersonate.
 */
/** Effective permission map for the active sub-role. Keys are `<resource>.<verb>` action strings;
 *  values are true when the sub-role is granted that action. Fetched once on sign-in from
 *  `GET /<kind>/me/permissions`. */
export type PermissionMap = Record<string, boolean>;

export type Session =
  | {
      kind: 'admin';
      token: string;
      admin: AdminProfile;
      permissions: PermissionMap;
      impersonating?: ImpersonationContext;
    }
  | {
      kind: 'retailer';
      token: string;
      retailer: RetailerProfile;
      permissions: PermissionMap;
      /** Set only when this retailer session was minted by admin impersonation.
       *  Drives the impersonation banner + Exit button on the retailer SPA. */
      impersonator?: ImpersonatorContext;
    };

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
  /** Replace the active session's permission map. Used after login + on demand
   *  to refresh permissions if the admin matrix changes. */
  setPermissions: (permissions: PermissionMap) => void;
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

      setPermissions: (permissions) => {
        const cur = get().session;
        if (!cur) return;
        const id = accountIdOf(cur);
        const updated: Session = { ...cur, permissions };
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
      // v3 → v4 added the required `permissions` map on every session — backfill
      // with `{}`; runtime fetch will fill it on the next refresh.
      migrate: (persisted, fromVersion) => {
        let state: Partial<AuthStore> = persisted as Partial<AuthStore>;
        if (fromVersion < 2 && persisted && typeof persisted === 'object') {
          const old = persisted as { session?: Session | null };
          if (old.session) {
            const id = accountIdOf(old.session);
            state = {
              accounts: [old.session],
              activeId: id,
              session: old.session,
            };
          } else {
            state = { accounts: [], activeId: null, session: null };
          }
        }
        if (fromVersion < 4 && state && state.accounts) {
          const withPerms = state.accounts.map(
            (a) => ({ ...a, permissions: (a as Session).permissions ?? {} }) as Session,
          );
          state = {
            ...state,
            accounts: withPerms,
            session: state.activeId
              ? withPerms.find((a) => accountIdOf(a) === state.activeId) ?? null
              : null,
          };
        }
        return state;
      },
    },
  ),
);

/** Convenience: read the current bearer token (or null) without subscribing. */
export function getToken(): string | null {
  return useAuth.getState().session?.token ?? null;
}

/** Subscribe to the active session's impersonation context. Returns the
 *  impersonator on a retailer session that was minted by admin impersonation,
 *  otherwise null. */
export function useImpersonation(): ImpersonatorContext | null {
  return useAuth((s) =>
    s.session?.kind === 'retailer' ? (s.session.impersonator ?? null) : null,
  );
}

/** Install a retailer impersonation session minted by `POST /admin/impersonation/start`.
 *  Keeps the originating admin session in the accounts list so Exit can swap
 *  back without re-login. Reloads to the retailer dashboard to flush mounted
 *  admin-portal components and run the retailer SPA shell cleanly. */
export function installImpersonationSessionAndReload(args: {
  retailer: RetailerProfile;
  token: string;
  sessionId: string;
  storeName?: string;
  permissions?: PermissionMap;
  redirectTo?: string;
}): void {
  const { accounts, activeId, session } = useAuth.getState();
  if (!session || session.kind !== 'admin' || !activeId) return;
  const retailerSession: Session = {
    kind: 'retailer',
    token: args.token,
    retailer: args.retailer,
    permissions: args.permissions ?? {},
    impersonator: {
      adminAccountId: activeId,
      sessionId: args.sessionId,
      since: Date.now(),
      ...(args.storeName ? { storeName: args.storeName } : {}),
    },
  };
  const retailerAccountId = accountIdOf(retailerSession);
  // Replace any existing retailer session for the same retailer (re-impersonation).
  const nextAccounts = [
    ...accounts.filter((a) => accountIdOf(a) !== retailerAccountId),
    retailerSession,
  ];
  prepareAccountChangeForReload({ accounts: nextAccounts, activeId: retailerAccountId });
  window.location.assign(args.redirectTo ?? '/retailer/dashboard');
}

/** Tear down an impersonation retailer session and switch back to the admin
 *  account that started it. Caller is responsible for calling
 *  `POST /admin/impersonation/stop` with the admin token BEFORE invoking this. */
export function exitImpersonationAndReload(redirectTo = '/admin/dashboard'): void {
  const { accounts, session } = useAuth.getState();
  if (!session || session.kind !== 'retailer' || !session.impersonator) return;
  const adminId = session.impersonator.adminAccountId;
  const retailerId = accountIdOf(session);
  const nextAccounts = accounts.filter((a) => accountIdOf(a) !== retailerId);
  if (!nextAccounts.some((a) => accountIdOf(a) === adminId)) {
    // Admin session was evicted somehow — fall back to clearing impersonation
    // metadata on the retailer session and staying signed in as retailer.
    return;
  }
  prepareAccountChangeForReload({ accounts: nextAccounts, activeId: adminId });
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
