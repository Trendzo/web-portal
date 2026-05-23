import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ComplianceResponse, ComplianceMetric, ComplianceMetricKey } from '@/lib/compliance-floors';

const POLL_MS = 5 * 60 * 1000;

const LABELS: Record<ComplianceMetricKey, string> = {
  acceptance: 'Acceptance rate',
  fulfilment: 'Fulfilment rate',
  disputeRate: 'Dispute rate',
  returnRate: 'Return rate',
};

/**
 * Polls /retailer/reports/compliance every 5 minutes. If any metric verdict is
 * `breach` (or `warning`) we render a banner so the retailer can act before
 * admin escalates. Mounted in the retailer layout; silently no-ops for
 * non-retailer sessions and while the query is loading.
 */
export function ComplianceFloorBanner() {
  const isRetailer = useAuth((s) => s.session?.kind === 'retailer');

  const { data } = useQuery({
    queryKey: ['retailer', 'reports', 'compliance', 'banner'],
    queryFn: () => api<ComplianceResponse>('/retailer/reports/compliance'),
    enabled: isRetailer,
    refetchInterval: POLL_MS,
    staleTime: POLL_MS,
  });

  if (!data) return null;

  const offenders = (Object.entries(data.metrics) as [ComplianceMetricKey, ComplianceMetric][])
    .filter(([, m]) => m.verdict !== 'ok');
  if (offenders.length === 0) return null;

  const anyBreach = offenders.some(([, m]) => m.verdict === 'breach');
  const tone = anyBreach
    ? 'border-danger/40 bg-danger/10 text-danger'
    : 'border-warning/40 bg-warning/10 text-warning';

  return (
    <div className={`px-4 py-2 text-[12.5px] border-b ${tone}`} role="alert">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span className="font-medium">
          {anyBreach ? 'Performance floor breached' : 'Approaching performance floor'}:
        </span>
        <span>
          {offenders.map(([key, m]) => `${LABELS[key]} ${(m.valueBp / 100).toFixed(1)}%`).join(' · ')}
        </span>
        <Link
          to="/retailer/reports/compliance"
          className="ml-auto underline underline-offset-2 hover:opacity-80"
        >
          Review
        </Link>
      </div>
    </div>
  );
}
