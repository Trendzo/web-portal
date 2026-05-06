import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppShell } from '@/components/shell/AppShell';
import { RoleGate } from '@/components/shell/RoleGate';
import type { RetailerProfile, Store } from '@/lib/types';

type MeResponse = { retailer: RetailerProfile; store: Store | null };

/**
 * Storefront is in the main nav while the retailer still needs to act on it (pre-
 * submission and during admin review). Once the store is approved, it falls out of
 * the daily workflow — the retailer mostly cares about Products + Overview from
 * then on. We surface "View storefront" as a quick action on the Overview page so
 * it's always one click away when needed, just not cluttering the chrome.
 */
function buildNav(store: Store | null) {
  const showStorefront = !store || store.status !== 'active';
  return [
    { to: '/retailer/dashboard', label: 'Overview', end: true },
    ...(showStorefront ? [{ to: '/retailer/store', label: 'Storefront', end: true }] : []),
    { to: '/retailer/listings', label: 'Products', end: false },
    { to: '/retailer/promotions', label: 'Promotions', end: false },
    { to: '/retailer/brands', label: 'Brands', end: true },
  ];
}

export default function RetailerLayout() {
  // Reuses the same query key as dashboard.tsx — React Query dedups, so this adds
  // no extra network round-trip when both are mounted.
  const { data } = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<MeResponse>('/retailer/me'),
  });
  const nav = useMemo(() => buildNav(data?.store ?? null), [data?.store]);

  return (
    <RoleGate kind="retailer">
      <AppShell kindLabel="Retailer" nav={nav} />
    </RoleGate>
  );
}
