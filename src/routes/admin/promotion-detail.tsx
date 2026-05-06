import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Download, Pause, Play, Plus, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  discountTypeLabel,
  formatDiscount,
  mechanismLabel,
  promotionStatusMeta,
} from '@/lib/status';
import type { Promotion, VoucherCode } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetaList } from '@/components/ui/meta-list';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';

export default function AdminPromotionDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const promo = useQuery({
    queryKey: ['admin', 'promotion', id],
    queryFn: () => api<Promotion>(`/admin/promotions/${id}`),
  });

  const lifecycle = useMutation({
    mutationFn: (action: 'pause' | 'resume' | 'revoke' | 'activate') =>
      api<Promotion>(`/admin/promotions/${id}/${action}`, { method: 'POST' }),
    onSuccess: (p) => {
      toast.success(`${promotionStatusMeta(p.effectiveStatus).label}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'promotion', id] });
      void qc.invalidateQueries({ queryKey: ['admin', 'promotions'] });
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
          description={promo.error instanceof ApiError ? promo.error.message : 'Unknown error'}
          action={<Button asChild variant="outline"><Link to="/admin/promotions">Back to promotions</Link></Button>}
        />
      </Page>
    );
  }

  const p = promo.data;
  const meta = promotionStatusMeta(p.effectiveStatus);
  const isVoucher = p.mechanism === 'voucher';
  const canPause = p.effectiveStatus === 'active' || p.effectiveStatus === 'scheduled';
  const canResume = p.effectiveStatus === 'paused';
  const canRevoke = !['expired', 'exhausted', 'revoked'].includes(p.effectiveStatus);
  const canActivate = p.effectiveStatus === 'draft';

  return (
    <Page>
      <Link
        to="/admin/promotions"
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
            {p.storeId ? <Badge flat>Store-scoped</Badge> : <Badge flat>Platform-wide</Badge>}
          </div>
        }
      />

      {/* Lifecycle action bar */}
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
              if (confirm('Revoke this promotion? This is permanent.')) {
                lifecycle.mutate('revoke');
              }
            }}
            loading={lifecycle.isPending && lifecycle.variables === 'revoke'}
          >
            Revoke
          </Button>
        )}
        <span className="ml-auto font-mono text-[11px] tracking-wider text-ink-3">{p.id}</span>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {isVoucher && <TabsTrigger value="codes">Voucher codes</TabsTrigger>}
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
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
                  { label: 'Issued by', value: p.issuerType },
                  { label: 'Clubbing slot', value: p.appliedTo },
                ]}
              />
            </div>
            <div>
              <h3 className="kicker text-ink-3 mb-2">Raw config</h3>
              <pre className="rounded-xs border border-rule bg-paper-2/40 p-4 text-[12px] font-mono overflow-auto leading-relaxed text-ink-2">
                {JSON.stringify(p.config, null, 2)}
              </pre>
              {Object.keys(p.scope).length > 0 && (
                <>
                  <h3 className="kicker text-ink-3 mt-6 mb-2">Scope / eligibility</h3>
                  <pre className="rounded-xs border border-rule bg-paper-2/40 p-4 text-[12px] font-mono overflow-auto leading-relaxed text-ink-2">
                    {JSON.stringify(p.scope, null, 2)}
                  </pre>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {isVoucher && (
          <TabsContent value="codes">
            <VoucherCodesPanel promotionId={p.id} />
          </TabsContent>
        )}

        <TabsContent value="settings">
          <div className="space-y-4 max-w-xl">
            <p className="text-[13.5px] text-ink-2">
              Edits to scope / eligibility / clubbing overrides are coming. For MVP, use lifecycle
              actions above to pause/resume/revoke. Recreate the promotion if you need a structural change.
            </p>
            <Button
              variant="outline"
              caps
              onClick={() => navigate('/admin/promotions')}
            >
              Back to list
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </Page>
  );
}

// ─── Voucher codes panel ───

function VoucherCodesPanel({ promotionId }: { promotionId: string }) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const codes = useQuery({
    queryKey: ['admin', 'voucher-codes', promotionId],
    queryFn: () => api<VoucherCode[]>(`/admin/promotions/${promotionId}/vouchers`),
  });

  const downloadCsv = () => {
    const url = `/api/v1/admin/promotions/${promotionId}/vouchers?format=csv`;
    const token = localStorage.getItem('closetx-dashboard.auth');
    // Simple anchor download with token in header isn't possible — fetch + blob instead.
    fetch(url, {
      headers: token
        ? { Authorization: `Bearer ${JSON.parse(token).state?.session?.token ?? ''}` }
        : {},
    })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `vouchers-${promotionId}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error('Could not download CSV'));
  };

  const allCodes = (codes.data ?? []).map((v) => v.code).join('\n');
  const copyAll = () => {
    void navigator.clipboard.writeText(allCodes);
    toast.success(`Copied ${codes.data?.length ?? 0} codes`);
  };

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="font-display italic text-[20px] leading-tight">Voucher codes</h3>
          <p className="text-[12.5px] text-ink-3 mt-0.5">
            Each code is single-use globally. Generate in batches.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" iconLeft={<Copy className="size-3.5" />} onClick={copyAll} disabled={!codes.data?.length}>
            Copy all
          </Button>
          <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={downloadCsv} disabled={!codes.data?.length}>
            CSV
          </Button>
          <Button variant="ink" caps size="sm" iconLeft={<Plus className="size-3.5" />} onClick={() => setGenerating(true)}>
            Generate
          </Button>
        </div>
      </div>

      {codes.isLoading ? (
        <Skeleton className="h-32" />
      ) : !codes.data?.length ? (
        <Empty
          kicker="No codes yet"
          title="Bulk-generate to start."
          description="Pick a count and (optionally) a prefix. Codes are 8 chars from a 32-char alphabet (no 0/O, 1/I/L)."
          action={
            <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setGenerating(true)}>
              Generate codes
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {codes.data.map((v) => {
            const used = v.totalUses != null && v.redeemedCount >= v.totalUses;
            return (
              <div
                key={v.id}
                className={`bg-paper p-3 text-center ${used ? 'opacity-40' : ''}`}
              >
                <div className="font-mono text-[13.5px] tracking-[0.15em] text-ink">{v.code}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-ink-3">
                  {v.redeemedCount} / {v.totalUses ?? '∞'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <GenerateDialog
        open={generating}
        onOpenChange={setGenerating}
        promotionId={promotionId}
        onDone={() => qc.invalidateQueries({ queryKey: ['admin', 'voucher-codes', promotionId] })}
      />
    </>
  );
}

function GenerateDialog({
  open,
  onOpenChange,
  promotionId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  promotionId: string;
  onDone: () => void;
}) {
  const [count, setCount] = useState('25');
  const [usesAllowed, setUsesAllowed] = useState('1');
  const [prefix, setPrefix] = useState('');
  const [error, setError] = useState('');

  const generate = useMutation({
    mutationFn: () =>
      api<{ generated: number }>(
        `/admin/promotions/${promotionId}/vouchers/bulk-generate`,
        {
          method: 'POST',
          body: {
            count: Number(count),
            usesAllowed: usesAllowed.trim() ? Number(usesAllowed) : null,
            prefix: prefix.trim().toUpperCase(),
          },
        },
      ),
    onSuccess: (res) => {
      toast.success(`Generated ${res.generated} codes`);
      onOpenChange(false);
      setCount('25');
      setPrefix('');
      onDone();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate voucher codes</DialogTitle>
          <DialogDescription>
            Bulk-create unique codes. Each is 8 chars from a 32-char alphabet (no 0/O, 1/I/L).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label required>Count</Label>
              <Input mono type="number" min={1} max={10_000} value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
            <div>
              <Label hint="Per-code; leave blank for unlimited">Uses each</Label>
              <Input mono type="number" min={1} placeholder="1" value={usesAllowed} onChange={(e) => setUsesAllowed(e.target.value)} />
            </div>
          </div>
          <div>
            <Label hint="Optional, A-Z and 0-9 only">Prefix</Label>
            <Input mono placeholder="e.g. DROP24" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} />
          </div>
          <FieldError>{error}</FieldError>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="ink" caps loading={generate.isPending} onClick={() => generate.mutate()}>
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

