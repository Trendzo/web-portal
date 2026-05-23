// MOCK_DEPENDENCY: §7 AI Catalog Generation — shapes match the real backend schema.

import type { AiListingQuota, AiSubmission } from '@/lib/types';

const HOUR = 1000 * 60 * 60;
const now = () => Date.now();

const PLACEHOLDER = 'https://placehold.co/512x768/171717/ffffff?text=';

export function mockAiSubmissions(): AiSubmission[] {
  return [
    {
      id: 'ai_001',
      storeId: 'store_aurora',
      listingId: 'lst_aurora_kurta',
      targetVariantId: null,
      status: 'ready_for_review',
      mode: 'with_model',
      prompt: 'Studio shot, neutral grey background, three-quarter pose.',
      referenceImageUrls: [`${PLACEHOLDER}input+1`],
      revisionNotes: null,
      rawPhotos: [`${PLACEHOLDER}input+1`],
      outputUrls: [`${PLACEHOLDER}out+front`],
      errorMessage: null,
      costPaise: null,
      parentSubmissionId: null,
      thirdPartyRequestId: null,
      at: new Date(now() - HOUR * 2).toISOString(),
    },
    {
      id: 'ai_002',
      storeId: 'store_aurora',
      listingId: 'lst_aurora_kurta',
      targetVariantId: null,
      status: 'processing',
      mode: 'without_model',
      prompt: 'Flat-lay on cream linen.',
      referenceImageUrls: [`${PLACEHOLDER}input+flat`],
      revisionNotes: null,
      rawPhotos: [`${PLACEHOLDER}input+flat`],
      outputUrls: [],
      errorMessage: null,
      costPaise: null,
      parentSubmissionId: null,
      thirdPartyRequestId: null,
      at: new Date(now() - HOUR * 0.5).toISOString(),
    },
    {
      id: 'ai_003',
      storeId: 'store_aurora',
      listingId: 'lst_saffron_lehenga',
      targetVariantId: null,
      status: 'accepted',
      mode: 'with_model',
      prompt: 'Saffron lehenga on virtual model, front view.',
      referenceImageUrls: [`${PLACEHOLDER}input+lehenga`],
      revisionNotes: null,
      rawPhotos: [`${PLACEHOLDER}input+lehenga`],
      outputUrls: [`${PLACEHOLDER}out+lehenga+front`],
      errorMessage: null,
      costPaise: null,
      parentSubmissionId: null,
      thirdPartyRequestId: null,
      at: new Date(now() - HOUR * 24).toISOString(),
    },
  ];
}

export function mockAiListingQuota(): AiListingQuota {
  return { listingId: 'lst_aurora_kurta', variantCount: 3, usedAttempts: 1, remaining: 2 };
}
