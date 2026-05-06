import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

type RoleGateProps = {
  kind: 'admin' | 'retailer';
  children: ReactNode;
};

/**
 * Protect a subtree behind a session of the right `kind`. Redirects to that domain's
 * login if the session is missing or wrong-kind. Captures the intended location in
 * `state.from` so login can return after auth.
 */
export function RoleGate({ kind, children }: RoleGateProps) {
  const session = useAuth((s) => s.session);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const location = useLocation();

  // Hold the redirect decision until the auth store has rehydrated from
  // localStorage. Otherwise, on a fresh document load (e.g. after switching
  // accounts via window.location.assign), the first render sees `session: null`
  // and redirects to login before `persist` has a chance to fill the session
  // back in — which manifests as a brief login-page flash.
  if (!hasHydrated) return null;

  if (!session || session.kind !== kind) {
    const dest = kind === 'admin' ? '/admin/login' : '/retailer/login';
    return <Navigate to={dest} replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
