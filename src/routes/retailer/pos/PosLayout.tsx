import { NavLink, Outlet } from 'react-router-dom';
import { usePermission } from '@/lib/use-permission';
import { cn } from '@/lib/cn';

/**
 * POS shell. Renders inside the retailer dashboard sidebar (see router: /retailer/pos)
 * so the cashier keeps quick navigation to the rest of the workspace. Every POS surface
 * (register, sales, held bills, day summary, labels) lives here as an internal tab, so the
 * dashboard sidebar carries just one "Register" entry.
 */
const TABS = [
  { to: '/retailer/pos', label: 'Register', end: true, action: 'pos.sell' },
  { to: '/retailer/pos/sales', label: 'Sales', end: false, action: 'pos.view' },
  { to: '/retailer/pos/held', label: 'Held bills', end: true, action: 'pos.sell' },
  { to: '/retailer/pos/day-summary', label: 'Day summary', end: true, action: 'pos.view' },
  { to: '/retailer/pos/labels', label: 'Labels', end: true, action: 'pos.labels' },
] as const;

export default function PosLayout() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-2/40">
      <nav className="sticky top-0 z-10 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-bg/95 px-4 py-2 backdrop-blur">
        {TABS.map((t) => (
          <PosTab key={t.to} to={t.to} end={t.end} action={t.action} label={t.label} />
        ))}
      </nav>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

function PosTab({ to, end, action, label }: { to: string; end: boolean; action: string; label: string }) {
  const allowed = usePermission(action);
  if (!allowed) return null;
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
          isActive ? 'bg-ink text-bg' : 'text-ink-3 hover:bg-bg-3 hover:text-ink',
        )
      }
    >
      {label}
    </NavLink>
  );
}
