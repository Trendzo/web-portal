import { useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { exitImpersonationAndReload, useAuth, useImpersonation } from '@/lib/auth';
import { useBannerStack } from '@/lib/banners';
import { formatAge } from '@/lib/status';

const BANNER_ID = 'impersonation-active';

/**
 * Headless mount component. Subscribes to the active retailer session's
 * impersonator context (set when an admin started impersonation) and pushes /
 * clears a warning banner accordingly. Mount once per RetailerLayout. Renders
 * nothing.
 */
export function ImpersonationBanner() {
  const ctx = useImpersonation();
  const pushBanner = useBannerStack((s) => s.pushBanner);
  const clearByKind = useBannerStack((s) => s.clearByKind);

  useEffect(() => {
    if (!ctx) {
      clearByKind('impersonation');
      return;
    }
    pushBanner({
      id: BANNER_ID,
      kind: 'impersonation',
      tone: 'warning',
      title: ctx.storeName
        ? `Viewing as ${ctx.storeName}`
        : 'Viewing as impersonated store',
      body: `Started ${formatAge(ctx.since)}. Every action is recorded against your admin id and the store.`,
      cta: {
        label: 'Exit impersonation',
        onClick: () => {
          void stopAndExit(ctx.sessionId, ctx.adminAccountId);
        },
      },
      portal: 'retailer',
    });
    return () => {
      clearByKind('impersonation');
    };
  }, [ctx, pushBanner, clearByKind]);

  return null;
}

/** Look up the admin token by account id, call /admin/impersonation/stop with
 *  it, then swap the active session back to the admin account. If anything
 *  fails before the swap, surface a toast and stay on the retailer SPA. */
async function stopAndExit(sessionId: string, adminAccountId: string) {
  const adminAccount = useAuth
    .getState()
    .accounts.find((a) => a.kind === 'admin' && `admin:${a.admin.id}` === adminAccountId);
  if (!adminAccount || adminAccount.kind !== 'admin') {
    toast.error('Admin session not found — please sign in to admin again.');
    return;
  }
  try {
    await api('/admin/impersonation/stop', {
      method: 'POST',
      body: { sessionId },
      token: adminAccount.token,
    });
  } catch {
    // Even if the server call fails (network / already-stopped), still tear
    // down the local impersonation session so the admin isn't stranded.
    toast.error('Could not notify server — exiting locally.');
  }
  exitImpersonationAndReload();
}
