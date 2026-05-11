import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Info, Plus, Search, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import {
  discountTypeLabel,
  formatDiscount,
  formatPaise,
  mechanismLabel,
  promotionStatusMeta,
} from '@/lib/status';
import type { Mechanism, Promotion, PromotionPerformance, PromotionStatus } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS: ReadonlyArray<{ value: PromotionStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'paused', label: 'Paused' },
  { value: 'draft', label: 'Draft' },
  { value: 'expired', label: 'Expired' },
];

export default function RetailerPromotions() {
  return (
    <Page>
      <PageHeader
        title={<>Promotions</>}
        description={
          <>
            Promotions you run on your own catalogue. Offers (auto-apply) are open by default;
            coupons and vouchers are admin-restricted at launch.
          </>
        }
        actions={
          <Button asChild variant="ink" caps iconLeft={<Plus className="size-3.5" />}>
            <Link to="/retailer/promotions/new">New offer</Link>
          </Button>
        }
      />

      <div className="mb-6 flex items-start gap-3 border border-rule bg-paper-2/50 px-4 py-3 text-[12.5px] text-ink-2">
        <Info className="size-4 mt-0.5 text-ink-3 shrink-0" />
        <span>
          You can issue <strong className="text-ink">offers</strong> for your own products.{' '}
          <strong className="text-ink">Coupons</strong> and{' '}
          <strong className="text-ink">vouchers</strong> are restricted at launch — contact admin
          to enable them on your store.
        </span>
      </div>

      <Tabs defaultValue="offers">
        <TabsList className="overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="prices">Variant prices</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="vouchers">Vouchers</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="prices"><VariantPricesTab /></TabsContent>
        <TabsContent value="offers"><MechanismList mechanism="offer" /></TabsContent>
        <TabsContent value="coupons"><MechanismList mechanism="coupon" /></TabsContent>
        <TabsContent value="vouchers"><MechanismList mechanism="voucher" /></TabsContent>
        <TabsContent value="performance"><PerformanceTab /></TabsContent>
      </Tabs>
    </Page>
  );
}

function VariantPricesTab() {
  return (
    <Empty
      title="Variant pricing lives on its own page."
      description="Edit per-variant prices and see audit log there."
      action={
        <Button asChild variant="ink" iconRight={<ArrowUpRight className="size-3.5" />}>
          <Link to="/retailer/pricing">Open variant pricing</Link>
        </Button>
      }
    />
  );
}

function MechanismList({ mechanism }: { mechanism: Mechanism }) {
  const [status, setStatus] = useState<PromotionStatus | 'all'>('all');
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'promotions', status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      const qs = params.toString();
      return api<Promotion[]>(`/retailer/promotions${qs ? `?${qs}` : ''}`);
    },
  });

  const filtered = (data ?? [])
    .filter((p) => p.mechanism === mechanism)
    .filter((p) => (q.trim() ? p.name.toLowerCase().includes(q.toLowerCase()) : true));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} className="!pl-7" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as PromotionStatus | 'all')}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : filtered.length === 0 ? (
        <Empty
          kicker="None"
          title={`No ${mechanism}s match this filter.`}
          {...(mechanism === 'offer' && {
            action: (
              <Button asChild variant="ink" caps iconLeft={<Plus className="size-3.5" />}>
                <Link to="/retailer/promotions/new">New offer</Link>
              </Button>
            ),
          })}
        />
      ) : (
        <ol className="border-y border-rule divide-y divide-rule" data-stagger>
          {filtered.map((p, i) => <PromoRow key={p.id} promo={p} ord={i + 1} />)}
        </ol>
      )}
    </>
  );
}

function PerformanceTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'promotions', 'performance'],
    queryFn: () =>
      api<PromotionPerformance[]>('/retailer/promotions/performance'),
  });
  const list = data ?? [];
  return (
    <div className="space-y-3">
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : list.length === 0 ? (
        <Empty kicker="No data" title="No promotion metrics yet." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Promotion</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Redemptions</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">GMV influence</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">AOV lift</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Refund rate</th>
                  <th className="px-3 py-2 text-center font-medium text-ink-3">Anomaly</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.promotionId} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{m.name}</td>
                    <td className="px-3 py-2 text-right font-mono">{m.redemptions.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaise(m.gmvInfluencePaise)}</td>
                    <td className="px-3 py-2 text-right font-mono">+{(m.aovLiftBp / 100).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right font-mono">{(m.refundRateBp / 100).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-center">
                      {m.anomalyFlagged ? <Badge tone="danger" pulse><Sparkles className="size-3 mr-1 inline" />Flagged</Badge> : <span className="text-ink-4">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PromoRow({ promo, ord }: { promo: Promotion; ord: number }) {
  const meta = promotionStatusMeta(promo.effectiveStatus);
  return (
    <li>
      <Link
        to={`/retailer/promotions/${promo.id}`}
        className="grid grid-cols-12 gap-4 px-2 py-5 hover:bg-surface/40 transition-colors group"
      >
        <div className="col-span-12 lg:col-span-1">
          <span className="font-mono text-[11px] tracking-wider text-ink-3">
            № {String(ord).padStart(3, '0')}
          </span>
        </div>
        <div className="col-span-12 lg:col-span-6 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display italic text-[22px] leading-tight text-ink truncate">{promo.name}</h3>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <Badge flat>{mechanismLabel(promo.mechanism)}</Badge>
          </div>
          <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-ink-3">
            {discountTypeLabel(promo.discountType)}
          </p>
        </div>
        <div className="col-span-6 lg:col-span-3">
          <div className="kicker text-ink-3">Discount</div>
          <div className="font-mono text-[14px] text-ink mt-0.5">
            {formatDiscount(promo.discountType, promo.config)}
          </div>
        </div>
        <div className="col-span-5 lg:col-span-1">
          <div className="kicker text-ink-3">Used</div>
          <div className="font-mono text-[14px] text-ink mt-0.5 tabular-nums">
            {promo.redeemedCount}
          </div>
        </div>
        <div className="col-span-1 lg:col-span-1 flex items-center justify-end">
          <ArrowUpRight className="size-4 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
      </Link>
    </li>
  );
}
