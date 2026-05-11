import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { storeStatusMeta } from '@/lib/status';
import type { RetailerProfile, Store } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { StoreVisibilityWhilePaused } from '@/lib/types';

type StoreWithPause = Store & {
  pauseReason: string | null;
  pauseUntil: string | null;
  pauseVisibility: StoreVisibilityWhilePaused | null;
};
type MeResponse = { retailer: RetailerProfile; store: StoreWithPause | null };

export default function RetailerStorePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<MeResponse>('/retailer/me'),
  });

  if (isLoading) {
    return (
      <Page>
        <PageHeader title="Storefront" />
        <Skeleton className="h-72 w-full" />
      </Page>
    );
  }

  if (data?.store) return <StoreDetails store={data.store as StoreWithPause} />;

  return (
    <Page>
      <PageHeader title="Storefront" />
      <div className="mx-auto max-w-md py-16 text-center space-y-3">
        <p className="text-[14px] font-medium text-ink">Store not provisioned yet</p>
        <p className="text-[13px] text-ink-3">
          Your store is created automatically when ClosetX approves your application.
          Check back after you receive the approval email.
        </p>
      </div>
    </Page>
  );
}

function StoreDetails({ store }: { store: StoreWithPause }) {
  const meta = storeStatusMeta(store.status);
  return (
    <Page>
      <PageHeader
        title={<em>{store.legalName}</em>}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
        }
        description={
          <>
            Storefront details aren't self-editable in the MVP — contact admin if anything
            needs to change.
          </>
        }
      />

      <Tabs defaultValue="basics">
        <TabsList className="overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="hours">Hours</TabsTrigger>
          <TabsTrigger value="address">Address</TabsTrigger>
          <TabsTrigger value="bank">Legal &amp; Bank</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        <TabsContent value="basics">
          <SectionHeading title="Profile basics" />
          <MetaList
            cols={2}
            items={[
              { label: 'Legal name', value: store.legalName },
              { label: 'Store ID', value: store.id, mono: true },
              { label: 'GSTIN', value: store.gstin, mono: true },
              { label: 'State code', value: store.stateCode, mono: true, hint: 'GST place-of-supply' },
            ]}
          />
        </TabsContent>

        <TabsContent value="hours">
          <SectionHeading title="Operating hours" />
          <StoreHoursPanel />
        </TabsContent>

        <TabsContent value="address">
          <SectionHeading title="Location" />
          <MetaList
            cols={2}
            items={[
              { label: 'Address', value: store.address },
              { label: 'Coordinates', value: `${store.lat.toFixed(5)}, ${store.lng.toFixed(5)}`, mono: true },
              { label: 'State code', value: store.stateCode, mono: true },
            ]}
          />
        </TabsContent>

        <TabsContent value="bank">
          <SectionHeading title="Legal entity &amp; bank" />
          <BankAccountPanel platformFeeBp={store.platformFeeBp} payoutCadenceDays={store.payoutCadenceDays} gstin={store.gstin} />
        </TabsContent>

        <TabsContent value="documents">
          <SectionHeading title="Compliance documents" />
          <StoreDocumentsPanel />
        </TabsContent>

        <TabsContent value="status">
          <SectionHeading title="Status" />
          <div className="rounded-lg border border-line bg-bg p-5">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <p className="mt-3 text-[13px] text-ink-2">
              {store.status === 'onboarding'
                ? 'Your store is active — add inventory and go live.'
                : store.status === 'active'
                  ? 'Live to consumers. Pause from the panel below to take a temporary break.'
                  : `Storefront is ${store.status}. Contact admin to restore.`}
            </p>
          </div>
          {store.status === 'active' && (
            <div className="mt-6">
              <SectionHeading title="Pause storefront" />
              <PausePanel store={store} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Page>
  );
}

function PausePanel({ store }: { store: StoreWithPause }) {
  const qc = useQueryClient();
  const paused = store.status === 'paused';
  const [reason, setReason] = useState('');
  const [visibility, setVisibility] = useState<StoreVisibilityWhilePaused>(
    store.pauseVisibility ?? 'block_orders_only',
  );

  const togglePause = useMutation({
    mutationFn: (next: boolean) =>
      next
        ? api('/retailer/store/pause', { method: 'POST', body: JSON.stringify({ reason: reason || null, visibility }) })
        : api('/retailer/store/resume', { method: 'POST' }),
    onSuccess: (_, next) => {
      void qc.invalidateQueries({ queryKey: ['retailer', 'me'] });
      toast.success(next ? 'Storefront paused' : 'Storefront resumed');
      setReason('');
    },
  });

  return (
    <div className="rounded-lg border border-line bg-bg p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[14px] font-semibold text-ink">{paused ? 'Paused' : 'Live'}</div>
          {paused && store.pauseUntil && (
            <div className="text-[12px] text-ink-3">Until {new Date(store.pauseUntil).toLocaleString('en-IN')}</div>
          )}
        </div>
        <Button
          variant={paused ? 'accent' : 'outline'}
          loading={togglePause.isPending}
          onClick={() => togglePause.mutate(!paused)}
        >
          {paused ? 'Resume storefront' : 'Pause storefront'}
        </Button>
      </div>
      <div>
        <div className="kicker mb-2">While paused, this storefront will</div>
        <div className="space-y-2">
          {(['block_orders_only', 'hide_from_catalog'] as const).map((v) => (
            <label key={v} className="flex items-start gap-2.5 rounded-md border border-line bg-bg-2/30 px-3 py-2 cursor-pointer hover:border-line-strong">
              <input
                type="radio"
                name="visibility"
                value={v}
                checked={visibility === v}
                onChange={() => setVisibility(v)}
                className="mt-0.5 accent-accent"
              />
              <div>
                <div className="text-[13px] text-ink font-medium">
                  {v === 'block_orders_only' ? 'Block new orders only' : 'Hide from catalog'}
                </div>
                <div className="text-[11.5px] text-ink-3">
                  {v === 'block_orders_only'
                    ? 'Listings stay visible; checkout is disabled with a "back soon" notice.'
                    : 'Listings are hidden from search and category browsing while paused.'}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
      {!paused && (
        <div>
          <Label htmlFor="pause-reason">Optional internal reason</Label>
          <Input id="pause-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. weekend stock-take" />
        </div>
      )}
    </div>
  );
}

function StoreHoursPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'store', 'hours'],
    queryFn: () => api<Record<string, { from: string; to: string; closed: boolean }>>('/retailer/store/hours'),
  });
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  if (isLoading) return <Skeleton className="h-40" />;
  const hours = data ?? {};
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-bg">
      <table className="w-full text-[13px]">
        <tbody>
          {days.map((d) => {
            const slot = hours[d];
            return (
              <tr key={d} className="border-b border-line last:border-b-0">
                <td className="px-4 py-2.5 capitalize text-ink-2 w-32">{d}</td>
                <td className="px-4 py-2.5 font-mono text-ink">
                  {!slot || slot.closed ? <span className="text-ink-3 italic">Closed</span> : `${slot.from} – ${slot.to}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BankAccountPanel({ platformFeeBp, payoutCadenceDays, gstin }: { platformFeeBp: number; payoutCadenceDays: number; gstin: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'store', 'bank'],
    queryFn: () => api<{ accountHolderName: string; accountNumber: string; ifsc: string; bankName: string | null; pennyDropStatus: string; pennyDropAt: string | null } | null>('/retailer/store/bank'),
  });
  if (isLoading) return <Skeleton className="h-20" />;
  if (!data) return (
    <MetaList
      cols={2}
      items={[
        { label: 'GSTIN', value: gstin, mono: true },
        { label: 'Platform fee', value: platformFeeBp > 0 ? `${(platformFeeBp / 100).toFixed(2)}%` : 'Set on approval' },
        { label: 'Payout cadence', value: payoutCadenceDays > 0 ? `Every ${payoutCadenceDays} days` : 'Set on approval' },
        { label: 'Bank account', value: 'Not on file' },
      ]}
    />
  );
  return (
    <MetaList
      cols={2}
      items={[
        { label: 'GSTIN', value: gstin, mono: true },
        { label: 'Platform fee', value: platformFeeBp > 0 ? `${(platformFeeBp / 100).toFixed(2)}%` : 'Set on approval' },
        { label: 'Payout cadence', value: payoutCadenceDays > 0 ? `Every ${payoutCadenceDays} days` : 'Set on approval' },
        { label: 'Account holder', value: data.accountHolderName },
        { label: 'Account number', value: data.accountNumber, mono: true },
        { label: 'IFSC', value: data.ifsc, mono: true },
        ...(data.bankName ? [{ label: 'Bank', value: data.bankName }] : []),
        { label: 'Penny drop', value: data.pennyDropStatus.replace(/_/g, ' '), hint: data.pennyDropAt ? `Verified ${new Date(data.pennyDropAt).toLocaleDateString()}` : '' },
      ]}
    />
  );
}

function StoreDocumentsPanel() {
  const { data } = useQuery({
    queryKey: ['retailer', 'store', 'documents'],
    queryFn: () => api<Array<{ id: string; kind: string; label: string; status: string; uploadedAt: string | null; fileUrl: string | null }>>('/retailer/store/documents'),
  });
  const docs = data ?? [];
  return (
    <ul className="space-y-2">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center justify-between rounded-lg border border-line bg-bg px-4 py-3">
          <div>
            <div className="text-[13.5px] font-medium text-ink">{d.label}</div>
            <div className="text-[11.5px] text-ink-3">
              {d.uploadedAt ? `Uploaded ${new Date(d.uploadedAt).toLocaleDateString()}` : 'Not uploaded'}
            </div>
          </div>
          <Badge tone={d.status === 'verified' ? 'success' : d.status === 'pending_review' ? 'warning' : d.status === 'rejected' ? 'danger' : 'neutral'}>
            {d.status.replace(/_/g, ' ')}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
