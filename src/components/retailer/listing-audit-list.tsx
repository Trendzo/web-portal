import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Store, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { ListingAuditEntry } from '@/lib/types';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

const ICON: Record<ListingAuditEntry['actorKind'], typeof ShieldCheck> = {
  retailer: Store,
  admin: ShieldCheck,
  system: Zap,
};

function renderDiff(val: Record<string, unknown> | null): string {
  if (!val) return '∅';
  const entries = Object.entries(val);
  if (entries.length === 0) return '∅';
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join(', ');
}

export function ListingAuditList({ listingId }: { listingId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'listing', listingId, 'audit'],
    queryFn: () => api<ListingAuditEntry[]>(`/retailer/listings/${listingId}/audit`),
  });
  const list = data ?? [];

  return (
    <div className="space-y-3">
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : list.length === 0 ? (
        <Empty kicker="No history" title="No edits recorded for this listing." />
      ) : (
        <ol className="space-y-2">
          {list.map((e) => {
            const Icon = ICON[e.actorKind];
            return (
              <li key={e.id} className="flex items-start gap-3 rounded-md border border-line bg-bg-2/30 px-3 py-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-bg text-ink-2">
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-ink">
                    <span className="font-medium capitalize">{e.actorKind}</span>{' '}
                    <span className="font-mono text-[12px] bg-bg-3 px-1 rounded">{e.action}</span>
                    {e.note && <span className="ml-1 text-ink-3"> — {e.note}</span>}
                  </div>
                  {(e.before || e.after) && (
                    <div className="mt-0.5 text-[12px] text-ink-3">
                      <span className="line-through text-ink-4">{renderDiff(e.before)}</span>
                      {' → '}
                      <span className="text-ink">{renderDiff(e.after)}</span>
                    </div>
                  )}
                </div>
                <span className="text-[11.5px] text-ink-4 shrink-0">{formatAge(e.at)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
