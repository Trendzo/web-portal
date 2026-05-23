import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { useAuth } from '@/lib/auth';

type Props = {
  /** Optional override for the user-facing message. */
  message?: string;
  /** Optional override for the action key the user lacked — surfaced for support diagnosis. */
  action?: string;
};

/**
 * Page-level fallback for routes the active sub-role can't access. Pair with
 * `usePermission(action)` at the top of any page component — when permission
 * is denied, return `<NotAuthorized action={...} />` instead of the normal
 * page body.
 */
export function NotAuthorized({ message, action }: Props) {
  const session = useAuth((s) => s.session);
  const homeHref = session?.kind === 'retailer' ? '/retailer/dashboard' : '/admin/dashboard';
  return (
    <Page>
      <div className="mx-auto max-w-md py-16 text-center space-y-5">
        <div className="inline-grid size-14 place-items-center rounded-full bg-warning/10 text-warning mx-auto">
          <ShieldAlert className="size-7" />
        </div>
        <h1 className="font-display italic text-[28px] text-ink">Not authorized</h1>
        <p className="text-[13.5px] text-ink-2 leading-relaxed">
          {message ??
            'Your current role does not include permission for this page. Ask a super-admin to grant you access if you need it.'}
        </p>
        {action && (
          <p className="text-[11.5px] text-ink-4">
            Required permission: <code className="font-mono">{action}</code>
          </p>
        )}
        <Button asChild variant="ink">
          <Link to={homeHref}>Back to dashboard</Link>
        </Button>
      </div>
    </Page>
  );
}
