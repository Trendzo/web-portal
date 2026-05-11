import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { applicationStatusMeta, formatAge } from '@/lib/status';
import type { Application, ApplicationStatus } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import { ReasonActionDialog } from '@/components/admin/reason-action-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS: ReadonlyArray<{ value: ApplicationStatus | 'all'; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under review' },
  { value: 'docs_requested', label: 'Docs requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All applications' },
];

export default function AdminApplications() {
  const [status, setStatus] = useState<ApplicationStatus | 'all'>('pending');
  const [q, setQ] = useState('');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/applications/${id}/approve`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Application approved.');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Approval failed.'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/admin/applications/${id}/reject`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      toast.success('Application rejected.');
      setRejectTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Rejection failed.'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'applications', status],
    queryFn: () =>
      api<Application[]>(
        `/admin/applications?limit=50${status === 'all' ? '' : `&status=${status}`}`,
      ),
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!q.trim()) return list;
    const n = q.toLowerCase();
    return list.filter(
      (a) =>
        a.legalName.toLowerCase().includes(n) ||
        a.email.toLowerCase().includes(n) ||
        a.gstin.toLowerCase().includes(n) ||
        a.id.toLowerCase().includes(n),
    );
  }, [data, q]);

  return (
    <Page>
      <PageHeader
        kicker="Onboarding"
        title="Applications"
        description="Review pending retailer applications. Approve to admit, request clarification on weak fields, or reject with cause."
        actions={undefined}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
          <Input
            placeholder="Search legal name, email, GSTIN, ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="!pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as ApplicationStatus | 'all')}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[12px] text-ink-3">
          {filtered.length} {filtered.length === 1 ? 'application' : 'applications'}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Empty kicker="All clear" title="No applications match this filter." />
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => {
            const meta = applicationStatusMeta(a.status);
            const canAct = a.status === 'pending' || a.status === 'under_review' || a.status === 'docs_requested';
            return (
              <Card key={a.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-ink">{a.legalName}</span>
                      <Badge tone={meta.tone} pulse={a.status === 'pending' || a.status === 'docs_requested'}>
                        {meta.label}
                      </Badge>
                      {a.clarificationCount > 0 && (
                        <Badge tone="warning" flat>{a.clarificationCount} clarification{a.clarificationCount === 1 ? '' : 's'}</Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
                      <span>{a.email}</span>
                      <span>·</span>
                      <span className="font-mono text-[11.5px]">{a.gstin}</span>
                      <span>·</span>
                      <CopyableId value={a.id} label="application id" />
                    </div>
                    <div className="mt-1 text-[11.5px] text-ink-4">
                      Submitted {formatAge(a.submittedAt)} · {a.documentsCount}/5 docs · penny-drop {(a.pennyDropResult ?? 'not_attempted').replace('_', ' ')}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canAct && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          iconLeft={<Check className="size-3.5 text-success" />}
                          loading={approveMutation.isPending && approveMutation.variables === a.id}
                          onClick={() => approveMutation.mutate(a.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          iconLeft={<X className="size-3.5 text-danger" />}
                          onClick={() => setRejectTarget(a.id)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                      <Link to={`/admin/applications/${a.id}`}>Open</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}
      <ReasonActionDialog
        open={rejectTarget !== null}
        title="Reject application"
        description="Provide a reason for rejection. This is recorded in the audit log and may be shared with the applicant."
        confirmLabel="Reject"
        danger
        loading={rejectMutation.isPending}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => rejectTarget && rejectMutation.mutate({ id: rejectTarget, reason })}
      />
    </Page>
  );
}
