import { useParams } from 'react-router-dom';
import { useAuth } from './auth';

/**
 * Reports work in two modes:
 *   - retailer session viewing own reports → `/retailer/reports/...`
 *   - admin session drilling into a store → `/admin/stores/:storeId/reports/...`
 *
 * Pages call this hook once and use `basePath` to build all API paths,
 * so a single page component serves both modes.
 */
export type StoreScope = {
  scope: 'retailer' | 'admin';
  storeId?: string;
  basePath: string;
};

export function useStoreScope(): StoreScope {
  const session = useAuth((s) => s.session);
  const params = useParams<{ storeId?: string }>();

  if (session?.kind === 'admin' && params.storeId) {
    return {
      scope: 'admin',
      storeId: params.storeId,
      basePath: `/admin/stores/${params.storeId}/reports`,
    };
  }
  return {
    scope: 'retailer',
    basePath: '/retailer/reports',
  };
}
