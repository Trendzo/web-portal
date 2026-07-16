import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useStoreRetailerId } from '@/hooks/useStoreRetailerId';
import { PendingRequestsGrid } from '@/components/admin/pending-requests-grid';
import { ClarificationThread } from '@/components/admin/clarification-thread';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  ChevronDown,
  CircleDot,
  Coins,
  CalendarClock,
  Clock,
  ImageOff,
  MapPin,
  MessageSquareText,
  Package,
  PauseCircle,
  Pencil,
  Phone,
  PlayCircle,
  Receipt,
  Rocket,
  ScrollText,
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

// Lazy so Leaflet only loads when a store with coordinates is viewed.
const StoreMap = lazy(() => import('@/components/ui/store-map'));

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
  // Appeal cards deep-link with #appeal — scroll to the thread once the tab renders.
  // Also fires when the card is clicked on THIS page's scoped grid (hash change only).
  const location = useLocation();
  useEffect(() => {
    if (location.hash !== '#appeal') return;
    const t = setTimeout(
      () =>
        document
          .getElementById('store-appeal-thread')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      150,
    );
    return () => clearTimeout(t);
  }, [location.hash, activeTab]);
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
  const [dialog, setDialog] = useState<null | 'pause' | 'suspend' | 'terminate' | 'reverify' | 'restore'>(null);
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
    mutationFn: ({ verb, reason }: { verb: 'pause' | 'suspend' | 'ban'; reason?: string }) =>
      api(`/admin/stores/${storeId}/${verb}`, { method: 'POST', body: reason ? { reason } : {} }),
    onSuccess: (_d, vars) => {
      toast.success(`Store ${vars.verb}`);
      setDialog(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'stores'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
  });

  // Single restore path — the server maps the store's state to the right lift and
  // reports which one it took (`restoreMode`) so the toast can say what happened.
  const restoreMut = useMutation({
    mutationFn: (reason: string) =>
      api<{
        restoreMode:
          | 'account_reinstated'
          | 'account_reopened'
          | 'resumed'
          | 'unsuspended'
          | 'reinstated';
      }>(`/admin/stores/${storeId}/restore`, { method: 'POST', body: reason ? { reason } : {} }),
    onSuccess: (d) => {
      toast.success(
        {
          account_reinstated: 'Account ban lifted — store restored',
          account_reopened: 'Account reopened — store and logins restored',
          resumed: 'Store resumed',
          unsuspended: 'Suspension lifted — store is live',
          reinstated: 'Store reinstated',
        }[d.restoreMode] ?? 'Store operations resumed',
      );
      setDialog(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'stores'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'retailers'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'change-requests', 'pending'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Restore failed'),
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
    s.status === 'active' ? 'success'
    : s.status === 'paused' ? 'warning'
    : s.status === 'suspended' || s.status === 'terminated' ? 'danger'
    : 'neutral';
  const statusLabel = s.status;
  // Why the store is down decides what "Resume store operations" will actually do —
  // surfaced in the ribbon copy and the confirm dialog, decided again server-side.
  const closureSuspended =
    s.status === 'suspended' && s.suspendReason === 'account_closed_by_owner';
  const cascadeBanned =
    s.status === 'terminated' && (s.suspendReason ?? '').startsWith('account_termination[');
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

  const lifecycle = lifecycleNotice(s, { closureSuspended, cascadeBanned });

  return (
    <Page>
      {/* Back link — small, above the hero so the identity band leads the page. */}
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
          {cameFromStores ? (
            <Link to="/admin/stores">Back to stores</Link>
          ) : (
            <Link to={`/admin/retailers/${retailerId}`}>Back to retailer</Link>
          )}
        </Button>
      </div>

      {/* ── Hero identity band ─────────────────────────────────────────────
          Monogram + name + status, the store's key registry facts as copy/scan
          chips, and the lifecycle controls — the operator's whole "what and how
          do I act on this store" answered above the fold. A faint dot texture in
          the top-right lifts it from a plain panel without breaking the mono
          console palette. */}
      <Card className="relative mb-4 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 size-64 text-ink"
          style={{
            backgroundImage: 'radial-gradient(currentColor 1.1px, transparent 1.1px)',
            backgroundSize: '15px 15px',
            opacity: 0.05,
            maskImage: 'radial-gradient(circle at top right, black, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(circle at top right, black, transparent 72%)',
          }}
        />
        <CardContent className="relative p-5 sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <Monogram name={s.legalName} tone={tone} />
              <div className="min-w-0">
                <div className="kicker mb-1.5 flex items-center gap-2">
                  <span>Store</span>
                  <span className="text-ink-4">·</span>
                  <span className="normal-case tracking-normal text-ink-3">
                    {storeAgeLabel(s.createdAt)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-ink sm:text-[28px]">
                    {s.legalName}
                  </h1>
                  <Badge tone={tone as never} pulse={s.status === 'onboarding' || s.status === 'paused'}>
                    {statusLabel}
                  </Badge>
                  {s.gstScheme && (
                    <Badge flat nodot>
                      {s.gstScheme === 'composition' ? 'Composition' : 'Regular GST'}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <CopyableId value={s.id} label="store id" />
                  <MetaChip icon={Receipt} value={s.gstin} mono />
                  <MetaChip icon={MapPin} value={`${s.address}, ${stateLabel}`} />
                  <MetaChip icon={CalendarClock} value={`Created ${new Date(s.createdAt).toLocaleDateString()}`} />
                </div>

                {/* Lifecycle controls — sitting under the store's identity so the
                    primary action tracks the record it acts on. */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {s.status === 'active' && (
                    <>
                      <PermissionGate action="store_management.edit">
                        <Button variant="ink" size="sm" iconLeft={<PauseCircle className="size-3.5" />} onClick={() => setDialog('pause')}>
                          Pause store
                        </Button>
                      </PermissionGate>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" iconRight={<ChevronDown className="size-3.5" />}>
                            More actions
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
                  {/* THE restore affordance — one button, one place, every non-operating
                      state. The backend /restore endpoint lifts the full chain (account
                      ban / owner closure / store pause-suspend-terminate) so the operator
                      never hunts for the right lever on another page. */}
                  {(s.status === 'paused' || s.status === 'suspended' || s.status === 'terminated') && (
                    <PermissionGate
                      action={s.status === 'paused' ? 'store_management.edit' : 'retailer.reinstate'}
                    >
                      <Button variant="ink" size="sm" iconLeft={<PlayCircle className="size-3.5" />} onClick={() => setDialog('restore')}>
                        Resume store operations
                      </Button>
                    </PermissionGate>
                  )}
                  {/* Jump straight to the retailer's appeal conversation — same
                      condition that renders the thread on the Compliance tab. */}
                  {(s.status === 'suspended' ||
                    s.status === 'terminated' ||
                    (appealQ.data?.messages.length ?? 0) > 0) && (
                    <Button
                      variant="outline"
                      size="sm"
                      iconLeft={<MessageSquareText className="size-3.5" />}
                      onClick={() => {
                        setActiveTab('compliance');
                        setTimeout(
                          () =>
                            document
                              .getElementById('store-appeal-thread')
                              ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                          50,
                        );
                      }}
                    >
                      Appeal thread
                      {(appealQ.data?.messages.length ?? 0) > 0 && ` (${appealQ.data!.messages.length})`}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Ops shortcuts — square deep-link cards, right-aligned in the hero so
                the tools operators reach for constantly sit beside the identity
                instead of eating a full band below. */}
            <div className="w-full shrink-0 lg:w-[336px]">
              <p className="kicker mb-2 lg:text-right">Manage this store</p>
              <div className="grid grid-cols-3 gap-3">
                <OpsTile icon={Package}      label="Listings"   hint="Catalog & inventory" href={`/admin/retailers/${retailerId}/stores/${storeId}/listings`} />
                <OpsTile icon={ShoppingCart} label="Fulfilment" hint="Orders & dispatch"    href={`/admin/retailers/${retailerId}/stores/${storeId}/fulfilment`} />
                <OpsTile icon={Tag}          label="Promotions" hint="Discounts & offers"   href={`/admin/retailers/${retailerId}/stores/${storeId}/promotions`} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lifecycle notice — only when the store isn't cleanly active, so the reason
          (paused/suspended/terminated/onboarding) never hides at the page bottom.
          Left rule + soft tint carries the tone at a glance. */}
      {lifecycle && (
        <div
          className={cn(
            'mb-4 flex items-start gap-2.5 rounded-lg border border-l-[3px] px-4 py-3 text-[12.5px]',
            lifecycle.tone === 'danger' && 'border-danger/25 border-l-danger bg-danger-soft/50',
            lifecycle.tone === 'warning' && 'border-warning/25 border-l-warning bg-warning-soft/50',
            lifecycle.tone === 'neutral' && 'border-line border-l-ink-3 bg-bg-2/60',
          )}
        >
          <lifecycle.icon
            className={cn(
              'mt-0.5 size-4 shrink-0',
              lifecycle.tone === 'danger' && 'text-danger',
              lifecycle.tone === 'warning' && 'text-warning',
              lifecycle.tone === 'neutral' && 'text-ink-3',
            )}
          />
          <p className="text-ink-2">
            <span className="font-semibold text-ink">{lifecycle.title}.</span>{' '}
            {lifecycle.body}
          </p>
        </div>
      )}

      {/* ── Metric rail ────────────────────────────────────────────────────
          One card, four internally-divided stats — reads as a single instrument
          panel instead of four floating tiles. */}
      <Card className="mb-4 overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          <Stat
            icon={<Coins className="size-4" />}
            label="Platform fee"
            value={`${(s.platformFeeBp / 100).toFixed(2)}%`}
            hint="per order value"
          />
          <Stat
            icon={<CalendarClock className="size-4" />}
            label="Payout cadence"
            value={`Every ${s.payoutCadenceDays}d`}
            hint="settlement cycle"
          />
          <Stat
            icon={<Users className="size-4" />}
            label="Accounts"
            value={accountsCount.toString()}
            hint={`${activeStaffCount} active`}
          />
          <Stat
            icon={<CircleDot className="size-4" />}
            label="Lifecycle"
            value={statusLabel}
            tone={tone}
          />
        </div>
      </Card>

      <div className="mb-1" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="accounts">
            Accounts
            {accountsCount > 0 && <TabCount value={accountsCount} />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Aligned 2×2 card grid — each row's cards share their top and bottom
              edges (grid rows stretch, inner content flexes to fill). Row 1:
              identity record | economics. Row 2: physical storefront |
              configuration + photos. Stacks to one column on mobile. */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
            <Card className="min-w-0">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
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
                  /* Profile fields grouped by concern — business identity, tax
                     registration, contact — with hairline dividers between groups
                     so the record scans as three columns instead of a flat list. */
                  <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    <FieldGroup icon={Building2} label="Business" className="pb-4 sm:pb-0 sm:pr-5">
                      <ProfileRow label="Legal name" value={s.legalName} />
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
                    </FieldGroup>
                    <FieldGroup icon={ScrollText} label="Tax registration" className="py-4 sm:py-0 sm:px-5">
                      <ProfileRow label="GSTIN" value={s.gstin} mono />
                      <ProfileRow label="PAN" value={s.pan || '—'} mono />
                      <ProfileRow label="State" value={stateLabel} />
                    </FieldGroup>
                    <FieldGroup icon={Phone} label="Contact" className="pt-4 sm:pt-0 sm:pl-5">
                      <ProfileRow label="Contact phone" value={s.contactPhone ?? '—'} mono />
                      <ProfileRow label="Manager" value={s.managerName || 'Not assigned'} />
                      <ProfileRow label="Address" value={s.address} />
                    </FieldGroup>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fees & payout — only the two fields an admin can actually set per store
                (platform fee + payout cadence). Delivery/handling/convenience are
                platform-wide or have no per-store write path, so they're omitted here.
                Edit opens the same store edit form the Profile card uses. Flex column
                so the stat tiles stretch and the card bottom lines up with Profile. */}
            <Card className="flex min-w-0 flex-col">
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
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
                <div className="grid flex-1 grid-cols-2 gap-3">
                  <KpiTile
                    icon={<Coins className="size-3.5" />}
                    label="Platform fee"
                    value={`${(s.platformFeeBp / 100).toFixed(2)}%`}
                    hint="of each order value"
                  />
                  <KpiTile
                    icon={<CalendarClock className="size-3.5" />}
                    label="Payout cadence"
                    value={`Every ${s.payoutCadenceDays}d`}
                    hint="settlement cycle"
                  />
                </div>
                {editing && (
                  <p className="mt-3 text-[12.5px] text-ink-3">Editing in the Profile form</p>
                )}
              </CardContent>
            </Card>

            {/* Location & storefront — geolocation + hours. Turns the abstract record
                into a real place: an operator can confirm the pin and trading hours.
                The map flexes to absorb any extra row height so the card bottom stays
                level with the Configuration/photos stack beside it. */}
            <Card className="flex min-w-0 flex-col">
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <SectionHeading kicker="Storefront" title="Location & storefront" />
                  {s.lat != null && s.lng != null && (
                    <a
                      className="inline-flex shrink-0 items-center gap-1 text-[12.5px] text-info hover:underline"
                      href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=16/${s.lat}/${s.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin className="size-3.5" /> Open in map
                    </a>
                  )}
                </div>
                <div className="grid flex-1 grid-cols-1 gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                  <div className="flex min-w-0 flex-col">
                    <p className="kicker mb-2">Location</p>
                    {s.lat != null && s.lng != null ? (
                      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-line">
                        {/* isolate + z-0 trap Leaflet's z-indexed panes so they never
                            float above dropdowns/dialogs elsewhere on the page. */}
                        <div className="relative isolate min-h-52 flex-1">
                          <Suspense fallback={<Skeleton className="absolute inset-0 rounded-none" />}>
                            <StoreMap lat={s.lat} lng={s.lng} className="absolute inset-0" />
                          </Suspense>
                        </div>
                        <div className="flex items-center gap-1.5 border-t border-line bg-bg-2/60 px-3 py-1.5">
                          <MapPin className="size-3 shrink-0 text-ink-3" />
                          <span className="truncate font-mono tabular-nums text-[12px] text-ink-2">
                            {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-52 flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-line text-[12.5px] text-ink-3">
                        <MapPin className="size-4" /> No coordinates on file
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="kicker mb-2">Opening hours</p>
                    <OpeningHours hours={s.openingHours} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right cell of row 2 — Configuration on top, photos filling the rest so
                the stack's bottom edge lines up with the storefront card. */}
            <div className="flex min-w-0 flex-col gap-5">
              {/* Configuration — operational capability flags as a settings list, so
                  each flag gets a plain-language description next to its state. */}
              <Card>
                <CardContent className="p-5">
                  <SectionHeading kicker="Setup" title="Configuration" />
                  <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                    <SettingRow
                      icon={Receipt}
                      label="POS billing"
                      description="Bill walk-in customers at the counter"
                      on={!!s.posBillingEnabled}
                    />
                    <SettingRow
                      icon={SlidersHorizontal}
                      label="Delegation mode"
                      description="Staff manage the store on the owner's behalf"
                      on={!!s.delegationModeEnabled}
                    />
                    <SettingRow
                      icon={Package}
                      label="Low-stock threshold"
                      description="Listings at or below this level get flagged"
                      value={`${s.lowStockThreshold ?? 5} units`}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Store photos — what the storefront actually looks like. */}
              <Card className="flex flex-1 flex-col">
                <CardContent className="flex flex-1 flex-col p-5">
                  <SectionHeading kicker="Gallery" title="Store photos" />
                  <div className="flex-1">
                    <GalleryStrip urls={s.galleryImageUrls} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
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
            <div className="mt-6" id="store-appeal-thread">
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
        open={dialog === 'restore'}
        title="Resume store operations"
        description={
          s.status === 'paused'
            ? 'The store is paused. Resuming puts the storefront back live immediately.'
            : closureSuspended
              ? 'The owner closed this account. Resuming reopens the retailer account and the store together, and clears any pending reopen request from the desk.'
              : cascadeBanned
                ? 'This store went down with its retailer account ban. Resuming lifts the account ban and restores its stores — including this one.'
                : s.status === 'suspended'
                  ? 'Lifts the admin suspension — listings return to the consumer catalog and fulfilment resumes.'
                  : 'Lifts the termination and puts the store back live.'
        }
        confirmLabel="Resume operations"
        minReasonLength={0}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => restoreMut.mutate(reason)}
        loading={restoreMut.isPending}
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

/** Human "how old is this store" label from its ISO creation date. */
function storeAgeLabel(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days < 1) return 'opened today';
  if (days < 30) return `${days}d old`;
  if (days < 365) return `${Math.floor(days / 30)}mo old`;
  return `${(days / 365).toFixed(1)}y old`;
}

type Notice = { title: string; body: string; tone: 'danger' | 'warning' | 'neutral'; icon: typeof CircleDot };

/** The contextual lifecycle banner — null when the store is cleanly active
 *  (no reason worth surfacing), otherwise the tone + reason for its state.
 *  `closureSuspended` / `cascadeBanned` explain *why* the store is down, which
 *  decides what the single Resume affordance will actually lift. */
function lifecycleNotice(
  s: AdminStoreView,
  flags: { closureSuspended: boolean; cascadeBanned: boolean },
): Notice | null {
  if (s.status === 'terminated') {
    return {
      title: 'Terminated',
      body: flags.cascadeBanned
        ? 'This store went down with its retailer account ban — resuming lifts the account ban and restores its stores together.'
        : (s.suspendReason ?? 'No reason recorded'),
      tone: 'danger',
      icon: X,
    };
  }
  if (s.status === 'suspended') {
    return {
      title: 'Suspended',
      body: flags.closureSuspended
        ? 'The owner closed this account (reversible) — resuming reopens the account and store together.'
        : (s.suspendReason ?? 'No reason recorded'),
      tone: 'danger',
      icon: ShieldAlert,
    };
  }
  if (s.status === 'paused') {
    return {
      title: 'Paused',
      body: `${s.pauseReason ?? 'No reason recorded'}${s.pauseVisibility === 'hidden' ? ' · hidden from consumer catalog' : ''}`,
      tone: 'warning',
      icon: PauseCircle,
    };
  }
  if (s.status === 'onboarding') {
    return {
      title: 'Onboarding',
      body: 'Store is still completing setup and is not yet fulfilling orders. Lifecycle controls unlock once it goes active.',
      tone: 'neutral',
      icon: Rocket,
    };
  }
  return null;
}

/** Store monogram — initials on the layout's single ink surface, with a small
 *  status dot at the corner (avatar-presence style). */
function Monogram({ name, tone }: { name: string; tone: StatusTone }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';
  const dot =
    tone === 'success' ? 'bg-success'
    : tone === 'warning' ? 'bg-warning'
    : tone === 'danger' ? 'bg-danger'
    : 'bg-ink-4';
  return (
    <div className="relative shrink-0">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-ink text-[19px] font-semibold tracking-tight text-bg shadow-sm sm:size-16 sm:text-[22px]">
        {initials}
      </div>
      <span className="absolute -bottom-1 -right-1 flex size-4.5 items-center justify-center rounded-full bg-bg">
        <span className={cn('size-2.5 rounded-full', dot, tone !== 'success' && 'pulse-dot')} />
      </span>
    </div>
  );
}

/** Small count pill for tab labels. */
function TabCount({ value }: { value: number }) {
  return (
    <span className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-bg-3 px-1.5 py-0.5 font-mono text-[10.5px] leading-none tabular-nums text-ink-2">
      {value}
    </span>
  );
}

/** Compact icon + text chip for the hero's registry facts. */
function MetaChip({ icon: Icon, value, mono }: { icon: typeof MapPin; value: string; mono?: boolean }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-bg-2/60 px-2 py-1 text-[11.5px] text-ink-2">
      <Icon className="size-3.5 shrink-0 text-ink-3" />
      <span className={cn('truncate', mono && 'font-mono tabular-nums')}>{value}</span>
    </span>
  );
}

/** Metric-rail cell — icon chip, kicker label, big mono value, hint. */
function Stat({
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
  const valueCls =
    tone === 'success' ? 'text-success-strong'
    : tone === 'warning' ? 'text-warning'
    : tone === 'danger' ? 'text-danger'
    : 'text-ink';
  const iconCls =
    tone === 'success' ? 'border-success/30 bg-success-soft/50 text-success-strong'
    : tone === 'warning' ? 'border-warning/30 bg-warning-soft/60 text-warning'
    : tone === 'danger' ? 'border-danger/30 bg-danger-soft/60 text-danger'
    : 'border-line bg-bg-2 text-ink-2';
  return (
    <div className="flex items-start gap-3 bg-bg p-4 sm:p-5">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg border', iconCls)}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="kicker">{label}</div>
        <div className={cn('mt-1 font-mono text-[19px] leading-none tabular-nums capitalize', valueCls)}>
          {value}
        </div>
        {hint && <div className="mt-1.5 text-[11.5px] text-ink-3">{hint}</div>}
      </div>
    </div>
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

/** Square deep-link tile: icon top-left, arrow top-right, label + hint at the
 *  bottom. Sized to sit three-across in the hero's right column. */
function OpsTile({
  icon: Icon,
  label,
  hint,
  href,
}: {
  icon: typeof Package;
  label: string;
  hint: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="press group flex aspect-square flex-col justify-between rounded-xl border border-line bg-bg p-3 shadow-xs transition-colors hover:border-line-strong hover:bg-bg-2/50"
    >
      <span className="flex items-start justify-between">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-bg-2 text-ink-2 transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-bg">
          <Icon className="size-4.5" />
        </span>
        <ArrowUpRight className="size-3.5 shrink-0 text-ink-3 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-semibold leading-tight text-ink">{label}</span>
        <span className="mt-0.5 block truncate text-[10.5px] leading-tight text-ink-3">{hint}</span>
      </span>
    </Link>
  );
}

/** Labeled cluster of profile fields with a small icon anchor. */
function FieldGroup({
  icon: Icon,
  label,
  className,
  children,
}: {
  icon: typeof Package;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-md border border-line bg-bg-2">
          <Icon className="size-3.5 text-ink-2" />
        </span>
        <span className="kicker">{label}</span>
      </div>
      <dl className="space-y-3">{children}</dl>
    </div>
  );
}

/** Settings-list row: icon, name + plain-language description, and either an
 *  On/Off pill or a literal value on the right. */
function SettingRow({
  icon: Icon,
  label,
  description,
  on,
  value,
}: {
  icon: typeof Package;
  label: string;
  description: string;
  on?: boolean;
  value?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-bg-2">
        <Icon className="size-4 text-ink-2" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        <p className="truncate text-[11.5px] text-ink-3">{description}</p>
      </div>
      {value != null ? (
        <span className="shrink-0 font-mono tabular-nums text-[13px] text-ink">{value}</span>
      ) : (
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium',
            on
              ? 'border-success/30 bg-success-soft text-success-strong'
              : 'border-line bg-bg-2 text-ink-3',
          )}
        >
          {on ? 'On' : 'Off'}
        </span>
      )}
    </div>
  );
}

// Weekday order for opening-hours rendering; keys match the stored jsonb shape.
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABEL: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

function OpeningHours({ hours }: { hours: Record<string, { open: string; close: string }[]> | null | undefined }) {
  const anySet = hours ? Object.values(hours).some((slots) => slots && slots.length > 0) : false;
  if (!anySet) {
    // Same height as the map so the two empty states sit level.
    return (
      <div className="flex h-52 items-center justify-center gap-2 rounded-lg border border-dashed border-line text-[12.5px] text-ink-3">
        <Clock className="size-4" /> No hours set
      </div>
    );
  }
  // Full week in stable order (closed days dimmed), then any non-standard keys.
  const ordered = [
    ...DAY_ORDER,
    ...Object.keys(hours ?? {}).filter((k) => !DAY_ORDER.includes(k as never) && hours?.[k]?.length),
  ];
  return (
    <dl className="divide-y divide-line overflow-hidden rounded-lg border border-line">
      {ordered.map((day) => {
        const slots = hours?.[day] ?? [];
        const open = slots.length > 0;
        return (
          <div key={day} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px]">
            <dt className={cn('font-medium', open ? 'text-ink-2' : 'text-ink-4')}>
              {DAY_LABEL[day] ?? day}
            </dt>
            <dd className={cn('font-mono tabular-nums', open ? 'text-ink' : 'text-ink-4')}>
              {open ? slots.map((slot) => `${slot.open}–${slot.close}`).join(', ') : 'Closed'}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function GalleryStrip({ urls }: { urls: string[] | null | undefined }) {
  const list = (urls ?? []).filter(Boolean);
  if (list.length === 0) {
    // h-full: stretches to fill the photos card so its bottom edge stays aligned.
    return (
      <div className="flex h-full min-h-24 items-center justify-center gap-2 rounded-lg border border-dashed border-line text-[12.5px] text-ink-3">
        <ImageOff className="size-4" /> No photos uploaded
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2">
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
