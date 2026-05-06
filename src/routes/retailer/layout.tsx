import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, LayoutDashboard, Package, PackageX, Receipt, Tag, Tags, Warehouse } from 'lucide-react';
import { api } from '@/lib/api';
import { SidebarShell, type SidebarGroup } from '@/components/shell/SidebarShell';
import { RoleGate } from '@/components/shell/RoleGate';
import type { RetailerProfile, Store } from '@/lib/types';

type MeResponse = { retailer: RetailerProfile; store: Store | null };

/**
 * Storefront sits in the sidebar while the retailer still needs to act on it
 * (pre-submission and during admin review). Once the store is approved, it
 * falls out of the daily workflow and we hide it — "View storefront" remains
 * one click away from the Overview page when needed.
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
              { to: '/retailer/held-items', label: 'Held items', end: true, icon: PackageX },
            ],
          },
        ]
      : []),
    {
      label: 'Catalog',
      items: [
        { to: '/retailer/listings', label: 'Products', end: false, icon: Package },
        { to: '/retailer/inventory', label: 'Inventory', end: true, icon: Warehouse },
        { to: '/retailer/brands', label: 'Brands', end: true, icon: Tags },
      ],
    },
    {
      label: 'Marketing',
      items: [
        { to: '/retailer/promotions', label: 'Promotions', end: false, icon: Tag },
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

  return (
    <RoleGate kind="retailer">
      <SidebarShell
        kindLabel="Retailer"
        groups={groups}
        searchHint="Search products, promos…"
      />
    </RoleGate>
  );
}
