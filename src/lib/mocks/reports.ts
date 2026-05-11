// MOCK_DEPENDENCY: §21 Analytics & Reporting (every report row shape)

import type {
  ComplianceFloorRow,
  FeatureUsageRow,
  FulfilmentMetricRow,
  FunnelStep,
  InventoryHealthRow,
  LeaderboardRow,
  OperationalRow,
  ReturnsReportRow,
  SalesReportRow,
} from '@/lib/types';

const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;
const now = () => Date.now();

function bucketDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export function mockSalesReport(): SalesReportRow[] {
  return Array.from({ length: 14 }, (_, i) => ({
    bucket: bucketDate(13 - i),
    ordersCount: 42 + Math.round(Math.sin(i / 2) * 12) + i,
    grossPaise: (1_20_000_00 + i * 8000_00 + Math.round(Math.cos(i / 3) * 10_000_00)),
    netPaise: (1_02_000_00 + i * 6800_00),
  }));
}

export function mockFulfilmentMetrics(): FulfilmentMetricRow[] {
  return Array.from({ length: 7 }, (_, i) => ({
    bucket: bucketDate(6 - i),
    acceptanceRateBp: 9200 + Math.round(Math.sin(i) * 200),
    avgTimeToAcceptMs: 3 * 60_000 + i * 2_000,
    avgTimeToPackMs: 18 * 60_000 + i * 30_000,
    avgTimeToHandoverMs: 32 * 60_000 + i * 90_000,
    avgEndToEndMs: 110 * 60_000 + i * 5 * 60_000,
  }));
}

export function mockReturnsReport(): ReturnsReportRow[] {
  return Array.from({ length: 7 }, (_, i) => ({
    bucket: bucketDate(6 - i),
    returnRateBp: 800 + Math.round(Math.sin(i / 1.5) * 200),
    totalReturns: 14 + i,
    topListing: ['Aurora Indigo Kurta', 'Saffron Lehenga', 'Velvet Sherwani'][i % 3]!,
    topReason: ['Wrong size', 'Colour mismatch', 'Quality below expectation'][i % 3]!,
  }));
}

export function mockLeaderboard(): LeaderboardRow[] {
  const stores = ['Aurora Boutique', 'Saffron Studio', 'Indigo Threads', 'Velvet Co.', 'Linen House', 'Marigold', 'Onyx Drape'];
  return stores.map((name, i) => ({
    retailerId: `retailer_${i}`,
    retailerName: name,
    acceptanceRateBp: 9800 - i * 220,
    fulfilmentScoreBp: 9500 - i * 180,
    returnRateBp: 600 + i * 130,
    disputeRateBp: 80 + i * 30,
    rank: i + 1,
  }));
}

export function mockFunnel(): FunnelStep[] {
  return [
    { label: 'Search / browse', count: 142_000, dropoffPctFromPrevious: 0 },
    { label: 'Listing view', count: 84_500, dropoffPctFromPrevious: 40.5 },
    { label: 'Add to bag', count: 28_900, dropoffPctFromPrevious: 65.8 },
    { label: 'Checkout open', count: 14_200, dropoffPctFromPrevious: 50.9 },
    { label: 'Payment success', count: 9_800, dropoffPctFromPrevious: 31.0 },
    { label: 'Delivered', count: 9_220, dropoffPctFromPrevious: 5.9 },
  ];
}

export function mockFeatureUsage(): FeatureUsageRow[] {
  return [
    { feature: 'Virtual try-on', uniqueUsers: 4_281, totalUsage: 12_900, costPaise: 1_82_000_00 },
    { feature: 'AI catalog', uniqueUsers: 312, totalUsage: 1_180, costPaise: 64_000_00 },
    { feature: 'Spin the wheel', uniqueUsers: 18_400, totalUsage: 22_100, costPaise: 12_000_00 },
    { feature: 'Daily check-in', uniqueUsers: 9_220, totalUsage: 88_400, costPaise: 8_500_00 },
    { feature: 'Lucky draw', uniqueUsers: 1_140, totalUsage: 1_420, costPaise: 22_000_00 },
  ];
}

export function mockOperational(): OperationalRow[] {
  return [
    { metric: 'Orders / hour (peak)', value: '218', trendBp: 420 },
    { metric: 'Avg time to accept', value: '3m 12s', trendBp: -180 },
    { metric: 'Avg time to handover', value: '34m', trendBp: 90 },
    { metric: 'End-to-end fulfilment', value: '1h 52m', trendBp: -240 },
    { metric: 'Failed payouts (24h)', value: '7', trendBp: 100 },
    { metric: 'Open tickets', value: '142', trendBp: -60 },
  ];
}

export function mockComplianceFloors(): ComplianceFloorRow[] {
  return [
    { retailerName: 'Indigo Threads', metric: 'Acceptance rate', value: '74%', threshold: '85%', daysBelow: 14 },
    { retailerName: 'Marigold', metric: 'Dispute rate', value: '4.2%', threshold: '2.0%', daysBelow: 9 },
    { retailerName: 'Onyx Drape', metric: 'KYC re-verification', value: 'Overdue', threshold: 'On time', daysBelow: 22 },
  ];
}

export function mockInventoryHealth(): InventoryHealthRow[] {
  return [
    { listingId: 'lst_aurora_1', listingName: 'Aurora Indigo Kurta', variantSku: 'AUR-IND-M', stock: 2, reservedDays: 0, status: 'low_stock', lastSoldAt: new Date(now() - DAY * 2).toISOString() },
    { listingId: 'lst_saffron_2', listingName: 'Saffron Lehenga', variantSku: 'SAF-RED-L', stock: 0, reservedDays: 0, status: 'out_of_stock', lastSoldAt: new Date(now() - DAY * 6).toISOString() },
    { listingId: 'lst_velvet_3', listingName: 'Velvet Sherwani', variantSku: 'VEL-MAR-XL', stock: 38, reservedDays: 0, status: 'overstock', lastSoldAt: new Date(now() - DAY * 21).toISOString() },
    { listingId: 'lst_linen_4', listingName: 'Linen Co-ord Set', variantSku: 'LIN-BEI-S', stock: 12, reservedDays: 96, status: 'aged', lastSoldAt: new Date(now() - DAY * 96).toISOString() },
    { listingId: 'lst_marigold_5', listingName: 'Marigold Anarkali', variantSku: 'MAR-YEL-M', stock: 1, reservedDays: 0, status: 'low_stock', lastSoldAt: new Date(now() - DAY * 1).toISOString() },
  ];
}

export function mockPostPayoutRecovery() {
  return [
    { id: 'ppr_1', refundId: 'ref_4421', orderId: 'ord_8755', retailerId: 'retailer_aurora', retailerName: 'Aurora Boutique', payoutCycleId: 'pc_next', refundedPaise: 340_000, plannedDebitPaise: 340_000, status: 'planned' as const, reason: 'Refund issued after payout settled', createdAt: new Date(now() - DAY * 1).toISOString(), scheduledFor: new Date(now() + DAY * 6).toISOString(), settledAt: null },
    { id: 'ppr_2', refundId: 'ref_4400', orderId: 'ord_8612', retailerId: 'retailer_saffron', retailerName: 'Saffron Studio', payoutCycleId: 'pc_next', refundedPaise: 528_000, plannedDebitPaise: 528_000, status: 'planned' as const, reason: 'Adjudicated dispute outcome', createdAt: new Date(now() - DAY * 3).toISOString(), scheduledFor: new Date(now() + DAY * 4).toISOString(), settledAt: null },
    { id: 'ppr_3', refundId: 'ref_4395', orderId: 'ord_8444', retailerId: 'retailer_indigo', retailerName: 'Indigo Threads', payoutCycleId: 'pc_prev', refundedPaise: 145_000, plannedDebitPaise: 145_000, status: 'debited' as const, reason: 'Refund debited last cycle', createdAt: new Date(now() - DAY * 35).toISOString(), scheduledFor: new Date(now() - DAY * 28).toISOString(), settledAt: new Date(now() - DAY * 28).toISOString() },
  ];
}
