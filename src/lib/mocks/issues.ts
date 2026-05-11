// MOCK_DEPENDENCY: §19 Customer Issues (detail + messages)

import type { IssueDetail, IssueListRow, IssueMessage } from '@/lib/types';

const HOUR = 1000 * 60 * 60;
const now = () => Date.now();

export function mockIssueDetail(id: string): IssueDetail {
  const base: IssueListRow = {
    id,
    kind: id.includes('query') ? 'query' : 'dispute',
    orderId: 'ord_8821',
    returnId: null,
    targetKind: 'order',
    targetId: 'ord_8821',
    openedByActorType: 'consumer',
    openedByActorId: 'cons_001',
    openedAt: new Date(now() - HOUR * 12).toISOString(),
    description: 'Customer reports the kurta colour does not match the listing photo. Asks for refund or exchange.',
    evidence: ['photo_001.jpg', 'photo_002.jpg'],
    status: 'open',
    decision: null,
    decisionNote: null,
    decidedAt: null,
    decidedByAdminId: null,
  };
  const messages: IssueMessage[] = [
    { id: `${id}_m1`, issueId: id, authorKind: 'consumer', authorLabel: 'Priya Sharma', body: 'The kurta I received is much darker than the listing image. Please advise.', attachments: [{ id: 'att_1', url: 'photo_001.jpg', label: 'Received item' }, { id: 'att_2', url: 'photo_002.jpg', label: 'Listing image' }], createdAt: new Date(now() - HOUR * 12).toISOString() },
    { id: `${id}_m2`, issueId: id, authorKind: 'system', authorLabel: 'system', body: 'Issue auto-assigned to Operations Lead based on category routing.', attachments: [], createdAt: new Date(now() - HOUR * 11.9).toISOString() },
    { id: `${id}_m3`, issueId: id, authorKind: 'admin', authorLabel: 'Operations Lead', body: 'Sharing photos with the retailer for response. Standby.', attachments: [], createdAt: new Date(now() - HOUR * 8).toISOString() },
    { id: `${id}_m4`, issueId: id, authorKind: 'retailer', authorLabel: 'Aurora Boutique', body: 'Photos forwarded to QC. We can offer a free exchange or full refund. Pickup logistics already confirmed.', attachments: [], createdAt: new Date(now() - HOUR * 4).toISOString() },
  ];
  return {
    ...base,
    _messages: messages,  // kept for local use in issue-detail page, not in type
    target: { messages, assigneeAdminId: 'admin_ops_a', consumerId: 'cons_001', retailerId: 'retailer_aurora', priorIssueCount: { consumer: 1, retailer: 4 } },
    decidedByAdmin: null,
  } as unknown as IssueDetail;
}
