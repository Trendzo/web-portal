// MOCK_DEPENDENCY: §3 KYC & Compliance
//
// Greenfield module — every fixture mirrors the not-yet-built compliance
// endpoints. Replacement protocol same as auth/onboarding mocks.

import type {
  AccountDeletionRequest,
  ChangeRequest,
  ChangeRequestField,
  DataExportRequest,
  EnforcementStep,
  KycDocument,
  KycReverification,
  PolicyEnforcement,
} from '@/lib/types';

const DAY = 1000 * 60 * 60 * 24;
const now = () => Date.now();

export function mockKycReverification(): KycReverification {
  return {
    id: 'kyc_active',
    retailerId: 'retailer_self',
    dueAt: new Date(now() + DAY * 5).toISOString(),
    gracePeriodEndsAt: new Date(now() + DAY * 12).toISOString(),
    status: 'pending',
    lastVerifiedAt: new Date(now() - DAY * 350).toISOString(),
    documents: mockKycDocuments(),
  };
}

export function mockKycDocuments(): KycDocument[] {
  return [
    {
      id: 'kyc_doc_gstin',
      kind: 'gstin_certificate',
      label: 'GSTIN Certificate',
      status: 'verified',
      uploadedAt: new Date(now() - DAY * 350).toISOString(),
      fileUrl: 'https://example.com/docs/gstin.pdf',
    },
    {
      id: 'kyc_doc_pan',
      kind: 'pan_card',
      label: 'PAN Card',
      status: 'pending_review',
      uploadedAt: new Date(now() - DAY * 1).toISOString(),
      fileUrl: 'https://example.com/docs/pan.pdf',
    },
    {
      id: 'kyc_doc_addr',
      kind: 'address_proof',
      label: 'Address Proof',
      status: 'missing',
      uploadedAt: null,
      fileUrl: null,
    },
  ];
}

const FIELDS: ChangeRequestField[] = ['legal_name', 'address', 'bank_account', 'gstin'];

export function mockChangeRequests(): ChangeRequest[] {
  return FIELDS.slice(0, 3).map((field, i) => ({
    id: `cr_${field}`,
    storeId: 'store_aurora',
    storeName: 'Aurora Boutique',
    field,
    currentValue:
      field === 'legal_name'
        ? 'Aurora Boutique LLP'
        : field === 'address'
          ? '12 Linking Road, Mumbai 400050'
          : 'HDFC ••••2143',
    requestedValue:
      field === 'legal_name'
        ? 'Aurora Lifestyle LLP'
        : field === 'address'
          ? '14 Linking Road, Mumbai 400050'
          : 'ICICI ••••9988',
    reason: 'Updated incorporation document',
    evidenceUrl: null,
    status: i === 0 ? 'pending' : i === 1 ? 'under_review' : 'approved',
    submittedAt: new Date(now() - DAY * (i + 1)).toISOString(),
    decidedAt: i === 2 ? new Date(now() - 1000 * 60 * 60 * 6).toISOString() : null,
    decidedByAccountId: i === 2 ? 'admin_super' : null,
    decisionNote: i === 2 ? 'Validated against new incorporation cert' : null,
  }));
}

export function mockPolicyEnforcement(): PolicyEnforcement[] {
  return [
    {
      id: 'enf_1',
      storeId: 'store_aurora',
      step: 'warning_2' as EnforcementStep,
      breachKind: 'return_rate',
      metric: { value: '14.5%', threshold: '10.0%' },
      actedAt: new Date(now() - DAY * 1).toISOString(),
      actedByAdminId: 'admin_super',
      reason: 'Second warning — required action: improve fulfilment SOPs',
      liftsActionId: null,
    },
    {
      id: 'enf_2',
      storeId: 'store_indigo',
      step: 'suspension' as EnforcementStep,
      breachKind: 'kyc_overdue',
      metric: { value: '14 days overdue', threshold: '0 days' },
      actedAt: new Date(now() - DAY * 14).toISOString(),
      actedByAdminId: 'admin_super',
      reason: 'Suspension issued for KYC overdue breach',
      liftsActionId: null,
    },
  ];
}

export function mockDataExports(): DataExportRequest[] {
  return [
    {
      id: 'exp_1',
      consumerId: 'cons_001',
      requestedAt: new Date(now() - DAY * 1).toISOString(),
      status: 'pending',
      readyAt: null,
      downloadUrl: null,
      expiresAt: null,
      failureReason: null,
    },
    {
      id: 'exp_2',
      consumerId: 'cons_002',
      requestedAt: new Date(now() - DAY * 5).toISOString(),
      status: 'ready',
      readyAt: new Date(now() - DAY * 2).toISOString(),
      downloadUrl: 'https://example.com/exports/arjun.zip',
      expiresAt: new Date(now() + DAY * 5).toISOString(),
      failureReason: null,
    },
  ];
}

export function mockAccountDeletions(): AccountDeletionRequest[] {
  return [
    {
      id: 'del_1',
      consumerId: 'cons_003',
      requestedAt: new Date(now() - DAY * 2).toISOString(),
      status: 'pending',
      scheduledFor: new Date(now() + DAY * 28).toISOString(),
      cancelledAt: null,
    },
    {
      id: 'del_2',
      consumerId: 'cons_004',
      requestedAt: new Date(now() - DAY * 30).toISOString(),
      status: 'completed',
      scheduledFor: new Date(now() - DAY * 1).toISOString(),
      cancelledAt: null,
    },
  ];
}
