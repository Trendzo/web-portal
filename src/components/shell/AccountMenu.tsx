import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, LogOut, Plus, ShieldCheck, Store } from 'lucide-react';
import {
  accountHomeOf,
  accountIdOf,
  accountLabelOf,
  useAuth,
  type Session,
} from '@/lib/auth';
import { cn } from '@/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

/**
 * Hook bundling the multi-account actions used by both the desktop dropdown
 * and the mobile inline panel.
 */
function useAccountActions() {
  const navigate = useNavigate();
  const accounts = useAuth((s) => s.accounts);
  const session = useAuth((s) => s.session);
  const switchTo = useAuth((s) => s.switchTo);
  const signOut = useAuth((s) => s.signOut);
  const signOutAll = useAuth((s) => s.signOutAll);

  const switchToAccount = (s: Session) => {
    if (session && accountIdOf(session) === accountIdOf(s)) return;
    switchTo(accountIdOf(s));
    // Full-page navigation rather than `navigate()` — the auth store has just changed,
    // and an in-memory route swap causes a race where the new route's <RoleGate>
    // reads the OLD session for one render and redirects to login. A fresh document
    // load reads the persisted active session cleanly, with no stale React Query cache
    // or layout hanging around.
    window.location.assign(accountHomeOf(s));
  };

  const addAccount = (kind: 'admin' | 'retailer') => {
    navigate(kind === 'admin' ? '/admin/login' : '/retailer/login');
  };

  const signOutActive = () => {
    const remaining = accounts.filter(
      (a) => session && accountIdOf(a) !== accountIdOf(session),
    );
    signOut();
    const next = remaining[0];
    // Same reasoning as switchToAccount — full nav avoids any RoleGate redirect race.
    window.location.assign(next ? accountHomeOf(next) : '/');
  };

  const signOutEveryone = () => {
    signOutAll();
    window.location.assign('/');
  };

  return {
    accounts,
    session,
    switchToAccount,
    addAccount,
    signOutActive,
    signOutEveryone,
  };
}

/**
 * Identity chip in the masthead. Click → dropdown listing every signed-in account
 * with switch / add / sign-out actions.
 */
export function AccountMenu({ className }: { className?: string }) {
  const { accounts, session, switchToAccount, addAccount, signOutActive, signOutEveryone } =
    useAccountActions();

  if (!session) return null;

  const activeId = accountIdOf(session);
  const activeLabel = accountLabelOf(session);
  const others = accounts.filter((a) => accountIdOf(a) !== activeId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'group flex items-center gap-2.5 rounded-xs border border-transparent',
            'px-2 py-1.5 hover:bg-paper-2 hover:border-rule transition-colors',
            'focus-visible:outline-none focus-visible:border-ink',
            className,
          )}
        >
          <KindBadge kind={session.kind} />
          <span className="hidden text-left leading-tight sm:block min-w-0">
            <span className="block max-w-[180px] truncate text-[13.5px] font-medium text-ink">
              {activeLabel.primary}
            </span>
            <span className="block max-w-[180px] truncate text-[10.5px] uppercase tracking-[0.16em] text-ink-3">
              {activeLabel.secondary}
            </span>
          </span>
          <ChevronDown className="size-4 text-ink-3 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuLabel>Active account</DropdownMenuLabel>
        <ActiveRow session={session} />

        {others.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Switch to</DropdownMenuLabel>
            {others.map((a) => (
              <DropdownMenuItem
                key={accountIdOf(a)}
                onSelect={() => switchToAccount(a)}
              >
                <AccountRowBody session={a} />
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Add account</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => addAccount('admin')}>
          <span className="grid size-7 place-items-center text-ink-3">
            <Plus className="size-3.5" />
          </span>
          <span className="text-[13.5px]">Sign in another admin</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => addAccount('retailer')}>
          <span className="grid size-7 place-items-center text-ink-3">
            <Plus className="size-3.5" />
          </span>
          <span className="text-[13.5px]">Sign in another retailer</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOutActive}>
          <span className="grid size-7 place-items-center text-ink-3">
            <LogOut className="size-3.5" />
          </span>
          <span className="text-[13.5px] truncate">
            Sign out <span className="text-ink-2">{activeLabel.primary}</span>
          </span>
        </DropdownMenuItem>
        {accounts.length > 1 && (
          <DropdownMenuItem onSelect={signOutEveryone}>
            <span className="grid size-7 place-items-center text-ink-3">
              <LogOut className="size-3.5" />
            </span>
            <span className="text-[13.5px]">Sign out all accounts</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Inline accounts panel — used at the bottom of the mobile shell drawer where a
 * nested dropdown would feel wrong.
 */
export function AccountsPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { accounts, session, switchToAccount, addAccount, signOutActive, signOutEveryone } =
    useAccountActions();

  if (!session) return null;
  const activeId = accountIdOf(session);
  const others = accounts.filter((a) => accountIdOf(a) !== activeId);

  const wrap = (fn: () => void) => () => {
    fn();
    onNavigate?.();
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="kicker mb-2 text-ink-3">Active</div>
        <ActiveRow session={session} />
      </div>

      {others.length > 0 && (
        <div>
          <div className="kicker mb-2 text-ink-3">Switch to</div>
          <div className="space-y-1">
            {others.map((a) => (
              <button
                key={accountIdOf(a)}
                type="button"
                onClick={wrap(() => switchToAccount(a))}
                className="flex w-full items-center gap-2.5 rounded-xs px-2 py-2 hover:bg-paper-2 text-left"
              >
                <AccountRowBody session={a} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="kicker mb-2 text-ink-3">Add account</div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            iconLeft={<Plus className="size-3.5" />}
            onClick={wrap(() => addAccount('admin'))}
          >
            Admin
          </Button>
          <Button
            variant="outline"
            size="sm"
            iconLeft={<Plus className="size-3.5" />}
            onClick={wrap(() => addAccount('retailer'))}
          >
            Retailer
          </Button>
        </div>
      </div>

      <div className="border-t border-rule pt-3 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          iconLeft={<LogOut className="size-3.5" />}
          onClick={wrap(signOutActive)}
        >
          Sign out{' '}
          <span className="ml-1 truncate text-ink-2">{accountLabelOf(session).primary}</span>
        </Button>
        {accounts.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-ink-2"
            iconLeft={<LogOut className="size-3.5" />}
            onClick={wrap(signOutEveryone)}
          >
            Sign out all accounts
          </Button>
        )}
      </div>
    </div>
  );
}

// ───────── shared row pieces ─────────

function ActiveRow({ session }: { session: Session }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xs px-2 py-2 bg-paper-2/60">
      <AccountRowBody session={session} />
      <Check className="size-4 text-ink shrink-0" aria-label="active" />
    </div>
  );
}

function AccountRowBody({ session }: { session: Session }) {
  const label = accountLabelOf(session);
  return (
    <>
      <KindBadge kind={session.kind} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13.5px] font-medium text-ink">{label.primary}</span>
        <span className="block truncate text-[11px] text-ink-3">{label.secondary}</span>
      </span>
    </>
  );
}

function KindBadge({ kind }: { kind: 'admin' | 'retailer' }) {
  const Icon = kind === 'admin' ? ShieldCheck : Store;
  return (
    <span
      className="grid size-7 shrink-0 place-items-center border border-ink/30 bg-paper rounded-xs"
      aria-hidden
    >
      <Icon className="size-3.5 text-ink" />
    </span>
  );
}
