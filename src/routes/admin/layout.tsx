import {
  Award,
  Boxes,
  Building2,
  Coins,
  Folder,
  Layers,
  LayoutDashboard,
  Package,
  PackageX,
  Receipt,
  Sparkles,
  Tag,
  Users,
  Zap,
} from 'lucide-react';
import { SidebarShell, type SidebarGroup } from '@/components/shell/SidebarShell';
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
      { to: '/admin/dashboard', label: 'Dashboard', end: true, icon: LayoutDashboard },
      { to: '/admin/retailers', label: 'Retailers', end: true, icon: Users },
      { to: '/admin/stores', label: 'Storefronts', end: true, icon: Building2 },
    ],
  },
  {
    label: 'Orders',
    items: [
      { to: '/admin/orders', label: 'All orders', end: true, icon: Receipt },
      { to: '/admin/orders/new', label: 'Place test order', end: true, icon: Sparkles },
      { to: '/admin/refunds', label: 'Refunds', end: true, icon: Coins },
      { to: '/admin/held-items', label: 'Held items', end: true, icon: PackageX },
    ],
  },
  {
    label: 'Promotions',
    items: [
      { to: '/admin/promotions', label: 'Promotions', end: false, icon: Tag },
      { to: '/admin/clubbing', label: 'Clubbing matrix', end: true, icon: Layers },
      { to: '/admin/promotion-preview', label: 'Pricing simulator', end: true, icon: Zap },
    ],
  },
  {
    label: 'Loyalty',
    items: [
      { to: '/admin/loyalty', label: 'Loyalty config', end: true, icon: Award },
      { to: '/admin/consumers', label: 'Consumer balances', end: false, icon: Users },
    ],
  },
  {
    label: 'Curation',
    items: [
      { to: '/admin/collections', label: 'Collections', end: false, icon: Folder },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/admin/categories', label: 'Categories', end: true, icon: Boxes },
      { to: '/admin/brands', label: 'Brands', end: true, icon: Package },
    ],
  },
];

export default function AdminLayout() {
  return (
    <RoleGate kind="admin">
      <SidebarShell
        kindLabel="Admin"
        groups={GROUPS}
        searchHint="Search retailers, stores, promos…"
      />
    </RoleGate>
  );
}
