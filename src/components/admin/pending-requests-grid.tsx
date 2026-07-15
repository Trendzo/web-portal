import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type {
  Application,
  ApplicationDocumentKind,
  ChangeRequest,
  KycReverification,
  PolicyEnforcementAction,
} from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { RejectApplicationDialog } from '@/components/admin/reject-application-dialog';

/** One request type the operator can triage from the Stores → Pending Requests view. */
type RequestKind = 'application' | 'change' | 'kyc' | 'policy' | 'appeal';

/** GET /admin/stores/appeals/pending — appeal threads whose latest message is the retailer's. */
type AppealQueueRow = {
  storeId: string;
  storeName: string | null;
  storeStatus: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
};

interface NormalizedRequest {
  kind: RequestKind;
  id: string;
  title: string;
  subtitle: string;
  age: string;
  /** Right-aligned kind tag. */
  badge: { label: string; tone: 'info' | 'warning' | 'danger' | 'neutral' };
  /** Detail flow opened on card click — same routes the KYC tab deep-links to. */
  detailHref: string;
  /** No inline Accept/Reject — the decision needs the detail page (KYC is reviewed
   *  document-by-document, so a blanket one-click approve would bypass the review). */
  reviewOnly?: boolean;
}

const STALE_MS = 60_000;

function fieldLabel(f: ChangeRequest['field']): string {
  switch (f) {
    case 'legal_name': return 'Legal name change';
    case 'address': return 'Address change';
    case 'gstin': return 'GSTIN change';
    case 'bank_account': return 'Bank account change';
    case 'pos_billing_activation': return 'POS billing activation';
    case 'account_deletion': return 'Account closure request';
    case 'account_reopen': return 'Account reopen request';
  }
}

/**
 * Owns the four pending-request queries and normalizes them into one list, plus
 * a total `count`. Shared (by query key) with the individual compliance panels
 * and the Stores "Pending Requests" button badge — one fetch per source, counts
 * always agree. Excludes data-export / account-deletion compliance items; this
 * surface is scoped to store/retailer *requests* (applications, verified-field
 * change requests, re-KYC, policy breaches, and suspend/terminate appeals awaiting a reply).
 */
export function usePendingRequests(storeId?: string) {
  const apps = useQuery({
    queryKey: ['admin', 'applications', 'pending'],
    queryFn: () => api<Application[]>('/admin/applications?limit=50&status=pending'),
    staleTime: STALE_MS,
  });
  const changes = useQuery({
    queryKey: ['admin', 'change-requests', 'pending'],
    queryFn: () => api<ChangeRequest[]>('/admin/compliance/change-requests?status=pending'),
    staleTime: STALE_MS,
  });
  const kyc = useQuery({
    queryKey: ['admin', 'compliance', 'kyc', 'submitted'],
    // Only cycles the retailer has SUBMITTED are an admin task. `pending`/`overdue` are
    // waiting on the retailer, and decided ones are done — the endpoint used to return
    // every cycle that ever existed, which is why an approved one sat here forever.
    queryFn: () => api<KycReverification[]>('/admin/compliance/kyc?status=submitted'),
    staleTime: STALE_MS,
  });
  const appeals = useQuery({
    queryKey: ['admin', 'store-appeals', 'pending'],
    // Threads whose latest message is from the RETAILER — awaiting an admin reply.
    queryFn: () => api<AppealQueueRow[]>('/admin/stores/appeals/pending'),
    staleTime: STALE_MS,
  });
  const policy = useQuery({
    queryKey: ['admin', 'policy-enforcement'],
    queryFn: () => api<PolicyEnforcementAction[]>('/admin/compliance/policy-enforcement?limit=100'),
    staleTime: STALE_MS,
  });

  const policyActive = useMemo(
    () => (policy.data ?? []).filter((a) => a.step !== 'lifted' && (!storeId || a.storeId === storeId)),
    [policy.data, storeId],
  );

  const items = useMemo<NormalizedRequest[]>(() => {
    const out: NormalizedRequest[] = [];
    // Applications are pre-store (no storeId), so they only belong on the
    // platform-wide view — skip them when scoped to a single store.
    for (const a of storeId ? [] : apps.data ?? []) {
      out.push({
        kind: 'application',
        id: a.id,
        title: a.legalName,
        subtitle: `${a.email} · ${a.gstin}`,
        age: `Submitted ${formatAge(a.submittedAt)} · ${a.documentsCount}/5 docs`,
        badge: { label: 'New store', tone: 'info' },
        detailHref: `/admin/applications/${a.id}`,
      });
    }
    for (const cr of (changes.data ?? []).filter((c) => !storeId || c.storeId === storeId)) {
      out.push({
        kind: 'change',
        id: cr.id,
        title: fieldLabel(cr.field),
        subtitle: cr.storeName ?? `Store ${cr.storeId}`,
        age: `Submitted ${formatAge(cr.submittedAt)}`,
        badge: { label: 'Change request', tone: 'warning' },
        detailHref: `/admin/change-requests/${cr.id}`,
      });
    }
    // The query already filters to `submitted`, so no client-side status filtering here.
    for (const k of (kyc.data ?? []).filter((x) => !storeId || x.storeId === storeId)) {
      const reviewed = k.documents.filter(
        (d) => d.status === 'verified' || d.status === 'rejected',
      ).length;
      out.push({
        kind: 'kyc',
        id: k.id,
        title: k.storeName ?? `Store ${k.storeId ?? k.retailerId ?? ''}`,
        subtitle: `${reviewed}/${k.documents.length} documents reviewed`,
        age: k.submittedAt ? `Submitted ${formatAge(k.submittedAt)}` : 'Submitted',
        badge: { label: 'Re-KYC', tone: 'warning' },
        detailHref: `/admin/compliance/${k.id}`,
        // KYC is reviewed document-by-document — a one-click blanket approve from this
        // desk would bypass that entirely (it used to approve a cycle with zero docs).
        reviewOnly: true,
      });
    }
    for (const a of (appeals.data ?? []).filter((x) => !storeId || x.storeId === storeId)) {
      out.push({
        kind: 'appeal',
        id: a.storeId,
        title: a.storeName ?? `Store ${a.storeId}`,
        subtitle: a.lastMessagePreview,
        age: `${a.storeStatus ?? 'blocked'} · replied ${formatAge(a.lastMessageAt)}`,
        badge: { label: 'Appeal', tone: 'danger' },
        detailHref: `/admin/stores/${a.storeId}?tab=compliance`,
        // Appeals are a conversation + a lifecycle decision — no one-click accept.
        reviewOnly: true,
      });
    }
    for (const p of policyActive) {
      out.push({
        kind: 'policy',
        id: p.id,
        title: p.storeName ?? `Retailer ${p.retailerId ?? ''}`,
        subtitle: `Enforcement step: ${p.step.replace(/_/g, ' ')}`,
        age: formatAge(p.actedAt),
        badge: { label: 'Policy', tone: 'danger' },
        detailHref: p.retailerId ? `/admin/retailers/${p.retailerId}` : '/admin/compliance?tab=policy',
      });
    }
    return out;
  }, [apps.data, changes.data, kyc.data, appeals.data, policyActive, storeId]);

  return {
    items,
    count: items.length,
    isLoading: apps.isLoading || changes.isLoading || kyc.isLoading || policy.isLoading || appeals.isLoading,
  };
}

export function PendingRequestsGrid({ storeId }: { storeId?: string } = {}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { items, isLoading } = usePendingRequests(storeId);

  const [rejectApp, setRejectApp] = useState<string | null>(null);

  function invalidate(kind: RequestKind) {
    if (kind === 'application') void qc.invalidateQueries({ queryKey: ['admin', 'applications'] });
    else if (kind === 'change') void qc.invalidateQueries({ queryKey: ['admin', 'change-requests'] });
    else if (kind === 'kyc') void qc.invalidateQueries({ queryKey: ['admin', 'compliance'] });
    else void qc.invalidateQueries({ queryKey: ['admin', 'policy-enforcement'] });
  }

  const approveApp = useMutation({
    mutationFn: (id: string) => api(`/admin/applications/${id}/approve`, { method: 'POST', body: {} }),
    onSuccess: () => { toast.success('Application approved.'); invalidate('application'); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Approval failed.'),
  });
  const rejectAppMut = useMutation({
    mutationFn: ({ id, reason, mustReuploadDocKinds }: { id: string; reason: string; mustReuploadDocKinds: ApplicationDocumentKind[] }) =>
      api(`/admin/applications/${id}/reject`, { method: 'POST', body: { reason, mustReuploadDocKinds } }),
    onSuccess: () => { toast.success('Application rejected.'); setRejectApp(null); invalidate('application'); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Rejection failed.'),
  });

  const decideChange = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) =>
      api(`/admin/compliance/change-requests/${id}/decide`, { method: 'POST', body: { decision } }),
    onSuccess: (_d, v) => { toast.success(v.decision === 'approved' ? 'Approved and applied' : 'Rejected'); invalidate('change'); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed.'),
  });

  // KYC has no inline decide: it is reviewed document-by-document on the detail page.
  // A one-click blanket approve here used to approve a cycle with zero documents uploaded.
  function accept(r: NormalizedRequest) {
    if (r.kind === 'application') approveApp.mutate(r.id);
    else if (r.kind === 'change') decideChange.mutate({ id: r.id, decision: 'approved' });
  }
  function reject(r: NormalizedRequest) {
    if (r.kind === 'application') setRejectApp(r.id);
    else if (r.kind === 'change') decideChange.mutate({ id: r.id, decision: 'rejected' });
  }

  const acting = approveApp.isPending || rejectAppMut.isPending || decideChange.isPending;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
    );
  }
  if (items.length === 0) {
    return <Empty kicker="All clear" title="No pending requests." description="New store applications, change requests, re-KYC and policy breaches land here." />;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((r) => (
          <Card
            key={`${r.kind}:${r.id}`}
            className="flex cursor-pointer flex-col transition-colors hover:border-line-2"
            onClick={() => navigate(r.detailHref)}
          >
            <CardContent className="flex flex-1 flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-ink truncate">{r.title}</span>
                <Badge tone={r.badge.tone as never} flat>{r.badge.label}</Badge>
              </div>
              <div className="mt-1 text-xs text-ink-3 truncate">{r.subtitle}</div>
              <div className="mt-0.5 text-[11.5px] text-ink-4">{r.age}</div>

              <div className="mt-auto pt-3" onClick={(e) => e.stopPropagation()}>
                {r.kind === 'policy' ? (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(r.detailHref)}>
                    Open
                  </Button>
                ) : r.reviewOnly ? (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(r.detailHref)}>
                    Review documents
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={acting}
                      iconLeft={<Check className="size-3.5 text-success" />}
                      onClick={() => accept(r)}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={acting}
                      iconLeft={<X className="size-3.5 text-danger" />}
                      onClick={() => reject(r)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <RejectApplicationDialog
        open={rejectApp !== null}
        loading={rejectAppMut.isPending}
        onClose={() => setRejectApp(null)}
        onConfirm={({ reason, mustReuploadDocKinds }) =>
          rejectApp && rejectAppMut.mutate({ id: rejectApp, reason, mustReuploadDocKinds })
        }
      />
    </>
  );
}
