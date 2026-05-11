import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import type { TaxInvoice } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';

type InvoiceDetail = TaxInvoice & {
  creditNotes: Array<{
    id: string;
    creditNoteNumber: string;
    reason: string;
    grandTotalReversedPaise: number;
    issuedAt: string;
  }>;
};

export default function RetailerTaxInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'tax-invoices', id],
    queryFn: () => api<InvoiceDetail>(`/retailer/invoices/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading) return <Page><Skeleton className="h-72" /></Page>;
  if (!data) return <Page><PageHeader title="Invoice not found" /></Page>;

  return (
    <Page>
      <PageHeader
        kicker="Invoicing"
        title={data.number}
        description={`${data.kind} · order ${data.orderId} · ${data.consumerName}`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
              <Link to="/retailer/tax-invoices">Back</Link>
            </Button>
            {data.pdfUrl ? (
              <Button asChild variant="accent" iconLeft={<Download className="size-3.5" />}>
                <a href={data.pdfUrl} target="_blank" rel="noopener noreferrer">Download PDF</a>
              </Button>
            ) : (
              <Button variant="accent" iconLeft={<Download className="size-3.5" />} disabled>PDF not ready</Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Header" title="Invoice details" />
            <MetaList
              cols={1}
              items={[
                { label: 'Invoice number', value: data.number, mono: true },
                { label: 'Kind', value: <Badge tone={data.kind === 'invoice' ? 'info' : data.kind === 'supplementary' ? 'warning' : 'neutral'} flat>{data.kind}</Badge> },
                { label: 'Status', value: <Badge tone={data.status === 'issued' ? 'success' : data.status === 'credited' ? 'neutral' : 'warning'}>{data.status}</Badge> },
                { label: 'Issued', value: data.issuedAt ? new Date(data.issuedAt).toLocaleString('en-IN') : '—' },
                { label: 'Order', value: data.orderId, mono: true },
                { label: 'Customer', value: data.consumerName },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Tax breakdown" title="Per component" />
            <MetaList
              cols={1}
              items={[
                { label: 'Grand total', value: formatPaise(data.totalPaise) },
                { label: 'CGST', value: formatPaise(data.cgstPaise), mono: true },
                { label: 'SGST', value: formatPaise(data.sgstPaise), mono: true },
                { label: 'IGST', value: formatPaise(data.igstPaise), mono: true },
              ]}
            />
          </CardContent>
        </Card>

        {data.creditNotes.length > 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <SectionHeading kicker="Credit notes" title="Linked credit notes" hint={`${data.creditNotes.length} linked`} />
              <ul className="space-y-2">
                {data.creditNotes.map((cn) => (
                  <li key={cn.id} className="flex items-center justify-between rounded-md border border-line bg-bg-2/30 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral" flat>credit note</Badge>
                      <span className="font-mono text-[12px] text-ink">{cn.creditNoteNumber}</span>
                      <span className="text-[12px] text-ink-3">−{formatPaise(cn.grandTotalReversedPaise)}</span>
                      <span className="text-[11.5px] text-ink-4">{cn.reason}</span>
                    </div>
                    <span className="text-[11.5px] text-ink-4">
                      {new Date(cn.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </Page>
  );
}
