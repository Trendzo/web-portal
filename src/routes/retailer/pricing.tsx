import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, History, Save } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { Listing } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

type AuditEntry = { variantId: string; before: number; after: number; at: string };

export default function RetailerPricing() {
  const qc = useQueryClient();
  const listings = useQuery({
    queryKey: ['retailer', 'listings'],
    queryFn: () => api<Listing[]>('/retailer/listings'),
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const all = listings.data ?? [];
  const rows = all.flatMap((l) =>
    (l.variants ?? []).map((v) => ({ listing: l, variant: v })),
  );

  async function commit(variantId: string, before: number) {
    const draft = drafts[variantId];
    if (!draft) return;
    const after = Math.round(Number(draft) * 100);
    if (!Number.isFinite(after) || after === before) return;
    try {
      await api(`/retailer/variants/${variantId}`, { method: 'PATCH', body: { pricePaise: after } });
      setAudit((a) => [{ variantId, before, after, at: new Date().toISOString() }, ...a].slice(0, 20));
      setDrafts((d) => {
        const next = { ...d };
        delete next[variantId];
        return next;
      });
      void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] });
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
        description="Edit each variant's price independently. Every change appends to the per-variant audit log."
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
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Current</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">New (₹)</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ listing, variant }) => {
                    const draft = drafts[variant.id];
                    const currentRupees = (variant.pricePaise / 100).toString();
                    const dirty = draft !== undefined && draft !== currentRupees;
                    return (
                      <tr key={variant.id} className="border-t border-line">
                        <td className="px-3 py-2 text-ink">
                          <Link to={`/retailer/listings/${listing.id}`} className="hover:text-accent inline-flex items-center gap-1">
                            {listing.name} <ArrowUpRight className="size-3" />
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-ink-2">{variant.attributesLabel}</td>
                        <td className="px-3 py-2 text-right font-mono text-ink">{formatPaise(variant.pricePaise)}</td>
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
                            onClick={() => commit(variant.id, variant.pricePaise)}
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
              <span className="ml-auto text-[12px] text-ink-3">{audit.length} changes this session</span>
            </div>
            {audit.length === 0 ? (
              <p className="text-[12.5px] text-ink-3 italic">No edits yet — change a price and the diff appears here.</p>
            ) : (
              <ol className="space-y-2">
                {audit.map((a, i) => (
                  <li key={`${a.variantId}_${i}`} className="rounded-md border border-line bg-bg-2/30 px-3 py-2 text-[12px]">
                    <div className="font-mono text-ink-3">{a.variantId}</div>
                    <div className="mt-0.5 text-ink-2">
                      <span className="line-through text-ink-4">{formatPaise(a.before)}</span>{' → '}
                      <span className="text-ink font-medium">{formatPaise(a.after)}</span>
                    </div>
                    <div className="text-[11px] text-ink-4">{formatAge(a.at)}</div>
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
