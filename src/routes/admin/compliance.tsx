import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import {
  accountDeletionStatusMeta,
  changeRequestStatusMeta,
  dataExportStatusMeta,
  formatAge,
  kycReverificationStatusMeta,
} from '@/lib/status';
import type {
  AccountDeletionRequest,
  ChangeRequest,
  DataExportRequest,
  KycReverification,
} from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
          <TabsTrigger value="changes">Change requests</TabsTrigger>
          <TabsTrigger value="exports">Data exports</TabsTrigger>
          <TabsTrigger value="deletions">Account deletions</TabsTrigger>
        </TabsList>

        <TabsContent value="kyc"><KycPanel /></TabsContent>
        <TabsContent value="floor"><FloorBreachPanel /></TabsContent>
        <TabsContent value="changes"><ChangesPanel /></TabsContent>
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
        return (
          <Card key={k.id}>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-medium text-ink">Retailer {k.retailerId}</span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <Badge tone={dueIn < 0 ? 'danger' : dueIn < 7 ? 'warning' : 'neutral'} flat>
                    {dueIn < 0 ? `${-dueIn} days overdue` : `Due in ${dueIn} days`}
                  </Badge>
                </div>
                <div className="mt-1 text-[12px] text-ink-3">
                  {k.documents.filter((d) => d.status === 'verified').length}/{k.documents.length} documents verified
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

function FloorBreachPanel() {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-[13px] text-ink-3">
          Performance-floor breach feed (cancellation rate, fulfilment SLA, dispute rate) lands here.
          Open the policy enforcement screen for the warning ladder per retailer.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3" iconRight={<ArrowUpRight className="size-3.5" />}>
          <Link to="/admin/policy-enforcement">Open enforcement</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ChangesPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'compliance', 'changes'],
    queryFn: () => api<ChangeRequest[]>('/admin/compliance/change-requests'),
  });
  const list = data ?? [];
  if (isLoading) return <Skeleton className="h-32" />;
  if (list.length === 0) return <Empty kicker="No requests" title="No verified-field change requests." />;
  return (
    <ul className="space-y-2">
      {list.map((cr) => {
        const meta = changeRequestStatusMeta(cr.status);
        return (
          <Card key={cr.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-medium text-ink capitalize">{cr.field.replace(/_/g, ' ')}</span>
                <Badge tone={meta.tone}>{meta.label}</Badge>
                <span className="text-[11.5px] text-ink-3">{formatAge(cr.submittedAt)}</span>
              </div>
              <div className="mt-1 text-[12.5px] text-ink-2">
                <span className="text-ink-3">From:</span> {cr.currentValue} → <span className="text-ink-3">To:</span> {cr.requestedValue}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </ul>
  );
}

function DataExportsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'compliance', 'data-exports'],
    queryFn: () => api<DataExportRequest[]>('/admin/compliance/data-exports'),
  });
  const list = data ?? [];
  if (isLoading) return <Skeleton className="h-32" />;
  if (list.length === 0) return <Empty kicker="All clear" title="No GDPR data export requests pending." />;
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {list.map((d) => {
          const meta = dataExportStatusMeta(d.status);
          return (
            <Card key={d.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-medium text-ink">Consumer {d.consumerId}</span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="text-[11.5px] text-ink-3">requested {formatAge(d.requestedAt)}</span>
                  </div>
                  {d.readyAt && (
                    <div className="mt-1 text-[12px] text-ink-3">Archive ready {formatAge(d.readyAt)}</div>
                  )}
                </div>
                <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                  <Link to="/admin/data-exports">Manage</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </ul>
    </div>
  );
}

function AccountDeletionsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'compliance', 'deletions'],
    queryFn: () => api<AccountDeletionRequest[]>('/admin/compliance/account-deletions'),
  });
  const list = data ?? [];
  if (isLoading) return <Skeleton className="h-32" />;
  if (list.length === 0) return <Empty kicker="All clear" title="No account deletion requests pending." />;
  return (
    <ul className="space-y-2">
      {list.map((d) => {
        const meta = accountDeletionStatusMeta(d.status);
        return (
          <Card key={d.id}>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-medium text-ink">Consumer {d.consumerId}</span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="text-[11.5px] text-ink-3">scheduled {formatAge(d.scheduledFor)}</span>
                </div>
                {d.status === 'pending' && (
                  <div className="mt-1 text-[12px] text-ink-3">Within grace window — consumer can still cancel.</div>
                )}
              </div>
              <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                <Link to="/admin/account-deletions">Manage</Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </ul>
  );
}
