// MOCK_DEPENDENCY: §20 Consumer Management — community + reviews moderation

import type { CommunityFlag, ReviewFlag } from '@/lib/types';

const HOUR = 1000 * 60 * 60;
const now = () => Date.now();

export function mockCommunityFlags(): CommunityFlag[] {
  return [
    { id: 'cf_1', consumerId: 'cons_001', consumerLabel: 'Priya Sharma', postId: 'post_881', excerpt: 'Anyone else having issues with the new app version? It keeps crashing on…', reason: 'spam', reportedBy: 'cons_877', reportedAt: new Date(now() - HOUR * 1).toISOString(), status: 'open' },
    { id: 'cf_2', consumerId: 'cons_445', consumerLabel: 'Anonymous user 445', postId: 'post_902', excerpt: 'Buy from this seller and you will get scammed for sure!', reason: 'harassment', reportedBy: 'cons_312', reportedAt: new Date(now() - HOUR * 4).toISOString(), status: 'open' },
    { id: 'cf_3', consumerId: 'cons_889', consumerLabel: 'Test Account', postId: 'post_1002', excerpt: 'Free coupon code: SCAM2025 (definitely not phishing)', reason: 'misinfo', reportedBy: 'system', reportedAt: new Date(now() - HOUR * 24).toISOString(), status: 'open' },
  ];
}

export function mockReviewFlags(): ReviewFlag[] {
  return [
    { id: 'rf_1', consumerId: 'cons_002', consumerLabel: 'Arjun Verma', reviewId: 'rv_4421', listingId: 'lst_aurora_kurta', listingName: 'Aurora Indigo Kurta', rating: 1, excerpt: 'Wrong size, wrong colour, wrong everything. AVOID.', reason: 'abuse', reportedAt: new Date(now() - HOUR * 2).toISOString(), status: 'open' },
    { id: 'rf_2', consumerId: 'cons_900', consumerLabel: 'New user 900', reviewId: 'rv_4500', listingId: 'lst_velvet_sherwani', listingName: 'Velvet Sherwani', rating: 5, excerpt: 'Best ever! 10/10! Buy now!! Best seller!!! Buy buy buy!!!', reason: 'fake', reportedAt: new Date(now() - HOUR * 8).toISOString(), status: 'open' },
    { id: 'rf_3', consumerId: 'cons_456', consumerLabel: 'Sara Iyer', reviewId: 'rv_4380', listingId: 'lst_saffron_lehenga', listingName: 'Saffron Embroidered Lehenga', rating: 3, excerpt: 'Reviewing the delivery boy here, very rude.', reason: 'irrelevant', reportedAt: new Date(now() - HOUR * 30).toISOString(), status: 'open' },
  ];
}
