import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, Bell, Building2, CalendarDays, FileText, Inbox, LayoutDashboard, Package, PackageX, Pencil, Receipt, ShieldCheck, Sparkles, SlidersHorizontal, Tag, Users, Wallet, Warehouse, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import {
  SidebarShell,
  filterSidebarGroups,
  type SidebarGroup,
} from '@/components/shell/SidebarShell';
import { RoleGate } from '@/components/shell/RoleGate';
import { AiQuotaChip } from '@/components/shell/AiQuotaChip';
import { ImpersonationBanner } from '@/components/shell/ImpersonationBanner';
import { ComplianceFloorBanner } from '@/components/shell/ComplianceFloorBanner';
import { useRetailerBanners } from '@/lib/banner-triggers';
import { useAuth } from '@/lib/auth';
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
  const showOrders = store && (store.status === 'active' || store.status === 'paused');
  return [
    {
      label: 'Workspace',
      items: [
        { to: '/retailer/dashboard', label: 'Overview', end: true, icon: LayoutDashboard },
        { to: '/retailer/store', label: showStorefront ? 'Storefront' : 'Store settings', end: true, icon: Building2, action: 'store.view_profile' },
      ],
    },
    ...(showOrders
      ? [
          {
            label: 'Orders',
            items: [
              { to: '/retailer/orders', label: 'Orders', end: false, icon: Receipt, action: 'orders.view' },
              { to: '/retailer/returns', label: 'Returns', end: true, icon: PackageX, action: 'returns.view' },
              { to: '/retailer/held-items', label: 'Held items', end: true, icon: PackageX, action: 'held_items.view' },
              { to: '/retailer/issues', label: 'Issues', end: true, icon: AlertTriangle, action: 'disputes.view' },
            ],
          },
        ]
      : []),
    {
      label: 'Catalog',
      items: [
        { to: '/retailer/listings', label: 'Products', end: false, icon: Package, action: 'listings.view' },
        { to: '/retailer/inventory', label: 'Inventory', end: true, icon: Warehouse, action: 'inventory.view' },
        { to: '/retailer/pricing', label: 'Pricing', end: true, icon: Tag, action: 'listings.view' },
        { to: '/retailer/attribute-templates', label: 'Attribute templates', end: false, icon: SlidersHorizontal, action: 'attribute_templates.view' },
        { to: '/retailer/ai-catalog', label: 'AI catalog', end: false, icon: Sparkles, action: 'ai_catalog.generate' },
      ],
    },
    {
      label: 'Marketing',
      items: [
        { to: '/retailer/promotions', label: 'Promotions', end: false, icon: Tag, action: 'promotions.view' },
        { to: '/retailer/voucher-batch', label: 'Voucher batches', end: true, icon: Tag, action: 'vouchers.view' },
      ],
    },
    {
      label: 'Finance',
      items: [
        { to: '/retailer/fees', label: 'Fees', end: true, icon: Tag, action: 'fees.view' },
        { to: '/retailer/tax-invoices', label: 'Tax invoices', end: true, icon: FileText, action: 'invoicing.view' },
        { to: '/retailer/commission-invoices', label: 'Commission invoices', end: true, icon: FileText, action: 'invoicing.view' },
        { to: '/retailer/billing-statements', label: 'Billing statements', end: true, icon: Receipt, action: 'invoicing.view' },
        { to: '/retailer/payouts', label: 'Payouts', end: true, icon: Wallet, action: 'payouts.view' },
        { to: '/retailer/payouts/upcoming', label: 'Upcoming payout', end: true, icon: Wallet, action: 'payouts.view' },
        { to: '/retailer/early-disbursement', label: 'Early disbursement', end: true, icon: Zap, action: 'early_disbursement.request' },
      ],
    },
    {
      label: 'Reports',
      items: [
        { to: '/retailer/reports/sales-detailed', label: 'Sales detail', end: true, icon: BarChart3, action: 'reports.view' },
        { to: '/retailer/reports/revenue-summary', label: 'Revenue summary', end: true, icon: BarChart3, action: 'reports.view' },
        { to: '/retailer/reports/listings/revenue', label: 'Listing revenue', end: true, icon: BarChart3, action: 'reports.view' },
        { to: '/retailer/reports/listings/conversion', label: 'Variant conversion', end: true, icon: BarChart3, action: 'reports.view' },
        { to: '/retailer/reports/listings/best-sellers', label: 'Best sellers', end: true, icon: BarChart3, action: 'reports.view' },
        { to: '/retailer/reports/listings/dead-stock', label: 'Dead stock', end: true, icon: BarChart3, action: 'reports.view' },
        { to: '/retailer/reports/returns/top-listings', label: 'Top returns', end: true, icon: BarChart3, action: 'reports.view' },
        { to: '/retailer/reports/compliance', label: 'Compliance', end: true, icon: BarChart3, action: 'reports.view' },
        { to: '/retailer/reports/payouts/cycles', label: 'Payout cycles', end: true, icon: BarChart3, action: 'reports.view' },
        { to: '/retailer/reports/sales', label: 'Sales (legacy)', end: true, icon: BarChart3, action: 'reports.view' },
        { to: '/retailer/reports/performance', label: 'Performance (legacy)', end: true, icon: BarChart3, action: 'reports.view' },
        { to: '/retailer/reports/returns', label: 'Returns (legacy)', end: true, icon: BarChart3, action: 'reports.view' },
        { to: '/retailer/reports/inventory-health', label: 'Inventory health (legacy)', end: true, icon: BarChart3, action: 'reports.view' },
      ],
    },
    {
      label: 'Workspace tools',
      items: [
        { to: '/retailer/inbox', label: 'Inbox', end: true, icon: Inbox, action: 'notifications.read' },
        { to: '/retailer/notification-prefs', label: 'Notifications', end: true, icon: Bell, action: 'notifications.read' },
        { to: '/retailer/holiday-calendar', label: 'Holiday calendar', end: true, icon: CalendarDays, action: 'store.holidays_edit' },
        { to: '/retailer/pickup-slots', label: 'Pickup slots', end: true, icon: CalendarDays, action: 'store.edit_profile' },
      ],
    },
    {
      label: 'Compliance',
      items: [
        { to: '/retailer/kyc', label: 'KYC', end: true, icon: ShieldCheck, action: 'compliance.view' },
        { to: '/retailer/change-requests', label: 'Change requests', end: true, icon: Pencil, action: 'change_requests.view' },
      ],
    },
    {
      label: 'Team',
      items: [
        { to: '/retailer/staff', label: 'Staff', end: true, icon: Users, action: 'staff.list' },
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
  const permissions = useAuth((s) =>
    s.session?.kind === 'retailer' ? s.session.permissions : undefined,
  );
  const setPermissions = useAuth((s) => s.setPermissions);
  // Re-fetch permissions on every layout mount so admin sub-role matrix edits
  // take effect on the next nav without forcing a fresh sign-in. Login flow
  // hydrates these once; this query keeps them current with a 5-minute stale
  // window so we don't hammer the endpoint on tab switches.
  useQuery({
    queryKey: ['retailer', 'me', 'permissions'],
    queryFn: async () => {
      const res = await api<{ permissions: Record<string, boolean> }>('/retailer/me/permissions');
      setPermissions(res.permissions);
      return res.permissions;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });
  const groups = useMemo(() => {
    const built = buildGroups(data?.store ?? null);
    return filterSidebarGroups(built, permissions);
  }, [data?.store, permissions]);
  useRetailerBanners();

  return (
    <RoleGate kind="retailer">
      <ImpersonationBanner />
      <ComplianceFloorBanner />
      <SidebarShell
        kindLabel="Retailer"
        groups={groups}
        searchHint="Search products, promos…"
        sidebarFooter={AiQuotaChip}
      />
    </RoleGate>
  );
}
