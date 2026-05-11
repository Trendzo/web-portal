// MOCK_DEPENDENCY: §7 AI Catalog Generation — shapes updated to match real backend schema

import type { AiQuota, AiSubmission } from '@/lib/types';

const HOUR = 1000 * 60 * 60;
const now = () => Date.now();

const PLACEHOLDER = 'https://placehold.co/512x768/171717/ffffff?text=';

export function mockAiSubmissions(): AiSubmission[] {
  return [
    {
      id: 'ai_001',
      storeId: 'store_aurora',
      listingId: 'lst_aurora_kurta',
      status: 'ready_for_review',
      mode: 'with_model',
      rawPhotos: [`${PLACEHOLDER}input+1`, `${PLACEHOLDER}input+2`],
      outputUrls: [
        `${PLACEHOLDER}out+front`,
        `${PLACEHOLDER}out+3q`,
        `${PLACEHOLDER}out+back`,
      ],
      costPaise: null,
      parentSubmissionId: null,
      thirdPartyRequestId: null,
      at: new Date(now() - HOUR * 2).toISOString(),
    },
    {
      id: 'ai_002',
      storeId: 'store_aurora',
      listingId: null,
      status: 'processing',
      mode: 'without_model',
      rawPhotos: [`${PLACEHOLDER}input+flat`],
      outputUrls: [],
      costPaise: null,
      parentSubmissionId: null,
      thirdPartyRequestId: null,
      at: new Date(now() - HOUR * 0.5).toISOString(),
    },
    {
      id: 'ai_003',
      storeId: 'store_aurora',
      listingId: 'lst_saffron_lehenga',
      status: 'accepted',
      mode: 'with_model',
      rawPhotos: [`${PLACEHOLDER}input+lehenga`],
      outputUrls: [`${PLACEHOLDER}out+lehenga+front`, `${PLACEHOLDER}out+lehenga+side`],
      costPaise: 500,
      parentSubmissionId: null,
      thirdPartyRequestId: null,
      at: new Date(now() - HOUR * 24).toISOString(),
    },
  ];
}

export function mockAiQuota(): AiQuota {
  return {
    used: 14,
    total: 50,
    remaining: 36,
  };
}
