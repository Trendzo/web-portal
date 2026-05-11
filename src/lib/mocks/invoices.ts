// MOCK_DEPENDENCY: §17 Consumer Invoicing

import type { GstReturnFile, InvoiceNumberingConfig, TaxInvoice } from '@/lib/types';

const DAY = 1000 * 60 * 60 * 24;
const now = () => Date.now();

export function mockTaxInvoices(): TaxInvoice[] {
  const mk = (id: string, number: string, kind: 'invoice' | 'supplementary' | 'commission', orderId: string, consumerName: string, totalPaise: number, cgstPaise: number, sgstPaise: number, igstPaise: number, linkedInvoiceId: string | null, daysAgo: number): TaxInvoice => ({
    id, number, kind, status: 'issued', orderId, storeId: 'store_self', consumerName,
    issuedAt: new Date(now() - DAY * daysAgo).toISOString(),
    totalPaise, taxableValuePaise: totalPaise - cgstPaise - sgstPaise - igstPaise,
    cgstPaise, sgstPaise, igstPaise, pdfUrl: '#', linkedInvoiceId,
    createdAt: new Date(now() - DAY * (daysAgo + 0.1)).toISOString(),
  });
  return [
    mk('inv_001', 'TI/2026/04/001', 'invoice', 'ord_8821', 'Priya Sharma', 340000, 8100, 8100, 0, null, 2),
    mk('inv_002', 'TI/2026/04/002', 'invoice', 'ord_8820', 'Arjun Verma', 528000, 0, 0, 25143, null, 3),
    mk('inv_003', 'TI/2026/04/002-S', 'supplementary', 'ord_8820', 'Arjun Verma', 12000, 0, 0, 571, 'inv_002', 2),
    mk('inv_004', 'CN/2026/04/001', 'supplementary', 'ord_8807', 'Meera Iyer', -60000, -1428, -1428, 0, 'inv_005', 1),
    mk('inv_005', 'TI/2026/04/003', 'invoice', 'ord_8807', 'Meera Iyer', 219000, 5214, 5214, 0, null, 5),
  ];
}

export function mockTaxInvoice(id: string): TaxInvoice | undefined {
  return mockTaxInvoices().find((i) => i.id === id);
}

export function mockInvoiceNumbering(): InvoiceNumberingConfig[] {
  return [
    { legalEntityId: 'le_aurora_llp', legalEntityName: 'Aurora Boutique LLP', prefix: 'AUR', pattern: '{prefix}/{YYYY}/{MM}/{seq:04d}', nextSequence: 412, resetCycle: 'fiscal_year' },
    { legalEntityId: 'le_saffron_pvtltd', legalEntityName: 'Saffron Studio Pvt Ltd', prefix: 'SAF', pattern: '{prefix}-{YYYY}{MM}-{seq:05d}', nextSequence: 188, resetCycle: 'monthly' },
  ];
}

export function mockGstReturns(): GstReturnFile[] {
  return [0, 1, 2].map((i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const period = d.toISOString().slice(0, 7);
    return [
      { id: `gst_${period}_r1`, period, kind: 'gstr1' as const, generatedAt: i === 0 ? null : new Date(now() - DAY * (i * 30 - 5)).toISOString(), downloadUrl: i === 0 ? null : '#', status: i === 0 ? 'pending' as const : 'ready' as const },
      { id: `gst_${period}_r3b`, period, kind: 'gstr3b' as const, generatedAt: i === 0 ? null : new Date(now() - DAY * (i * 30 - 4)).toISOString(), downloadUrl: i === 0 ? null : '#', status: i === 0 ? 'pending' as const : 'ready' as const },
      { id: `gst_${period}_tcs`, period, kind: 'tcs_reconciliation' as const, generatedAt: i === 0 ? null : new Date(now() - DAY * (i * 30 - 3)).toISOString(), downloadUrl: i === 0 ? null : '#', status: i === 0 ? 'pending' as const : 'ready' as const },
    ];
  }).flat();
}
