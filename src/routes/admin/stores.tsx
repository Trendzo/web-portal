import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Search, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { retailerStatusMeta, storeStatusMeta } from '@/lib/status';
import type { AdminRetailerView, AdminStoreView, StoreStatus } from '@/lib/types';
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

const STATUS_OPTIONS: ReadonlyArray<{ value: StoreStatus | 'all'; label: string }> = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'all', label: 'All storefronts' },
];

type StoreRetailer = NonNullable<AdminStoreView['retailer']>;

export default function AdminStores() {
  const [status, setStatus] = useState<StoreStatus | 'all'>('onboarding');
  const [q, setQ] = useState('');
  const [rejecting, setRejecting] = useState<AdminStoreView | null>(null);
  const [approving, setApproving] = useState<AdminStoreView | null>(null);
  const [reviewingRetailer, setReviewingRetailer] = useState<StoreRetailer | null>(null);

  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'stores', status],
    queryFn: () =>
      api<AdminStoreView[]>(status === 'all' ? '/admin/stores' : `/admin/stores?status=${status}`),
  });

  const approve = useMutation({
    mutationFn: ({
      id,
      platformFeeBp,
      payoutCadenceDays,
    }: {
      id: string;
      platformFeeBp: number;
      payoutCadenceDays: number;
    }) =>
      api<AdminStoreView>(`/admin/stores/${id}/approve`, {
        method: 'POST',
        body: { platformFeeBp, payoutCadenceDays },
      }),
    onSuccess: (s) => {
      toast.success(`Approved · ${s.legalName}`, {
        description: `Fee ${(s.platformFeeBp / 100).toFixed(2)}% · Payout every ${s.payoutCadenceDays} days`,
      });
      setApproving(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'stores'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Approve failed'),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api<AdminStoreView>(`/admin/stores/${id}/reject`, { method: 'POST', body: { reason } }),
    onSuccess: (s) => {
      toast.success(`Rejected · ${s.legalName}`);
      setRejecting(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'stores'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Reject failed'),
  });

  // Quick-action: approve the retailer that owns a still-pending store from inside the
  // storefronts page, so the admin doesn't have to context-switch to the retailers list.
  // Invalidates *both* queries so the storefront row's gate clears immediately.
  const approveRetailerInline = useMutation({
    mutationFn: (id: string) =>
      api<AdminRetailerView>(`/admin/retailers/${id}/approve`, { method: 'POST' }),
    onSuccess: (r) => {
      toast.success(`Approved retailer · ${r.email}`);
      setReviewingRetailer(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'stores'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'retailers'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Retailer approve failed'),
  });

  const filtered = (data ?? []).filter((s) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      s.legalName.toLowerCase().includes(needle) ||
      s.address.toLowerCase().includes(needle) ||
      s.gstin.toLowerCase().includes(needle) ||
      s.id.toLowerCase().includes(needle)
    );
  });

  return (
    <Page>
      <PageHeader
        title={<>Storefronts</>}
        description={
          <>
            Once approved, a store goes live and the retailer can publish products.
            Reject to mark a store terminated — the retailer can re-create it.
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            placeholder="Search by name, address, GSTIN, ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="!pl-7"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="kicker text-ink-3 hidden sm:inline">Filter</span>
          <Select value={status} onValueChange={(v) => setStatus(v as StoreStatus | 'all')}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-px border-y border-rule" data-stagger>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : isError ? (
        <Empty
          kicker="Connection lost"
          title="Couldn't load the storefronts."
          action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
        />
      ) : filtered.length === 0 ? (
        <Empty
          kicker="No storefronts"
          title={q ? 'Nothing matches that search.' : 'No storefronts to review today.'}
          description={q ? 'Try a different keyword.' : 'Approved retailers will submit storefronts here.'}
        />
      ) : (
        <ul className="border-y border-rule divide-y divide-rule" data-stagger>
          {filtered.map((s, i) => (
            <StoreRow
              key={s.id}
              ord={i + 1}
              store={s}
              busy={approve.isPending && approve.variables?.id === s.id}
              onApprove={() => setApproving(s)}
              onReject={() => setRejecting(s)}
              onReviewRetailer={() => s.retailer && setReviewingRetailer(s.retailer)}
            />
          ))}
        </ul>
      )}

      <ApproveDialog
        target={approving}
        onClose={() => setApproving(null)}
        onConfirm={(platformFeeBp, payoutCadenceDays) => {
          if (!approving) return;
          approve.mutate({ id: approving.id, platformFeeBp, payoutCadenceDays });
        }}
        loading={approve.isPending}
      />

      <RejectDialog
        target={rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => {
          if (!rejecting) return;
          reject.mutate({ id: rejecting.id, reason });
        }}
        loading={reject.isPending}
      />

      <RetailerReviewDialog
        retailer={reviewingRetailer}
        onClose={() => setReviewingRetailer(null)}
        onApprove={(id) => approveRetailerInline.mutate(id)}
        loading={approveRetailerInline.isPending}
      />
    </Page>
  );
}

function StoreRow({
  ord,
  store,
  busy,
  onApprove,
  onReject,
  onReviewRetailer,
}: {
  ord: number;
  store: AdminStoreView;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onReviewRetailer: () => void;
}) {
  const meta = storeStatusMeta(store.status);
  // Cross-entity gate: the storefront's owning retailer must be approved before
  // the store itself can be approved. Surface this so the admin sees the dependency
  // *before* clicking — backend enforces it too as a safety net.
  const retailerActive = store.retailer?.status === 'active';
  const retailerMeta = store.retailer ? retailerStatusMeta(store.retailer.status) : null;
  const isOnboarding = store.status === 'onboarding';
  const blockReason = !retailerActive
    ? `Retailer is ${store.retailer?.status.replace('_', ' ') ?? 'missing'}. Approve the retailer first.`
    : '';

  return (
    <li className="grid grid-cols-12 gap-6 px-2 py-6 hover:bg-surface/40 transition-colors">
      <div className="col-span-12 lg:col-span-1">
        <div className="font-mono text-[11px] tracking-wider text-ink-3">№ {String(ord).padStart(3, '0')}</div>
      </div>
      <div className="col-span-12 lg:col-span-7">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display italic text-[24px] leading-tight text-ink">{store.legalName}</h3>
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <Badge flat>
            Fee{' '}
            {store.platformFeeBp > 0
              ? `${(store.platformFeeBp / 100).toFixed(2)}%`
              : 'TBD'}
          </Badge>
        </div>
        <div className="mt-3">
          <MetaList
            cols={2}
            items={[
              {
                label: 'Owning retailer',
                value: store.retailer ? (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{store.retailer.legalName}</span>
                      {retailerMeta && <Badge tone={retailerMeta.tone}>{retailerMeta.label}</Badge>}
                    </div>
                    <div className="mt-0.5 text-[12px] text-ink-3">{store.retailer.email}</div>
                  </>
                ) : (
                  <span className="text-ink-3">No owner on file</span>
                ),
              },
              {
                label: 'Address',
                value: (
                  <>
                    <div>{store.address}</div>
                    <div className="mt-0.5 text-[12px] text-ink-3">
                      State {store.stateCode} · {store.lat.toFixed(4)}, {store.lng.toFixed(4)}
                    </div>
                  </>
                ),
              },
            ]}
          />
        </div>
        <p className="mt-3 text-[11.5px] uppercase tracking-[0.14em] text-ink-3">
          ID <span className="font-mono normal-case tracking-normal">{store.id}</span>
          <span className="mx-2 text-ink-4">·</span>
          GSTIN <span className="font-mono normal-case tracking-normal">{store.gstin}</span>
        </p>
        {isOnboarding && !retailerActive && store.retailer && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-warning-soft bg-warning-soft/40 px-3 py-2 rounded-xs">
            <span className="text-[12.5px] text-ink-2 leading-relaxed">
              <span className="text-warning">·</span> Approve{' '}
              <span className="text-ink font-medium">{store.retailer.email}</span> first
              before this storefront can go live.
            </span>
            <Button
              type="button"
              variant="ink"
              caps
              size="sm"
              onClick={onReviewRetailer}
            >
              Review retailer
            </Button>
          </div>
        )}
      </div>
      <div className="col-span-12 lg:col-span-4 flex items-start justify-end gap-2">
        {isOnboarding ? (
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
              disabled={!retailerActive}
              title={blockReason || undefined}
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

/**
 * Approval dialog. Admin sets BOTH the platform fee AND the payout cadence here —
 * the only point in the lifecycle where these get written. Defaults: 15% fee, 7-day
 * payout cadence; both editable inline.
 */
function ApproveDialog({
  target,
  onClose,
  onConfirm,
  loading,
}: {
  target: AdminStoreView | null;
  onClose: () => void;
  onConfirm: (platformFeeBp: number, payoutCadenceDays: number) => void;
  loading: boolean;
}) {
  const DEFAULT_FEE_PCT = 15;
  const DEFAULT_CADENCE = 7;
  const [feePct, setFeePct] = useState(String(DEFAULT_FEE_PCT));
  const [cadence, setCadence] = useState(String(DEFAULT_CADENCE));

  // Reset to the defaults each time a new store is opened.
  useEffect(() => {
    if (target) {
      setFeePct(String(DEFAULT_FEE_PCT));
      setCadence(String(DEFAULT_CADENCE));
    }
  }, [target]);

  const feeNum = parseFloat(feePct);
  const feeError =
    feePct.trim() === ''
      ? 'Enter a fee percentage'
      : Number.isNaN(feeNum)
        ? 'Must be a number'
        : feeNum < 0 || feeNum > 100
          ? 'Must be between 0 and 100'
          : '';

  const cadNum = parseInt(cadence, 10);
  const cadError =
    cadence.trim() === ''
      ? 'Enter a number of days'
      : Number.isNaN(cadNum)
        ? 'Must be a whole number'
        : cadNum < 1 || cadNum > 30
          ? 'Must be between 1 and 30 days'
          : '';

  const platformFeeBp = feeError ? 0 : Math.round(feeNum * 100);
  const payoutCadenceDays = cadError ? 0 : cadNum;
  const canSubmit = !feeError && !cadError;

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve {target?.legalName ?? 'storefront'}</DialogTitle>
          <DialogDescription>
            Set the commission and payout terms. Defaults are 15% fee and weekly payouts —
            change either for retailers on a different deal. The store goes live once approved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label htmlFor="approveFee" required hint="0–100">
              Platform fee (%)
            </Label>
            <Input
              id="approveFee"
              mono
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={feePct}
              onChange={(e) => setFeePct(e.target.value)}
              autoFocus
            />
            <FieldError>{feeError}</FieldError>
            {!feeError && (
              <p className="mt-2 text-[11.5px] uppercase tracking-[0.14em] text-ink-3">
                Stored as <span className="font-mono normal-case tracking-normal">
                  {platformFeeBp} bp
                </span>{' '}
                · {(platformFeeBp / 100).toFixed(2)}% of each order
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="approveCadence" required hint="1–30 days">
              Payout cadence (days)
            </Label>
            <Input
              id="approveCadence"
              mono
              type="number"
              min={1}
              max={30}
              step={1}
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
            />
            <FieldError>{cadError}</FieldError>
            {!cadError && (
              <p className="mt-2 text-[11.5px] uppercase tracking-[0.14em] text-ink-3">
                Payouts every{' '}
                <span className="font-mono normal-case tracking-normal">
                  {payoutCadenceDays}
                </span>{' '}
                day{payoutCadenceDays === 1 ? '' : 's'}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="ink"
            caps
            disabled={!canSubmit}
            loading={loading}
            iconLeft={<Check className="size-3.5" />}
            onClick={() => onConfirm(platformFeeBp, payoutCadenceDays)}
          >
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  target,
  onClose,
  onConfirm,
  loading,
}: {
  target: AdminStoreView | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  const error =
    reason.trim().length === 0 ? '' : reason.trim().length < 3 ? 'A reason worth recording, please.' : '';

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o) { onClose(); setReason(''); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this storefront?</DialogTitle>
          <DialogDescription>
            The store will be marked terminated. This is permanent — the retailer will need
            to re-submit a fresh storefront.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="reason" required>Cause</Label>
          <Input
            id="reason"
            placeholder="e.g. Address outside serviceable area"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <FieldError>{error}</FieldError>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onClose(); setReason(''); }}>Cancel</Button>
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

/**
 * Inline retailer-review dialog — opened from a storefront row when its owning
 * retailer hasn't been approved yet. Shows the retailer summary + an Approve button;
 * for anything more nuanced (rejecting, full profile) the admin still goes to the
 * Retailers page.
 */
function RetailerReviewDialog({
  retailer,
  onClose,
  onApprove,
  loading,
}: {
  retailer: StoreRetailer | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  loading: boolean;
}) {
  if (!retailer) return null;
  const meta = retailerStatusMeta(retailer.status);
  const canApprove = retailer.status === 'pending_approval';

  return (
    <Dialog open={Boolean(retailer)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review retailer</DialogTitle>
          <DialogDescription>
            Approve this retailer to unblock their storefront. Rejecting needs a reason
            and lives on the Retailers page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="kicker text-ink-3">Legal name</div>
            <div className="text-ink mt-1">{retailer.legalName}</div>
          </div>
          <div>
            <div className="kicker text-ink-3">Email</div>
            <div className="text-ink mt-1">{retailer.email}</div>
          </div>
          <div>
            <div className="kicker text-ink-3">Status</div>
            <div className="mt-1.5"><Badge tone={meta.tone}>{meta.label}</Badge></div>
          </div>
          <p className="text-[11.5px] uppercase tracking-[0.14em] text-ink-3 border-t border-rule pt-3">
            ID <span className="font-mono normal-case tracking-normal">{retailer.id}</span>
          </p>
          {!canApprove && (
            <p className="text-[12.5px] text-ink-2">
              {retailer.status === 'active'
                ? 'Already approved.'
                : 'This account is deactivated. Visit the Retailers page to manage.'}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {canApprove && (
            <Button
              variant="ink"
              caps
              loading={loading}
              iconLeft={<Check className="size-3.5" />}
              onClick={() => onApprove(retailer.id)}
            >
              Approve retailer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
