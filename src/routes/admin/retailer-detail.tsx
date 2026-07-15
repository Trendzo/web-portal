// MOCK_DEPENDENCY: §2 Retailer Onboarding (single-retailer detail view)

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowUpRight, Building2, Coins, Eye, Package, Pencil, Receipt, Users } from 'lucide-react';
import { api, ApiError, apiValidated } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminRetailerViewSchema } from '@/lib/schemas';
import { installImpersonationSessionAndReload } from '@/lib/auth';
import type { RetailerProfile } from '@/lib/types';
import { retailerStatusMeta, formatAge, formatPaise } from '@/lib/status';
import type { AdminPayoutRow } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CopyableId } from '@/components/ui/copyable-id';
import { ReasonActionDialog } from '@/components/admin/reason-action-dialog';
import { AccountsOnStoreCard } from '@/components/admin/accounts-on-store-card';

export default function AdminRetailerDetail() {
  const { id } = useParams<{ id: string }>();
  const [banning, setBanning] = useState(false);
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();

  const banMut = useMutation({
    mutationFn: ({ reason }: { reason: string }) =>
      api(`/admin/retailers/${id}/ban`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      toast.success('Retailer permanently banned');
      setBanning(false);
      void qc.invalidateQueries({ queryKey: ['admin', 'retailers', id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Ban failed'),
  });
  const unbanMut = useMutation({
    mutationFn: () => api(`/admin/retailers/${id}/unban`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Ban lifted');
      void qc.invalidateQueries({ queryKey: ['admin', 'retailers', id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Unban failed'),
  });
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'retailers', id],
    queryFn: () => apiValidated(`/admin/retailers/${id}`, AdminRetailerViewSchema),
    enabled: Boolean(id),
    // Don't retry malformed payloads — backend won't fix shape on a retry.
    retry: (failureCount, err) =>
      err instanceof ApiError && err.code === 'invalid_response' ? false : failureCount < 2,
  });

  const startImpersonation = useMutation({
    mutationFn: async (storeId: string) => {
      const impData = await api<{
        sessionId: string;
        storeId: string;
        storeName: string;
        token: string;
        retailer: RetailerProfile;
      }>('/admin/impersonation/start', {
        method: 'POST',
        body: { storeId },
      });
      let permissions: Record<string, boolean> = {};
      try {
        const perms = await api<{ permissions: Record<string, boolean> }>(
          '/retailer/me/permissions',
          { token: impData.token },
        );
        permissions = perms.permissions;
      } catch {
        /* fall through with empty permissions */
      }
      return { ...impData, permissions };
    },
    onSuccess: (impData) => {
      installImpersonationSessionAndReload({
        retailer: impData.retailer,
        token: impData.token,
        sessionId: impData.sessionId,
        storeName: impData.storeName,
        permissions: impData.permissions,
      });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Could not start impersonation');
    },
  });

  if (!id) return <Page><PageHeader title="Missing id" /></Page>;
  if (isLoading) return <Page><Skeleton className="h-60" /></Page>;

  // Validation / not-found / network failure: render explicit error state with
  // diagnostic so the page never crashes on a malformed payload.
  if (isError || !data) {
    const apiErr = error instanceof ApiError ? error : null;
    const is404 = apiErr?.status === 404;
    const isShape = apiErr?.code === 'invalid_response';
    return (
      <Page>
        <PageHeader
          kicker="Retailers"
          title={is404 ? 'Retailer not found' : isShape ? 'Malformed retailer payload' : 'Could not load retailer'}
          actions={
            <div className="flex gap-2">
              <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
                <Link to="/admin/users?tab=retailers">Back to retailers</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>Retry</Button>
            </div>
          }
        />
        <Card>
          <CardContent className="p-6 text-[13px] text-ink-3 space-y-2">
            {is404 && <p>No retailer matches id <code className="font-mono">{id}</code>.</p>}
            {isShape && (
              <>
                <p>Backend returned a payload that does not match the expected retailer shape. Refusing to render to avoid corrupting downstream state.</p>
                <p className="text-[12px] text-ink-3">If this persists, the backend likely returned an array, an empty object, or a stale schema. Report with the request id.</p>
              </>
            )}
            {!is404 && !isShape && apiErr && (
              <p>{apiErr.message} (<code className="font-mono">{apiErr.code}</code>)</p>
            )}
            {!is404 && !isShape && !apiErr && error instanceof Error && (
              <p>{error.message}</p>
            )}
          </CardContent>
        </Card>
      </Page>
    );
  }

  const r = data;
  const meta = retailerStatusMeta(r.status);

  function impersonate() {
    if (!r.storeId) {
      toast.error('Retailer has no storefront yet — impersonation needs a store context.');
      return;
    }
    startImpersonation.mutate(r.storeId);
  }

  return (
    <Page>
      <PageHeader
        kicker="Retailers"
        title={r.legalName}
        description={`${r.email} · ${r.phone}`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
              <Link to="/admin/users?tab=retailers">Back to retailers</Link>
            </Button>
            <Button variant="outline" size="sm" iconLeft={<Eye className="size-3.5" />} onClick={impersonate} loading={startImpersonation.isPending}>
              Impersonate
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <CopyableId value={r.id} label="retailer id" />
        {r.storeId ? (
          <Badge tone="info" flat>Store: {r.storeId}</Badge>
        ) : (
          <Badge tone="neutral" flat>No storefront yet</Badge>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stores">Stores</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-3">
                <SectionHeading kicker="Identity" title="Profile" />
                <Button variant="outline" size="sm" iconLeft={<Pencil className="size-3" />} onClick={() => setEditing(true)}>
                  Edit profile
                </Button>
              </div>
              <MetaList
                cols={2}
                items={[
                  { label: 'Legal name', value: r.legalName },
                  { label: 'Email', value: r.email },
                  { label: 'Phone', value: r.phone },
                  { label: 'GSTIN', value: r.gstin, mono: true },
                  { label: 'Sub-role', value: r.subRole.replace('_', ' ') },
                  { label: 'Joined', value: `${new Date(r.createdAt).toLocaleDateString()} · ${formatAge(r.createdAt)}` },
                ]}
              />

              <div className="mt-6 flex flex-wrap gap-2">
                {r.status === 'terminated' ? (
                  // ONE restore surface platform-wide: the store page's "Resume store
                  // operations" (its /restore lifts the account ban + stores together).
                  // Only a pre-store account (e.g. rejected applicant) keeps a direct
                  // reinstate here — there is no store page to send the operator to.
                  r.storeId ? (
                    <Button asChild variant="outline">
                      <Link to={`/admin/retailers/${r.id}/stores/${r.storeId}`}>
                        Resume store operations
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => unbanMut.mutate()} loading={unbanMut.isPending}>
                      Reinstate account
                    </Button>
                  )
                ) : (
                  <Button variant="outline" className="text-danger border-danger/40 hover:bg-danger/5" onClick={() => setBanning(true)}>
                    Terminate (permanent)
                  </Button>
                )}
                <Button asChild variant="outline" iconLeft={<Users className="size-3.5" />}>
                  <Link to={`/admin/retailers/${r.id}/staff`}>Manage staff</Link>
                </Button>
                {r.storeId && (
                  <Button asChild variant="outline" iconLeft={<Building2 className="size-3.5" />}>
                    <Link to={`/admin/retailers/${r.id}/stores/${r.storeId}`}>Open store</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <AccountsOnStoreCard retailerId={r.id} focusedAccountId={r.id} />

          <PlatformFeeOverrideCard retailerId={r.id} retailerName={r.legalName} />

          <PosBillingCard
            retailerId={r.id}
            retailerName={r.legalName}
            hasStore={Boolean(r.storeId)}
            enabled={r.posBillingEnabled === true}
            pending={r.posActivationPending === true}
          />
        </TabsContent>

        <TabsContent value="stores">
          <Card>
            <CardContent className="p-6">
              <SectionHeading kicker="Stores" title="Storefronts owned by this retailer" />
              {r.storeId ? (
                <p className="text-[13px] text-ink-2">
                  Storefront <span className="font-mono">{r.storeId}</span>. Open the admin
                  storefront detail screen for catalog, inventory, orders, and ban actions.
                </p>
              ) : (
                <p className="text-[13px] text-ink-3 italic">Store will be provisioned automatically on approval.</p>
              )}
              <div className="mt-3 flex gap-2">
                {r.storeId && (
                  <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                    <Link to={`/admin/retailers/${r.id}/stores/${r.storeId}`}>Open store</Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                  <Link to="/admin/stores">Storefronts queue</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <RelatedLink icon={Receipt} title="Orders for this retailer" href={`/admin/orders?retailerId=${r.id}`} />
        </TabsContent>

        <TabsContent value="payouts">
          <PayoutsTab storeId={r.storeId} />
        </TabsContent>

        <TabsContent value="issues">
          <RelatedLink icon={Package} title="Disputes filed against this retailer" href="/admin/disputes" />
        </TabsContent>

        <TabsContent value="audit">
          <AuditTab retailerId={r.id} />
        </TabsContent>
      </Tabs>

      <ReasonActionDialog
        open={banning}
        title="Terminate retailer (permanent)"
        description="Permanently blocks the account and ALL its stores. The retailer is signed out and barred from re-entering. Can be lifted later by an admin."
        confirmLabel="Terminate"
        danger
        onClose={() => setBanning(false)}
        onConfirm={(reason) => banMut.mutate({ reason })}
      />

      <EditRetailerDialog
        retailer={{
          id: r.id,
          legalName: r.legalName,
          phone: r.phone,
          email: r.email,
          gstin: r.gstin,
          subRole: r.subRole,
        }}
        open={editing}
        onClose={() => setEditing(false)}
      />
    </Page>
  );
}

function PayoutsTab({ storeId }: { storeId: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payouts', 'store', storeId],
    queryFn: () => api<AdminPayoutRow[]>(`/admin/payouts?storeId=${storeId}&limit=10`),
    enabled: Boolean(storeId),
  });
  const list = data ?? [];
  if (!storeId) return <p className="text-[13px] text-ink-3 italic">No store attached to this retailer.</p>;
  if (isLoading) return <Skeleton className="h-32" />;
  if (list.length === 0) return (
    <Card><CardContent className="p-6"><p className="text-[13px] text-ink-3 italic">No payouts yet for this store.</p></CardContent></Card>
  );
  return (
    <div className="space-y-2">
      {list.map((p) => (
        <Card key={p.id}>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-ink">{p.period}</span>
                <Badge tone={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : p.status === 'processing' ? 'info' : 'warning'}>{p.status}</Badge>
                <span className="font-mono text-[13px] text-ink">{formatPaise(p.amountPaise)}</span>
              </div>
              <div className="mt-1 text-[11.5px] text-ink-3">Bank {p.bankAccountMasked}</div>
            </div>
            <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
              <Link to={`/admin/payouts/${p.id}`}>Open</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
      <div className="mt-2">
        <Button asChild variant="outline" size="sm" iconLeft={<Coins className="size-3.5" />}>
          <Link to={`/admin/payouts-pipeline?storeId=${storeId}`}>All payouts pipeline</Link>
        </Button>
      </div>
    </div>
  );
}

type AuditEntry = { id: string; at: string; action: string; actorKind: string; actorId: string | null; resourceKind: string; note: string | null };

function AuditTab({ retailerId }: { retailerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit-log', retailerId],
    queryFn: () => api<AuditEntry[]>(`/admin/audit-log?resourceId=${retailerId}&limit=30`),
  });
  const entries = data ?? [];
  if (isLoading) return <Skeleton className="h-32" />;
  if (entries.length === 0) return (
    <Card><CardContent className="p-6"><p className="text-[13px] text-ink-3 italic">No audit entries yet.</p></CardContent></Card>
  );
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-[12.5px]">
          <thead className="bg-bg-2/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-ink-3">When</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Action</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Actor</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-line">
                <td className="px-3 py-2 text-ink-3 text-[11.5px]">{formatAge(e.at)}</td>
                <td className="px-3 py-2 font-mono text-ink">{e.action}</td>
                <td className="px-3 py-2 text-ink-2">{e.actorKind}{e.actorId ? ` · ${e.actorId.slice(0, 8)}` : ''}</td>
                <td className="px-3 py-2 text-ink-3">{e.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function PlatformFeeOverrideCard({ retailerId, retailerName }: { retailerId: string; retailerName: string }) {
  const [feePercent, setFeePercent] = useState<string>('15');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const apply = async () => {
    const bp = Math.round(Number(feePercent) * 100);
    if (!Number.isFinite(bp) || bp < 0 || bp > 10000) {
      toast.error('Fee must be between 0% and 100%');
      return;
    }
    if (reason.trim().length < 3) {
      toast.error('Reason required (3+ chars)');
      return;
    }
    setSaving(true);
    try {
      await api(`/admin/retailers/${retailerId}/fee-override`, { method: 'PATCH', body: { platformFeeBp: bp, reason } });
      toast.success(`Override saved for ${retailerName}: ${(bp / 100).toFixed(2)}%`);
      setReason('');
    } catch { toast.error('Failed to save override'); }
    finally { setSaving(false); }
  };
  return (
    <Card className="mt-4">
      <CardContent className="p-6">
        <div className="mb-3">
          <SectionHeading kicker="Override" title="Platform fee override" />
        </div>
        <p className="mb-3 text-[12.5px] text-ink-3">
          Replaces the marketplace default platform fee for this retailer. Reason is logged in audit.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <div>
            <label className="kicker mb-1 block">Fee % override</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={feePercent}
              onChange={(e) => setFeePercent(e.target.value)}
              className="w-full rounded-md border border-line-2 bg-bg px-3 py-2 text-[14px] font-mono"
            />
          </div>
          <div>
            <label className="kicker mb-1 block">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. tier-1 launch promo"
              className="w-full rounded-md border border-line-2 bg-bg px-3 py-2 text-[14px]"
            />
          </div>
          <div className="flex items-end">
            <Button variant="accent" disabled={saving} onClick={() => void apply()}>Save override</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PosBillingCard({
  retailerId,
  retailerName,
  hasStore,
  enabled,
  pending,
}: {
  retailerId: string;
  retailerName: string;
  hasStore: boolean;
  enabled: boolean;
  pending: boolean;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const toggle = async (next: boolean, reason: string) => {
    setBusy(true);
    try {
      await api(`/admin/retailers/${retailerId}/pos-billing`, {
        method: 'POST',
        body: { enabled: next, ...(reason.trim() ? { reason: reason.trim() } : {}) },
      });
      toast.success(`POS billing ${next ? 'enabled' : 'disabled'} for ${retailerName}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'retailers', retailerId] });
    } catch {
      toast.error('Failed to update POS billing');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="mt-4">
      <CardContent className="p-6">
        <div className="mb-3 flex items-center gap-3">
          <SectionHeading kicker="Feature" title="POS billing (counter sales)" />
          <Badge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
          {!enabled && pending && <Badge tone="warning">Activation requested</Badge>}
        </div>
        <p className="mb-3 text-[12.5px] text-ink-3">
          Controls access to the offline POS / counter-billing surface for this retailer. Enable or
          disable independent of any request. {pending && !enabled ? 'This retailer has a pending activation request.' : ''}
        </p>
        {!hasStore ? (
          <p className="text-[13px] text-ink-3 italic">No store yet — provisioned on approval.</p>
        ) : enabled ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void toggle(false, 'Disabled by admin from retailer detail')}
          >
            Disable POS billing
          </Button>
        ) : (
          <Button
            variant="accent"
            disabled={busy}
            onClick={() => void toggle(true, 'Enabled by admin from retailer detail')}
          >
            Enable POS billing
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function RelatedLink({ icon: Icon, title, href }: { icon: typeof Building2; title: string; href: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md bg-bg-3 text-ink-2">
            <Icon className="size-4" />
          </span>
          <span className="text-[13.5px] text-ink">{title}</span>
        </div>
        <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
          <Link to={href}>Open</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// AccountsOnStoreCard moved to components/admin/accounts-on-store-card.tsx so
// the admin store-detail page can reuse the same roster + quick actions.

/**
 * Admin direct-edit of retailer ACCOUNT identity fields (the "without change
 * request" path — account fields have no change-request type). Sends only the
 * fields that actually changed to `PATCH /admin/retailers/:id`. Store verified
 * fields (address/GSTIN/bank on the store) are edited from store-detail instead.
 */
function EditRetailerDialog({
  retailer,
  open,
  onClose,
}: {
  retailer: { id: string; legalName: string; phone: string; email: string; gstin: string; subRole: string };
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [legalName, setLegalName] = useState(retailer.legalName);
  const [phone, setPhone] = useState(retailer.phone);
  const [email, setEmail] = useState(retailer.email);
  const [gstin, setGstin] = useState(retailer.gstin);
  const [subRole, setSubRole] = useState(retailer.subRole);

  // Re-seed the form each time the dialog opens (or the underlying record changes).
  useEffect(() => {
    if (!open) return;
    setLegalName(retailer.legalName);
    setPhone(retailer.phone);
    setEmail(retailer.email);
    setGstin(retailer.gstin);
    setSubRole(retailer.subRole);
  }, [open, retailer.legalName, retailer.phone, retailer.email, retailer.gstin, retailer.subRole]);

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      if (legalName.trim() !== retailer.legalName) body.legalName = legalName.trim();
      if (phone.trim() !== retailer.phone) body.phone = phone.trim();
      if (email.trim().toLowerCase() !== retailer.email) body.email = email.trim().toLowerCase();
      if (gstin.trim().toUpperCase() !== retailer.gstin) body.gstin = gstin.trim().toUpperCase();
      if (subRole !== retailer.subRole) body.subRole = subRole;
      if (Object.keys(body).length === 0) throw new ApiError(400, 'no_changes', 'No changes to save');
      return api(`/admin/retailers/${retailer.id}`, { method: 'PATCH', body });
    },
    onSuccess: () => {
      toast.success('Retailer profile updated');
      void qc.invalidateQueries({ queryKey: ['admin', 'retailers', retailer.id] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit retailer profile</DialogTitle>
          <DialogDescription>
            Updates the owner account directly (audited, retailer notified). Applies immediately —
            no change request needed for account fields.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ret-legal">Legal name</Label>
            <Input id="ret-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ret-phone">Phone</Label>
              <Input id="ret-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919812345678" />
            </div>
            <div>
              <Label htmlFor="ret-email">Email</Label>
              <Input id="ret-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ret-gstin">GSTIN</Label>
              <Input id="ret-gstin" mono className="uppercase" value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} />
            </div>
            <div>
              <Label htmlFor="ret-subrole">Sub-role</Label>
              <Select value={subRole} onValueChange={setSubRole}>
                <SelectTrigger id="ret-subrole"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">owner</SelectItem>
                  <SelectItem value="manager">manager</SelectItem>
                  <SelectItem value="staff">staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

