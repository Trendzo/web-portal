import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, Check, Search, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { retailerStatusMeta } from '@/lib/status';
import type { AdminRetailerView, RetailerStatus } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldError, Label } from '@/components/ui/label';

const SUB_ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Floor staff',
};

const STATUS_OPTIONS: ReadonlyArray<{ value: RetailerStatus | 'all'; label: string }> = [
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'approved_no_store', label: 'Approved · awaiting store' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'all', label: 'All retailers' },
];

export default function AdminRetailers() {
  const [status, setStatus] = useState<RetailerStatus | 'all'>('active');
  const [q, setQ] = useState('');
  const [rejecting, setRejecting] = useState<AdminRetailerView | null>(null);
  const [suspending, setSuspending] = useState<AdminRetailerView | null>(null);
  const [terminating, setTerminating] = useState<AdminRetailerView | null>(null);

  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'retailers', status],
    queryFn: () =>
      api<AdminRetailerView[]>(
        status === 'all' ? '/admin/retailers' : `/admin/retailers?status=${status}`,
      ),
  });

  const approve = useMutation({
    mutationFn: (id: string) =>
      api<AdminRetailerView>(`/admin/retailers/${id}/approve`, { method: 'POST' }),
    onSuccess: (r) => {
      toast.success(`Approved ${r.email}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'retailers'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Approve failed'),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api<AdminRetailerView>(`/admin/retailers/${id}/reject`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: (r) => {
      toast.success(`Rejected ${r.email}`);
      setRejecting(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'retailers'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Reject failed'),
  });

  const suspend = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/admin/retailers/${id}/suspend`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      toast.success('Store suspended');
      setSuspending(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'retailers'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Suspend failed'),
  });

  const terminate = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/admin/retailers/${id}/terminate`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      toast.success('Retailer terminated');
      setTerminating(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'retailers'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Terminate failed'),
  });

  const filtered = (data ?? []).filter((r) => {
    if (!q.trim()) return true;
    const n = q.toLowerCase();
    return (
      r.email.toLowerCase().includes(n) ||
      r.legalName.toLowerCase().includes(n) ||
      r.gstin.toLowerCase().includes(n) ||
      r.id.toLowerCase().includes(n)
    );
  });

  return (
    <Page>
      <PageHeader
        title="Retailers"
        description="Approve to admit, reject with cause to log a refusal. A store is provisioned automatically on approval."
        actions={
          <Button asChild variant="ink" size="sm">
            <Link to="/admin/retailers/new">+ New retailer</Link>
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
            <Input
              placeholder="Search name, email, GSTIN, ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="!pl-9"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as RetailerStatus | 'all')}>
            <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[12px] text-ink-3 hidden sm:inline">
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : isError ? (
        <Empty
          kicker="Connection lost"
          title="Couldn't load retailers"
          description="The API didn't respond. Try again, or check the backend."
          action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
        />
      ) : filtered.length === 0 ? (
        <Empty
          kicker={q ? 'No matches' : 'All clear'}
          title={q ? 'No retailers match your search.' : 'No retailers in this state.'}
          description={q ? 'Try a different keyword.' : 'When new retailers sign up, they appear here.'}
        />
      ) : (
        <div className="rounded-lg border border-line bg-bg overflow-hidden">
          {/* Desktop: table */}
          <table className="hidden md:table w-full text-[13px]">
            <thead className="bg-bg-2 border-b border-line">
              <tr>
                <Th>Retailer</Th>
                <Th>Role</Th>
                <Th>Contact</Th>
                <Th>GSTIN</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((r) => {
                const meta = retailerStatusMeta(r.status);
                const busy = approve.isPending && approve.variables === r.id;
                return (
                  <tr key={r.id} className="hover:bg-bg-2/50 transition-colors">
                    <Td>
                      <div className="font-medium text-ink">{r.legalName}</div>
                      <div className="text-[11px] text-ink-4 font-mono mt-0.5 truncate max-w-[180px]">
                        {r.id}
                      </div>
                    </Td>
                    <Td>
                      <Badge tone="info" flat>{SUB_ROLE_LABEL[r.subRole] ?? r.subRole}</Badge>
                    </Td>
                    <Td>
                      <div className="text-ink-2">{r.email}</div>
                      <div className="text-[11.5px] text-ink-3 mt-0.5">{r.phone}</div>
                    </Td>
                    <Td className="font-mono text-[12px]">{r.gstin}</Td>
                    <Td>
                      <Badge tone={meta.tone} pulse={r.status === 'pending_approval'}>
                        {meta.label}
                      </Badge>
                    </Td>
                    <Td className="text-[12px] text-ink-3">
                      {new Date(r.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </Td>
                    <Td className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {r.status === 'pending_approval' ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              iconLeft={<X className="size-3.5" />}
                              onClick={() => setRejecting(r)}
                            >
                              Reject
                            </Button>
                            <Button
                              variant="accent"
                              size="sm"
                              iconLeft={<Check className="size-3.5" />}
                              onClick={() => approve.mutate(r.id)}
                              loading={busy}
                            >
                              Approve
                            </Button>
                          </>
                        ) : r.status === 'active' ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSuspending(r)}
                            >
                              Suspend
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-danger border-danger/40 hover:bg-danger/5"
                              onClick={() => setTerminating(r)}
                            >
                              Terminate
                            </Button>
                          </>
                        ) : null}
                        <Button asChild variant="ghost" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                          <Link to={`/admin/retailers/${r.id}`}>View</Link>
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile: stacked cards */}
          <ul className="md:hidden divide-y divide-line">
            {filtered.map((r) => {
              const meta = retailerStatusMeta(r.status);
              const busy = approve.isPending && approve.variables === r.id;
              return (
                <li key={r.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-ink truncate">{r.legalName}</div>
                      <div className="text-[12.5px] text-ink-3 truncate mt-0.5">{r.email}</div>
                    </div>
                    <Badge tone={meta.tone} pulse={r.status === 'pending_approval'}>
                      {meta.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-ink-3 font-mono">
                    <Badge tone="info" flat>{SUB_ROLE_LABEL[r.subRole] ?? r.subRole}</Badge>
                    <span>·</span>
                    <span>{r.gstin}</span>
                  </div>
                  {r.status === 'pending_approval' && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        iconLeft={<X className="size-3.5" />}
                        onClick={() => setRejecting(r)}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="accent"
                        size="sm"
                        className="flex-1"
                        iconLeft={<Check className="size-3.5" />}
                        onClick={() => approve.mutate(r.id)}
                        loading={busy}
                      >
                        Approve
                      </Button>
                    </div>
                  )}
                  {r.status === 'active' && (
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setSuspending(r)}>
                        Suspend
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-danger border-danger/40"
                        onClick={() => setTerminating(r)}
                      >
                        Terminate
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <RejectDialog
        target={rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => {
          if (!rejecting) return;
          reject.mutate({ id: rejecting.id, reason });
        }}
        loading={reject.isPending}
      />
      <ReasonActionDialog
        title="Suspend store"
        description="This will pause fulfilment immediately. The retailer account stays active so they can log in and see the notice. You can lift the suspension later."
        confirmLabel="Suspend"
        target={suspending}
        onClose={() => setSuspending(null)}
        onConfirm={(reason) => { if (suspending) suspend.mutate({ id: suspending.id, reason }); }}
        loading={suspend.isPending}
      />
      <ReasonActionDialog
        title="Terminate retailer"
        description="This permanently terminates the retailer and their store. It cannot be undone."
        confirmLabel="Terminate"
        danger
        target={terminating}
        onClose={() => setTerminating(null)}
        onConfirm={(reason) => { if (terminating) terminate.mutate({ id: terminating.id, reason }); }}
        loading={terminate.isPending}
      />
    </Page>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-3 ${className ?? ''}`}>
      {children}
    </th>
  );
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ''}`}>{children}</td>;
}

function RejectDialog({
  target,
  onClose,
  onConfirm,
  loading,
}: {
  target: AdminRetailerView | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  const error =
    reason.trim().length === 0
      ? ''
      : reason.trim().length < 3
        ? 'Add a longer reason'
        : '';

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setReason('');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this retailer?</DialogTitle>
          <DialogDescription>
            They'll be marked terminated and won't be able to onboard further. The reason is logged.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="reason" required>Reason</Label>
          <Input
            id="reason"
            placeholder="e.g. Invalid GSTIN, KYC mismatch"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <FieldError>{error}</FieldError>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onClose(); setReason(''); }}>Cancel</Button>
          <Button
            variant="danger"
            disabled={Boolean(error) || reason.trim().length === 0}
            loading={loading}
            onClick={() => onConfirm(reason.trim())}
          >
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReasonActionDialog({
  title,
  description,
  confirmLabel,
  danger = false,
  target,
  onClose,
  onConfirm,
  loading,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  target: AdminRetailerView | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(o) => {
        if (!o) { onClose(); setReason(''); }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="action-reason" required>Reason</Label>
          <Input
            id="action-reason"
            placeholder="Internal reason (logged)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onClose(); setReason(''); }}>Cancel</Button>
          <Button
            variant={danger ? 'danger' : 'ink'}
            disabled={reason.trim().length === 0}
            loading={loading}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
