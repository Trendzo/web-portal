// MOCK_DEPENDENCY: §13 Promotions extensions — performance, targeted drops, anomalies

import type { PromotionAnomaly, PromotionPerformance, TargetedDrop } from '@/lib/types';

const HOUR = 1000 * 60 * 60;
const now = () => Date.now();

export function mockPromotionPerformance(): PromotionPerformance[] {
  const row = (
    promotionId: string,
    name: string,
    redemptions: number,
    uniqueConsumers: number,
    totalDiscountPaise: number,
    gmvInfluencedPaise: number,
    refundRateBp: number,
    aovLiftBp: number,
    anomalyReasons: PromotionPerformance['anomalyReasons'],
  ): PromotionPerformance => ({
    promotionId,
    name,
    redemptions,
    uniqueConsumers,
    totalDiscountPaise,
    gmvInfluencePaise: totalDiscountPaise,
    gmvInfluencedPaise,
    refundRateBp,
    aovLiftBp,
    anomalyFlagged: anomalyReasons.length > 0,
    anomalyReasons,
  });
  return [
    row('promo_diwali', 'Diwali ₹500 off', 423, 410, 8_50_000_00, 32_00_000_00, 320, 1450, []),
    row('promo_first', 'First-order coupon', 1820, 1820, 24_00_000_00, 84_00_000_00, 180, 800, []),
    row('promo_flash20', 'Flash 20% off', 91, 14, 1_20_000_00, 5_40_000_00, 1840, 220, ['refund_spike', 'consumer_concentration']),
    row('promo_loyalty', 'Loyalty bonus tier', 612, 540, 6_40_000_00, 22_00_000_00, 240, 940, []),
  ];
}

export function mockTargetedDrops(): TargetedDrop[] {
  return [
    { id: 'drop_1', name: 'Diwali VIP push', promotionId: 'promo_diwali', promotionName: 'Diwali ₹500 off', cohortKind: 'tier', audienceSize: 412, pushedAt: new Date(now() - HOUR * 4).toISOString(), redemptionCount: 87 },
    { id: 'drop_2', name: 'Win-back lapsed', promotionId: 'promo_loyalty', promotionName: 'Loyalty bonus tier', cohortKind: 'segment', audienceSize: 1240, pushedAt: new Date(now() - HOUR * 50).toISOString(), redemptionCount: 142 },
  ];
}

export function mockPromotionAnomalies(): PromotionAnomaly[] {
  return [
    { id: 'anom_1', promotionId: 'promo_flash20', promotionName: 'Flash 20% off', kind: 'velocity_spike', detectedAt: new Date(now() - HOUR * 1).toISOString(), severity: 'high', metric: 'redemptions/min', value: '12', threshold: '4', status: 'open', consumersInvolved: 38 },
    { id: 'anom_2', promotionId: 'promo_flash20', promotionName: 'Flash 20% off', kind: 'consumer_concentration', detectedAt: new Date(now() - HOUR * 6).toISOString(), severity: 'medium', metric: 'top-1% share', value: '42%', threshold: '15%', status: 'acknowledged', consumersInvolved: 14 },
    { id: 'anom_3', promotionId: 'promo_first', promotionName: 'First-order coupon', kind: 'refund_spike', detectedAt: new Date(now() - HOUR * 22).toISOString(), severity: 'low', metric: 'refund rate', value: '32%', threshold: '30%', status: 'open', consumersInvolved: 7 },
  ];
}
