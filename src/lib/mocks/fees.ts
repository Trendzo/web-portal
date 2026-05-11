// MOCK_DEPENDENCY: §12 Fees and Charges

import type { FeesConfig, RetailerFeeView } from '@/lib/types';

export function mockFeesConfig(): FeesConfig {
  return {
    defaultPlatformFeeBp: 1500, // 15%
    surgeMultiplier: 1.0,
    gstRateBp: 500, // 5%
    tcsRateBp: 100, // 1%
    intraStateSplit: { cgstBp: 250, sgstBp: 250 },
    interStateSplit: { igstBp: 500 },
    delivery: {
      express: { baseFeePaise: 8000, perKmFeePaise: 1000 },
      standard: { baseFeePaise: 4000, perKmFeePaise: 500 },
      pickup: { baseFeePaise: 0, perKmFeePaise: 0 },
      try_and_buy: { baseFeePaise: 12000, perKmFeePaise: 1500 },
    },
    platformFeeOverrides: [
      { retailerId: 'retailer_aurora', retailerName: 'Aurora Boutique', platformFeeBp: 1200, reason: 'Tier-1 launch promo' },
      { retailerId: 'retailer_indigo', retailerName: 'Indigo Threads', platformFeeBp: 1800, reason: 'High dispute rate' },
    ],
  };
}

export function mockRetailerFees(): RetailerFeeView {
  return {
    platformFeeBp: 1500,
    payoutCadenceDays: 7,
    delegationModeEnabled: false,
    handlingFeePaise: 0,
    convenienceFeePaise: 0,
    gstRateBp: 500,
    tcsRateBp: 100,
  };
}
