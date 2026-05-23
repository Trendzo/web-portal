import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Tag } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BulkActionBar } from '@/components/admin/bulk-action-bar';
import { useBulkSelect } from '@/hooks/useBulkSelect';

interface PromoRow {
  id: string;
  name: string;
  mechanism: 'offer' | 'coupon' | 'voucher';
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'expired' | 'exhausted' | 'revoked';
  validFrom: string;
  validUntil: string;
  totalUses: number | null;
}

export default function AdminStorePromotions() {
  const { id: retailerId, storeId } = useParams<{ id: string; storeId: string }>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'store-promotions', storeId],
    queryFn: () => api<PromoRow[]>(`/admin/stores/${storeId}/promotions`),
    enabled: Boolean(storeId),
  });
  const rows = data ?? [];
  const bulk = useBulkSelect(rows);

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['admin', 'store-promotions', storeId] });
  }

  const act = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: 'pause' | 'resume' | 'revoke' | 'activate' }) =>
      api(`/admin/stores/${storeId}/promotions/${id}/${verb}`, { method: 'POST', body: {} }),
    onSuccess: (_d, vars) => {
      toast.success(`Promotion ${vars.verb}`);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
  });

  const bulkPause = useMutation({
    mutationFn: () =>
      api<{ paused: number; skipped: number }>(`/admin/stores/${storeId}/promotions/bulk-pause`, {
        method: 'POST',
        body: { promotionIds: bulk.selectedIds },
      }),
    onSuccess: (r) => {
      toast.success(`Paused ${r.paused} (${r.skipped} skipped)`);
      bulk.clear();
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Bulk pause failed'),
  });

  return (
    <Page>
      <PageHeader
        kicker="Store"
        title="Promotions"
        description="Per-store promo CRUD. Bulk pause from the selection bar. Open a promo to manage its voucher batch."
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to={`/admin/retailers/${retailerId}/stores/${storeId}`}>Back</Link>
          </Button>
        }
      />

      <div className="mb-3 flex items-center gap-3 text-[12.5px] text-ink-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={bulk.isAllSelected} onChange={bulk.toggleAll} className="accent-accent" />
          Select all
        </label>
        <span>{rows.length} promotions</span>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6"><p className="text-[13px] text-ink-3 italic">No promotions yet. Retailer can also create from their side.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <input type="checkbox" className="accent-accent" checked={bulk.isSelected(p.id)} onChange={() => bulk.toggle(p.id)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{p.name}</span>
                    <Badge tone={p.mechanism === 'offer' ? 'info' : p.mechanism === 'coupon' ? 'success' : 'warning'}>{p.mechanism}</Badge>
                    <Badge tone={
                      p.status === 'active' ? 'success'
                      : p.status === 'paused' ? 'warning'
                      : p.status === 'revoked' || p.status === 'expired' || p.status === 'exhausted' ? 'danger'
                      : 'neutral'
                    }>{p.status}</Badge>
                  </div>
                  <div className="mt-1 text-[12px] text-ink-3">
                    {new Date(p.validFrom).toLocaleDateString('en-IN')} – {new Date(p.validUntil).toLocaleDateString('en-IN')}
                    {p.totalUses !== null && ` · ${p.totalUses} max uses`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.status === 'draft' && (
                    <Button variant="ink" size="sm" onClick={() => act.mutate({ id: p.id, verb: 'activate' })}>Activate</Button>
                  )}
                  {p.status === 'active' && (
                    <Button variant="outline" size="sm" onClick={() => act.mutate({ id: p.id, verb: 'pause' })}>Pause</Button>
                  )}
                  {p.status === 'paused' && (
                    <Button variant="outline" size="sm" onClick={() => act.mutate({ id: p.id, verb: 'resume' })}>Resume</Button>
                  )}
                  {(p.status === 'active' || p.status === 'paused' || p.status === 'draft') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-danger border-danger/40"
                      onClick={() => act.mutate({ id: p.id, verb: 'revoke' })}
                    >
                      Revoke
                    </Button>
                  )}
                  {p.mechanism === 'voucher' && (
                    <Button asChild variant="outline" size="sm" iconLeft={<Tag className="size-3.5" />}>
                      <Link to={`/admin/retailers/${retailerId}/stores/${storeId}/promotions/${p.id}/vouchers`}>
                        Vouchers
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClear={bulk.clear}
        actions={[
          { label: 'Pause selected', onClick: () => bulkPause.mutate(), loading: bulkPause.isPending },
        ]}
      />
    </Page>
  );
}
