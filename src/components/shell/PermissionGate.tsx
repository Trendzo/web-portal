import type { ReactNode } from 'react';
import { usePermission } from '@/lib/use-permission';

type Props = {
  action: string;
  children: ReactNode;
  /** Rendered when the user lacks `action`. Default: null (hide). */
  fallback?: ReactNode;
};

/**
 * Hides `children` when the active session is not granted `action`. Used to gate
 * buttons, dialogs, action menus, table cells — anywhere a fine-grained UI affordance
 * should disappear instead of being shown disabled.
 *
 * Page-level guards should use the `<NotAuthorized />` component instead so a direct
 * URL access shows an explicit message rather than a blank page.
 */
export function PermissionGate({ action, children, fallback = null }: Props) {
  const allowed = usePermission(action);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
