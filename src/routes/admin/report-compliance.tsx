import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useCsvExport, useServerCsv } from '@/lib/csv';
import { unwrapMeta, unwrapRows } from '@/lib/report';
import { FreshnessLabel } from '@/components/ui/freshness-label';
import type { AdminStoreView, ComplianceFloorRow } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Label, FieldError } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type EnforcementStep = 'warning_1' | 'warning_2' | 'warning_3' | 'suspension' | 'termination' | 'lifted';
type BreachKind = 'acceptance_rate' | 'fulfilment_sla' | 'dispute_rate' | 'return_rate' | 'kyc_overdue' | 'policy_violation';

function metricToBreachKind(metric: string): BreachKind {
  if (metric === 'Acceptance rate') return 'acceptance_rate';
  if (metric === 'Fulfilment rate') return 'fulfilment_sla';
  if (metric === 'Dispute rate') return 'dispute_rate';
  if (metric === 'Return rate') return 'return_rate';
  return 'acceptance_rate';
}

export default function AdminReportCompliance() {
  const [escalating, setEscalating] = useState<ComplianceFloorRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', 'compliance'],
    queryFn: () => api<unknown>('/admin/reports/compliance'),
  });
  const rows = unwrapRows<ComplianceFloorRow>(data);
  const meta = unwrapMeta(data);

  void useCsvExport; // legacy export hook retained import for compatibility
  const exportCsv = useServerCsv('compliance_floor', '/admin/reports/compliance');

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Performance-floor breaches"
        description="Retailers below the floor. Click to escalate via Policy Enforcement."
        actions={
          <>
            <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
            <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>Export CSV</Button>
          </>
        }
      />

      {isLoading ? <Skeleton className="h-32" /> : rows.length === 0 ? (
        <Empty kicker="All clear" title="No retailers below floor." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Retailer</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Metric</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Value</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Threshold</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Days below</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.retailerName}_${r.metric}`} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{r.retailerName}</td>
                    <td className="px-3 py-2"><Badge tone="warning" flat>{r.metric}</Badge></td>
                    <td className="px-3 py-2 text-right font-mono text-danger">{r.value}</td>
                    <td className="px-3 py-2 text-right font-mono text-ink-3">{r.threshold}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.daysBelow}d</td>
                    <td className="px-3 py-1.5 text-right">
                      <Button variant="outline" size="sm" onClick={() => setEscalating(r)}>
                        Escalate
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {escalating && (
        <EscalateDialog
          open={true}
          onClose={() => setEscalating(null)}
          prefilledStoreId={escalating.retailerId}
          prefilledBreachKind={metricToBreachKind(escalating.metric)}
        />
      )}
    </Page>
  );
}

function EscalateDialog({
  open,
  onClose,
  prefilledStoreId,
  prefilledBreachKind,
}: {
  open: boolean;
  onClose: () => void;
  prefilledStoreId: string;
  prefilledBreachKind: BreachKind;
}) {
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState(prefilledStoreId);
  const [step, setStep] = useState<EnforcementStep>('warning_1');
  const [breachKind, setBreachKind] = useState<BreachKind>(prefilledBreachKind);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const stores = useQuery({
    queryKey: ['admin', 'stores', 'all'],
    queryFn: () => api<AdminStoreView[]>('/admin/stores'),
    enabled: open,
  });

  const submit = useMutation({
    mutationFn: () =>
      api('/admin/compliance/policy-enforcement', {
        method: 'POST',
        body: {
          storeId: storeId.trim(),
          step,
          breachKind,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
      }),
    onSuccess: () => {
      toast.success('Enforcement action issued');
      void qc.invalidateQueries({ queryKey: ['admin', 'policy-enforcement'] });
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Failed to issue enforcement action';
      setError(msg);
      toast.error(msg);
    },
  });

  function handleOpenChange(o: boolean) {
    if (!o) {
      onClose();
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escalate breach</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!storeId.trim()) return setError('Store ID is required.');
            submit.mutate();
          }}
          className="space-y-4"
          noValidate
        >
          <div>
            <Label htmlFor="esc-store-id" required>Store</Label>
            <Select value={storeId} onValueChange={setStoreId} disabled={stores.isLoading}>
              <SelectTrigger id="esc-store-id">
                <SelectValue placeholder={stores.isLoading ? 'Loading stores…' : 'Pick a store'} />
              </SelectTrigger>
              <SelectContent>
                {(stores.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-medium">{s.legalName}</span>
                    <span className="ml-2 font-mono text-[11px] text-ink-3">{s.id}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="esc-step" required>Step</Label>
            <Select value={step} onValueChange={(v) => setStep(v as EnforcementStep)}>
              <SelectTrigger id="esc-step"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="warning_1">Warning 1</SelectItem>
                <SelectItem value="warning_2">Warning 2</SelectItem>
                <SelectItem value="warning_3">Warning 3</SelectItem>
                <SelectItem value="suspension">Suspension</SelectItem>
                <SelectItem value="termination">Termination</SelectItem>
                <SelectItem value="lifted">Lifted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="esc-breach-kind" required>Breach kind</Label>
            <Select value={breachKind} onValueChange={(v) => setBreachKind(v as BreachKind)}>
              <SelectTrigger id="esc-breach-kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="acceptance_rate">Acceptance rate</SelectItem>
                <SelectItem value="fulfilment_sla">Fulfilment SLA</SelectItem>
                <SelectItem value="dispute_rate">Dispute rate</SelectItem>
                <SelectItem value="return_rate">Return rate</SelectItem>
                <SelectItem value="kyc_overdue">KYC overdue</SelectItem>
                <SelectItem value="policy_violation">Policy violation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="esc-reason">Reason (optional)</Label>
            <textarea
              id="esc-reason"
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              rows={3}
              className="mt-1 w-full resize-none rounded-md border border-line bg-transparent px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-4 focus:outline-none focus:ring-1 focus:ring-ink/30"
              placeholder="Brief explanation for the audit trail…"
            />
          </div>

          <FieldError>{error}</FieldError>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="ink" caps loading={submit.isPending}>
              Issue action
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
