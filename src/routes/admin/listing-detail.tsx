// MOCK_DEPENDENCY: §5 Catalog and Listings — admin moderation overlay

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { CatalogFlag, ListingAuditEntry } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { CopyableId } from '@/components/ui/copyable-id';
import { ReasonActionDialog } from '@/components/admin/reason-action-dialog';
import { TypeConfirmDialog } from '@/components/admin/type-confirm-dialog';
import { MockDataBadge } from '@/components/ui/mock-data-badge';

type ReportBreakdown = { total: number; breakdown: { reasonCode: string; count: number }[] };

export default function AdminListingDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const [takingDown, setTakingDown] = useState(false);
  const [retiring, setRetiring] = useState(false);

  const flagQuery = useQuery({
    queryKey: ['admin', 'listing', id, 'flags'],
    queryFn: () => api<CatalogFlag[]>(`/admin/catalog/moderation?listingId=${id}`),
    enabled: Boolean(id),
  });
  const flag = flagQuery.data?.[0];

  const qc = useQueryClient();

  const takeDown = useMutation({
    mutationFn: (note: string) =>
      api(`/admin/catalog/moderation/${flag!.id}/resolve`, {
        method: 'POST',
        body: { outcome: 'resolved_taken_down', note },
      }),
    onSuccess: () => {
      toast.success('Listing taken down');
      void qc.invalidateQueries({ queryKey: ['admin', 'listing', id] });
      setTakingDown(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Take down failed'),
  });

  const restore = useMutation({
    mutationFn: (note: string) =>
      api(`/admin/catalog/moderation/${flag!.id}/resolve`, {
        method: 'POST',
        body: { outcome: 'resolved_restored', note },
      }),
    onSuccess: () => {
      toast.success('Listing restored');
      void qc.invalidateQueries({ queryKey: ['admin', 'listing', id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Restore failed'),
  });

  const retire = useMutation({
    mutationFn: (note: string) =>
      api(`/admin/catalog/listings/${id}/retire`, {
        method: 'POST',
        body: { note },
      }),
    onSuccess: () => {
      toast.success('Listing retired');
      void qc.invalidateQueries({ queryKey: ['admin', 'listing', id] });
      setRetiring(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Retire failed'),
  });

  const dismiss = useMutation({
    mutationFn: () =>
      api(`/admin/catalog/moderation/${flag!.id}/resolve`, {
        method: 'POST',
        body: { outcome: 'resolved_dismissed' },
      }),
    onSuccess: () => {
      toast.success('Flag dismissed');
      void qc.invalidateQueries({ queryKey: ['admin', 'listing', id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Dismiss failed'),
  });

  const audit = useQuery({
    queryKey: ['admin', 'listing', id, 'audit'],
    queryFn: () => api<ListingAuditEntry[]>(`/admin/catalog/listings/${id}/audit`),
  });

  const reports = useQuery({
    queryKey: ['admin', 'listing', id, 'reports'],
    queryFn: () => api<ReportBreakdown>(`/admin/catalog/listings/${id}/reports`),
    enabled: Boolean(id),
  });

  if (flagQuery.isLoading) return <Page><Skeleton className="h-72" /></Page>;

  return (
    <Page>
      <PageHeader
        kicker="Catalog moderation"
        title={`Listing ${id}`}
        description="Admin moderation overlay. Take down hides immediately; retire removes platform-wide."
        actions={
          <div className="flex items-center gap-2">
            <MockDataBadge label="Mock data · backend wiring pending" />
            <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
              <Link to="/admin/catalog-moderation">Back</Link>
            </Button>
          </div>
        }
      />

      {flag && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone="warning"><ShieldAlert className="size-3 mr-1 inline" />{flag.source}</Badge>
          <Badge tone="neutral" flat>{flag.reasonCode}</Badge>
          <span className="text-[12px] text-ink-3">Opened {formatAge(flag.openedAt)}</span>
          <CopyableId value={flag.listingId} label="listing id" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Snapshot" title="Listing summary" />
            <MetaList
              cols={1}
              items={[
                { label: 'Listing ID', value: id, mono: true },
                { label: 'Source', value: flag?.source?.replace(/_/g, ' ') ?? '—' },
                { label: 'Reason', value: flag?.reasonCode ?? '—' },
                { label: 'Reporter', value: flag?.reportedByConsumerId ?? '—', mono: true },
              ]}
            />

            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                variant="outline"
                iconLeft={<EyeOff className="size-3.5" />}
                disabled={!flag}
                onClick={() => setTakingDown(true)}
              >
                Take down
              </Button>
              <Button
                variant="outline"
                iconLeft={<Eye className="size-3.5" />}
                disabled={!flag}
                loading={restore.isPending}
                onClick={() => restore.mutate('')}
              >
                Restore
              </Button>
              <Button
                variant="outline"
                className="text-danger border-danger/40 hover:bg-danger/5"
                onClick={() => setRetiring(true)}
              >
                Retire platform-wide
              </Button>
              <Button variant="ghost" disabled={!flag} loading={dismiss.isPending} onClick={() => dismiss.mutate()}>
                Dismiss flag
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading
              kicker="Consumer reports"
              title={`${reports.data?.total ?? 0} report${(reports.data?.total ?? 0) === 1 ? '' : 's'}`}
            />
            {reports.isLoading ? (
              <Skeleton className="h-24" />
            ) : (reports.data?.breakdown?.length ?? 0) === 0 ? (
              <p className="text-[12.5px] text-ink-3 italic">No consumer-filed reports for this listing.</p>
            ) : (
              <ul className="space-y-1.5">
                {(reports.data?.breakdown ?? []).map((b) => {
                  const pct = reports.data!.total > 0 ? Math.round((b.count / reports.data!.total) * 100) : 0;
                  return (
                    <li key={b.reasonCode} className="flex items-center gap-3">
                      <span className="w-40 truncate text-[12.5px] text-ink-2 capitalize">
                        {b.reasonCode.replace(/_/g, ' ')}
                      </span>
                      <div className="flex-1 overflow-hidden rounded-full bg-bg-2">
                        <div className="h-1.5 bg-warning" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-16 text-right font-mono text-[12px] tabular-nums text-ink-2">
                        {b.count}{' '}
                        <span className="text-ink-4">({pct}%)</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <SectionHeading kicker="Audit" title="Edit history" />
            {audit.isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <ol className="space-y-2">
                {(audit.data ?? []).map((e) => (
                  <li key={e.id} className="text-[12.5px] text-ink-2">
                    <span className="font-medium capitalize">{e.actorKind}</span>
                    {' · '}
                    <span className="font-mono bg-bg-3 px-1 rounded">{e.action}</span>
                    {e.note && <span className="text-ink-3"> — {e.note}</span>}
                    {' '}<span className="text-ink-4">·</span>{' '}
                    <span className="text-ink-3">{formatAge(e.at)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <ReasonActionDialog
        open={takingDown}
        title="Take down listing?"
        description="The listing will be hidden from consumers immediately. Retailer is notified with the reason."
        confirmLabel="Take down"
        danger
        onClose={() => setTakingDown(false)}
        onConfirm={(reason) => takeDown.mutate(reason)}
      />
      <TypeConfirmDialog
        open={retiring}
        title="Retire listing platform-wide?"
        description="This is permanent. The listing cannot be republished — even by admin override. Type the listing name exactly to confirm."
        confirmText={flag?.listingName ?? id}
        typeLabel={
          <>
            Type the listing name <span className="font-mono text-ink">{flag?.listingName ?? id}</span> to confirm
          </>
        }
        confirmLabel="Retire forever"
        danger
        loading={retire.isPending}
        onClose={() => setRetiring(false)}
        onConfirm={(reason) => retire.mutate(reason)}
      />
    </Page>
  );
}
