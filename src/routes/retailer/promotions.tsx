import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Info, Plus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import {
  discountTypeLabel,
  formatDiscount,
  mechanismLabel,
  promotionStatusMeta,
} from '@/lib/status';
import type { Promotion, PromotionStatus } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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

  const filtered = (data ?? []).filter((p) => {
    if (!q.trim()) return true;
    const n = q.toLowerCase();
    return p.name.toLowerCase().includes(n);
  });

  return (
    <Page>
      <PageHeader
        title={<>Promotions</>}
        description={
          <>
            Promotions you run on your own catalogue. Offers (auto-apply when conditions match)
            are open by default; coupons and vouchers are admin-restricted at launch.
          </>
        }
        actions={
          <Button asChild variant="ink" caps iconLeft={<Plus className="size-3.5" />}>
            <Link to="/retailer/promotions/new">New offer</Link>
          </Button>
        }
      />

      {/* Delegation notice */}
      <div className="mb-6 flex items-start gap-3 border border-rule bg-paper-2/50 px-4 py-3 text-[12.5px] text-ink-2">
        <Info className="size-4 mt-0.5 text-ink-3 shrink-0" />
        <span>
          You can issue <strong className="text-ink">offers</strong> for your own products.{' '}
          <strong className="text-ink">Coupons</strong> and{' '}
          <strong className="text-ink">vouchers</strong> are restricted at launch — contact admin
          to enable them on your store.
        </span>
      </div>

      <div className="mb-6 flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            placeholder="Search by name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="!pl-7"
          />
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
          kicker={q || status !== 'all' ? 'No matches' : 'No promotions yet'}
          title={
            q || status !== 'all' ? 'Nothing matches that filter.' : 'No promotions yet.'
          }
          description="Create your first offer — auto-applies at checkout when conditions match."
          action={
            <Button asChild variant="ink" caps iconLeft={<Plus className="size-3.5" />}>
              <Link to="/retailer/promotions/new">New offer</Link>
            </Button>
          }
        />
      ) : (
        <ol className="border-y border-rule divide-y divide-rule" data-stagger>
          {filtered.map((p, i) => (
            <Row key={p.id} promo={p} ord={i + 1} />
          ))}
        </ol>
      )}
    </Page>
  );
}

function Row({ promo, ord }: { promo: Promotion; ord: number }) {
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
