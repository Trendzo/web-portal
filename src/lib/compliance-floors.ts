/**
 * Platform compliance floors, mirrored from
 * backend/src/modules/retailer/reports/reports.controller.ts.
 *
 * Used by the retailer floor-breach banner so we can render a warning before
 * polling /compliance again.
 */
export const COMPLIANCE_FLOORS = {
  acceptanceFloorBp: 8000,
  acceptanceWarnBp: 8500,
  fulfilmentFloorBp: 8500,
  fulfilmentWarnBp: 9000,
  disputeCeilBp: 1000,
  disputeWarnBp: 500,
  returnCeilBp: 1500,
  returnWarnBp: 800,
} as const;

export type ComplianceVerdict = 'ok' | 'warning' | 'breach';

export type ComplianceMetricKey = 'acceptance' | 'fulfilment' | 'disputeRate' | 'returnRate';

export type ComplianceMetric = {
  valueBp: number;
  verdict: ComplianceVerdict;
  /** present for acceptance/fulfilment (high-is-good). */
  floorBp?: number;
  warnBp?: number;
  /** present for disputeRate/returnRate (low-is-good). */
  ceilBp?: number;
  /** acceptance: avgAcceptMs; fulfilment: avgEndToEndMs; rates: count. */
  avgAcceptMs?: number;
  avgEndToEndMs?: number;
  count?: number;
};

export type ComplianceResponse = {
  windowStart: string;
  windowEnd: string;
  ordersTotal: number;
  itemsTotal: number;
  metrics: Record<ComplianceMetricKey, ComplianceMetric>;
};

export function verdictTone(v: ComplianceVerdict): 'success' | 'warning' | 'danger' {
  if (v === 'ok') return 'success';
  if (v === 'warning') return 'warning';
  return 'danger';
}
