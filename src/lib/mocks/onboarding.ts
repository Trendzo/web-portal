// MOCK_DEPENDENCY: §2 Retailer Onboarding & Lifecycle
//
// Application pipeline + clarification thread + extended Store Profile
// fixtures. Backend will replace these with real `/admin/applications/*` and
// `/retailer/application/*` endpoints.

import type {
  Application,
  ApplicationStatus,
  BankAccount,
  ClarificationMessage,
  RequiredDocumentType,
  StoreDocument,
  StoreHours,
} from '@/lib/types';

export function mockApplications(): Application[] {
  const now = Date.now();
  const mk = (id: string, status: ApplicationStatus, hoursAgo: number): Application => ({
    id,
    legalName: id === 'app_1' ? 'Aurora Boutique' : id === 'app_2' ? 'Saffron Studio' : 'Indigo Threads',
    email: `${id.replace('app_', 'owner')}@example.com`,
    phone: '+91 9${id.slice(-1)}99999000',
    gstin: `27AAAAA${id.slice(-1)}000A1Z5`,
    pan: `AAAPL${id.slice(-1)}567Q`,
    addressLine: '12 Linking Road',
    pincode: '400050',
    stateCode: 'MH',
    submittedAt: new Date(now - 1000 * 60 * 60 * hoursAgo).toISOString(),
    status,
    pennyDropResult: status === 'docs_requested' ? 'failed' : 'matched',
    gstinVerification: status === 'rejected' ? 'invalid' : 'valid',
    documentsCount: status === 'pending' ? 0 : 4,
    clarificationCount: status === 'docs_requested' ? 2 : 0,
  });
  return [
    mk('app_1', 'pending', 2),
    mk('app_2', 'pending', 14),
    mk('app_3', 'docs_requested', 36),
    mk('app_4', 'approved', 96),
    mk('app_5', 'rejected', 240),
  ];
}

export function mockApplication(id: string): Application | undefined {
  return mockApplications().find((a) => a.id === id);
}

export function mockClarificationThread(applicationId: string): ClarificationMessage[] {
  if (applicationId !== 'app_3') return [];
  const now = Date.now();
  return [
    {
      id: 'msg_1',
      applicationId,
      authorKind: 'admin',
      authorLabel: 'Operations Lead',
      body: 'Bank statement does not show your legal name. Please upload a name-matched proof or update bank details.',
      attachments: [],
      fieldKey: 'bank',
      createdAt: new Date(now - 1000 * 60 * 60 * 30).toISOString(),
    },
    {
      id: 'msg_2',
      applicationId,
      authorKind: 'applicant',
      authorLabel: 'Aurora Boutique',
      body: 'Updated bank account uploaded. Please re-run penny drop.',
      attachments: ['bank_statement_v2.pdf'],
      fieldKey: 'bank',
      createdAt: new Date(now - 1000 * 60 * 60 * 4).toISOString(),
    },
  ];
}

export function mockStoreHours(): StoreHours {
  const standard = { from: '10:00', to: '21:00', closed: false };
  return {
    monday: standard,
    tuesday: standard,
    wednesday: standard,
    thursday: standard,
    friday: standard,
    saturday: { from: '10:00', to: '22:00', closed: false },
    sunday: { from: '11:00', to: '20:00', closed: false },
  };
}

export function mockBankAccount(): BankAccount {
  return {
    accountHolderName: 'Aurora Boutique LLP',
    accountNumber: '••••••••2143',
    ifsc: 'HDFC0001234',
    bankName: 'HDFC Bank',
    pennyDropStatus: 'matched',
    pennyDropAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
  };
}

const REQUIRED_DOCS: RequiredDocumentType[] = [
  'gstin_certificate',
  'pan_card',
  'address_proof',
  'cancelled_cheque',
  'shop_act_license',
];

export function mockStoreDocuments(): StoreDocument[] {
  return REQUIRED_DOCS.map((kind, i) => ({
    id: `doc_${kind}`,
    kind,
    label: kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    status: i < 3 ? 'verified' : i === 3 ? 'pending_review' : 'missing',
    uploadedAt: i === 4 ? null : new Date(Date.now() - 1000 * 60 * 60 * 24 * (i + 1)).toISOString(),
    fileUrl: i === 4 ? null : `https://example.com/docs/${kind}.pdf`,
  }));
}
