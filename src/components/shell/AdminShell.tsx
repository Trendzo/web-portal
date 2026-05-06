import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Menu, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Mark } from '@/components/ui/mark';
import { AccountMenu, AccountsPanel } from './AccountMenu';

export type SidebarItem = {
  to: string;
  label: string;
  end?: boolean;
};

export type SidebarGroup = {
  label: string;
  items: SidebarItem[];
};

type AdminShellProps = {
  kindLabel: string;
  groups: SidebarGroup[];
};

/**
 * Admin shell — fixed left sidebar (240px) + top bar with search-hint + identity menu.
 * Sidebar is always-visible on desktop; on mobile it's a slide-over drawer.
 */
export function AdminShell({ kindLabel, groups }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:w-[240px] lg:shrink-0 border-r border-line bg-bg sticky top-0 max-h-screen">
          <div className="flex items-center px-5 py-4 border-b border-line">
            <NavLink to="/" aria-label="ClosetX home">
              <Mark size="md" kicker={kindLabel} />
            </NavLink>
          </div>
          <SidebarBody groups={groups} />
        </aside>

        {/* Main column */}
        <div className="flex flex-col min-w-0 flex-1">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/90 backdrop-blur-md px-4 sm:px-6">
            <button
              className="lg:hidden -m-2 p-2 text-ink-2 hover:bg-bg-3 rounded-md"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>

            {/* Mobile wordmark — sidebar is hidden, so show brand here */}
            <NavLink to="/" className="lg:hidden" aria-label="ClosetX home">
              <Mark size="sm" />
            </NavLink>

            {/* Search hint — placeholder until cmd-K palette ships */}
            <button
              type="button"
              className={cn(
                'hidden md:flex items-center gap-2 rounded-md border border-line bg-bg-2 ' +
                  'px-3 py-1.5 text-[13px] text-ink-3 hover:bg-bg-3 hover:border-line-2 ' +
                  'transition-colors min-w-[280px]',
              )}
              onClick={() => {/* TODO: command palette */}}
            >
              <Search className="size-3.5 text-ink-4" />
              <span className="flex-1 text-left">Search retailers, stores, promos…</span>
              <kbd className="kbd">/</kbd>
            </button>

            <div className="ml-auto flex items-center gap-3">
              <AccountMenu />
            </div>
          </header>

          <main className="flex-1 min-h-0">
            <Outlet />
          </main>
        </div>
      </div>

      {mobileOpen && (
        <MobileDrawer
          groups={groups}
          kindLabel={kindLabel}
          onClose={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
}

function SidebarBody({ groups }: { groups: SidebarGroup[] }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="kicker px-2 mb-1.5">{group.label}</div>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <SidebarItemRow item={item} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarItemRow({ item }: { item: SidebarItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end ?? false}
      className={({ isActive }) =>
        cn(
          'flex items-center px-2 py-1.5 rounded-md text-[13px] font-medium transition-colors press relative',
          isActive
            ? 'bg-accent-soft text-accent'
            : 'text-ink-2 hover:bg-bg-3 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden
              className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent"
            />
          )}
          <span className="ml-1.5">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function MobileDrawer({
  groups,
  kindLabel,
  onClose,
}: {
  groups: SidebarGroup[];
  kindLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex bg-ink/40 backdrop-blur-sm lg:hidden">
      <div className="flex w-72 max-w-[85vw] flex-col bg-bg border-r border-line shadow-lg">
        <div className="flex items-start justify-between px-5 py-4 border-b border-line">
          <Mark size="md" kicker={kindLabel} />
          <button
            aria-label="Close"
            onClick={onClose}
            className="-m-2 p-2 text-ink-2 hover:bg-bg-3 rounded-md"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="kicker px-2 mb-1.5">{group.label}</div>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end ?? false}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'block px-2 py-2 rounded-md text-[14px]',
                          isActive ? 'bg-accent-soft text-accent font-semibold' : 'text-ink-2',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-line p-4">
          <AccountsPanel onNavigate={onClose} />
        </div>
      </div>
      <button
        type="button"
        aria-label="Close menu"
        className="flex-1"
        onClick={onClose}
      />
    </div>
  );
}
