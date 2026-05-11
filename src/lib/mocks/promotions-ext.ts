// MOCK_DEPENDENCY: §13 Promotions extensions — performance, targeted drops, anomalies

import type { PromotionAnomaly, PromotionPerformance, TargetedDrop } from '@/lib/types';

const HOUR = 1000 * 60 * 60;
const now = () => Date.now();

export function mockPromotionPerformance(): PromotionPerformance[] {
  return [
    { promotionId: 'promo_diwali', name: 'Diwali ₹500 off', redemptions: 423, gmvInfluencePaise: 8_50_000_00, aovLiftBp: 1450, refundRateBp: 320, anomalyFlagged: false },
    { promotionId: 'promo_first', name: 'First-order coupon', redemptions: 1820, gmvInfluencePaise: 24_00_000_00, aovLiftBp: 800, refundRateBp: 180, anomalyFlagged: false },
    { promotionId: 'promo_flash20', name: 'Flash 20% off', redemptions: 91, gmvInfluencePaise: 1_20_000_00, aovLiftBp: 220, refundRateBp: 1840, anomalyFlagged: true },
    { promotionId: 'promo_loyalty', name: 'Loyalty bonus tier', redemptions: 612, gmvInfluencePaise: 6_40_000_00, aovLiftBp: 940, refundRateBp: 240, anomalyFlagged: false },
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
    { id: 'anom_2', promotionId: 'promo_flash20', promotionName: 'Flash 20% off', kind: 'concentrated_consumers', detectedAt: new Date(now() - HOUR * 6).toISOString(), severity: 'medium', metric: 'top-1% share', value: '42%', threshold: '15%', status: 'acknowledged', consumersInvolved: 14 },
    { id: 'anom_3', promotionId: 'promo_first', promotionName: 'First-order coupon', kind: 'suspect_traffic', detectedAt: new Date(now() - HOUR * 22).toISOString(), severity: 'low', metric: 'bot signature', value: '0.6', threshold: '0.5', status: 'open', consumersInvolved: 7 },
  ];
}
