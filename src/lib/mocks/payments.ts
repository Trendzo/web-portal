// MOCK_DEPENDENCY: §15 Payment Capture (reconciliation + failures)

import type { PaymentFailureRow, PaymentReconRow, WalletPayout } from '@/lib/types';

const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;
const now = () => Date.now();

export function mockReconciliation(): PaymentReconRow[] {
  return [
    { id: 'rec_1', orderId: 'ord_8821', gateway: 'razorpay', capturePaise: 340000, settlementPaise: 340000, status: 'matched', capturedAt: new Date(now() - HOUR * 6).toISOString(), settledAt: new Date(now() - HOUR * 2).toISOString(), diffPaise: 0 },
    { id: 'rec_2', orderId: 'ord_8820', gateway: 'razorpay', capturePaise: 528000, settlementPaise: 525500, status: 'mismatch', capturedAt: new Date(now() - HOUR * 26).toISOString(), settledAt: new Date(now() - HOUR * 18).toISOString(), diffPaise: -2500 },
    { id: 'rec_3', orderId: 'ord_8807', gateway: 'phonepe', capturePaise: 219000, settlementPaise: 0, status: 'missing_settlement', capturedAt: new Date(now() - HOUR * 36).toISOString(), settledAt: null, diffPaise: -219000 },
    { id: 'rec_4', orderId: 'ord_8755', gateway: 'manual', capturePaise: 0, settlementPaise: 145000, status: 'missing_capture', capturedAt: new Date(now() - DAY * 3).toISOString(), settledAt: new Date(now() - DAY * 1).toISOString(), diffPaise: 145000 },
  ];
}

export function mockPaymentFailures(): PaymentFailureRow[] {
  return [
    { id: 'pf_1', orderId: 'ord_8901', consumerEmail: 'priya@example.com', amountPaise: 219000, method: 'upi', failureCode: 'BANK_TIMEOUT', failureMessage: 'Issuer bank did not respond', attemptCount: 2, reservationStillHeld: true, failedAt: new Date(now() - HOUR * 0.3).toISOString() },
    { id: 'pf_2', orderId: 'ord_8895', consumerEmail: 'arjun@example.com', amountPaise: 480000, method: 'card', failureCode: 'INSUFFICIENT_FUNDS', failureMessage: 'Card declined', attemptCount: 3, reservationStillHeld: true, failedAt: new Date(now() - HOUR * 1.5).toISOString() },
    { id: 'pf_3', orderId: 'ord_8870', consumerEmail: 'meera@example.com', amountPaise: 145000, method: 'upi', failureCode: 'GATEWAY_UNAVAILABLE', failureMessage: 'Gateway returned 503', attemptCount: 1, reservationStillHeld: false, failedAt: new Date(now() - HOUR * 12).toISOString() },
  ];
}

export function mockWalletPayouts(): WalletPayout[] {
  return [
    { id: 'wp_1', consumerId: 'cons_001', consumerEmail: 'priya@example.com', balancePaise: 87500, closedAt: new Date(now() - DAY * 2).toISOString(), claimWindowEndsAt: new Date(now() + DAY * 88).toISOString(), status: 'pending_claim', bankAccountMasked: null, paidAt: null },
    { id: 'wp_2', consumerId: 'cons_002', consumerEmail: 'arjun@example.com', balancePaise: 420000, closedAt: new Date(now() - DAY * 14).toISOString(), claimWindowEndsAt: new Date(now() + DAY * 76).toISOString(), status: 'awaiting_bank', bankAccountMasked: 'ICICI ••••8821', paidAt: null },
    { id: 'wp_3', consumerId: 'cons_003', consumerEmail: 'meera@example.com', balancePaise: 12000, closedAt: new Date(now() - DAY * 95).toISOString(), claimWindowEndsAt: new Date(now() - DAY * 5).toISOString(), status: 'escheated', bankAccountMasked: null, paidAt: null },
    { id: 'wp_4', consumerId: 'cons_004', consumerEmail: 'kabir@example.com', balancePaise: 240000, closedAt: new Date(now() - DAY * 30).toISOString(), claimWindowEndsAt: new Date(now() + DAY * 60).toISOString(), status: 'paid', bankAccountMasked: 'HDFC ••••2143', paidAt: new Date(now() - DAY * 25).toISOString() },
  ];
}
