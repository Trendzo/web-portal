import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AdminProfile, RetailerProfile } from './types';

/**
 * One signed-in identity (admin OR retailer). The store can hold many of these and
 * switch between them — the *active* one is what `session` points at.
 */
export type Session =
  | { kind: 'admin'; token: string; admin: AdminProfile }
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

      signOutAll: () => set({ accounts: [], activeId: null, session: null }),

      patchRetailer: (patch) => {
        const cur = get().session;
        if (cur?.kind !== 'retailer') return;
        const id = accountIdOf(cur);
        const updated: Session = { ...cur, retailer: { ...cur.retailer, ...patch } };
        const accounts = get().accounts.map((a) => (accountIdOf(a) === id ? updated : a));
        set({ accounts, ...setActive(accounts, id) });
      },
    }),
    {
      name: 'closetx-dashboard.auth',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // v1 schema was `{ session }`. Promote it into the v2 multi-account shape so
      // anyone who signed in before the upgrade keeps their session.
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
