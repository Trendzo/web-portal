import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Menu, MoreHorizontal, Package, Tag, Tags, Store as StoreIcon, X } from 'lucide-react';
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
  nav: NavItem[];
};

/**
 * Retailer shell — desktop has a top nav strip; mobile has a bottom tab bar
 * (4 primary destinations + "More" drawer for the rest). Mobile-first by design:
 * many small Indian retailers manage on phones.
 */
export function AppShell({ kindLabel, nav }: AppShellProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  // Bottom tabs: pick the first 3 and tuck the rest behind "More".
  const primary = nav.slice(0, 3);
  const overflow = nav.slice(3);

  return (
    <div className="flex min-h-full flex-col bg-bg">
      {/* Desktop top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 sm:px-6 h-14">
          <NavLink to="/" className="flex items-center" aria-label="ClosetX home">
            <Mark size="sm" kicker={kindLabel} />
          </NavLink>

          {/* Desktop horizontal nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end ?? false}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-accent-soft text-accent'
                      : 'text-ink-2 hover:bg-bg-3 hover:text-ink',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 border-t border-line bg-bg/95 backdrop-blur-md md:hidden"
        aria-label="Primary"
      >
        <ul className="grid grid-cols-4 h-16">
          {primary.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end ?? false}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center h-full gap-0.5 transition-colors',
                    isActive ? 'text-accent' : 'text-ink-3 hover:text-ink',
                  )
                }
              >
                {iconFor(item.to)}
                <span className="text-[10.5px] font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center w-full h-full gap-0.5 text-ink-3 hover:text-ink"
            >
              <MoreHorizontal className="size-5" />
              <span className="text-[10.5px] font-medium">More</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Mobile "More" drawer */}
      {moreOpen && (
        <MobileMoreSheet
          overflow={overflow}
          kindLabel={kindLabel}
          onClose={() => setMoreOpen(false)}
        />
      )}
    </div>
  );
}

/** Pick a sensible icon for the bottom-tab nav based on the route. */
function iconFor(to: string) {
  if (to.includes('listings') || to.includes('products')) return <Package className="size-5" />;
  if (to.includes('promotions') || to.includes('promo')) return <Tag className="size-5" />;
  if (to.includes('store')) return <StoreIcon className="size-5" />;
  if (to.includes('brands')) return <Tags className="size-5" />;
  return <LayoutDashboard className="size-5" />;
}

function MobileMoreSheet({
  overflow,
  kindLabel,
  onClose,
}: {
  overflow: NavItem[];
  kindLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/40 backdrop-blur-sm md:hidden">
      <button type="button" aria-label="Close" className="flex-1" onClick={onClose} />
      <div className="bg-bg rounded-t-2xl border-t border-line shadow-lg max-h-[80vh] flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b border-line">
          <Mark size="sm" kicker={kindLabel} />
          <button
            aria-label="Close"
            onClick={onClose}
            className="-m-2 p-2 text-ink-2 hover:bg-bg-3 rounded-md"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {overflow.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end ?? false}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'block px-3 py-3 rounded-md text-[14px]',
                  isActive ? 'bg-accent-soft text-accent font-semibold' : 'text-ink-2 hover:bg-bg-3',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="border-t border-line p-4">
          <AccountsPanel onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}

// Suppress unused imports kept for prop parity / future use.
void Menu;
