// MOCK_DEPENDENCY: §18 Retailer Billing & Settlement (every fixture)

import type {
  AdminPayoutRow,
  BillingMonthSummary,
  BillingStatement,
  BillingStatementDetail,
  CommissionInvoice,
  EarlyDisbursementRequest,
  PayoutCycle,
  TailOfCycleRow,
} from '@/lib/types';

const DAY = 1000 * 60 * 60 * 24;
const now = () => Date.now();

function periodLabel(monthsBack: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().slice(0, 7);
}

export function mockCommissionInvoices(): CommissionInvoice[] {
  return [
    { id: 'ci_001', number: 'CLX/2026/04/001', orderId: 'ord_8821', storeId: 'store_self', commissionPaise: 51000, gstOnCommissionPaise: 9180, totalPaise: 60180, issuedAt: new Date(now() - DAY * 2).toISOString(), pdfUrl: '#' },
    { id: 'ci_002', number: 'CLX/2026/04/002', orderId: 'ord_8820', storeId: 'store_self', commissionPaise: 78600, gstOnCommissionPaise: 14148, totalPaise: 92748, issuedAt: new Date(now() - DAY * 3).toISOString(), pdfUrl: '#' },
    { id: 'ci_003', number: 'CLX/2026/04/003', orderId: 'ord_8807', storeId: 'store_self', commissionPaise: 32850, gstOnCommissionPaise: 5913, totalPaise: 38763, issuedAt: new Date(now() - DAY * 5).toISOString(), pdfUrl: '#' },
  ];
}

export function mockBillingStatements(): BillingStatement[] {
  return [0, 1, 2, 3].map((i) => ({
    id: `bs_${i}`,
    period: periodLabel(i),
    storeId: 'store_self',
    status: i === 0 ? 'open' : 'closed',
    ordersCount: 120 - i * 18,
    grossPaise: (24_50_000_00 - i * 4_00_000_00),
    commissionPaise: (3_67_500_00 - i * 60_000_00),
    tcsPaise: (24_500_00 - i * 4_000_00),
    refundsPaise: (1_20_000_00 - i * 20_000_00),
    holdsPaise: (15_000_00 - i * 2_000_00),
    adjustmentsPaise: i === 1 ? -25_000_00 : 0,
    netPaise: (19_22_500_00 - i * 3_14_000_00),
    generatedAt: new Date(now() - DAY * (i * 30 + 2)).toISOString(),
  }));
}

export function mockBillingStatementDetail(id: string): BillingStatementDetail | undefined {
  const base = mockBillingStatements().find((s) => s.id === id);
  if (!base) return undefined;
  return {
    ...base,
    liabilityBookings: id === 'bs_1'
      ? [
          { id: 'lb_1', issueId: 'iss_991', description: 'Adjudicated dispute on ord_8755 — full refund + ₹250 goodwill', amountPaise: 32500 },
          { id: 'lb_2', issueId: 'iss_993', description: 'Adjudicated dispute on ord_8612 — split 50/50', amountPaise: 18000 },
        ]
      : [],
  };
}

export function mockPayoutCycles(): PayoutCycle[] {
  return ([0, 1, 2, 3].map((i) => ({
    id: `pc_${i}`,
    period: periodLabel(i),
    storeId: 'store_self',
    amountPaise: (19_22_500_00 - i * 3_14_000_00),
    status: i === 0 ? 'pending' : i === 1 ? 'processing' : 'paid',
    bankAccountMasked: 'HDFC ••••2143',
    bankConfirmationRef: i >= 2 ? `UTR${1000000 + i}` : null,
    initiatedAt: new Date(now() - DAY * (i * 30 + 1)).toISOString(),
    settledAt: i >= 2 ? new Date(now() - DAY * (i * 30)).toISOString() : null,
    retryCount: i === 1 ? 1 : 0,
    deductions: [
      { kind: 'commission', label: 'Platform commission', amountPaise: 3_67_500_00 - i * 60_000_00 },
      { kind: 'tcs', label: 'TCS', amountPaise: 24_500_00 - i * 4_000_00 },
      { kind: 'refunds', label: 'Refunds debited', amountPaise: 1_20_000_00 - i * 20_000_00 },
      ...(i === 1 ? [{ kind: 'liability', label: 'Liability bookings (§19)', amountPaise: 50_500_00 }] : []),
    ],
  })) as unknown as PayoutCycle[]);
}

export function mockEarlyDisbursementRequests(): EarlyDisbursementRequest[] {
  return [
    { id: 'edr_1', storeId: 'store_self', storeName: 'Aurora Boutique', amountPaise: 1_50_000_00, reason: 'Inventory restock for Diwali', requestedAt: new Date(now() - DAY * 1).toISOString(), status: 'pending', decidedAt: null, decisionNote: null },
    { id: 'edr_2', storeId: 'store_self', storeName: 'Aurora Boutique', amountPaise: 80_000_00, reason: 'Vendor payment overdue', requestedAt: new Date(now() - DAY * 8).toISOString(), status: 'approved', decidedAt: new Date(now() - DAY * 7).toISOString(), decisionNote: 'Approved with 1% expedite fee' },
    { id: 'edr_3', storeId: 'store_indigo', storeName: 'Indigo Threads', amountPaise: 2_50_000_00, reason: 'Cash flow gap', requestedAt: new Date(now() - DAY * 14).toISOString(), status: 'rejected', decidedAt: new Date(now() - DAY * 13).toISOString(), decisionNote: 'Insufficient settled GMV history' },
  ];
}

export function mockBillingMonths(): BillingMonthSummary[] {
  return [0, 1, 2, 3].map((i) => ({
    period: periodLabel(i),
    status: i === 0 ? 'open' : i === 1 ? 'closing' : 'closed',
    storesIncluded: 84 - i * 4,
    totalGrossPaise: (12_00_00_000_00 - i * 80_00_000_00),
    totalCommissionPaise: (1_80_00_000_00 - i * 12_00_000_00),
    totalNetPaise: (10_20_00_000_00 - i * 68_00_000_00),
    closedAt: i >= 2 ? new Date(now() - DAY * (i * 30 - 5)).toISOString() : null,
    gstReturnStatus: i >= 2 ? 'ready' : 'pending',
  }));
}

export function mockAdminPayouts(): AdminPayoutRow[] {
  const stores = ['Aurora Boutique', 'Saffron Studio', 'Indigo Threads', 'Velvet Co.', 'Linen House', 'Marigold'];
  return (stores.flatMap((s, i) => ([
    { id: `apo_${i}_failed`, storeId: `store_${i}`, storeName: s, period: periodLabel(0), amountPaise: 4_00_000_00 + i * 50_000_00, status: 'failed' as const, initiatedAt: new Date(now() - DAY * 1).toISOString(), retryCount: 2 + (i % 2) },
    { id: `apo_${i}_paid`, storeId: `store_${i}`, storeName: s, period: periodLabel(1), amountPaise: 5_20_000_00 + i * 70_000_00, status: 'paid' as const, initiatedAt: new Date(now() - DAY * 30).toISOString(), retryCount: 0 },
  ])).slice(0, 10)) as unknown as AdminPayoutRow[];
}

export function mockTailOfCycle(): TailOfCycleRow[] {
  return [
    { storeId: 'store_aurora', storeName: 'Aurora Boutique', period: periodLabel(1), unreconciledPaise: 12500, reasonHints: ['Penny-drop bounce', 'Adjustment pending'] },
    { storeId: 'store_saffron', storeName: 'Saffron Studio', period: periodLabel(1), unreconciledPaise: 4200, reasonHints: ['Bank confirmation missing'] },
    { storeId: 'store_indigo', storeName: 'Indigo Threads', period: periodLabel(2), unreconciledPaise: 88000, reasonHints: ['Disputed liability booking'] },
  ];
}
