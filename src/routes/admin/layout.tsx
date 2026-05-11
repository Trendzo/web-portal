import {
  AlertTriangle,
  Award,
  BarChart3,
  Coins,
  FileSearch,
  FileText,
  Folder,
  GanttChart,
  Inbox,
  Layers,
  LayoutDashboard,
  MessageSquare,
  PackageX,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Users,
  UserX,
  Wallet,
  Zap,
} from 'lucide-react';
import { SidebarShell, type SidebarGroup } from '@/components/shell/SidebarShell';
import { RoleGate } from '@/components/shell/RoleGate';
import { ImpersonationBanner } from '@/components/shell/ImpersonationBanner';
import { useAdminBanners } from '@/lib/banner-triggers';

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
      { to: '/admin/applications', label: 'Applications', end: true, icon: Inbox },
      { to: '/admin/retailers', label: 'Retailers', end: true, icon: Users },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { to: '/admin/compliance', label: 'Compliance queue', end: true, icon: ShieldCheck },
      { to: '/admin/policy-enforcement', label: 'Policy enforcement', end: true, icon: ShieldAlert },
      { to: '/admin/data-exports', label: 'Data exports', end: true, icon: FileSearch },
      { to: '/admin/account-deletions', label: 'Account deletions', end: true, icon: UserX },
    ],
  },
  {
    label: 'Identity',
    items: [
      { to: '/admin/admins', label: 'Admin team', end: true, icon: ShieldCheck },
      { to: '/admin/sub-roles', label: 'Sub-roles', end: true, icon: GanttChart },
    ],
  },
  {
    label: 'Orders',
    items: [
      { to: '/admin/orders', label: 'All orders', end: true, icon: Receipt },
      { to: '/admin/orders/new', label: 'Place test order', end: true, icon: Sparkles },
      { to: '/admin/refund-reconciliation', label: 'Refund reconciliation', end: true, icon: Coins },
      { to: '/admin/post-payout-recovery', label: 'Post-payout recovery', end: true, icon: Coins },
      { to: '/admin/held-items', label: 'Held items', end: true, icon: PackageX },
      { to: '/admin/issues', label: 'Issues', end: false, icon: AlertTriangle },
      { to: '/admin/delivery-windows', label: 'Delivery windows', end: true, icon: GanttChart },
    ],
  },
  {
    label: 'Settlement',
    items: [
      { to: '/admin/billing-console', label: 'Billing console', end: true, icon: Wallet },
      { to: '/admin/payouts-pipeline', label: 'Payouts pipeline', end: true, icon: GanttChart },
      { to: '/admin/early-disbursement-decisions', label: 'Early disbursement', end: true, icon: Zap },
      { to: '/admin/tail-of-cycle', label: 'Tail of cycle', end: true, icon: Coins },
      { to: '/admin/invoice-numbering', label: 'Invoice numbering', end: true, icon: FileText },
      { to: '/admin/gst-returns', label: 'GST returns', end: true, icon: FileText },
    ],
  },
  {
    label: 'Promotions',
    items: [
      { to: '/admin/promotions', label: 'Promotions', end: false, icon: Tag },
      { to: '/admin/targeted-drops', label: 'Targeted drops', end: true, icon: Sparkles },
      { to: '/admin/clubbing', label: 'Clubbing matrix', end: true, icon: Layers },
      { to: '/admin/promotion-preview', label: 'Pricing simulator', end: true, icon: Zap },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/admin/fees', label: 'Fees & charges', end: true, icon: Coins },
      { to: '/admin/payment-reconciliation', label: 'Payment reconciliation', end: true, icon: GanttChart },
      { to: '/admin/payment-failures', label: 'Payment failures', end: true, icon: ShieldAlert },
      { to: '/admin/wallet-payouts', label: 'Wallet payouts', end: true, icon: Coins },
    ],
  },
  {
    label: 'Customers',
    items: [
      { to: '/admin/loyalty', label: 'Loyalty config', end: true, icon: Award },
      { to: '/admin/consumers', label: 'Consumers', end: false, icon: Users },
      { to: '/admin/community-moderation', label: 'Community moderation', end: true, icon: MessageSquare },
      { to: '/admin/reviews-moderation', label: 'Reviews moderation', end: true, icon: Star },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/admin/reports/leaderboard', label: 'Leaderboard', end: true, icon: BarChart3 },
      { to: '/admin/reports/funnel', label: 'Funnel', end: true, icon: BarChart3 },
      { to: '/admin/reports/feature-usage', label: 'Feature usage', end: true, icon: BarChart3 },
      { to: '/admin/reports/operational', label: 'Operational', end: true, icon: BarChart3 },
      { to: '/admin/reports/compliance', label: 'Floor breaches', end: true, icon: ShieldAlert },
    ],
  },
  {
    label: 'Inbox',
    items: [
      { to: '/admin/inbox', label: 'Notifications', end: true, icon: Inbox },
    ],
  },
  {
    label: 'Curation',
    items: [
      { to: '/admin/collections', label: 'Featured Selections', end: false, icon: Folder },
      { to: '/admin/catalog-moderation', label: 'Catalog moderation', end: true, icon: ShieldAlert },
    ],
  },
];

export default function AdminLayout() {
  useAdminBanners();
  return (
    <RoleGate kind="admin">
      <ImpersonationBanner />
      <SidebarShell
        kindLabel="Admin"
        groups={GROUPS}
        searchHint="Search retailers, stores, promos…"
      />
    </RoleGate>
  );
}
