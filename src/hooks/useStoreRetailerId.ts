import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Reliable retailer (owner-account) id for a store — for building
 * `/admin/retailers/:retailerId/...` links from any store-scoped admin page.
 *
 * The route `:id` segment is NOT trustworthy: some entry points seed it with the
 * store's legalEntityId (a human code like `LE_KAUSH_001`) instead of the
 * retailer account id (`ret_…`). Staff/accounts endpoints key on the account id,
 * so a wrong value silently 404s (the bug that broke the store-detail Accounts
 * tab, and the same class of breakage on listings/inventory/etc.).
 *
 * Resolution: trust the route param only when it already looks like a real
 * account id (`ret_…`); otherwise recover the correct id from the store record
 * (`GET /admin/stores/:storeId` → `retailer.id`). The query shares the
 * store-detail cache key, so it's usually already warm — no extra round-trip.
 */
export function useStoreRetailerId(storeId: string | undefined): string | undefined {
  const { id: routeRetailerId } = useParams<{ id: string }>();
  const routeLooksValid = Boolean(routeRetailerId?.startsWith('ret_'));

  const { data } = useQuery({
    queryKey: ['admin', 'stores', storeId],
    queryFn: () => api<{ retailer?: { id: string } | null }>(`/admin/stores/${storeId}`),
    enabled: Boolean(storeId) && !routeLooksValid,
  });

  return routeLooksValid ? routeRetailerId : data?.retailer?.id;
}
