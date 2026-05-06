import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Mark } from '@/components/ui/mark';
import { AccountMenu, AccountsPanel } from './AccountMenu';

export type NavItem = {
  to: string;
  label: string;
  end?: boolean;
};

type AppShellProps = {
  kindLabel: string;
  /** Horizontal nav items — order matters, the active item gets the underline. */
  nav: NavItem[];
};

/**
 * Retailer shell — masthead + horizontal nav. Tight chrome, no decorative byline /
 * footer copy. The horizontal nav fits a single-tenant workflow.
 */
export function AppShell({ kindLabel, nav }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <header className="border-b border-ink/80 bg-paper">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-5 py-4 sm:px-8">
          <NavLink to="/" className="flex items-center" aria-label="ClosetX home">
            <Mark size="md" kicker={kindLabel} />
          </NavLink>

          <div className="hidden lg:flex">
            <AccountMenu />
          </div>

          <button
            className="lg:hidden -m-2 p-2 text-ink hover:bg-paper-2 rounded-xs"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      <nav className="hidden border-b border-rule bg-paper lg:block">
        <ul className="mx-auto flex max-w-[1280px] items-stretch divide-x divide-rule px-5 sm:px-8">
          {nav.map((item) => (
            <li key={item.to} className="flex-1 min-w-0">
              <NavLink
                to={item.to}
                end={item.end ?? false}
                className={({ isActive }) =>
                  cn(
                    'flex items-baseline px-4 py-3.5 transition-colors press',
                    isActive
                      ? 'bg-paper text-ink'
                      : 'text-ink-2 hover:bg-paper-2 hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <span
                    className={cn(
                      'font-display italic text-[18px] leading-none tracking-tight',
                      isActive && 'underline decoration-ink decoration-1 underline-offset-[6px]',
                    )}
                  >
                    {item.label}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {mobileOpen && (
        <MobileMenu nav={nav} kindLabel={kindLabel} onClose={() => setMobileOpen(false)} />
      )}

      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  );
}

function MobileMenu({
  nav,
  kindLabel,
  onClose,
}: {
  nav: NavItem[];
  kindLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-paper px-5 py-5 flex flex-col lg:hidden">
      <div className="flex items-start justify-between">
        <Mark size="md" kicker={kindLabel} />
        <button
          aria-label="Close"
          onClick={onClose}
          className="-m-2 p-2 text-ink hover:bg-paper-2 rounded-xs"
        >
          <X className="size-5" />
        </button>
      </div>
      <nav className="mt-8 flex-1 overflow-y-auto">
        <ul>
          {nav.map((item) => (
            <li key={item.to} className="border-b border-rule">
              <NavLink
                to={item.to}
                end={item.end ?? false}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'block py-3 font-display italic text-[24px]',
                    isActive ? 'text-ink' : 'text-ink-2',
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-rule pt-5">
        <AccountsPanel onNavigate={onClose} />
      </div>
    </div>
  );
}
