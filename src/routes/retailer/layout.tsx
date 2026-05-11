import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, Bell, Building2, CalendarDays, FileText, Inbox, LayoutDashboard, Package, PackageX, Pencil, Receipt, ShieldCheck, Sparkles, SlidersHorizontal, Tag, Users, Wallet, Warehouse, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { SidebarShell, type SidebarGroup } from '@/components/shell/SidebarShell';
import { RoleGate } from '@/components/shell/RoleGate';
import { AiQuotaChip } from '@/components/shell/AiQuotaChip';
import { useRetailerBanners } from '@/lib/banner-triggers';
import type { RetailerProfile, Store } from '@/lib/types';

type MeResponse = { retailer: RetailerProfile; store: Store | null };

/**
 * Storefront sits in the sidebar while the retailer still needs to act on it
 * (pre-submission and during admin review). Once the store is approved, it
 * falls out of the daily workflow and we hide it — "View storefront" remains
 * one click away from the Overview page when needed.
 *
 * Brands link is hidden from the sidebar — retailers reach the brand library
 * inline from the New Listing wizard. Route is still registered for that path.
 */
function buildGroups(store: Store | null): SidebarGroup[] {
  const showStorefront = !store || store.status !== 'active';
  const showOrders = store && store.status === 'active';
  return [
    {
      label: 'Workspace',
      items: [
        { to: '/retailer/dashboard', label: 'Overview', end: true, icon: LayoutDashboard },
        ...(showStorefront ? [{ to: '/retailer/store', label: 'Storefront', end: true, icon: Building2 }] : []),
      ],
    },
    ...(showOrders
      ? [
          {
            label: 'Orders',
            items: [
              { to: '/retailer/orders', label: 'Orders', end: false, icon: Receipt },
              { to: '/retailer/returns', label: 'Returns', end: true, icon: PackageX },
              { to: '/retailer/held-items', label: 'Held items', end: true, icon: PackageX },
              { to: '/retailer/issues', label: 'Issues', end: true, icon: AlertTriangle },
            ],
          },
        ]
      : []),
    {
      label: 'Catalog',
      items: [
        { to: '/retailer/listings', label: 'Products', end: false, icon: Package },
        { to: '/retailer/inventory', label: 'Inventory', end: true, icon: Warehouse },
        { to: '/retailer/pricing', label: 'Pricing', end: true, icon: Tag },
        { to: '/retailer/attribute-templates', label: 'Attribute templates', end: false, icon: SlidersHorizontal },
        { to: '/retailer/ai-catalog', label: 'AI catalog', end: false, icon: Sparkles },
      ],
    },
    {
      label: 'Marketing',
      items: [
        { to: '/retailer/promotions', label: 'Promotions', end: false, icon: Tag },
        { to: '/retailer/voucher-batch', label: 'Voucher batches', end: true, icon: Tag },
      ],
    },
    {
      label: 'Finance',
      items: [
        { to: '/retailer/fees', label: 'Fees', end: true, icon: Tag },
        { to: '/retailer/tax-invoices', label: 'Tax invoices', end: true, icon: FileText },
        { to: '/retailer/commission-invoices', label: 'Commission invoices', end: true, icon: FileText },
        { to: '/retailer/billing-statements', label: 'Billing statements', end: true, icon: Receipt },
        { to: '/retailer/payouts', label: 'Payouts', end: true, icon: Wallet },
        { to: '/retailer/early-disbursement', label: 'Early disbursement', end: true, icon: Zap },
      ],
    },
    {
      label: 'Reports',
      items: [
        { to: '/retailer/reports/sales', label: 'Sales', end: true, icon: BarChart3 },
        { to: '/retailer/reports/performance', label: 'Performance', end: true, icon: BarChart3 },
        { to: '/retailer/reports/returns', label: 'Returns', end: true, icon: BarChart3 },
        { to: '/retailer/reports/inventory-health', label: 'Inventory health', end: true, icon: BarChart3 },
      ],
    },
    {
      label: 'Workspace tools',
      items: [
        { to: '/retailer/inbox', label: 'Inbox', end: true, icon: Inbox },
        { to: '/retailer/notification-prefs', label: 'Notifications', end: true, icon: Bell },
        { to: '/retailer/holiday-calendar', label: 'Holiday calendar', end: true, icon: CalendarDays },
      ],
    },
    {
      label: 'Compliance',
      items: [
        { to: '/retailer/kyc', label: 'KYC', end: true, icon: ShieldCheck },
        { to: '/retailer/change-requests', label: 'Change requests', end: true, icon: Pencil },
      ],
    },
    {
      label: 'Team',
      items: [
        { to: '/retailer/staff', label: 'Staff', end: true, icon: Users },
      ],
    },
  ];
}

export default function RetailerLayout() {
  // Reuses the same query key as dashboard.tsx — React Query dedups, so this adds
  // no extra network round-trip when both are mounted.
  const { data } = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<MeResponse>('/retailer/me'),
  });
  const groups = useMemo(() => buildGroups(data?.store ?? null), [data?.store]);
  useRetailerBanners();

  return (
    <RoleGate kind="retailer">
      <SidebarShell
        kindLabel="Retailer"
        groups={groups}
        searchHint="Search products, promos…"
        sidebarFooter={AiQuotaChip}
      />
    </RoleGate>
  );
}
