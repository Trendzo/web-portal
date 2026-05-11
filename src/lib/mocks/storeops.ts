// MOCK_DEPENDENCY: §4 Store Operations + §22 Notifications

import type {
  DashboardTileKey,
  HolidayDate,
  Notification,
  NotificationPrefs,
  StorePauseState,
} from '@/lib/types';

const DAY = 1000 * 60 * 60 * 24;

export function mockStorePauseState(): StorePauseState {
  return {
    paused: false,
    visibility: 'block_orders_only',
    pausedAt: null,
    reason: null,
  };
}

export function mockHolidayDates(): HolidayDate[] {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const next = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d;
  };
  return [
    { date: fmt(next(14)), label: 'Diwali — closed all day' },
    { date: fmt(next(15)), label: 'Diwali extended' },
    { date: fmt(next(45)), label: 'Annual maintenance' },
  ];
}

export function mockNotificationPrefs(): NotificationPrefs {
  const tiles: DashboardTileKey[] = ['sales', 'orders', 'inventory', 'top_products', 'recent_products', 'compliance'];
  return {
    channels: { push: true, email: true, sms: false, in_app: true },
    dailyDigest: true,
    language: 'en',
    enabledDashboardTiles: tiles,
  };
}

export function mockInboxNotifications(): Notification[] {
  const now = Date.now();
  const mk = (id: string, kind: Notification['kind'], title: string, body: string, deepLink: string | null, ageHours: number, read: boolean): Notification => ({
    id,
    kind,
    title,
    body,
    deepLink,
    readAt: read ? new Date(now - 1000 * 60 * 60 * (ageHours - 1)).toISOString() : null,
    createdAt: new Date(now - 1000 * 60 * 60 * ageHours).toISOString(),
  });
  return [
    mk('n_1', 'order', 'New order ord_8821 needs acceptance', 'Cust Priya · ₹3,400 · expires in 12 min', '/retailer/orders', 0.2, false),
    mk('n_2', 'order', 'Order ord_8820 packed', 'Hand off to delivery agent within an hour.', '/retailer/orders', 1, false),
    mk('n_3', 'kyc', 'KYC re-verification due in 7 days', 'Re-upload PAN and address proof to avoid auto-pause.', '/retailer/kyc', 6, false),
    mk('n_4', 'refund', 'Refund ref_4421 partially disbursed', 'One disbursement failed — admin will retry.', '/retailer/issues', 12, true),
    mk('n_5', 'system', 'Scheduled maintenance tonight 11pm IST', 'Order placement will be blocked for ~10 minutes.', null, 24, true),
    mk('n_6', 'issue', 'Issue iss_991 awaiting your response', 'Customer asked about size mismatch on ord_8755.', '/retailer/issues', 30, true),
    mk('n_7', 'payout', 'Payout ₹12,560 settled to bank ••••2143', 'Cycle 2026-05-W1 cleared.', '/retailer/dashboard', 50 * DAY / (1000 * 60 * 60), true),
  ];
}

export function mockAdminInbox(): Notification[] {
  const now = Date.now();
  const mk = (id: string, kind: Notification['kind'], title: string, body: string, deepLink: string | null, ageHours: number, read: boolean): Notification => ({
    id,
    kind,
    title,
    body,
    deepLink,
    readAt: read ? new Date(now - 1000 * 60 * 60 * (ageHours - 1)).toISOString() : null,
    createdAt: new Date(now - 1000 * 60 * 60 * ageHours).toISOString(),
  });
  return [
    mk('an_1', 'system', '7 payouts failed in last 24h', 'Bank channel HDFC IMPS error rate spiked. Investigate pipeline.', '/admin/payouts-pipeline', 0.5, false),
    mk('an_2', 'kyc', '3 retailer KYCs overdue 7+ days', 'Suspension auto-trigger in 24h unless cleared.', '/admin/compliance', 4, false),
    mk('an_3', 'issue', 'Disputes awaiting admin decision', '12 disputes idle 48h+. Triage from inbox.', '/admin/issues?status=awaiting_admin', 6, false),
    mk('an_4', 'refund', 'Tail of cycle ₹2.4L unreconciled', 'May 2026 cycle close pending reconciliation.', '/admin/tail-of-cycle', 22, true),
    mk('an_5', 'system', 'GSTR-1 filing window opens tomorrow', 'May 2026 returns due by 11th.', '/admin/gst-returns', 36, true),
    mk('an_6', 'order', '5 retailer applications submitted today', 'Pending document review in Applications queue.', '/admin/applications', 9, false),
    mk('an_7', 'system', 'Performance-floor breaches: 3 retailers', 'Indigo Threads 14d below acceptance floor.', '/admin/reports/compliance', 48, true),
  ];
}
