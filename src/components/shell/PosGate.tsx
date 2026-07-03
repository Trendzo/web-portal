import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RetailerProfile, Store } from '@/lib/types';

type MeResponse = { retailer: RetailerProfile; store: Store | null };

/**
 * Guards the offline-POS surface behind the per-retailer opt-in. Server-side is authoritative
 * (every POS endpoint 403s when disabled); this is the client mirror so a bookmarked or
 * deep-linked `/retailer/pos/*` URL never renders a functioning register. Reuses the shared
 * `['retailer','me']` query (React Query dedups with the layout/dashboard fetch).
 */
export function PosGate({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<MeResponse>('/retailer/me'),
  });

  // Wait for the snapshot before deciding — avoids bouncing on first paint.
  if (isLoading) return null;
  if (!data?.store?.posBillingEnabled) {
    return <Navigate to="/retailer/dashboard" replace />;
  }
  return <>{children}</>;
}
