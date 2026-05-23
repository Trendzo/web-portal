import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, History, Save, TrendingDown } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { Listing } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

type AuditEntry = {
  id: string;
  listingId: string;
  variantId: string | null;
  beforePaise: number;
  afterPaise: number;
  actorKind: string;
  actorId: string | null;
  at: string;
};

type AppliedPromo = {
  promotionId: string;
  name: string;
  appliedTo: 'retailer_promo' | 'platform_promo' | 'coupon' | 'shipping' | 'loyalty';
  discountType: string;
  amountPaise: number;
};

type EffectivePriceRow = {
  variantId: string;
  attributesLabel: string;
  basePaise: number;
  postPromoSubtotalPaise: number;
  effectivePaise: number;
  totalDiscountPaise: number;
  appliedPromos: AppliedPromo[];
};

export default function RetailerPricing() {
  const qc = useQueryClient();
  const listings = useQuery({
    queryKey: ['retailer', 'listings'],
    queryFn: () => api<Listing[]>('/retailer/listings'),
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const auditQ = useQuery({
    queryKey: ['retailer', 'audit', 'recent-price-changes'],
    queryFn: () => api<AuditEntry[]>('/retailer/audit/recent-price-changes'),
    staleTime: 10_000,
  });
  const audit = auditQ.data ?? [];

  const all = listings.data ?? [];
  const rows = all.flatMap((l) =>
    (l.variants ?? []).map((v) => ({ listing: l, variant: v })),
  );

  const listingIds = useMemo(() => Array.from(new Set(all.map((l) => l.id))), [all]);
  const effectiveQueries = useQueries({
    queries: listingIds.map((lid) => ({
      queryKey: ['retailer', 'listing-effective-pricing', lid],
      queryFn: () => api<EffectivePriceRow[]>(`/retailer/listings/${lid}/effective-pricing`),
      staleTime: 30_000,
    })),
  });

  const effectiveByVariant = useMemo(() => {
    const map = new Map<string, EffectivePriceRow>();
    for (const q of effectiveQueries) {
      if (q.data) for (const r of q.data) map.set(r.variantId, r);
    }
    return map;
  }, [effectiveQueries]);

  async function commit(variantId: string, before: number, listingId: string) {
    const draft = drafts[variantId];
    if (!draft) return;
    const after = Math.round(Number(draft) * 100);
    if (!Number.isFinite(after) || after === before) return;
    try {
      await api(`/retailer/variants/${variantId}`, { method: 'PATCH', body: { pricePaise: after } });
      setDrafts((d) => {
        const next = { ...d };
        delete next[variantId];
        return next;
      });
      void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] });
      void qc.invalidateQueries({ queryKey: ['retailer', 'listing-effective-pricing', listingId] });
      void qc.invalidateQueries({ queryKey: ['retailer', 'audit', 'recent-price-changes'] });
      toast.success(`Price updated to ${formatPaise(after)}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to update price');
    }
  }

  return (
    <Page>
      <PageHeader
        kicker="Pricing"
        title="Variant pricing"
        description="Edit each variant's price independently. The Consumer pays column reflects active platform + your promotions stacked on top of the base price."
        actions={null}
      />

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardContent className="overflow-x-auto p-0">
            {listings.isLoading ? (
              <Skeleton className="h-72" />
            ) : rows.length === 0 ? (
              <Empty kicker="No variants" title="Add a product variant first." />
            ) : (
              <table className="w-full text-[12.5px]">
                <thead className="bg-bg-2/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">Listing</th>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">Variant</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Base</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Consumer pays</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">New (₹)</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ listing, variant }) => {
                    const draft = drafts[variant.id];
                    const currentRupees = (variant.pricePaise / 100).toString();
                    const dirty = draft !== undefined && draft !== currentRupees;
                    const eff = effectiveByVariant.get(variant.id);
                    const hasDiscount = eff && eff.totalDiscountPaise > 0;
                    return (
                      <tr key={variant.id} className="border-t border-line align-top">
                        <td className="px-3 py-2 text-ink">
                          <Link to={`/retailer/listings/${listing.id}`} className="hover:text-accent inline-flex items-center gap-1">
                            {listing.name} <ArrowUpRight className="size-3" />
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-ink-2">{variant.attributesLabel}</td>
                        <td className="px-3 py-2 text-right font-mono text-ink">{formatPaise(variant.pricePaise)}</td>
                        <td className="px-3 py-2 text-right">
                          {eff ? (
                            <div className="flex flex-col items-end gap-1">
                              <span
                                className={`font-mono ${hasDiscount ? 'text-success font-semibold' : 'text-ink'}`}
                              >
                                {formatPaise(eff.effectivePaise)}
                              </span>
                              {hasDiscount && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-ink-3">
                                  <TrendingDown className="size-3 text-success" />
                                  −{formatPaise(eff.totalDiscountPaise)}
                                </span>
                              )}
                              {eff.appliedPromos.length > 0 && (
                                <div className="flex flex-wrap justify-end gap-1">
                                  {eff.appliedPromos.map((p) => (
                                    <Badge
                                      key={p.promotionId}
                                      tone={p.appliedTo === 'platform_promo' ? 'info' : 'success'}
                                      title={`${p.name} · −${formatPaise(p.amountPaise)}`}
                                    >
                                      {p.appliedTo === 'platform_promo' ? 'Platform' : 'You'}: {p.name}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-ink-4">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min="0"
                            value={draft ?? currentRupees}
                            onChange={(e) =>
                              setDrafts((d) => ({ ...d, [variant.id]: e.target.value }))
                            }
                            className="w-full rounded border border-line-2 bg-bg px-2 py-1 text-right font-mono text-[12px]"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <Button
                            size="xs"
                            variant={dirty ? 'accent' : 'ghost'}
                            disabled={!dirty}
                            iconLeft={<Save className="size-3" />}
                            onClick={() => commit(variant.id, variant.pricePaise, listing.id)}
                          >
                            Save
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <History className="size-4 text-ink-3" />
              <h2 className="text-[15px] font-semibold text-ink">Recent edits</h2>
              <span className="ml-auto text-[12px] text-ink-3">{audit.length} change{audit.length === 1 ? '' : 's'} · last 50</span>
            </div>
            {auditQ.isLoading ? (
              <Skeleton className="h-24" />
            ) : audit.length === 0 ? (
              <p className="text-[12.5px] text-ink-3 italic">No edits yet — change a price and the diff appears here.</p>
            ) : (
              <ol className="space-y-2">
                {audit.map((a) => (
                  <li key={a.id} className="rounded-md border border-line bg-bg-2/30 px-3 py-2 text-[12px]">
                    <div className="font-mono text-ink-3">{a.variantId ?? a.listingId}</div>
                    <div className="mt-0.5 text-ink-2">
                      <span className="line-through text-ink-4">{formatPaise(a.beforePaise)}</span>{' → '}
                      <span className="text-ink font-medium">{formatPaise(a.afterPaise)}</span>
                    </div>
                    <div className="text-[11px] text-ink-4">{formatAge(a.at)} · {a.actorKind}</div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
