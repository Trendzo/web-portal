import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useStoreRetailerId } from '@/hooks/useStoreRetailerId';
import { PendingRequestsGrid } from '@/components/admin/pending-requests-grid';
import { ClarificationThread } from '@/components/admin/clarification-thread';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  CircleDot,
  Coins,
  CalendarClock,
  Clock,
  ImageOff,
  MapPin,
  Package,
  Pencil,
  Receipt,
  ShoppingCart,
  ShieldAlert,
  SlidersHorizontal,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import { ReasonActionDialog } from '@/components/admin/reason-action-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AccountsOnStoreCard } from '@/components/admin/accounts-on-store-card';
import { PermissionGate } from '@/components/shell/PermissionGate';
import { cn } from '@/lib/cn';
import { gstStateNameFor } from '@/lib/states';

type AppealMessage = {
  id: string;
  storeId: string;
  authorKind: 'admin' | 'retailer' | 'system';
  body: string;
  attachments: string[];
  createdAt: string;
};

interface AdminStoreView {
  id: string;
  legalEntityId: string;
  legalName: string;
  gstin: string;
  pan?: string | null;
  gstScheme?: 'regular' | 'composition' | null;
  address: string;
  stateCode: string;
  lat?: number | null;
  lng?: number | null;
  openingHours?: Record<string, { open: string; close: string }[]> | null;
  galleryImageUrls?: string[] | null;
  status: string;
  permanentSuspend?: boolean;
  suspendReason?: string | null;
  suspendedAt?: string | null;
  suspendedByAccountId?: string | null;
  contactPhone?: string | null;
  managerName?: string | null;
  platformFeeBp: number;
  deliveryOverridePaise?: number | null;
  handlingFeePaise?: number | null;
  convenienceFeePaise?: number | null;
  payoutCadenceDays: number;
  delegationModeEnabled?: boolean;
  posBillingEnabled?: boolean;
  lowStockThreshold?: number;
  pauseVisibility?: 'visible' | 'hidden' | null;
  pauseReason?: string | null;
  pauseUntil?: string | null;
  createdAt: string;
  /** Owner retailer account. `retailer.id` (a `ret_…` id) is what the staff
   *  endpoint keys on — NOT `legalEntityId`, which is a human legal-entity code. */
  retailer?: { id: string; email: string; legalName: string; status: string } | null;
}

type EditDraft = {
  legalName: string;
  gstin: string;
  address: string;
  stateCode: string;
  contactPhone: string;
  managerName: string;
  platformFeeBp: number;
  payoutCadenceDays: number;
  /** §12 F3a — required when platformFeeBp changes. Recorded on the audit row. */
  platformFeeReason: string;
  /** lat/lng kept as raw input strings; parsed + validated on save. */
  lat: string;
  lng: string;
  /** Single open/close slot per weekday — the common case; empty day = closed. */
  openingHours: Record<string, { open: string; close: string }[]>;
};

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export default function AdminStoreDetail() {
  // Shared by two entry points: the retailer-scoped route
  // `/admin/retailers/:id/stores/:storeId` (id present) and the Stores-list
  // route `/admin/stores/:storeId` (id absent — derived from the fetched store's
  // legalEntityId below). Keeps one component so neither entry loses its nav tab.
  const { id: routeRetailerId, storeId } = useParams<{ id: string; storeId: string }>();
  const cameFromStores = !routeRetailerId;
  const [searchParams, setSearchParams] = useSearchParams();

  const TAB_KEYS = ['overview', 'compliance', 'accounts'] as const;
  type TabKey = (typeof TAB_KEYS)[number];
  function parseTab(v: string | null): TabKey {
    return TAB_KEYS.includes(v as TabKey) ? (v as TabKey) : 'overview';
  }
  const activeTab = parseTab(searchParams.get('tab'));
  function setActiveTab(v: string) {
    const next = parseTab(v);
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (next === 'overview') sp.delete('tab');
        else sp.set('tab', next);
        return sp;
      },
      { replace: true },
    );
  }
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<null | 'pause' | 'suspend' | 'terminate' | 'reverify'>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  // Verified store fields (legal name / address / GSTIN) can be applied directly
  // (admin override) or filed as a change request that flows through the approval
  // queue. `applyMode` picks which; `changeReason` is required for change requests.
  const [applyMode, setApplyMode] = useState<'immediate' | 'change_request'>('immediate');
  const [changeReason, setChangeReason] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'stores', storeId],
    queryFn: () => api<AdminStoreView>(`/admin/stores/${storeId!}`),
    enabled: Boolean(storeId),
  });

  // Retailer id: trust the route only when it's a real `ret_…` account id,
  // else recover it from the store record. Same resolution every store-scoped
  // page uses, so deep-links and the accounts query always resolve.
  const retailerId = useStoreRetailerId(storeId);

  // Accounts count drives a KPI tile + a deep-link button — fetched here so the
  // card and the headline number stay in sync, since the AccountsOnStoreCard
  // query is keyed identically and shares the React-Query cache.
  const accountsQ = useQuery({
    queryKey: ['admin', 'retailers', retailerId, 'staff'],
    queryFn: () => api<Array<{ id: string; subRole: string; status: string }>>(`/admin/retailers/${retailerId}/staff`),
    enabled: Boolean(retailerId),
  });

  const appealQ = useQuery({
    queryKey: ['admin', 'store-appeal', storeId],
    queryFn: () =>
      api<{ storeStatus: string; messages: AppealMessage[] }>(`/admin/stores/${storeId}/appeal`),
    enabled: Boolean(storeId),
  });
  const appealReply = useMutation({
    mutationFn: (body: string) =>
      api(`/admin/stores/${storeId}/appeal`, { method: 'POST', body: { body } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'store-appeal', storeId] }),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to send reply'),
  });

  const action = useMutation({
    mutationFn: ({ verb, reason }: { verb: 'pause' | 'resume' | 'suspend' | 'unsuspend' | 'ban' | 'unban'; reason?: string }) =>
      api(`/admin/stores/${storeId}/${verb}`, { method: 'POST', body: reason ? { reason } : {} }),
    onSuccess: (_d, vars) => {
      toast.success(`Store ${vars.verb}`);
      setDialog(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'stores'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
  });

  const reverifyMut = useMutation({
    mutationFn: (reason: string) =>
      api<{ cycleId: string; storeId: string }>(
        `/admin/compliance/stores/${storeId}/reverify`,
        { method: 'POST', body: { reason } },
      ),
    onSuccess: () => {
      toast.success('KYC re-verification opened · retailer will see the banner');
      setDialog(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'compliance', 'kyc'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'stores', storeId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Re-KYC failed'),
  });

  const saveMut = useMutation({
    mutationFn: async ({ d, mode, reason }: { d: EditDraft; mode: 'immediate' | 'change_request'; reason: string }) => {
      const server = data!;
      const feeChanged = d.platformFeeBp !== server.platformFeeBp;

      // Location + hours are non-verified direct fields (backend PATCH accepts them
      // straight). Send only what actually changed so we never clobber lat/lng with
      // NaN or overwrite hours with an empty object on an untouched form.
      const extras: Record<string, unknown> = {};
      const latNum = d.lat.trim() === '' ? null : Number(d.lat);
      const lngNum = d.lng.trim() === '' ? null : Number(d.lng);
      if (latNum !== null && !Number.isNaN(latNum) && latNum !== server.lat) extras.lat = latNum;
      if (lngNum !== null && !Number.isNaN(lngNum) && lngNum !== server.lng) extras.lng = lngNum;
      if (JSON.stringify(d.openingHours) !== JSON.stringify(server.openingHours ?? {})) {
        extras.openingHours = d.openingHours;
      }

      if (mode === 'change_request') {
        // Verified fields (legal name / address / GSTIN) → change requests; all other
        // changed fields have no change-request type, so they still apply directly.
        const calls: Promise<unknown>[] = [];
        const cr = (field: 'legal_name' | 'address' | 'gstin', requestedValue: string) =>
          api(`/admin/compliance/stores/${storeId}/change-requests`, {
            method: 'POST',
            body: { field, requestedValue, reason },
          });
        if (d.legalName !== server.legalName) calls.push(cr('legal_name', d.legalName));
        if (d.address !== server.address) calls.push(cr('address', d.address));
        if (d.gstin !== server.gstin) calls.push(cr('gstin', d.gstin));

        const direct: Record<string, unknown> = {};
        if (d.stateCode !== server.stateCode) direct.stateCode = d.stateCode;
        if ((d.contactPhone || null) !== (server.contactPhone ?? null)) direct.contactPhone = d.contactPhone || null;
        if ((d.managerName || null) !== (server.managerName ?? null)) direct.managerName = d.managerName || null;
        if (feeChanged) { direct.platformFeeBp = d.platformFeeBp; direct.platformFeeReason = d.platformFeeReason; }
        if (d.payoutCadenceDays !== server.payoutCadenceDays) direct.payoutCadenceDays = d.payoutCadenceDays;
        Object.assign(direct, extras);
        if (Object.keys(direct).length > 0) {
          calls.push(api(`/admin/stores/${storeId}`, { method: 'PATCH', body: direct }));
        }
        if (calls.length === 0) throw new ApiError(400, 'no_changes', 'No changes to save');
        await Promise.all(calls);
        return;
      }

      // Immediate override — everything (incl. GSTIN) written directly.
      await api(`/admin/stores/${storeId}`, {
        method: 'PATCH',
        body: {
          storeName: d.legalName,
          gstin: d.gstin,
          address: d.address,
          stateCode: d.stateCode,
          contactPhone: d.contactPhone || null,
          managerName: d.managerName || null,
          platformFeeBp: d.platformFeeBp,
          payoutCadenceDays: d.payoutCadenceDays,
          ...(feeChanged ? { platformFeeReason: d.platformFeeReason } : {}),
          ...extras,
        },
      });
    },
    onSuccess: (_r, vars) => {
      toast.success(vars.mode === 'change_request' ? 'Change request(s) filed' : 'Store profile updated');
      setEditing(false);
      setDraft(null);
      setApplyMode('immediate');
      setChangeReason('');
      void qc.invalidateQueries({ queryKey: ['admin', 'stores', storeId] });
      void qc.invalidateQueries({ queryKey: ['admin', 'change-requests'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  if (!storeId) return <Page><PageHeader title="Missing storeId" /></Page>;
  if (isLoading) {
    return (
      <Page>
        <Skeleton className="h-24 mb-4" />
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </Page>
    );
  }
  if (isError || !data) {
    return (
      <Page>
        <PageHeader title="Store not found" actions={
          <Button variant="outline" onClick={() => void refetch()}>Retry</Button>
        } />
      </Page>
    );
  }

  const s = data;
  const tone: StatusTone =
    s.permanentSuspend ? 'danger'
    : s.status === 'active' ? 'success'
    : s.status === 'paused' ? 'warning'
    : s.status === 'suspended' ? 'danger'
    : 'neutral';
  const statusLabel = s.status === 'terminated' || s.permanentSuspend ? 'terminated' : s.status;
  const accountsCount = accountsQ.data?.length ?? 0;
  const activeStaffCount = (accountsQ.data ?? []).filter((a) => a.status === 'active').length;
  // GST codes read as opaque numbers; show the state name when the code resolves,
  // else fall back to the raw code so nothing is hidden.
  const stateName = gstStateNameFor(s.stateCode);
  const stateLabel = stateName ? `${stateName} (${s.stateCode})` : s.stateCode;

  function startEdit() {
    setDraft({
      legalName: s.legalName,
      gstin: s.gstin,
      address: s.address,
      stateCode: s.stateCode,
      contactPhone: s.contactPhone ?? '',
      managerName: s.managerName ?? '',
      platformFeeBp: s.platformFeeBp,
      platformFeeReason: '',
      payoutCadenceDays: s.payoutCadenceDays,
      lat: s.lat != null ? String(s.lat) : '',
      lng: s.lng != null ? String(s.lng) : '',
      openingHours: s.openingHours ?? {},
    });
    setApplyMode('immediate');
    setChangeReason('');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(null);
    setApplyMode('immediate');
    setChangeReason('');
  }

  return (
    <Page>
      <PageHeader
        kicker="Store"
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span>{s.legalName}</span>
            <Badge tone={tone as never}>
              <CircleDot className="size-3" /> {statusLabel}
            </Badge>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
            <CopyableId value={s.id} label="store id" />
            <span className="text-ink-4">·</span>
            <span className="font-mono">{s.gstin}</span>
            <span className="text-ink-4">·</span>
            <span>{s.address}, {stateLabel}</span>
            <span className="text-ink-4">·</span>
            <span>created {new Date(s.createdAt).toLocaleDateString()}</span>
          </span>
        }
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            {cameFromStores ? (
              <Link to="/admin/stores">Back to stores</Link>
            ) : (
              <Link to={`/admin/retailers/${retailerId}`}>Back to retailer</Link>
            )}
          </Button>
        }
      />

      {/* KPI strip — one-glance store health.
          Numbers in tabular so columns line up across tiles. */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          icon={<Coins className="size-3.5" />}
          label="Platform fee"
          value={`${(s.platformFeeBp / 100).toFixed(2)}%`}
        />
        <KpiTile
          icon={<CalendarClock className="size-3.5" />}
          label="Pays out"
          value={`every ${s.payoutCadenceDays}d`}
        />
        <KpiTile
          icon={<Users className="size-3.5" />}
          label="Accounts"
          value={accountsCount.toString()}
          hint={`${activeStaffCount} active`}
        />
        <KpiTile
          icon={<CircleDot className="size-3.5" />}
          label="Lifecycle"
          value={statusLabel}
          tone={tone}
        />
      </div>

      {/* Action ribbon — full-width row of lifecycle controls. Keeps Pause/Suspend/
          Terminate one click away regardless of where the operator is on the page,
          rather than tucking them at the bottom of a profile card. */}
      <Card className="mb-5">
        <CardContent className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[12.5px] text-ink-3">
            {s.status === 'onboarding' && !s.permanentSuspend && (
              <>
                <span className="text-ink font-medium">Onboarding.</span>{' '}
                Store is still completing setup and is not yet fulfilling orders. Lifecycle controls unlock once it goes active.
              </>
            )}
            {s.status === 'terminated' && !s.permanentSuspend && (
              <>
                <span className="text-danger font-medium">Terminated.</span>{' '}
                {s.suspendReason ?? 'No reason recorded'}
              </>
            )}
            {s.status === 'active' && 'Store is fulfilling orders. Pause briefly for downtime, suspend to block until policy review, terminate to end the relationship.'}
            {s.status === 'paused' && (
              <>
                <span className="text-warning font-medium">Paused.</span>{' '}
                {s.pauseReason ?? 'No reason recorded'}
                {s.pauseVisibility === 'hidden' && ' · hidden from consumer catalog'}
              </>
            )}
            {s.status === 'suspended' && !s.permanentSuspend && (
              <>
                <span className="text-danger font-medium">Suspended.</span>{' '}
                {s.suspendReason ?? 'No reason recorded'}
              </>
            )}
            {s.permanentSuspend && (
              <>
                <span className="text-danger font-medium">Terminated.</span>{' '}
                {s.suspendReason ?? 'No reason recorded'}
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {s.status === 'active' && (
              <>
                <PermissionGate action="store_management.edit">
                  <Button variant="ink" size="sm" onClick={() => setDialog('pause')}>
                    Pause
                  </Button>
                </PermissionGate>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" iconRight={<ChevronDown className="size-3.5" />}>
                      More
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => setDialog('suspend')}>
                      <ShieldAlert className="size-3.5 text-warning" />
                      Suspend store
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDialog('terminate')}>
                      <X className="size-3.5 text-danger" />
                      Terminate store
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {s.status === 'paused' && (
              <PermissionGate action="store_management.edit">
                <Button variant="ink" size="sm" onClick={() => action.mutate({ verb: 'resume' })}>
                  Resume store
                </Button>
              </PermissionGate>
            )}
            {s.status === 'suspended' && !s.permanentSuspend && (
              <PermissionGate action="retailer.reinstate">
                <Button variant="ink" size="sm" onClick={() => action.mutate({ verb: 'unsuspend' })}>
                  Lift suspension
                </Button>
              </PermissionGate>
            )}
            {s.permanentSuspend && (
              <PermissionGate action="retailer.reinstate">
                <Button variant="ink" size="sm" onClick={() => action.mutate({ verb: 'unban' })}>
                  Reinstate store
                </Button>
              </PermissionGate>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick actions — operator entry points hoisted above the tab bar so the
          tools operators reach for constantly are one click away, not buried in
          a tab. Each deep-links into the store-scoped operator view. */}
      <div className="mb-5">
        <p className="mb-2 kicker text-ink-3">Manage this store</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <OpsTile icon={Package}      label="Listings"   href={`/admin/retailers/${retailerId}/stores/${storeId}/listings`} />
          <OpsTile icon={ShoppingCart} label="Fulfilment" href={`/admin/retailers/${retailerId}/stores/${storeId}/fulfilment`} />
          <OpsTile icon={Tag}          label="Promotions" href={`/admin/retailers/${retailerId}/stores/${storeId}/promotions`} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <SectionHeading kicker="Identity" title="Profile" />
                {!editing && (
                  <PermissionGate action="store_management.edit">
                    <Button
                      variant="outline"
                      size="sm"
                      iconLeft={<Pencil className="size-3" />}
                      onClick={startEdit}
                    >
                      Edit
                    </Button>
                  </PermissionGate>
                )}
              </div>

              {editing && draft ? (
                <EditForm
                  draft={draft}
                  serverPlatformFeeBp={s.platformFeeBp}
                  applyMode={applyMode}
                  changeReason={changeReason}
                  verifiedChanged={
                    draft.legalName !== s.legalName ||
                    draft.address !== s.address ||
                    draft.gstin !== s.gstin
                  }
                  onApplyModeChange={setApplyMode}
                  onChangeReason={setChangeReason}
                  onChange={setDraft}
                  onCancel={cancelEdit}
                  onSave={() => {
                    if (!draft) return;
                    const feeChanged = draft.platformFeeBp !== s.platformFeeBp;
                    if (feeChanged && draft.platformFeeReason.trim().length < 3) {
                      toast.error('Reason (≥3 chars) is required when changing the platform fee.');
                      return;
                    }
                    // Reject half-filled hours: a day must have both open and close, or neither.
                    const partialDay = Object.entries(draft.openingHours).find(
                      ([, slots]) => slots[0] && (!slots[0].open || !slots[0].close),
                    );
                    if (partialDay) {
                      toast.error(`Opening hours for ${partialDay[0]} need both open and close times.`);
                      return;
                    }
                    if ((draft.lat.trim() && Number.isNaN(Number(draft.lat))) || (draft.lng.trim() && Number.isNaN(Number(draft.lng)))) {
                      toast.error('Latitude / longitude must be valid numbers.');
                      return;
                    }
                    const verifiedChanged =
                      draft.legalName !== s.legalName ||
                      draft.address !== s.address ||
                      draft.gstin !== s.gstin;
                    if (applyMode === 'change_request') {
                      if (!verifiedChanged) {
                        toast.error('Change-request mode needs a change to legal name, address, or GSTIN.');
                        return;
                      }
                      if (changeReason.trim().length < 3) {
                        toast.error('A reason (≥3 chars) is required to file a change request.');
                        return;
                      }
                    }
                    saveMut.mutate({ d: draft, mode: applyMode, reason: changeReason.trim() });
                  }}
                  saving={saveMut.isPending}
                />
              ) : (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ProfileRow label="Legal name" value={s.legalName} />
                  <ProfileRow label="GSTIN" value={s.gstin} mono />
                  <ProfileRow label="PAN" value={s.pan || '—'} mono />
                  <ProfileRow
                    label="GST scheme"
                    value={
                      s.gstScheme === 'composition'
                        ? 'Composition · Bill of Supply'
                        : s.gstScheme === 'regular'
                          ? 'Regular · Tax Invoice'
                          : '—'
                    }
                  />
                  <ProfileRow label="Address" value={s.address} />
                  <ProfileRow label="State" value={stateLabel} />
                  <ProfileRow label="Contact phone" value={s.contactPhone ?? '—'} mono />
                  <ProfileRow label="Manager" value={s.managerName || 'Not assigned'} />
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Fees & payout — the full economics of the store in one place. Only the
              platform fee is a KPI tile above; the retailer-set delivery/handling/
              convenience fees live only here, so this is the one view that answers
              "what does this store charge and when does it get paid?". */}
          {/* Fees & payout — only the two fields an admin can actually set per store
              (platform fee + payout cadence). Delivery/handling/convenience are
              platform-wide or have no per-store write path, so they're omitted here.
              Edit opens the same store edit form the Profile card uses. */}
          <Card className="mt-5">
            <CardContent className="p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <SectionHeading kicker="Economics" title="Fees & payout" />
                {!editing && (
                  <PermissionGate action="store_management.edit">
                    <Button
                      variant="outline"
                      size="sm"
                      iconLeft={<Pencil className="size-3" />}
                      onClick={() => {
                        startEdit();
                        setActiveTab('overview');
                      }}
                    >
                      Edit
                    </Button>
                  </PermissionGate>
                )}
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <ProfileRow label="Platform fee" value={`${(s.platformFeeBp / 100).toFixed(2)}%`} mono />
                <ProfileRow label="Payout cadence" value={`Every ${s.payoutCadenceDays} days`} />
              </dl>
              {editing && (
                <p className="mt-3 text-[12.5px] text-ink-3">Editing in the form above ↑</p>
              )}
            </CardContent>
          </Card>

          {/* Configuration — operational capability flags. Small on/off chips so an
              operator can read the store's mode at a glance without opening settings. */}
          <Card className="mt-5">
            <CardContent className="p-5">
              <SectionHeading kicker="Setup" title="Configuration" />
              <div className="mt-3 flex flex-wrap gap-2">
                <ConfigChip icon={Receipt} label="POS billing" on={!!s.posBillingEnabled} />
                <ConfigChip icon={SlidersHorizontal} label="Delegation mode" on={!!s.delegationModeEnabled} />
                <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-bg-2/60 px-2.5 py-1 text-[12.5px] text-ink-2">
                  <Package className="size-3.5 text-ink-3" />
                  Low-stock threshold
                  <span className="font-mono tabular-nums text-ink">{s.lowStockThreshold ?? 5}</span>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Location & storefront — geolocation, hours and photos. Turns the abstract
              record into a real place: an operator can confirm the pin, the trading
              hours and what the store actually looks like. */}
          <Card className="mt-5">
            <CardContent className="p-5">
              <SectionHeading kicker="Storefront" title="Location & storefront" />
              <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <p className="kicker mb-1">Location</p>
                    {s.lat != null && s.lng != null ? (
                      <>
                        <p className="font-mono text-[13px] text-ink">
                          {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                        </p>
                        <a
                          className="mt-1 inline-flex items-center gap-1 text-[12.5px] text-info hover:underline"
                          href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=16/${s.lat}/${s.lng}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MapPin className="size-3.5" /> Open in map
                        </a>
                        <div className="mt-2 overflow-hidden rounded-lg border border-line">
                          <iframe
                            title="Store location"
                            className="h-44 w-full"
                            loading="lazy"
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${s.lng - 0.01}%2C${s.lat - 0.01}%2C${s.lng + 0.01}%2C${s.lat + 0.01}&layer=mapnik&marker=${s.lat}%2C${s.lng}`}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-[13px] text-ink-3">No coordinates on file</p>
                    )}
                  </div>

                  <div>
                    <p className="kicker mb-1">Opening hours</p>
                    <OpeningHours hours={s.openingHours} />
                  </div>
                </div>

                <div>
                  <p className="kicker mb-1">Store photos</p>
                  <GalleryStrip urls={s.galleryImageUrls} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <SectionHeading kicker="Risk" title="Compliance" />
                <PermissionGate action="kyc.review">
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={<ShieldAlert className="size-3.5" />}
                    onClick={() => setDialog('reverify')}
                  >
                    Ask for KYC again
                  </Button>
                </PermissionGate>
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <ProfileRow
                  label="Pause reason"
                  value={s.pauseReason ?? '—'}
                  tone={s.pauseReason ? 'warning' : 'neutral'}
                />
                <ProfileRow
                  label="Pause mode"
                  value={
                    s.status === 'paused'
                      ? s.pauseVisibility === 'hidden' ? 'Hidden from catalog' : 'Blocking new orders'
                      : '—'
                  }
                />
                <ProfileRow
                  label="Suspend reason"
                  value={s.suspendReason ?? '—'}
                  tone={s.suspendReason ? 'danger' : 'neutral'}
                />
                <ProfileRow
                  label="Permanent ban"
                  value={s.permanentSuspend ? 'Yes' : 'No'}
                  tone={s.permanentSuspend ? 'danger' : 'neutral'}
                />
                <ProfileRow
                  label="Pause until"
                  value={s.pauseUntil ? new Date(s.pauseUntil).toLocaleString() : '—'}
                />
                <ProfileRow
                  label="Suspended at"
                  value={s.suspendedAt ? new Date(s.suspendedAt).toLocaleString() : '—'}
                />
                <ProfileRow
                  label="Suspended by"
                  value={s.suspendedByAccountId ?? '—'}
                  mono={!!s.suspendedByAccountId}
                />
              </dl>
            </CardContent>
          </Card>

          {/* Store-scoped compliance requests — the same operations as the
              KYC/Pending-Requests desk (re-KYC, verified-field change requests,
              policy breaches), filtered to this store. Card click opens the
              same detail flow; Accept/Reject act in place. */}
          <div className="mt-6">
            <SectionHeading kicker="Requests" title="Compliance requests for this store" />
            <p className="mt-1 mb-3 text-[12.5px] text-ink-3">
              Pending re-KYC, change requests and policy breaches scoped to this store.
            </p>
            <PendingRequestsGrid storeId={storeId} />
          </div>

          {/* Suspend/terminate appeal thread — the retailer's in-band channel to
              contest a suspension/termination. Shown once there's a thread or the
              store is suspended/terminated. */}
          {(s.status === 'suspended' || s.status === 'terminated' || (appealQ.data?.messages.length ?? 0) > 0) && (
            <div className="mt-6">
              <SectionHeading kicker="Appeal" title="Suspension / termination appeal" />
              <p className="mt-1 mb-3 text-[12.5px] text-ink-3">
                Messages between the retailer and ClosetX about this suspension/termination.
                Lift the action from the ribbon above once resolved.
              </p>
              <Card>
                <CardContent className="p-5">
                  <ClarificationThread
                    messages={(appealQ.data?.messages ?? []).map((m) => ({
                      id: m.id,
                      applicationId: m.storeId,
                      authorKind: m.authorKind === 'admin' ? 'admin' : 'applicant',
                      authorLabel:
                        m.authorKind === 'admin' ? 'ClosetX admin' : m.authorKind === 'system' ? 'System' : 'Retailer',
                      body: m.body,
                      attachments: m.attachments,
                      fieldKey: null,
                      createdAt: m.createdAt,
                    }))}
                    canReply
                    replyPending={appealReply.isPending}
                    onReply={(text) => appealReply.mutate(text)}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="accounts">
          {retailerId && <AccountsOnStoreCard retailerId={retailerId} />}
        </TabsContent>
      </Tabs>

      <ReasonActionDialog
        open={dialog === 'pause'}
        title="Pause store"
        description="Pauses fulfilment temporarily. You can resume from this screen at any time."
        confirmLabel="Pause"
        onClose={() => setDialog(null)}
        onConfirm={(reason) => action.mutate({ verb: 'pause', reason })}
        loading={action.isPending}
      />
      <ReasonActionDialog
        open={dialog === 'suspend'}
        title="Suspend store"
        description="Temporary admin block. Retailer sees a banner and inbox message. Lift at any time."
        confirmLabel="Suspend"
        onClose={() => setDialog(null)}
        onConfirm={(reason) => action.mutate({ verb: 'suspend', reason })}
        loading={action.isPending}
      />
      <ReasonActionDialog
        open={dialog === 'terminate'}
        title="Terminate store"
        description="Permanently ends the relationship with this store. The retailer is signed out and barred. Can only be reversed by an admin with reinstate permission."
        confirmLabel="Terminate"
        danger
        onClose={() => setDialog(null)}
        onConfirm={(reason) => action.mutate({ verb: 'ban', reason })}
        loading={action.isPending}
      />
      <ReasonActionDialog
        open={dialog === 'reverify'}
        title="Trigger re-KYC"
        description="Opens a fresh 14-day KYC re-verification cycle for this store. The retailer sees a banner + KYC page until they re-upload the 5 required documents. Reason is recorded in the audit log."
        confirmLabel="Trigger re-KYC"
        onClose={() => setDialog(null)}
        onConfirm={(reason) => reverifyMut.mutate(reason)}
        loading={reverifyMut.isPending}
      />
    </Page>
  );
}

function KpiTile({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: StatusTone;
}) {
  const toneCls =
    tone === 'success'
      ? 'border-success/30 bg-success-soft/40'
      : tone === 'warning'
        ? 'border-warning/30 bg-warning-soft/40'
        : tone === 'danger'
          ? 'border-danger/30 bg-danger/5'
          : 'border-line bg-bg';
  const valueCls =
    tone === 'success' ? 'text-success-strong'
    : tone === 'warning' ? 'text-warning'
    : tone === 'danger' ? 'text-danger'
    : 'text-ink';

  return (
    <div className={cn('rounded-lg border px-3 py-2.5', toneCls)}>
      <div className="flex items-center gap-1.5 text-ink-3">
        {icon}
        <span className="kicker">{label}</span>
      </div>
      <div className={cn('mt-1 font-mono tabular-nums text-[20px] leading-none capitalize', valueCls)}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11.5px] text-ink-3">{hint}</div>}
    </div>
  );
}

function ProfileRow({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: StatusTone;
}) {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-[13px] text-ink',
          mono && 'font-mono',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function OpsTile({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Package;
  label: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="group flex items-center justify-between gap-2 rounded-lg border border-line bg-bg px-3 py-3 transition-colors hover:border-line-2 hover:bg-bg-2/60"
    >
      <span className="flex items-center gap-2">
        <span className="rounded-md border border-line bg-bg-2 p-1.5">
          <Icon className="size-3.5 text-ink-2" />
        </span>
        <span className="text-[13px] font-medium text-ink">{label}</span>
      </span>
      <ArrowUpRight className="size-3.5 text-ink-3 transition-colors group-hover:text-ink" />
    </Link>
  );
}

function ConfigChip({
  icon: Icon,
  label,
  on,
}: {
  icon: typeof Package;
  label: string;
  on: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12.5px]',
        on ? 'border-success/30 bg-success-soft/50 text-success' : 'border-line bg-bg-2/60 text-ink-3',
      )}
    >
      <Icon className="size-3.5" />
      {label}
      <span className="font-medium">{on ? 'On' : 'Off'}</span>
    </span>
  );
}

// Weekday order for opening-hours rendering; keys match the stored jsonb shape.
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABEL: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

function OpeningHours({ hours }: { hours: Record<string, { open: string; close: string }[]> | null | undefined }) {
  const entries = hours ? Object.entries(hours).filter(([, slots]) => slots && slots.length > 0) : [];
  if (entries.length === 0) {
    return <p className="text-[13px] text-ink-3">No hours set</p>;
  }
  // Preserve a stable weekday order, then append any non-standard keys as-is.
  const ordered = [
    ...DAY_ORDER.filter((d) => hours?.[d]?.length),
    ...Object.keys(hours ?? {}).filter((k) => !DAY_ORDER.includes(k as never) && hours?.[k]?.length),
  ];
  return (
    <dl className="space-y-1">
      {ordered.map((day) => (
        <div key={day} className="flex items-center gap-2 text-[13px]">
          <dt className="flex w-10 items-center gap-1 text-ink-3">
            <Clock className="size-3" /> {DAY_LABEL[day] ?? day}
          </dt>
          <dd className="font-mono tabular-nums text-ink">
            {(hours?.[day] ?? []).map((slot) => `${slot.open}–${slot.close}`).join(', ')}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function GalleryStrip({ urls }: { urls: string[] | null | undefined }) {
  const list = (urls ?? []).filter(Boolean);
  if (list.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center gap-2 rounded-lg border border-dashed border-line text-[12.5px] text-ink-3">
        <ImageOff className="size-4" /> No photos uploaded
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {list.map((url, i) => (
        <a
          key={`${url}-${i}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="group aspect-square overflow-hidden rounded-lg border border-line bg-bg-2"
        >
          <img
            src={url}
            alt={`Store photo ${i + 1}`}
            loading="lazy"
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        </a>
      ))}
    </div>
  );
}

function OpeningHoursEditor({
  value,
  onChange,
}: {
  value: Record<string, { open: string; close: string }[]>;
  onChange: (next: Record<string, { open: string; close: string }[]>) => void;
}) {
  function setDay(day: string, field: 'open' | 'close', v: string) {
    const slot = value[day]?.[0] ?? { open: '', close: '' };
    const nextSlot = { ...slot, [field]: v };
    const next = { ...value };
    // Only record a day when BOTH ends are filled; otherwise drop it (= closed).
    if (nextSlot.open || nextSlot.close) next[day] = [nextSlot]; // keep partial while typing
    else delete next[day];
    onChange(next);
  }
  function clearDay(day: string) {
    const next = { ...value };
    delete next[day];
    onChange(next);
  }
  return (
    <div className="mt-1 space-y-1.5 rounded-lg border border-line bg-bg-2/40 p-3">
      {DAY_ORDER.map((day) => {
        const slot = value[day]?.[0];
        return (
          <div key={day} className="flex items-center gap-2 text-[13px]">
            <span className="w-9 text-ink-3">{DAY_LABEL[day]}</span>
            <input
              type="time"
              value={slot?.open ?? ''}
              onChange={(e) => setDay(day, 'open', e.target.value)}
              className="rounded border border-line-2 bg-bg px-2 py-1 font-mono text-[12.5px]"
            />
            <span className="text-ink-4">–</span>
            <input
              type="time"
              value={slot?.close ?? ''}
              onChange={(e) => setDay(day, 'close', e.target.value)}
              className="rounded border border-line-2 bg-bg px-2 py-1 font-mono text-[12.5px]"
            />
            {(slot?.open || slot?.close) && (
              <button
                type="button"
                onClick={() => clearDay(day)}
                className="ml-1 text-ink-4 hover:text-danger"
                aria-label={`Clear ${DAY_LABEL[day]}`}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        );
      })}
      <p className="pt-1 text-[11px] text-ink-4">Leave a day blank to mark it closed.</p>
    </div>
  );
}

function EditForm({
  draft,
  serverPlatformFeeBp,
  applyMode,
  changeReason,
  verifiedChanged,
  onApplyModeChange,
  onChangeReason,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  draft: EditDraft;
  serverPlatformFeeBp: number;
  applyMode: 'immediate' | 'change_request';
  changeReason: string;
  verifiedChanged: boolean;
  onApplyModeChange: (m: 'immediate' | 'change_request') => void;
  onChangeReason: (r: string) => void;
  onChange: (updater: (d: EditDraft | null) => EditDraft | null) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const feeChanged = draft.platformFeeBp !== serverPlatformFeeBp;
  return (
    <>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ed-name">Legal name</Label>
          <Input
            id="ed-name"
            value={draft.legalName}
            onChange={(e) => onChange((d) => (d ? { ...d, legalName: e.target.value } : d))}
          />
        </div>
        <div>
          <Label htmlFor="ed-gstin">
            GSTIN
            <span className="ml-1.5 text-[11px] font-normal text-ink-3">(verified — override or file a request below)</span>
          </Label>
          <Input
            id="ed-gstin"
            mono
            className="uppercase"
            maxLength={15}
            value={draft.gstin}
            onChange={(e) => onChange((d) => (d ? { ...d, gstin: e.target.value.toUpperCase() } : d))}
          />
        </div>
        <div>
          <Label htmlFor="ed-address">Address</Label>
          <Input
            id="ed-address"
            value={draft.address}
            onChange={(e) => onChange((d) => (d ? { ...d, address: e.target.value } : d))}
          />
        </div>
        <div>
          <Label htmlFor="ed-state">State code</Label>
          <Input
            id="ed-state"
            value={draft.stateCode}
            maxLength={3}
            placeholder="e.g. MH"
            onChange={(e) => onChange((d) => (d ? { ...d, stateCode: e.target.value.toUpperCase() } : d))}
          />
        </div>
        <div>
          <Label htmlFor="ed-phone">Contact phone</Label>
          <Input
            id="ed-phone"
            value={draft.contactPhone}
            placeholder="9876543210"
            onChange={(e) => onChange((d) => (d ? { ...d, contactPhone: e.target.value } : d))}
          />
        </div>
        <div>
          <Label htmlFor="ed-manager">Manager name</Label>
          <Input
            id="ed-manager"
            value={draft.managerName}
            placeholder="Ramesh Patel"
            onChange={(e) => onChange((d) => (d ? { ...d, managerName: e.target.value } : d))}
          />
        </div>
        <div>
          <Label htmlFor="ed-fee">Platform fee (%)</Label>
          <Input
            id="ed-fee"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={draft.platformFeeBp / 100}
            onChange={(e) => {
              const pct = parseFloat(e.target.value);
              if (!isNaN(pct)) onChange((d) => (d ? { ...d, platformFeeBp: Math.round(pct * 100) } : d));
            }}
          />
          {feeChanged && (
            <div className="mt-2">
              <Label htmlFor="ed-fee-reason">Reason for override</Label>
              <textarea
                id="ed-fee-reason"
                rows={2}
                maxLength={500}
                placeholder="e.g. launch promo for Q3"
                value={draft.platformFeeReason}
                onChange={(e) =>
                  onChange((d) => (d ? { ...d, platformFeeReason: e.target.value } : d))
                }
                className="mt-1 w-full rounded border border-line-2 bg-bg px-2 py-1 text-[13px]"
              />
              <p className="mt-1 text-[11px] text-ink-4">
                Recorded on the audit row; retailer accounts get an inbox notification.
              </p>
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="ed-payout">Payout cadence (days)</Label>
          <Input
            id="ed-payout"
            type="number"
            min="1"
            max="30"
            value={draft.payoutCadenceDays}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) onChange((d) => (d ? { ...d, payoutCadenceDays: v } : d));
            }}
          />
        </div>
        <div>
          <Label htmlFor="ed-lat">Latitude</Label>
          <Input
            id="ed-lat"
            mono
            inputMode="decimal"
            placeholder="19.0596"
            value={draft.lat}
            onChange={(e) => onChange((d) => (d ? { ...d, lat: e.target.value } : d))}
          />
        </div>
        <div>
          <Label htmlFor="ed-lng">Longitude</Label>
          <Input
            id="ed-lng"
            mono
            inputMode="decimal"
            placeholder="72.8295"
            value={draft.lng}
            onChange={(e) => onChange((d) => (d ? { ...d, lng: e.target.value } : d))}
          />
        </div>
      </div>

      {/* Opening hours — one open/close slot per weekday (the common case). Leave a
          day blank to mark it closed; both fields are required to record a slot. */}
      <div className="mt-5">
        <Label>Opening hours</Label>
        <OpeningHoursEditor
          value={draft.openingHours}
          onChange={(next) => onChange((d) => (d ? { ...d, openingHours: next } : d))}
        />
      </div>

      {/* Apply mode — verified fields (legal name / address / GSTIN) can be written
          directly (override) or filed as a change request for the approval queue. */}
      <div className="mt-6 rounded-lg border border-line bg-bg-2/40 p-3">
        <p className="kicker text-ink-3">How to apply legal name / address / GSTIN changes</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onApplyModeChange('immediate')}
            className={cn(
              'rounded-md border px-3 py-1.5 text-[12.5px] transition-colors',
              applyMode === 'immediate' ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:bg-bg-2',
            )}
          >
            Apply immediately (override)
          </button>
          <button
            type="button"
            onClick={() => onApplyModeChange('change_request')}
            className={cn(
              'rounded-md border px-3 py-1.5 text-[12.5px] transition-colors',
              applyMode === 'change_request' ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:bg-bg-2',
            )}
          >
            File change request
          </button>
        </div>
        {applyMode === 'change_request' && (
          <div className="mt-3">
            <Label htmlFor="ed-cr-reason" required>Reason for the change request</Label>
            <textarea
              id="ed-cr-reason"
              rows={2}
              maxLength={500}
              placeholder="e.g. GSTIN correction per updated certificate"
              value={changeReason}
              onChange={(e) => onChangeReason(e.target.value)}
              className="mt-1 w-full rounded border border-line-2 bg-bg px-2 py-1 text-[13px]"
            />
            <p className="mt-1 text-[11px] text-ink-4">
              {verifiedChanged
                ? 'A pending request is filed per changed verified field; other fields apply directly. Approve it from the Compliance tab.'
                : 'Change a verified field (legal name, address, or GSTIN) to file a request.'}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="ink" loading={saving} onClick={onSave}>
          {applyMode === 'change_request' ? 'Save & file request' : 'Save changes'}
        </Button>
        <Button variant="outline" iconLeft={<X className="size-3.5" />} onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </>
  );
}
