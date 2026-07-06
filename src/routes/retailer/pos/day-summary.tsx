import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { usePermission } from '@/lib/use-permission';
import type { PosDaySummary } from '@/lib/pos-types';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LineChart } from '@/components/ui/line-chart';
import { PieChart } from '@/components/ui/pie-chart';
import { HBarChart } from '@/components/ui/hbar-chart';
import { WaterfallChart } from '@/components/ui/waterfall-chart';
import { chartColor } from '@/components/ui/chart-palette';

export default function PosDaySummaryPage() {
  const canManage = usePermission('pos.manage');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [openDay, setOpenDay] = useState(false);
  const [closeDay, setCloseDay] = useState(false);

  const { data } = useQuery({
    queryKey: ['retailer', 'pos', 'day-summary', date],
    queryFn: () => api<PosDaySummary>(`/retailer/pos/summary?date=${date}`),
  });

  const session = data?.session ?? null;

  return (
    <Page>
      <PageHeader
        title="Day report"
        description="Counter analytics, finance & end-of-day cash reconciliation."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
            {canManage && data && (
              session == null ? (
                <Button variant="ink" size="sm" onClick={() => setOpenDay(true)}>Open day</Button>
              ) : session.status === 'open' ? (
                <Button variant="ink" size="sm" onClick={() => setCloseDay(true)}>Close day</Button>
              ) : (
                <Badge tone="neutral">Day closed</Badge>
              )
            )}
          </div>
        }
      />

      {!data ? (
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <div className="grid gap-3 sm:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        </div>
      ) : (
        <div className="space-y-4">
          <CashReconciliation data={data} onOpen={() => canManage && setOpenDay(true)} canManage={canManage} />

          {/* KPI row */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Gross takings" value={formatPaise(data.grossPayablePaise)} big />
            <Stat label="Net sales" value={formatPaise(data.netSalesPaise)} sub={`after ${formatPaise(data.refundsPaise)} refunds`} />
            <Stat label="Tax collected" value={formatPaise(data.taxPaise)} sub="CGST + SGST + IGST" />
            <Stat label="Sales" value={String(data.saleCount)} sub={`${data.itemCount} items`} />
            <Stat label="Avg sale" value={formatPaise(data.avgSalePaise)} sub={`${data.avgBasketItems} items / bill`} />
            <Stat label="Discounts given" value={formatPaise(data.discountsPaise)} />
            <Stat label="Change given" value={formatPaise(data.changeGivenPaise)} />
            <Stat label="Round-off" value={formatPaise(data.roundOffPaise)} />
          </div>

          {/* Hourly revenue + tender mix */}
          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            <Panel title="Revenue by hour" hint="IST hour-of-day (completed sales)">
              <LineChart
                labels={data.hourly.map((h) => `${String(h.hour).padStart(2, '0')}`)}
                series={[{ label: 'Revenue', color: 'var(--color-ink)', values: data.hourly.map((h) => h.revenuePaise / 100) }]}
                height={200}
                formatY={(n) => `₹${Math.round(n).toLocaleString('en-IN')}`}
              />
            </Panel>
            <Panel title="Payment mix" hint="Net collected by tender">
              <TenderMix data={data} />
            </Panel>
          </div>

          {/* Top products + cashiers */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Top products" hint="By quantity sold">
              {data.topProducts.length === 0 ? (
                <Empty>No products sold.</Empty>
              ) : (
                <HBarChart
                  rows={data.topProducts.map((p, i) => ({
                    label: p.name,
                    value: p.qty,
                    display: `${p.qty} · ${formatPaise(p.revenuePaise)}`,
                    color: chartColor(i),
                  }))}
                />
              )}
            </Panel>
            <Panel title="By cashier" hint="Revenue per cashier">
              {data.byCashier.length === 0 ? (
                <Empty>No sales yet.</Empty>
              ) : (
                <HBarChart
                  rows={data.byCashier.map((c, i) => ({
                    label: c.name ?? '—',
                    value: c.revenuePaise,
                    display: formatPaise(c.revenuePaise),
                    sub: `${c.saleCount} sales`,
                    color: chartColor(i),
                  }))}
                />
              )}
            </Panel>
          </div>

          {/* GST summary + adjustments */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="GST summary" hint="For the day's tax invoices">
              <Rows
                items={[
                  ['Taxable value', formatPaise(data.taxableValuePaise)],
                  ['CGST', formatPaise(data.cgstPaise)],
                  ['SGST', formatPaise(data.sgstPaise)],
                  ['IGST', formatPaise(data.igstPaise)],
                  ['Total tax', formatPaise(data.taxPaise)],
                ]}
              />
            </Panel>
            <Panel title="Adjustments">
              <Rows
                items={[
                  ['Returns / refunds', formatPaise(data.refundsPaise)],
                  ['Return count', String(data.returnCount)],
                  ['Exchange count', String(data.exchangeCount)],
                  ['Voided (count)', String(data.voidCount)],
                  ['Voided value', formatPaise(data.voidedPaise)],
                ]}
              />
            </Panel>
          </div>
        </div>
      )}

      {openDay && <OpenDayDialog date={date} onClose={() => setOpenDay(false)} />}
      {closeDay && data && (
        <CloseDayDialog date={date} expectedPaise={data.expectedCashPaise} onClose={() => setCloseDay(false)} />
      )}
    </Page>
  );
}

// ───────────────────────── pieces ─────────────────────────

function Stat({ label, value, sub, big }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-bg p-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-4">{label}</div>
      <div className={`mt-1 font-semibold tabular-nums text-ink ${big ? 'text-[24px]' : 'text-[20px]'}`}>{value}</div>
      {sub && <div className="mt-1 text-[11.5px] text-ink-3">{sub}</div>}
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-bg p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        {hint && <span className="text-[11px] text-ink-4">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Rows({ items }: { items: [string, string][] }) {
  return (
    <div className="space-y-1.5 text-[13px]">
      {items.map(([k, v], i) => (
        <div key={k} className={`flex justify-between ${i === items.length - 1 ? 'border-t border-line pt-1.5 font-medium text-ink' : 'text-ink-3'}`}>
          <span>{k}</span>
          <span className="tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-8 text-center text-[13px] text-ink-3 italic">{children}</div>;
}

function TenderMix({ data }: { data: PosDaySummary }) {
  const slices = (['cash', 'card', 'upi'] as const)
    .map((m, i) => ({ label: m.toUpperCase(), value: data.byTenderNet[m]?.net ?? 0, color: chartColor(i) }))
    .filter((s) => s.value > 0);
  if (slices.length === 0) return <Empty>No payments collected.</Empty>;
  const total = slices.reduce((s, x) => s + x.value, 0);
  return <PieChart slices={slices} formatValue={formatPaise} centerValue={formatPaise(total)} centerLabel="collected" />;
}

function CashReconciliation({ data, onOpen, canManage }: { data: PosDaySummary; onOpen: () => void; canManage: boolean }) {
  const s = data.session;
  if (!s) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-line bg-bg-2/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[14px] font-semibold text-ink">Cash drawer not opened for this day</div>
          <div className="text-[12.5px] text-ink-3">Open the day with your starting float to reconcile cash at close.</div>
        </div>
        {canManage && <Button variant="outline" size="sm" onClick={onOpen}>Open day</Button>}
      </div>
    );
  }
  const expected = s.expectedCashPaise ?? data.expectedCashPaise;
  const steps = [
    { label: 'Opening float', amountPaise: s.openingFloatPaise, kind: 'start' as const },
    { label: 'Cash sales', amountPaise: data.cashCollectedPaise, kind: 'addition' as const },
    { label: 'Cash refunds', amountPaise: -data.cashRefundedPaise, kind: 'deduction' as const },
    { label: 'Expected in drawer', amountPaise: expected ?? 0, kind: 'total' as const },
  ];
  const closed = s.status === 'closed';
  const variance = s.cashVariancePaise ?? 0;
  return (
    <div className="rounded-xl border border-line bg-bg p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink">Cash reconciliation</h3>
        <Badge tone={closed ? 'neutral' : 'success'}>{closed ? 'Closed' : 'Open'}</Badge>
      </div>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <WaterfallChart steps={steps} />
        <div className="space-y-1.5 self-center text-[13px]">
          <div className="flex justify-between text-ink-3"><span>Opening float</span><span className="tabular-nums">{formatPaise(s.openingFloatPaise)}</span></div>
          <div className="flex justify-between text-ink-3"><span>Expected in drawer</span><span className="tabular-nums">{formatPaise(expected ?? 0)}</span></div>
          {closed && (
            <>
              <div className="flex justify-between text-ink-3"><span>Counted</span><span className="tabular-nums">{formatPaise(s.countedCashPaise ?? 0)}</span></div>
              <div className={`flex justify-between border-t border-line pt-1.5 font-medium ${variance === 0 ? 'text-ink' : variance > 0 ? 'text-success' : 'text-danger'}`}>
                <span>Variance {variance > 0 ? '(over)' : variance < 0 ? '(short)' : ''}</span>
                <span className="tabular-nums">{formatPaise(variance)}</span>
              </div>
              {s.closedAt && <div className="text-[11.5px] text-ink-4">Closed {new Date(s.closedAt).toLocaleString('en-IN')}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OpenDayDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [floatRupees, setFloatRupees] = useState('');
  const open = useMutation({
    mutationFn: () =>
      api('/retailer/pos/day/open', {
        method: 'POST',
        body: { openingFloatPaise: Math.round(Number(floatRupees || '0') * 100), date },
      }),
    onSuccess: () => {
      toast.success('Day opened');
      void qc.invalidateQueries({ queryKey: ['retailer', 'pos', 'day-summary'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not open day'),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Open day — starting cash float</DialogTitle></DialogHeader>
        <p className="text-[13px] text-ink-3">Enter the cash in the drawer at the start of the day. Used to reconcile at close.</p>
        <div>
          <label className="text-[12px] text-ink-3">Opening float (₹)</label>
          <Input type="number" min={0} inputMode="decimal" value={floatRupees} onChange={(e) => setFloatRupees(e.target.value)} placeholder="2000" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={open.isPending} onClick={() => open.mutate()}>Open day</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseDayDialog({ date, expectedPaise, onClose }: { date: string; expectedPaise: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [countedRupees, setCountedRupees] = useState('');
  const [note, setNote] = useState('');
  const countedPaise = Math.round(Number(countedRupees || '0') * 100);
  const variance = countedPaise - expectedPaise;
  const close = useMutation({
    mutationFn: () =>
      api('/retailer/pos/day/close', {
        method: 'POST',
        body: { countedCashPaise: countedPaise, note: note.trim() || undefined, date },
      }),
    onSuccess: () => {
      toast.success('Day closed');
      void qc.invalidateQueries({ queryKey: ['retailer', 'pos', 'day-summary'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not close day'),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Close day — count the drawer</DialogTitle></DialogHeader>
        <div className="rounded-lg border border-line bg-bg-2/40 p-3 text-[13px]">
          <div className="flex justify-between text-ink-3"><span>Expected in drawer</span><span className="tabular-nums">{formatPaise(expectedPaise)}</span></div>
          <div className={`mt-1 flex justify-between font-medium ${variance === 0 ? 'text-ink' : variance > 0 ? 'text-success' : 'text-danger'}`}>
            <span>Variance {variance > 0 ? '(over)' : variance < 0 ? '(short)' : ''}</span>
            <span className="tabular-nums">{countedRupees ? formatPaise(variance) : '—'}</span>
          </div>
        </div>
        <div>
          <label className="text-[12px] text-ink-3">Counted cash (₹)</label>
          <Input type="number" min={0} inputMode="decimal" value={countedRupees} onChange={(e) => setCountedRupees(e.target.value)} placeholder={String(Math.round(expectedPaise / 100))} />
        </div>
        <div>
          <label className="text-[12px] text-ink-3">Note (optional)</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. ₹50 short — float miscount" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="ink" disabled={!countedRupees} loading={close.isPending} onClick={() => close.mutate()}>Close day (Z-report)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
