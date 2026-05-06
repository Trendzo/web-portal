import { AdminShell, type SidebarGroup } from '@/components/shell/AdminShell';
import { RoleGate } from '@/components/shell/RoleGate';

/**
 * Admin sidebar groups. Architecture is built to scale — when a new admin domain ships
 * (disputes, payouts, config, audit, support tickets, etc.) it lands as a new group +
 * items here, and a route in `routes/router.tsx`. Nothing else needs to change.
 */
const GROUPS: SidebarGroup[] = [
  {
    label: 'Operations',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', end: true },
      { to: '/admin/retailers', label: 'Retailers', end: true },
      { to: '/admin/stores', label: 'Storefronts', end: true },
    ],
  },
  {
    label: 'Promotions',
    items: [
      { to: '/admin/promotions', label: 'Promotions', end: false },
      { to: '/admin/clubbing', label: 'Clubbing matrix', end: true },
      { to: '/admin/promotion-preview', label: 'Pricing simulator', end: true },
    ],
  },
  {
    label: 'Loyalty',
    items: [
      { to: '/admin/loyalty', label: 'Loyalty config', end: true },
      { to: '/admin/consumers', label: 'Consumer balances', end: false },
    ],
  },
  {
    label: 'Curation',
    items: [
      { to: '/admin/collections', label: 'Collections', end: false },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/admin/categories', label: 'Categories', end: true },
      { to: '/admin/brands', label: 'Brands', end: true },
    ],
  },
];

export default function AdminLayout() {
  return (
    <RoleGate kind="admin">
      <AdminShell kindLabel="Admin" groups={GROUPS} />
    </RoleGate>
  );
}
