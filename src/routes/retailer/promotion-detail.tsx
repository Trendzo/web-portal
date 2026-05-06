import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Pause, Play, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  discountTypeLabel,
  formatDiscount,
  mechanismLabel,
  promotionStatusMeta,
} from '@/lib/status';
import type { Promotion } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';

export default function RetailerPromotionDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const promo = useQuery({
    queryKey: ['retailer', 'promotion', id],
    queryFn: () => api<Promotion>(`/retailer/promotions/${id}`),
  });

  const lifecycle = useMutation({
    mutationFn: (action: 'pause' | 'resume' | 'revoke' | 'activate') =>
      api<Promotion>(`/retailer/promotions/${id}/${action}`, { method: 'POST' }),
    onSuccess: (p) => {
      toast.success(promotionStatusMeta(p.effectiveStatus).label);
      void qc.invalidateQueries({ queryKey: ['retailer', 'promotion', id] });
      void qc.invalidateQueries({ queryKey: ['retailer', 'promotions'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  if (promo.isLoading) {
    return (
      <Page>
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="mt-4 h-72" />
      </Page>
    );
  }
  if (promo.isError || !promo.data) {
    return (
      <Page>
        <Empty
          kicker="Not found"
          title="Couldn't find this promotion."
          action={<Button asChild variant="outline"><Link to="/retailer/promotions">Back</Link></Button>}
        />
      </Page>
    );
  }

  const p = promo.data;
  const meta = promotionStatusMeta(p.effectiveStatus);
  const canPause = p.effectiveStatus === 'active' || p.effectiveStatus === 'scheduled';
  const canResume = p.effectiveStatus === 'paused';
  const canRevoke = !['expired', 'exhausted', 'revoked'].includes(p.effectiveStatus);
  const canActivate = p.effectiveStatus === 'draft';

  return (
    <Page>
      <Link
        to="/retailer/promotions"
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.16em] text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        All promotions
      </Link>

      <PageHeader
        kicker={`${mechanismLabel(p.mechanism)} · ${discountTypeLabel(p.discountType)}`}
        title={<em>{p.name}</em>}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
        }
      />

      <div className="-mt-2 mb-8 flex flex-wrap items-center gap-2 border-b border-rule pb-4">
        {canActivate && (
          <Button
            variant="ink"
            size="sm"
            caps
            iconLeft={<Play className="size-3.5" />}
            onClick={() => lifecycle.mutate('activate')}
            loading={lifecycle.isPending && lifecycle.variables === 'activate'}
          >
            Activate
          </Button>
        )}
        {canPause && (
          <Button
            variant="outline"
            size="sm"
            caps
            iconLeft={<Pause className="size-3.5" />}
            onClick={() => lifecycle.mutate('pause')}
            loading={lifecycle.isPending && lifecycle.variables === 'pause'}
          >
            Pause
          </Button>
        )}
        {canResume && (
          <Button
            variant="ink"
            size="sm"
            caps
            iconLeft={<Play className="size-3.5" />}
            onClick={() => lifecycle.mutate('resume')}
            loading={lifecycle.isPending && lifecycle.variables === 'resume'}
          >
            Resume
          </Button>
        )}
        {canRevoke && (
          <Button
            variant="danger"
            size="sm"
            caps
            iconLeft={<X className="size-3.5" />}
            onClick={() => {
              if (confirm('Revoke this promotion? This is permanent.')) lifecycle.mutate('revoke');
            }}
            loading={lifecycle.isPending && lifecycle.variables === 'revoke'}
          >
            Revoke
          </Button>
        )}
        <span className="ml-auto font-mono text-[11px] tracking-wider text-ink-3">{p.id}</span>
      </div>

      <div className="grid gap-12 md:grid-cols-2">
        <MetaList
          items={[
            { label: 'Discount', value: formatDiscount(p.discountType, p.config) },
            {
              label: 'Validity',
              value: `${new Date(p.validFrom).toLocaleString('en-IN')} → ${new Date(p.validUntil).toLocaleString('en-IN')}`,
            },
            {
              label: 'Total redemptions',
              value:
                p.totalUses != null
                  ? `${p.redeemedCount.toLocaleString('en-IN')} / ${p.totalUses.toLocaleString('en-IN')}`
                  : `${p.redeemedCount.toLocaleString('en-IN')} / ∞`,
              mono: true,
            },
            {
              label: 'Per consumer',
              value: p.perConsumerLimit != null ? String(p.perConsumerLimit) : '∞',
              mono: true,
            },
          ]}
        />
        <div>
          <h3 className="kicker text-ink-3 mb-2">Raw config</h3>
          <pre className="rounded-xs border border-rule bg-paper-2/40 p-4 text-[12px] font-mono overflow-auto leading-relaxed text-ink-2">
            {JSON.stringify(p.config, null, 2)}
          </pre>
        </div>
      </div>
    </Page>
  );
}
