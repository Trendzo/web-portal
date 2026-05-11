// MOCK_DEPENDENCY: §1 Identity & Access (impersonation entry from
// retailer-detail still wired to a stub button until backend issues a real
// store-context token).

import { useEffect } from 'react';
import { exitImpersonationAndReload, useImpersonation } from '@/lib/auth';
import { useBannerStack } from '@/lib/banners';
import { formatAge } from '@/lib/status';

const BANNER_ID = 'impersonation-active';

/**
 * Headless mount component. Subscribes to the active admin session's
 * impersonation context and pushes / clears a warning banner accordingly.
 * Mount once per layout (AdminLayout). Renders nothing.
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
      title: `Viewing as store ${ctx.storeId}`,
      body: `Started ${formatAge(ctx.since)}. Every action is recorded against your admin id and the store id.`,
      cta: {
        label: 'Exit impersonation',
        onClick: () => exitImpersonationAndReload(),
      },
      portal: 'admin',
    });
    return () => {
      clearByKind('impersonation');
    };
  }, [ctx, pushBanner, clearByKind]);

  return null;
}
