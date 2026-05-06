import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Search, X } from 'lucide-react';
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
import { MetaList } from '@/components/ui/meta-list';

const STATUS_OPTIONS: ReadonlyArray<{ value: RetailerStatus | 'all'; label: string }> = [
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'active', label: 'Active' },
  { value: 'deactivated', label: 'Deactivated' },
  { value: 'all', label: 'All retailers' },
];

export default function AdminRetailers() {
  const [status, setStatus] = useState<RetailerStatus | 'all'>('pending_approval');
  const [q, setQ] = useState('');
  const [rejecting, setRejecting] = useState<AdminRetailerView | null>(null);

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
      toast.success(`Approved · ${r.email}`);
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
      toast.success(`Rejected · ${r.email}`);
      setRejecting(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'retailers'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Reject failed'),
  });

  const filtered = (data ?? []).filter((r) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      r.email.toLowerCase().includes(needle) ||
      r.legalName.toLowerCase().includes(needle) ||
      r.gstin.toLowerCase().includes(needle) ||
      r.id.toLowerCase().includes(needle)
    );
  });

  return (
    <Page>
      <PageHeader
        title={<>Retailers</>}
        description={
          <>
            Approve to admit, reject with cause to log a refusal. Approved retailers can
            then submit a storefront for separate review.
          </>
        }
      />

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search by name, email, GSTIN, ID…" />
        <StatusFilter value={status} onChange={(v) => setStatus(v as RetailerStatus | 'all')} options={STATUS_OPTIONS} />
      </Toolbar>

      {isLoading ? (
        <div className="space-y-px border-y border-rule" data-stagger>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : isError ? (
        <Empty
          kicker="Connection lost"
          title="Couldn't load the applications."
          description="The API didn't respond. Try again, or check the backend."
          action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
        />
      ) : filtered.length === 0 ? (
        <Empty
          kicker="No applications"
          title={q ? 'Nothing matches that search.' : 'A quiet morning at the door.'}
          description={
            q
              ? 'Try a different keyword or clear the filter.'
              : 'When retailers sign up, they will line up here for review.'
          }
        />
      ) : (
        <ul className="border-y border-rule divide-y divide-rule" data-stagger>
          {filtered.map((r, i) => (
            <RetailerRow
              key={r.id}
              ord={i + 1}
              retailer={r}
              busy={approve.isPending && approve.variables === r.id}
              onApprove={() => approve.mutate(r.id)}
              onReject={() => setRejecting(r)}
            />
          ))}
        </ul>
      )}

      <RejectDialog
        target={rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => {
          if (!rejecting) return;
          reject.mutate({ id: rejecting.id, reason });
        }}
        loading={reject.isPending}
        kind="retailer"
      />
    </Page>
  );
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
      {children}
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative max-w-md flex-1">
      <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="!pl-7"
      />
    </div>
  );
}

function StatusFilter<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="kicker text-ink-3 hidden sm:inline">Filter</span>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="sm:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RetailerRow({
  ord,
  retailer,
  busy,
  onApprove,
  onReject,
}: {
  ord: number;
  retailer: AdminRetailerView;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const meta = retailerStatusMeta(retailer.status);
  const ordStr = String(ord).padStart(3, '0');
  return (
    <li className="grid grid-cols-12 gap-6 px-2 py-6 hover:bg-surface/40 transition-colors">
      <div className="col-span-12 lg:col-span-1">
        <div className="font-mono text-[11px] tracking-wider text-ink-3">№ {ordStr}</div>
      </div>
      <div className="col-span-12 lg:col-span-7">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display italic text-[24px] leading-tight text-ink">
            {retailer.legalName}
          </h3>
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {retailer.storeId && <Badge flat tone="neutral">Has storefront</Badge>}
        </div>
        <div className="mt-3">
          <MetaList
            cols={3}
            items={[
              { label: 'Email', value: retailer.email },
              { label: 'Phone', value: retailer.phone },
              { label: 'GSTIN', value: retailer.gstin, mono: true },
            ]}
          />
        </div>
        <p className="mt-3 text-[11.5px] uppercase tracking-[0.14em] text-ink-3">
          ID <span className="font-mono normal-case tracking-normal">{retailer.id}</span>
          <span className="mx-2 text-ink-4">·</span>
          Joined {new Date(retailer.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      </div>
      <div className="col-span-12 lg:col-span-4 flex items-start justify-end gap-2">
        {retailer.status === 'pending_approval' ? (
          <>
            <Button variant="outline" size="sm" iconLeft={<X className="size-3.5" />} onClick={onReject}>
              Reject
            </Button>
            <Button
              variant="ink"
              size="sm"
              caps
              iconLeft={<Check className="size-3.5" />}
              onClick={onApprove}
              loading={busy}
            >
              Approve
            </Button>
          </>
        ) : (
          <span className="kicker text-ink-3">— Decided —</span>
        )}
      </div>
    </li>
  );
}

function RejectDialog({
  target,
  onClose,
  onConfirm,
  loading,
  kind,
}: {
  target: AdminRetailerView | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
  kind: 'retailer' | 'store';
}) {
  const [reason, setReason] = useState('');
  const error =
    reason.trim().length === 0
      ? ''
      : reason.trim().length < 3
        ? 'A reason worth recording, please.'
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
          <DialogTitle>Reject this {kind}?</DialogTitle>
          <DialogDescription>
            They'll be marked deactivated and won't be able to onboard further. The reason
            is logged on the desk.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="reason" required>Cause</Label>
          <Input
            id="reason"
            placeholder="e.g. Invalid GSTIN, KYC mismatch"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <FieldError>{error}</FieldError>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onClose();
              setReason('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            caps
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
