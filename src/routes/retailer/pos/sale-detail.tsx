import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Printer, Receipt, RotateCcw, Ban, ArrowLeft, ArrowLeftRight, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { usePermission } from '@/lib/use-permission';
import { printInvoiceA4, printReceipt80mm, downloadSalePdf } from '@/lib/pos-print';
import type { PosSaleDetail, PosLookupResult, PosLookupRow, PosQuote, TenderMethod } from '@/lib/pos-types';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';

const TENDERS: { value: TenderMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
];

/** The method the customer originally paid with — the default target for a refund. */
function originalTender(sale: PosSaleDetail): TenderMethod {
  return sale.payments.find((p) => p.direction === 'collect')?.method ?? 'cash';
}

export default function PosSaleDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canRefund = usePermission('pos.refund');
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [returnOpen, setReturnOpen] = useState(false);
  const [exchangeOpen, setExchangeOpen] = useState(false);

  const { data: sale } = useQuery({
    queryKey: ['retailer', 'pos', 'sale', id],
    queryFn: () => api<PosSaleDetail>(`/retailer/pos/sales/${id}`),
  });

  const voidSale = useMutation({
    mutationFn: () =>
      api(`/retailer/pos/sales/${id}/void`, { method: 'POST', body: { reason: voidReason } }),
    onSuccess: () => {
      toast.success('Sale voided');
      setVoidOpen(false);
      qc.invalidateQueries({ queryKey: ['retailer', 'pos'] });
      qc.invalidateQueries({ queryKey: ['retailer', 'inventory'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not void'),
  });

  if (!sale) return <Page><Empty title="Loading…" /></Page>;

  const isReturn = Boolean(sale.originalSaleId);

  return (
    <Page>
      <button
        type="button"
        onClick={() => navigate('/retailer/pos/sales')}
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Back to sales
      </button>
      <PageHeader
        title={sale.invoice?.invoiceNumber ?? 'Counter sale'}
        description={sale.completedAt ? new Date(sale.completedAt).toLocaleString('en-IN') : ''}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" iconLeft={<Printer className="size-4" />} onClick={() => printInvoiceA4(sale)}>
              Invoice
            </Button>
            <Button variant="outline" size="sm" iconLeft={<Receipt className="size-4" />} onClick={() => printReceipt80mm(sale)}>
              Receipt
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                downloadSalePdf(sale.id, sale.invoice?.invoiceNumber ?? 'invoice').catch((e) => toast.error(e.message))
              }
            >
              PDF
            </Button>
            {canRefund && sale.status === 'completed' && !isReturn && (
              <>
                <Button variant="outline" size="sm" iconLeft={<RotateCcw className="size-4" />} onClick={() => setReturnOpen(true)}>
                  Return
                </Button>
                <Button variant="outline" size="sm" iconLeft={<ArrowLeftRight className="size-4" />} onClick={() => setExchangeOpen(true)}>
                  Exchange
                </Button>
                <Button variant="danger" size="sm" iconLeft={<Ban className="size-4" />} onClick={() => setVoidOpen(true)}>
                  Void
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        {sale.status === 'voided' ? (
          <Badge tone="danger">Voided</Badge>
        ) : isReturn ? (
          <Badge tone="warning">Return</Badge>
        ) : (
          <Badge tone="success">Paid</Badge>
        )}
        <span className="text-[13px] text-ink-3">
          {sale.customerNameSnap || 'Walk-in customer'}
          {sale.customerPhoneSnap ? ` · ${sale.customerPhoneSnap}` : ''}
          {sale.customerGstinSnap ? ` · GSTIN ${sale.customerGstinSnap}` : ''}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-bg">
        <table className="w-full text-[13px]">
          <thead className="bg-bg-2 text-[11px] uppercase text-ink-4">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Rate</th>
              <th className="px-3 py-2 text-right font-medium">GST</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((it) => (
              <tr key={it.id} className="border-t border-line">
                <td className="px-3 py-2">
                  <div className="font-medium text-ink">{it.listingNameSnap}</div>
                  <div className="text-[11px] text-ink-4">{it.attributesLabelSnap}{it.skuSnap ? ` · ${it.skuSnap}` : ''}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPaise(it.unitMrpPaise)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPaise(it.gstPaise)} ({it.gstRateBp / 100}%)</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{formatPaise(it.netLinePaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-line p-3">
          <div className="ml-auto w-64 space-y-1 text-[13px]">
            <Tot label="Taxable" value={formatPaise(sale.taxableValuePaise)} />
            <Tot label="CGST" value={formatPaise(sale.cgstPaise)} />
            <Tot label="SGST" value={formatPaise(sale.sgstPaise)} />
            {sale.roundOffPaise !== 0 && <Tot label="Round off" value={formatPaise(sale.roundOffPaise)} />}
            <div className="flex justify-between border-t border-line pt-1 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatPaise(sale.payablePaise)}</span>
            </div>
            {(sale.returnLines?.length ?? 0) > 0 && (
              <Tot
                label={`Returned credit (${sale.returnLines!.reduce((s, r) => s + r.qty, 0)})`}
                value={`− ${formatPaise(sale.returnLines!.reduce((s, r) => s + r.refundPaise, 0))}`}
                muted
              />
            )}
            {sale.payments.filter((p) => p.direction === 'collect').map((p) => (
              <Tot key={p.id} label={`Paid · ${p.method.toUpperCase()}`} value={formatPaise(p.amountPaise)} muted />
            ))}
            {sale.payments.filter((p) => p.direction === 'refund').map((p) => (
              <Tot key={p.id} label={`Refunded · ${p.method.toUpperCase()}`} value={formatPaise(p.amountPaise)} muted />
            ))}
            {sale.changePaise > 0 && <Tot label="Change" value={formatPaise(sale.changePaise)} muted />}
          </div>
        </div>
      </div>

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void this sale?</DialogTitle></DialogHeader>
          <p className="text-[13px] text-ink-3">Restores stock and issues a credit note. This cannot be undone.</p>
          <Input placeholder="Reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={!voidReason} loading={voidSale.isPending} onClick={() => voidSale.mutate()}>
              Void sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {returnOpen && <ReturnDialog sale={sale} onClose={() => setReturnOpen(false)} />}
      {exchangeOpen && (
        <ExchangeDialog
          sale={sale}
          onClose={() => setExchangeOpen(false)}
          onDone={(exchangeSaleId) => {
            setExchangeOpen(false);
            navigate(`/retailer/pos/sales/${exchangeSaleId}`);
          }}
        />
      )}
    </Page>
  );
}

function Tot({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? 'text-ink-4' : 'text-ink-3'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function ReturnDialog({ sale, onClose }: { sale: PosSaleDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  // Default the refund to the method the customer originally paid with.
  const [method, setMethod] = useState<TenderMethod>(() => originalTender(sale));

  const refundPaise = sale.items.reduce((s, it) => {
    const q = qtys[it.id] ?? 0;
    return s + Math.round((it.netLinePaise * q) / it.qty);
  }, 0);

  const submit = useMutation({
    mutationFn: () =>
      api(`/retailer/pos/sales/${sale.id}/returns`, {
        method: 'POST',
        body: {
          idempotencyKey: `posret-${sale.id}-${crypto.randomUUID()}`,
          reason,
          lines: sale.items
            .filter((it) => (qtys[it.id] ?? 0) > 0)
            .map((it) => ({ originalSaleItemId: it.id, qty: qtys[it.id], restock: true })),
          refundTenders: [{ method, amountPaise: refundPaise }],
        },
      }),
    onSuccess: () => {
      toast.success('Return processed');
      onClose();
      qc.invalidateQueries({ queryKey: ['retailer', 'pos'] });
      qc.invalidateQueries({ queryKey: ['retailer', 'inventory'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Return failed'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Return items</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {sale.items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{it.listingNameSnap}</span>
                <span className="text-[11px] text-ink-4">bought {it.qty} · {formatPaise(it.netLinePaise)}</span>
              </span>
              <Input
                type="number"
                min={0}
                max={it.qty}
                value={qtys[it.id] ?? 0}
                onChange={(e) =>
                  setQtys((p) => ({ ...p, [it.id]: Math.max(0, Math.min(it.qty, Number(e.target.value))) }))
                }
                className="w-20"
              />
            </div>
          ))}
          <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div>
            <div className="mb-1 text-[11px] uppercase text-ink-4">Refund to</div>
            <Segmented options={TENDERS} value={method} onChange={setMethod} className="w-full" />
          </div>
        </div>
        <DialogFooter>
          <span className="mr-auto text-[13px] font-medium">Refund: {formatPaise(refundPaise)}</span>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="accent" disabled={refundPaise <= 0 || !reason} loading={submit.isPending} onClick={() => submit.mutate()}>
            Refund {method.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Exchange: hand back original line(s) + sell replacement variant(s), settling only the net.
 * Return value is prorated off the original lines; the new side is priced by the server `/quote`
 * (exact GST). If the customer owes, collect the difference; if they're owed, refund it.
 */
function ExchangeDialog({
  sale,
  onClose,
  onDone,
}: {
  sale: PosSaleDetail;
  onClose: () => void;
  onDone: (exchangeSaleId: string) => void;
}) {
  const qc = useQueryClient();
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [newItems, setNewItems] = useState<{ row: PosLookupRow; qty: number }[]>([]);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<PosLookupRow[]>([]);
  const [collectMethod, setCollectMethod] = useState<TenderMethod>('cash');
  const [refundMethod, setRefundMethod] = useState<TenderMethod>(() => originalTender(sale));

  const returnValue = useMemo(
    () => sale.items.reduce((s, it) => s + Math.round((it.netLinePaise * (qtys[it.id] ?? 0)) / it.qty), 0),
    [qtys, sale.items],
  );
  const newLines = useMemo(
    () => newItems.filter((n) => n.qty > 0).map((n) => ({ variantId: n.row.variantId, qty: n.qty })),
    [newItems],
  );

  // Price the new side exactly (GST) via the same quote endpoint the register uses.
  const { data: quote, isFetching: quoting } = useQuery({
    queryKey: ['retailer', 'pos', 'exch-quote', newLines],
    queryFn: () => api<PosQuote>('/retailer/pos/quote', { method: 'POST', body: { lines: newLines } }),
    enabled: newLines.length > 0,
  });
  const newValue = newLines.length > 0 ? quote?.payablePaise ?? 0 : 0;
  const net = newValue - returnValue;

  function addItem(row: PosLookupRow) {
    setNewItems((prev) => {
      const ex = prev.find((n) => n.row.variantId === row.variantId);
      if (ex) return prev.map((n) => (n.row.variantId === row.variantId ? { ...n, qty: n.qty + 1 } : n));
      return [...prev, { row, qty: 1 }];
    });
    setResults([]);
    setSearch('');
  }
  async function runSearch() {
    const q = search.trim();
    if (q.length < 1) return;
    try {
      const res = await api<PosLookupResult>(`/retailer/pos/lookup?q=${encodeURIComponent(q)}`);
      const rows = res.exact ? [res.exact] : res.results;
      if (rows.length === 1 && rows[0]) addItem(rows[0]);
      else if (rows.length === 0) toast.error(`No product for "${q}"`);
      else setResults(rows);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Lookup failed');
    }
  }

  const submit = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        idempotencyKey: `posexc-${sale.id}-${crypto.randomUUID()}`,
        reason,
        returnLines: sale.items
          .filter((it) => (qtys[it.id] ?? 0) > 0)
          .map((it) => ({ originalSaleItemId: it.id, qty: qtys[it.id], restock: true })),
        newLines,
      };
      if (net > 0) body.collectTenders = [{ method: collectMethod, amountPaise: net }];
      else if (net < 0) body.refundTenders = [{ method: refundMethod, amountPaise: -net }];
      return api<{ exchangeSaleId: string }>(`/retailer/pos/sales/${sale.id}/exchange`, { method: 'POST', body });
    },
    onSuccess: (res) => {
      toast.success('Exchange processed');
      qc.invalidateQueries({ queryKey: ['retailer', 'pos'] });
      qc.invalidateQueries({ queryKey: ['retailer', 'inventory'] });
      onDone(res.exchangeSaleId);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Exchange failed'),
  });

  const canSubmit =
    Boolean(reason) && returnValue > 0 && newLines.length > 0 && !quoting && Boolean(quote);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Exchange items</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Return side */}
          <div>
            <div className="mb-2 text-[11px] uppercase text-ink-4">Return</div>
            <div className="space-y-2">
              {sale.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{it.listingNameSnap}</span>
                    <span className="text-[11px] text-ink-4">bought {it.qty} · {formatPaise(it.netLinePaise)}</span>
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={it.qty}
                    value={qtys[it.id] ?? 0}
                    onChange={(e) =>
                      setQtys((p) => ({ ...p, [it.id]: Math.max(0, Math.min(it.qty, Number(e.target.value))) }))
                    }
                    className="w-20"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Add-new side */}
          <div>
            <div className="mb-2 text-[11px] uppercase text-ink-4">New items</div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
              <Input
                className="pl-8"
                placeholder="Scan / search to add…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runSearch(); } }}
              />
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-bg shadow-lg">
                  {results.map((r) => (
                    <button
                      key={r.variantId}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-bg-2"
                      onClick={() => addItem(r)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{r.name}</span>
                        <span className="block truncate text-[11px] text-ink-4">
                          {r.attributesLabel}{r.sku ? ` · ${r.sku}` : ''} · {r.availableQty} in stock
                        </span>
                      </span>
                      <span className="shrink-0 font-medium">{formatPaise(r.pricePaise)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 space-y-1.5">
              {newItems.map((n) => (
                <div key={n.row.variantId} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{n.row.name}</span>
                    <span className="text-[11px] text-ink-4">{n.row.attributesLabel} · {formatPaise(n.row.pricePaise)}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      value={n.qty}
                      onChange={(e) =>
                        setNewItems((p) =>
                          p.map((x) => (x.row.variantId === n.row.variantId ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x)),
                        )
                      }
                      className="w-16"
                    />
                    <button type="button" onClick={() => setNewItems((p) => p.filter((x) => x.row.variantId !== n.row.variantId))}>
                      <X className="size-3.5 text-ink-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-2 rounded-lg border border-line bg-bg-2/40 p-3 text-[13px]">
          <div className="flex justify-between text-ink-3"><span>Returned credit</span><span className="tabular-nums">− {formatPaise(returnValue)}</span></div>
          <div className="flex justify-between text-ink-3"><span>New items {quoting ? '…' : ''}</span><span className="tabular-nums">{formatPaise(newValue)}</span></div>
          <div className="mt-1 flex justify-between border-t border-line pt-1 font-semibold">
            <span>{net > 0 ? 'Customer pays' : net < 0 ? 'Refund' : 'Even exchange'}</span>
            <span className="tabular-nums">{formatPaise(Math.abs(net))}</span>
          </div>
          {net > 0 && (
            <div className="mt-2">
              <div className="mb-1 text-[11px] uppercase text-ink-4">Collect via</div>
              <Segmented options={TENDERS} value={collectMethod} onChange={setCollectMethod} className="w-full" />
            </div>
          )}
          {net < 0 && (
            <div className="mt-2">
              <div className="mb-1 text-[11px] uppercase text-ink-4">Refund to</div>
              <Segmented options={TENDERS} value={refundMethod} onChange={setRefundMethod} className="w-full" />
            </div>
          )}
        </div>

        <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="accent" disabled={!canSubmit} loading={submit.isPending} onClick={() => submit.mutate()}>
            {net > 0 ? `Collect ${formatPaise(net)}` : net < 0 ? `Refund ${formatPaise(-net)}` : 'Complete exchange'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
