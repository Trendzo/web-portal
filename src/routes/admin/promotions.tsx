import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Plus, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  discountTypeLabel,
  formatDiscount,
  mechanismLabel,
  promotionStatusMeta,
} from '@/lib/status';
import type { Mechanism, Promotion, PromotionStatus } from '@/lib/types';
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
  { value: 'exhausted', label: 'Exhausted' },
  { value: 'revoked', label: 'Revoked' },
];

const MECH_OPTIONS: ReadonlyArray<{ value: Mechanism | 'all'; label: string }> = [
  { value: 'all', label: 'All mechanisms' },
  { value: 'offer', label: 'Offers (auto)' },
  { value: 'coupon', label: 'Coupons (code)' },
  { value: 'voucher', label: 'Vouchers (single-use)' },
];

export default function AdminPromotions() {
  const [status, setStatus] = useState<PromotionStatus | 'all'>('all');
  const [mechanism, setMechanism] = useState<Mechanism | 'all'>('all');
  const [q, setQ] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'promotions', status, mechanism],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (mechanism !== 'all') params.set('mechanism', mechanism);
      const qs = params.toString();
      return api<Promotion[]>(`/admin/promotions${qs ? `?${qs}` : ''}`);
    },
  });

  const filtered = (data ?? []).filter((p) => {
    if (!q.trim()) return true;
    const n = q.toLowerCase();
    return p.name.toLowerCase().includes(n) || p.id.toLowerCase().includes(n);
  });

  return (
    <Page>
      <PageHeader
        title={<>Promotions</>}
        description={
          <>
            Offers (auto-applied), coupons (consumer enters code), and vouchers (single-use codes).
            Approved retailers can also issue offers for their own catalogue.
          </>
        }
        actions={
          <Button asChild variant="ink" caps iconLeft={<Plus className="size-3.5" />}>
            <Link to="/admin/promotions/new">New promotion</Link>
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex max-w-md flex-1 items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input
              placeholder="Search by name or ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="!pl-7"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={mechanism} onValueChange={(v) => setMechanism(v as Mechanism | 'all')}>
            <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MECH_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as PromotionStatus | 'all')}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-px border-y border-rule" data-stagger>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : isError ? (
        <Empty
          kicker="Connection lost"
          title="Couldn't load promotions"
          action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
        />
      ) : filtered.length === 0 ? (
        <Empty
          kicker={q || status !== 'all' || mechanism !== 'all' ? 'No matches' : 'No promotions yet'}
          title={
            q || status !== 'all' || mechanism !== 'all'
              ? 'Nothing matches that filter.'
              : 'No promotions yet.'
          }
          description="Create an offer, coupon, or voucher to start running campaigns."
          action={
            <Button asChild variant="ink" caps iconLeft={<Plus className="size-3.5" />}>
              <Link to="/admin/promotions/new">New promotion</Link>
            </Button>
          }
        />
      ) : (
        <ol className="border-y border-rule divide-y divide-rule" data-stagger>
          {filtered.map((p, i) => (
            <PromotionRow key={p.id} promo={p} ord={i + 1} />
          ))}
        </ol>
      )}
    </Page>
  );
}

function PromotionRow({ promo, ord }: { promo: Promotion; ord: number }) {
  const meta = promotionStatusMeta(promo.effectiveStatus);
  const cap =
    promo.totalUses != null
      ? `${promo.redeemedCount.toLocaleString('en-IN')} / ${promo.totalUses.toLocaleString('en-IN')}`
      : `${promo.redeemedCount.toLocaleString('en-IN')} / ∞`;
  return (
    <li>
      <Link
        to={`/admin/promotions/${promo.id}`}
        className="grid grid-cols-12 gap-4 px-2 py-5 hover:bg-surface/40 transition-colors group"
      >
        <div className="col-span-12 lg:col-span-1">
          <span className="font-mono text-[11px] tracking-wider text-ink-3">
            № {String(ord).padStart(3, '0')}
          </span>
        </div>
        <div className="col-span-12 lg:col-span-5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display italic text-[22px] leading-tight text-ink truncate">
              {promo.name}
            </h3>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <Badge flat>{mechanismLabel(promo.mechanism)}</Badge>
          </div>
          <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-ink-3">
            {promo.storeId ? 'Store-scoped' : 'Platform-wide'} · {discountTypeLabel(promo.discountType)}
          </p>
        </div>
        <div className="col-span-6 lg:col-span-3">
          <div className="kicker text-ink-3">Discount</div>
          <div className="font-mono text-[14px] text-ink mt-0.5">
            {formatDiscount(promo.discountType, promo.config)}
          </div>
        </div>
        <div className="col-span-5 lg:col-span-2">
          <div className="kicker text-ink-3">Redeemed</div>
          <div className="font-mono text-[14px] text-ink mt-0.5 tabular-nums">{cap}</div>
        </div>
        <div className="col-span-1 lg:col-span-1 flex items-center justify-end">
          <ArrowUpRight className="size-4 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
      </Link>
    </li>
  );
}

// Suppress unused — kept for API parity with other pages.
void ApiError;
