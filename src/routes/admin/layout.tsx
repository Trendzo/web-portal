import {
  AlertTriangle,
  Award,
  BarChart3,
  Building2,
  Coins,
  FileEdit,
  FileSearch,
  FileText,
  Folder,
  GanttChart,
  Inbox,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Package,
  PackageX,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Star,
  Tag,
  UserPlus,
  Users,
  UserX,
  Wallet,
  Zap,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  SidebarShell,
  filterSidebarGroups,
  type SidebarGroup,
} from '@/components/shell/SidebarShell';
import { RoleGate } from '@/components/shell/RoleGate';
import { api } from '@/lib/api';
import { useAdminBanners } from '@/lib/banner-triggers';
import { useAuth } from '@/lib/auth';

/**
 * Admin sidebar groups. Architecture is built to scale — when a new admin domain ships
 * (compliance, payouts, config, audit, support tickets, etc.) it lands as a new group +
 * items here, and a route in `routes/router.tsx`. Nothing else needs to change.
 *
 * Notes on entries that look "missing":
 * - Storefronts is folded into Retailers (single queue with status filter); store
 *   detail nests under retailer detail.
 * - Brands and Categories are catalog infrastructure listings depend on. They live at
 *   /admin/catalog/{brands,categories} and are reached by direct link from listing
 *   surfaces — not via sidebar.
 */
const GROUPS: SidebarGroup[] = [
  {
    label: 'Operations',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', end: true, icon: LayoutDashboard },
      { to: '/admin/applications', label: 'Applications', end: true, icon: Inbox, action: 'applications.view' },
      { to: '/admin/retailers', label: 'Retailers', end: true, icon: Users, action: 'applications.view' },
      { to: '/admin/stores', label: 'Stores', end: true, icon: Building2, action: 'store_management.view' },
      { to: '/admin/retailers/new', label: 'New retailer', end: true, icon: UserPlus, action: 'retailer.approve' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { to: '/admin/compliance', label: 'Compliance queue', end: true, icon: ShieldCheck, action: 'kyc.review' },
      { to: '/admin/change-requests', label: 'Change requests', end: false, icon: FileEdit, action: 'change_requests.view' },
      { to: '/admin/policy-enforcement', label: 'Policy enforcement', end: true, icon: ShieldAlert, action: 'moderation.view' },
      { to: '/admin/data-exports', label: 'Data exports', end: true, icon: FileSearch, action: 'data_exports.manage' },
      { to: '/admin/account-deletions', label: 'Account deletions', end: true, icon: UserX, action: 'account_deletions.manage' },
    ],
  },
  {
    label: 'Identity',
    items: [
      { to: '/admin/admins', label: 'Admin team', end: true, icon: ShieldCheck, action: 'team.list' },
      { to: '/admin/sub-roles', label: 'Sub-roles', end: true, icon: GanttChart, action: 'sub_roles.view' },
    ],
  },
  {
    label: 'Orders',
    items: [
      { to: '/admin/orders', label: 'All orders', end: true, icon: Receipt, action: 'orders.view' },
      { to: '/admin/orders/new', label: 'Place test order', end: true, icon: Sparkles, action: 'simulate.run' },
      { to: '/admin/refund-reconciliation', label: 'Refund reconciliation', end: true, icon: Coins, action: 'refunds.view' },
      { to: '/admin/post-payout-recovery', label: 'Post-payout recovery', end: true, icon: Coins, action: 'post_payout_recovery.manage' },
      { to: '/admin/held-items', label: 'Held items', end: true, icon: PackageX, action: 'held_items.view' },
      { to: '/admin/issues', label: 'Issues', end: false, icon: AlertTriangle, action: 'disputes.view' },
      { to: '/admin/delivery-windows', label: 'Delivery windows', end: true, icon: GanttChart, action: 'platform_config.view' },
    ],
  },
  {
    label: 'Settlement',
    items: [
      { to: '/admin/billing-console', label: 'Billing console', end: true, icon: Wallet, action: 'payouts.view' },
      { to: '/admin/payouts-pipeline', label: 'Payouts pipeline', end: true, icon: GanttChart, action: 'payouts.view' },
      { to: '/admin/payout-holds', label: 'Payout holds', end: true, icon: Wallet, action: 'payouts.hold' },
      { to: '/admin/payout-adjustments', label: 'Payout adjustments', end: true, icon: Wallet, action: 'payouts.hold' },
      { to: '/admin/early-disbursement-decisions', label: 'Early disbursement', end: true, icon: Zap, action: 'early_disbursement.decide' },
      { to: '/admin/tail-of-cycle', label: 'Tail of cycle', end: true, icon: Coins, action: 'payouts.view' },
      { to: '/admin/invoice-ops', label: 'Invoice ops', end: true, icon: FileText, action: 'invoicing.numbering.edit' },
      { to: '/admin/invoice-numbering', label: 'Invoice numbering', end: true, icon: FileText, action: 'invoicing.numbering.edit' },
      { to: '/admin/gst-returns', label: 'GST returns', end: true, icon: FileText, action: 'invoicing.gst_returns.generate' },
    ],
  },
  {
    label: 'Promotions',
    items: [
      { to: '/admin/promotions', label: 'Promotions', end: false, icon: Tag, action: 'promotions.view' },
      { to: '/admin/targeted-drops', label: 'Targeted drops', end: true, icon: Sparkles, action: 'promotions.create' },
      { to: '/admin/clubbing', label: 'Clubbing matrix', end: true, icon: Layers, action: 'clubbing.view' },
      { to: '/admin/promotion-preview', label: 'Pricing simulator', end: true, icon: Zap, action: 'promotions.view' },
      { to: '/admin/platform/delegation-modes', label: 'Feature controls', end: true, icon: Sliders, action: 'platform_config.edit' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/admin/fees', label: 'Fees & charges', end: true, icon: Coins, action: 'platform_config.view' },
      { to: '/admin/payment-reconciliation', label: 'Payment reconciliation', end: true, icon: GanttChart, action: 'refunds.view' },
      { to: '/admin/payment-failures', label: 'Payment failures', end: true, icon: ShieldAlert, action: 'refunds.view' },
      { to: '/admin/wallet-payouts', label: 'Wallet payouts', end: true, icon: Coins, action: 'wallet_payouts.process' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { to: '/admin/loyalty', label: 'Loyalty config', end: true, icon: Award, action: 'loyalty.view' },
      { to: '/admin/consumers', label: 'Consumers', end: false, icon: Users, action: 'consumers.view' },
      { to: '/admin/community-moderation', label: 'Community moderation', end: true, icon: MessageSquare, action: 'community.moderate' },
      { to: '/admin/reviews-moderation', label: 'Reviews moderation', end: true, icon: Star, action: 'moderation.view' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/admin/reports/headline', label: 'Headline', end: true, icon: BarChart3, action: 'reports.view' },
      { to: '/admin/reports/leaderboard', label: 'Leaderboard', end: true, icon: BarChart3, action: 'reports.view' },
      { to: '/admin/reports/funnel', label: 'Funnel', end: true, icon: BarChart3, action: 'reports.view' },
      { to: '/admin/reports/feature-usage', label: 'Feature usage', end: true, icon: BarChart3, action: 'reports.view' },
      { to: '/admin/reports/operational', label: 'Operational', end: true, icon: BarChart3, action: 'reports.view' },
      { to: '/admin/reports/below-floor', label: 'Below floor', end: true, icon: ShieldAlert, action: 'reports.view' },
      { to: '/admin/reports/compliance', label: 'Floor breaches', end: true, icon: ShieldAlert, action: 'reports.view' },
    ],
  },
  {
    label: 'Inbox',
    items: [
      { to: '/admin/inbox', label: 'Notifications', end: true, icon: Inbox },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/admin/listings', label: 'Listings search', end: true, icon: Package, action: 'moderation.view' },
      { to: '/admin/collections', label: 'Featured Selections', end: false, icon: Folder, action: 'moderation.view' },
      { to: '/admin/catalog-moderation', label: 'Catalog moderation', end: true, icon: ShieldAlert, action: 'moderation.decide' },
    ],
  },
];

export default function AdminLayout() {
  useAdminBanners();
  const permissions = useAuth((s) =>
    s.session?.kind === 'admin' ? s.session.permissions : undefined,
  );
  const setPermissions = useAuth((s) => s.setPermissions);
  // Live-refresh perms on mount so sub-role matrix changes take effect on next
  // nav without forcing sign-out / sign-in.
  useQuery({
    queryKey: ['admin', 'me', 'permissions'],
    queryFn: async () => {
      const res = await api<{ permissions: Record<string, boolean> }>('/admin/me/permissions');
      setPermissions(res.permissions);
      return res.permissions;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });
  const visibleGroups = filterSidebarGroups(GROUPS, permissions);
  return (
    <RoleGate kind="admin">
      <SidebarShell
        kindLabel="Admin"
        groups={visibleGroups}
        searchHint="Search retailers, stores, promos…"
      />
    </RoleGate>
  );
}
