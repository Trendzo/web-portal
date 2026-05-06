import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
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
  /** Reserved for prop parity with AppShell. */
  bylineExtras?: ReactNode[];
};

/**
 * Admin shell — masthead + persistent left sidebar with grouped navigation.
 * The grouped sidebar is the deliberate growth path: new admin domains land as new
 * sidebar items, no layout surgery required. Only built items are listed; placeholders
 * for unbuilt features are intentionally absent.
 */
export function AdminShell({ kindLabel, groups }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-col bg-paper">
      {/* Masthead */}
      <header className="border-b border-ink/80 bg-paper">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-6 px-5 py-4 sm:px-8">
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

      {/* Sidebar + main */}
      <div className="mx-auto flex w-full max-w-[1480px] flex-1 min-h-0">
        <aside className="hidden lg:block w-[240px] shrink-0 border-r border-rule bg-paper">
          <SidebarBody groups={groups} />
        </aside>

        <main className="flex-1 min-w-0 min-h-0">
          <Outlet />
        </main>
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
    <nav className="sticky top-0 max-h-screen overflow-y-auto px-5 py-7 space-y-6">
      {groups.map((group) => (
        <SidebarGroupSection key={group.label} group={group} />
      ))}
    </nav>
  );
}

function SidebarGroupSection({ group }: { group: SidebarGroup }) {
  return (
    <div>
      <div className="kicker mb-2 text-ink-3">{group.label}</div>
      <ul className="space-y-0.5">
        {group.items.map((item) => (
          <li key={item.to}>
            <SidebarItemRow item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidebarItemRow({ item }: { item: SidebarItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end ?? false}
      className={({ isActive }) =>
        cn(
          'flex items-baseline rounded-xs px-2 py-1.5 transition-colors press',
          isActive
            ? 'text-ink bg-paper-2/60'
            : 'text-ink-2 hover:text-ink hover:bg-paper-2/40',
        )
      }
    >
      {({ isActive }) => (
        <span
          className={cn(
            'font-display italic text-[16px] leading-none',
            isActive && 'underline decoration-ink decoration-1 underline-offset-[5px]',
          )}
        >
          {item.label}
        </span>
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
    <div className="fixed inset-0 z-50 flex flex-col bg-paper px-5 py-5 lg:hidden">
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
      <div className="mt-8 flex-1 overflow-y-auto space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="kicker mb-2 text-ink-3">{group.label}</div>
            <ul>
              {group.items.map((item) => (
                <li key={item.to} className="border-b border-rule">
                  <NavLink
                    to={item.to}
                    end={item.end ?? false}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'block py-3 font-display italic text-[22px]',
                        isActive ? 'text-ink' : 'text-ink-2',
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
      <div className="border-t border-rule pt-5">
        <AccountsPanel onNavigate={onClose} />
      </div>
    </div>
  );
}
