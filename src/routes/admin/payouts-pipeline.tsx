import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowUpRight, Eye, Play } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { AdminPayoutRow } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label, FieldError } from '@/components/ui/label';
import { StoreCombobox } from '@/components/ui/store-combobox';
import { BankAccountSelect } from '@/components/ui/bank-account-select';

type PreviewResp = {
  grossPaise: number;
  commissionPaise: number;
  commissionTaxPaise: number;
  refundsHeldPaise: number;
  adjustmentsPaise: number;
  disputeLiabilitiesPaise: number;
  disputeHoldPaise: number;
  tcsPaise: number;
  netPaise: number;
  orderCount: number;
  includedOrderIds: string[];
  activeHoldIds: string[];
  unattachedAdjustmentIds: string[];
};

export default function AdminPayoutsPipeline() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orderIdFromDeepLink = params.get('orderId');
  const [cycleOpen, setCycleOpen] = useState<'preview' | 'run' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payouts-pipeline'],
    queryFn: () => api<AdminPayoutRow[]>('/admin/payouts'),
  });
  const list = data ?? [];
  const failed = list.filter((p) => p.status === 'failed');
  const others = list.filter((p) => p.status !== 'failed');

  return (
    <Page>
      <PageHeader
        kicker="Settlement"
        title="Payouts pipeline"
        description="Every retailer's payouts. Failed cycles need bank-detail update or manual retry — the queue is pinned at the top."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" iconLeft={<Eye className="size-3.5" />} onClick={() => setCycleOpen('preview')}>
              Preview cycle
            </Button>
            <Button variant="accent" size="sm" iconLeft={<Play className="size-3.5" />} onClick={() => setCycleOpen('run')}>
              Run cycle
            </Button>
            {orderIdFromDeepLink ? (
              <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
                <Link to={`/admin/orders/${orderIdFromDeepLink}`}>Back to order</Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />} onClick={() => navigate(-1)}>
                Back
              </Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue="failed">
        <TabsList>
          <TabsTrigger value="failed">Failed queue <span className="ml-1.5 text-danger font-mono">{failed.length}</span></TabsTrigger>
          <TabsTrigger value="all">All payouts <span className="ml-1.5 text-ink-3">{list.length}</span></TabsTrigger>
        </TabsList>
        <TabsContent value="failed">
          {isLoading ? <Skeleton className="h-32" /> : failed.length === 0 ? <Empty kicker="All clear" title="No failed payouts." /> : <Table list={failed} />}
        </TabsContent>
        <TabsContent value="all">
          {isLoading ? <Skeleton className="h-32" /> : <Table list={[...failed, ...others]} />}
        </TabsContent>
      </Tabs>

      <CycleDialog mode={cycleOpen} onClose={() => setCycleOpen(null)} />
    </Page>
  );
}

function Table({ list }: { list: AdminPayoutRow[] }) {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-[12.5px]">
          <thead className="bg-bg-2/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Store</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Period</th>
              <th className="px-3 py-2 text-right font-medium text-ink-3">Amount</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Status</th>
              <th className="px-3 py-2 text-right font-medium text-ink-3">Retries</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Initiated</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-3 py-2 text-ink">{p.storeName}</td>
                <td className="px-3 py-2 font-mono text-ink-2">{p.period}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPaise(p.amountPaise)}</td>
                <td className="px-3 py-2">
                  <Badge
                    tone={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : p.status === 'processing' ? 'info' : 'warning'}
                    pulse={p.status === 'failed'}
                  >
                    {p.status.replace(/_/g, ' ')}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">{p.retryCount}</td>
                <td className="px-3 py-2 text-[11.5px] text-ink-3">{p.initiatedAt ? formatAge(p.initiatedAt) : '—'}</td>
                <td className="px-3 py-1.5 text-right">
                  <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                    <Link to={`/admin/payouts-pipeline/${p.id}`}>Open</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CycleDialog({ mode, onClose }: { mode: 'preview' | 'run' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState('');
  const [cycleStart, setCycleStart] = useState('');
  const [cycleEnd, setCycleEnd] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResp | null>(null);

  const previewM = useMutation({
    mutationFn: () =>
      api<PreviewResp>('/admin/payouts/preview', {
        method: 'POST',
        body: { storeId: storeId.trim(), cycleStart, cycleEnd },
      }),
    onSuccess: (p) => setPreview(p),
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Preview failed'),
  });

  const runM = useMutation({
    mutationFn: () =>
      api('/admin/payouts/run-cycle', {
        method: 'POST',
        body: { storeId: storeId.trim(), cycleStart, cycleEnd, bankAccountId: bankAccountId.trim() },
      }),
    onSuccess: () => {
      toast.success('Cycle started');
      void qc.invalidateQueries({ queryKey: ['admin', 'payouts-pipeline'] });
      onClose();
      setPreview(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Run failed'),
  });

  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(o) => {
        if (!o) { onClose(); setPreview(null); setError(null); }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'preview' ? 'Preview payout cycle' : 'Run payout cycle'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!storeId.trim()) return setError('Store ID required.');
            if (!cycleStart || !cycleEnd) return setError('Cycle start and end required.');
            if (mode === 'preview') previewM.mutate();
            else {
              if (!bankAccountId.trim()) return setError('Bank account ID required.');
              runM.mutate();
            }
          }}
          noValidate
        >
          <div>
            <Label required>Store</Label>
            <StoreCombobox value={storeId} onChange={setStoreId} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cyc-start" required>Cycle start</Label>
              <Input id="cyc-start" type="date" value={cycleStart} onChange={(e) => setCycleStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cyc-end" required>Cycle end</Label>
              <Input id="cyc-end" type="date" value={cycleEnd} onChange={(e) => setCycleEnd(e.target.value)} />
            </div>
          </div>
          {mode === 'run' && (
            <div>
              <Label required>Bank account</Label>
              <BankAccountSelect storeId={storeId} value={bankAccountId} onChange={setBankAccountId} />
            </div>
          )}

          {preview && (
            <Card>
              <CardContent className="p-4 space-y-1 text-[12.5px]">
                <Row label="Gross" value={formatPaise(preview.grossPaise)} />
                <Row label="Commission" value={`−${formatPaise(preview.commissionPaise)}`} tone="warn" />
                <Row label="Commission GST" value={`−${formatPaise(preview.commissionTaxPaise)}`} tone="warn" />
                <Row label="TCS" value={`−${formatPaise(preview.tcsPaise)}`} tone="warn" />
                <Row label="Refunds held" value={`−${formatPaise(preview.refundsHeldPaise)}`} tone="warn" />
                <Row label="Dispute holds" value={`−${formatPaise(preview.disputeHoldPaise)}`} tone="warn" />
                <Row label="Adjustments" value={formatPaise(preview.adjustmentsPaise)} />
                <div className="border-t border-line my-1" />
                <Row label="Net" value={formatPaise(preview.netPaise)} tone="good" />
                <div className="text-[11px] text-ink-4 mt-2">
                  {preview.orderCount} orders · {preview.activeHoldIds.length} active holds · {preview.unattachedAdjustmentIds.length} pending adjustments
                </div>
              </CardContent>
            </Card>
          )}

          <FieldError>{error}</FieldError>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              variant={mode === 'run' ? 'ink' : 'outline'}
              caps
              loading={mode === 'preview' ? previewM.isPending : runM.isPending}
            >
              {mode === 'preview' ? 'Run preview' : 'Initiate cycle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'good' }) {
  return (
    <div className="flex justify-between font-mono">
      <span className="text-ink-3">{label}</span>
      <span className={tone === 'warn' ? 'text-warning' : tone === 'good' ? 'text-success font-semibold' : 'text-ink'}>{value}</span>
    </div>
  );
}
