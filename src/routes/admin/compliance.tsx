import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, Download, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  accountDeletionStatusMeta,
  dataExportStatusMeta,
  formatAge,
} from '@/lib/status';
import { kycReverificationStatusMeta } from '@/lib/status';
import type {
  AccountDeletionRequest,
  DataExportRequest,
  KycReverification,
  PolicyEnforcementAction,
} from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AdminCompliance() {
  return (
    <Page>
      <PageHeader
        kicker="Compliance"
        title="Compliance queue"
        description="One inbox for KYC re-verifications, performance-floor breaches, change requests, GDPR exports and account deletions."
      />

      <Tabs defaultValue="kyc">
        <TabsList className="overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="kyc">KYC due</TabsTrigger>
          <TabsTrigger value="floor">Floor breaches</TabsTrigger>
          <TabsTrigger value="exports">Data exports</TabsTrigger>
          <TabsTrigger value="deletions">Account deletions</TabsTrigger>
        </TabsList>

        <TabsContent value="kyc"><KycPanel /></TabsContent>
        <TabsContent value="floor"><FloorBreachPanel /></TabsContent>
        <TabsContent value="exports"><DataExportsPanel /></TabsContent>
        <TabsContent value="deletions"><AccountDeletionsPanel /></TabsContent>
      </Tabs>
    </Page>
  );
}

function KycPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'compliance', 'kyc'],
    queryFn: () => api<KycReverification[]>('/admin/compliance/kyc'),
  });
  const list = data ?? [];
  if (isLoading) return <Skeleton className="h-32" />;
  if (list.length === 0) return <Empty kicker="All clear" title="No KYC re-verifications due." />;
  return (
    <ul className="space-y-2">
      {list.map((k) => {
        const meta = kycReverificationStatusMeta(k.status);
        const dueIn = Math.round((new Date(k.dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const uploadedCount = k.documents.filter((d) => d.status !== 'missing').length;
        return (
          <Card key={k.id}>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-medium text-ink truncate">
                    {k.storeName ?? `Store ${k.storeId ?? k.retailerId ?? ''}`}
                  </span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <Badge tone={dueIn < 0 ? 'danger' : dueIn < 7 ? 'warning' : 'neutral'} flat>
                    {dueIn < 0 ? `${-dueIn} days overdue` : `Due in ${dueIn} days`}
                  </Badge>
                </div>
                <div className="mt-1 text-[12px] text-ink-3">
                  {uploadedCount}/{k.documents.length} uploaded ·{' '}
                  {k.documents.filter((d) => d.status === 'verified').length} verified ·{' '}
                  {k.documents.filter((d) => d.status === 'rejected').length} rejected
                </div>
              </div>
              <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                <Link to={`/admin/compliance/${k.id}`}>Review</Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </ul>
  );
}

const STEP_TONE: Record<string, 'neutral' | 'warning' | 'danger'> = {
  warning_1: 'warning',
  warning_2: 'warning',
  warning_3: 'warning',
  suspension: 'danger',
  termination: 'danger',
  lifted: 'neutral',
};
const BREACH_LABEL: Record<string, string> = {
  acceptance_rate: 'Acceptance rate',
  fulfilment_sla: 'Fulfilment SLA',
  dispute_rate: 'Dispute rate',
  return_rate: 'Return rate',
  kyc_overdue: 'KYC overdue',
  policy_violation: 'Policy violation',
};

function FloorBreachPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'policy-enforcement'],
    queryFn: () =>
      api<PolicyEnforcementAction[]>('/admin/compliance/policy-enforcement?limit=100'),
  });
  const list = (data ?? []).filter((a) => a.step !== 'lifted');
  if (isLoading) return <Skeleton className="h-32" />;
  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <Empty
            kicker="All clear"
            title="No active performance-floor breaches."
            description="Issue a new enforcement step from the enforcement screen when you spot a problem."
            action={
              <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                <Link to="/admin/policy-enforcement">Open enforcement</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-ink-3">
          Stores currently sitting on a warning, suspension or termination step. Open the enforcement screen to issue a new step or lift an existing one.
        </p>
        <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
          <Link to="/admin/policy-enforcement">Open enforcement</Link>
        </Button>
      </div>
      <ul className="space-y-2">
        {list.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-medium text-ink truncate">
                    {a.storeName ?? `Store ${a.storeId}`}
                  </span>
                  <Badge tone={STEP_TONE[a.step] ?? 'neutral'}>
                    {a.step.replace(/_/g, ' ')}
                  </Badge>
                  <Badge tone="neutral" flat>
                    {BREACH_LABEL[a.breachKind] ?? a.breachKind}
                  </Badge>
                </div>
                <div className="mt-1 text-[12px] text-ink-3">
                  Acted {formatAge(a.actedAt)}
                  {a.actorName ? ` by ${a.actorName}` : ''}
                  {a.reason ? ` · ${a.reason}` : ''}
                </div>
                {a.metric && Object.keys(a.metric).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11.5px]">
                    {Object.entries(a.metric).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded-full border border-line bg-bg-2 px-2 py-0.5 font-mono text-ink-2"
                      >
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                <Link to={a.retailerId ? `/admin/retailers/${a.retailerId}` : `/admin/policy-enforcement`}>
                  Open
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </ul>
    </div>
  );
}

function DataExportsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'compliance', 'data-exports'],
    queryFn: () => api<DataExportRequest[]>('/admin/compliance/data-exports'),
  });
  const [building, setBuilding] = useState<DataExportRequest | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [failing, setFailing] = useState<DataExportRequest | null>(null);
  const [failureReason, setFailureReason] = useState('');

  const process = useMutation({
    mutationFn: (body: { id: string; status: 'building' | 'ready' | 'failed'; downloadUrl?: string; failureReason?: string }) =>
      api(`/admin/compliance/data-exports/${body.id}/process`, { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Updated');
      void qc.invalidateQueries({ queryKey: ['admin', 'compliance', 'data-exports'] });
      setBuilding(null);
      setFailing(null);
      setDownloadUrl('');
      setFailureReason('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  const list = data ?? [];
  if (isLoading) return <Skeleton className="h-32" />;
  if (list.length === 0) return <Empty kicker="All clear" title="No GDPR data export requests pending." />;
  return (
    <>
      <ul className="space-y-2">
        {list.map((d) => {
          const meta = dataExportStatusMeta(d.status);
          return (
            <Card key={d.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-medium text-ink truncate">
                      {d.consumerName ?? d.consumerEmail ?? `Consumer ${d.consumerId}`}
                    </span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="text-[11.5px] text-ink-3">requested {formatAge(d.requestedAt)}</span>
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-ink-3">
                    {d.consumerEmail ?? '—'}
                    {d.consumerPhone ? ` · ${d.consumerPhone}` : ''}
                  </div>
                  {d.readyAt && (
                    <div className="mt-1 text-[12px] text-ink-3">
                      Archive ready {formatAge(d.readyAt)}
                      {d.expiresAt && ` · expires ${new Date(d.expiresAt).toLocaleDateString()}`}
                    </div>
                  )}
                  {d.failureReason && (
                    <div className="mt-1 text-[12px] text-danger">{d.failureReason}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  {d.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => process.mutate({ id: d.id, status: 'building' })}
                    >
                      Start build
                    </Button>
                  )}
                  {d.status === 'building' && (
                    <Button variant="outline" size="sm" onClick={() => setBuilding(d)}>
                      Mark ready
                    </Button>
                  )}
                  {(d.status === 'pending' || d.status === 'building') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger/5"
                      onClick={() => setFailing(d)}
                    >
                      Mark failed
                    </Button>
                  )}
                  {d.status === 'ready' && d.downloadUrl && (
                    <Button asChild variant="outline" size="sm" iconLeft={<Download className="size-3.5" />}>
                      <a href={d.downloadUrl} target="_blank" rel="noreferrer">Download</a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </ul>

      <Dialog open={building !== null} onOpenChange={(o) => !o && setBuilding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish archive</DialogTitle>
            <DialogDescription>
              Paste the signed URL of the built archive. Consumer can download from here.
              Default expiry 7 days.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="export-url" required>Download URL</Label>
            <Input
              id="export-url"
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              placeholder="https://signed.url/…"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBuilding(null)}>Cancel</Button>
            <Button
              variant="accent"
              loading={process.isPending}
              disabled={!downloadUrl.startsWith('http')}
              onClick={() =>
                building &&
                process.mutate({
                  id: building.id,
                  status: 'ready',
                  downloadUrl: downloadUrl.trim(),
                })
              }
            >
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={failing !== null} onOpenChange={(o) => !o && setFailing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark export failed</DialogTitle>
            <DialogDescription>
              Records the failure so the consumer knows. Provide a short reason.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="export-fail" required>Reason</Label>
            <Input
              id="export-fail"
              value={failureReason}
              onChange={(e) => setFailureReason(e.target.value)}
              placeholder="e.g. archive generation timeout"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFailing(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={process.isPending}
              disabled={failureReason.trim().length < 3}
              iconLeft={<X className="size-3.5" />}
              onClick={() =>
                failing &&
                process.mutate({
                  id: failing.id,
                  status: 'failed',
                  failureReason: failureReason.trim(),
                })
              }
            >
              Mark failed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AccountDeletionsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'compliance', 'deletions'],
    queryFn: () => api<AccountDeletionRequest[]>('/admin/compliance/account-deletions'),
  });

  const complete = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/compliance/account-deletions/${id}/complete`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Deletion completed · consumer PII anonymised');
      void qc.invalidateQueries({ queryKey: ['admin', 'compliance', 'deletions'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Complete failed'),
  });
  const cancel = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/compliance/account-deletions/${id}/cancel`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Deletion cancelled');
      void qc.invalidateQueries({ queryKey: ['admin', 'compliance', 'deletions'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Cancel failed'),
  });

  const list = data ?? [];
  if (isLoading) return <Skeleton className="h-32" />;
  if (list.length === 0) return <Empty kicker="All clear" title="No account deletion requests pending." />;
  return (
    <ul className="space-y-2">
      {list.map((d) => {
        const meta = accountDeletionStatusMeta(d.status);
        const scheduledIn = Math.round(
          (new Date(d.scheduledFor).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        return (
          <Card key={d.id}>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-medium text-ink truncate">
                    {d.consumerName ?? d.consumerEmail ?? `Consumer ${d.consumerId}`}
                  </span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  {d.status === 'pending' && (
                    <Badge tone={scheduledIn < 1 ? 'danger' : scheduledIn < 3 ? 'warning' : 'neutral'} flat>
                      {scheduledIn < 0
                        ? `${-scheduledIn} days overdue`
                        : scheduledIn === 0
                          ? 'Today'
                          : `In ${scheduledIn} days`}
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 text-[11.5px] text-ink-3">
                  {d.consumerEmail ?? '—'}
                  {d.consumerPhone ? ` · ${d.consumerPhone}` : ''}
                </div>
                <div className="mt-1 text-[12px] text-ink-3">
                  Scheduled {new Date(d.scheduledFor).toLocaleString()} · requested {formatAge(d.requestedAt)}
                </div>
              </div>
              <div className="flex gap-2">
                {d.status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={complete.isPending && complete.variables === d.id}
                      onClick={() => {
                        if (!window.confirm('Complete deletion now? Consumer PII will be anonymised.')) return;
                        complete.mutate(d.id);
                      }}
                    >
                      Complete now
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger/5"
                      loading={cancel.isPending && cancel.variables === d.id}
                      onClick={() => {
                        if (!window.confirm('Cancel this deletion request?')) return;
                        cancel.mutate(d.id);
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </ul>
  );
}
