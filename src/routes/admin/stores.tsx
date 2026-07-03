import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { ReasonActionDialog } from '@/components/admin/reason-action-dialog';
import { storeStatusMeta } from '@/lib/status';
import type { StoreStatus } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PendingRequestsGrid, usePendingRequests } from '@/components/admin/pending-requests-grid';

interface AdminStoreListItem {
  id: string;
  legalEntityId: string;
  legalName: string;
  address: string;
  stateCode: string;
  status: StoreStatus;
  permanentSuspend: boolean;
  platformFeeBp: number;
  payoutCadenceDays: number;
  createdAt: string;
  orderCount: number;
  disputeCount: number;
  retailer: { id: string; email: string; legalName: string; status: string } | null;
}

const STATUS_OPTIONS: { value: StoreStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All stores' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'terminated', label: 'Terminated' },
];

const INDIA_STATES = [
  'AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'DD', 'DL', 'DN', 'GA', 'GJ',
  'HP', 'HR', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD', 'MH', 'ML', 'MN', 'MP',
  'MZ', 'NL', 'OD', 'PB', 'PY', 'RJ', 'SK', 'TG', 'TN', 'TR', 'UK', 'UP',
  'WB',
];

export default function AdminStores() {
  const [searchParams, setSearchParams] = useSearchParams();
  const retailerIdFilter = searchParams.get('retailerId');
  const [status, setStatus] = useState<StoreStatus | 'all'>('all');
  const [stateCode, setStateCode] = useState<string>('all');
  const [q, setQ] = useState('');
  // Toggle between the store grid and the merged compliance/KYC "Pending Requests"
  // grid (applications, change requests, re-KYC, policy breaches). See [[kyc-merged-into-stores]].
  const [showRequests, setShowRequests] = useState(false);
  const pending = usePendingRequests();
  const qc = useQueryClient();
  // Per-store lifecycle actions (moved here from the retailer tab — suspend is a
  // store-level action). Hold the target store for the reason dialog.
  const [suspendTarget, setSuspendTarget] = useState<AdminStoreListItem | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<AdminStoreListItem | null>(null);

  const lifecycle = useMutation({
    mutationFn: ({ storeId, verb, reason }: { storeId: string; verb: 'suspend' | 'ban'; reason: string }) =>
      api(`/admin/stores/${storeId}/${verb}`, { method: 'POST', body: { reason } }),
    onSuccess: (_d, v) => {
      toast.success(v.verb === 'ban' ? 'Store terminated' : 'Store suspended');
      setSuspendTarget(null);
      setTerminateTarget(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'stores'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
  });

  // Partition the cache by retailerIdFilter. Backend doesn't accept a
  // retailerId server-side filter today, so the filter is applied client-side
  // below — but giving each scoped view its own cache entry prevents the
  // "shared cache" from holding a single dataset mis-shaped for one viewer's
  // expectation.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'stores', status, stateCode, retailerIdFilter ?? null],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (stateCode !== 'all') params.set('stateCode', stateCode);
      params.set('limit', '200');
      const qs = params.toString();
      return api<AdminStoreListItem[]>(`/admin/stores${qs ? `?${qs}` : ''}`);
    },
  });

  const filtered = (data ?? []).filter((s) => {
    if (retailerIdFilter && s.retailer?.id !== retailerIdFilter) return false;
    if (!q) return true;
    const lq = q.toLowerCase();
    return (
      s.legalName.toLowerCase().includes(lq) ||
      s.address.toLowerCase().includes(lq) ||
      s.retailer?.email.toLowerCase().includes(lq) ||
      s.retailer?.legalName.toLowerCase().includes(lq)
    );
  });

  const filterRetailerName = retailerIdFilter
    ? (data ?? []).find((s) => s.retailer?.id === retailerIdFilter)?.retailer?.legalName
    : null;

  return (
    <Page>
      <PageHeader
        title="Stores"
        description="All retailer storefronts on the platform."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={showRequests ? 'ink' : 'outline'}
              size="sm"
              onClick={() => setShowRequests((v) => !v)}
            >
              {showRequests ? 'Back to stores' : 'Pending Requests'}
              {pending.count > 0 && (
                <Badge tone={showRequests ? 'neutral' : 'danger'} flat className="ml-1.5">
                  {pending.count}
                </Badge>
              )}
            </Button>
            <Button asChild variant="ink" size="sm">
              <Link to="/admin/retailers/new">+ New store</Link>
            </Button>
          </div>
        }
      />

      {showRequests ? (
        <PendingRequestsGrid />
      ) : (
      <>
      {retailerIdFilter && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-line bg-bg-2 px-3 py-2 text-[12.5px]">
          <span className="text-ink-3">Filtered to retailer:</span>
          <span className="text-ink font-medium">{filterRetailerName ?? retailerIdFilter}</span>
          <button
            type="button"
            onClick={() => {
              searchParams.delete('retailerId');
              setSearchParams(searchParams);
            }}
            className="ml-auto text-ink-3 hover:text-ink underline"
          >
            Clear
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={status} onValueChange={(v) => setStatus(v as StoreStatus | 'all')}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stateCode} onValueChange={setStateCode}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All states" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {INDIA_STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-3 pointer-events-none" />
          <Input
            className="pl-8"
            placeholder="Search by name, address, or owner email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <span className="self-center text-sm text-ink-3">
          {filtered.length} {filtered.length === 1 ? 'store' : 'stores'}
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : isError ? (
        <Empty
          title="Couldn't load stores"
          description="Check your connection and try again."
          action={<Button variant="outline" onClick={() => void refetch()}>Retry</Button>}
        />
      ) : filtered.length === 0 ? (
        <Empty
          title={q ? 'No stores match your search.' : 'No stores in this state.'}
          description={q ? 'Try a different keyword or filter.' : 'When retailers go live, stores appear here.'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((store) => {
            const meta = storeStatusMeta(store.status === 'suspended' && store.permanentSuspend ? 'terminated' : store.status);
            const label = store.status === 'suspended' && store.permanentSuspend ? 'terminated' : store.status;
            return (
              <Card key={store.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-ink truncate">{store.legalName}</span>
                    <Badge tone={meta.tone as never}>{label}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-ink-3 truncate">
                    {store.address} · {store.stateCode}
                  </div>
                  {store.retailer && (
                    <div className="mt-0.5 text-xs text-ink-3 truncate">
                      Owner: {store.retailer.legalName} · {store.retailer.email}
                    </div>
                  )}
                  <div className="mt-auto pt-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                      <span>{store.orderCount} orders</span>
                      {store.disputeCount > 0 && (
                        <span className="text-warning font-medium">{store.disputeCount} disputes</span>
                      )}
                      <span>{(store.platformFeeBp / 100).toFixed(1)}% fee</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link to={`/admin/stores/${store.id}`}>View</Link>
                      </Button>
                      {(store.status === 'active' || store.status === 'paused') && (
                        <Button variant="outline" size="sm" onClick={() => setSuspendTarget(store)}>
                          Suspend
                        </Button>
                      )}
                      {store.status !== 'terminated' && !store.permanentSuspend && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-danger border-danger/40 hover:bg-danger/5"
                          onClick={() => setTerminateTarget(store)}
                        >
                          Terminate
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </>
      )}

      <ReasonActionDialog
        open={suspendTarget !== null}
        title="Suspend store"
        description="Pauses fulfilment immediately. The owner account stays active so they can sign in and see the notice. Lift the suspension from the store detail page."
        confirmLabel="Suspend"
        loading={lifecycle.isPending}
        onClose={() => setSuspendTarget(null)}
        onConfirm={(reason) => { if (suspendTarget) lifecycle.mutate({ storeId: suspendTarget.id, verb: 'suspend', reason }); }}
      />
      <ReasonActionDialog
        open={terminateTarget !== null}
        title="Terminate store"
        description="Permanently terminates this store. The owner account is not deleted — use the retailer's Terminate to bar the account and all its stores."
        confirmLabel="Terminate"
        danger
        loading={lifecycle.isPending}
        onClose={() => setTerminateTarget(null)}
        onConfirm={(reason) => { if (terminateTarget) lifecycle.mutate({ storeId: terminateTarget.id, verb: 'ban', reason }); }}
      />
    </Page>
  );
}
