// MOCK_DEPENDENCY: §19 Customer Issues (detail + messages)

import type { IssueDetail, IssueListRow, IssueMessage } from '@/lib/types';

const HOUR = 1000 * 60 * 60;
const now = () => Date.now();

export function mockIssueDetail(id: string): IssueDetail {
  const base: IssueListRow = {
    id,
    kind: id.includes('query') ? 'query' : 'dispute',
    storeId: 'store_aurora',
    orderId: 'ord_8821',
    returnId: null,
    targetKind: 'order',
    targetId: 'ord_8821',
    openedByActorType: 'consumer',
    openedByActorId: 'cons_001',
    openedAt: new Date(now() - HOUR * 12).toISOString(),
    subject: 'Colour mismatch on kurta',
    description: 'Customer reports the kurta colour does not match the listing photo. Asks for refund or exchange.',
    evidence: ['photo_001.jpg', 'photo_002.jpg'],
    status: 'open',
    awaitingParty: 'retailer',
    assignedAdminId: 'admin_ops_a',
    decision: null,
    decisionNote: null,
    decidedAt: null,
    decidedByAdminId: null,
    payoutAdjustmentPaise: null,
    linkedHoldId: null,
    linkedAdjustmentId: null,
    lastMessageAt: new Date(now() - HOUR * 4).toISOString(),
    createdAt: new Date(now() - HOUR * 12).toISOString(),
    closedAt: null,
  };
  const messages: IssueMessage[] = [
    { id: `${id}_m1`, senderType: 'consumer', senderId: 'cons_001', body: 'The kurta I received is much darker than the listing image. Please advise.', attachments: ['photo_001.jpg', 'photo_002.jpg'], at: new Date(now() - HOUR * 12).toISOString() },
    { id: `${id}_m2`, senderType: 'system', senderId: 'system', body: 'Issue auto-assigned to Operations Lead based on category routing.', attachments: [], at: new Date(now() - HOUR * 11.9).toISOString() },
    { id: `${id}_m3`, senderType: 'admin', senderId: 'admin_ops_a', body: 'Sharing photos with the retailer for response. Standby.', attachments: [], at: new Date(now() - HOUR * 8).toISOString() },
    { id: `${id}_m4`, senderType: 'retailer', senderId: 'retailer_aurora', body: 'Photos forwarded to QC. We can offer a free exchange or full refund. Pickup logistics already confirmed.', attachments: [], at: new Date(now() - HOUR * 4).toISOString() },
  ];
  return {
    ...base,
    _messages: messages,
    target: { messages, assigneeAdminId: 'admin_ops_a', consumerId: 'cons_001', retailerId: 'retailer_aurora', priorIssueCount: { consumer: 1, retailer: 4 } },
    decidedByAdmin: null,
  } as unknown as IssueDetail;
}
