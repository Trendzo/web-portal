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
import { MockDataBadge } from '@/components/ui/mock-data-badge';

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

  if (flagQuery.isLoading) return <Page><Skeleton className="h-72" /></Page>;

  return (
    <Page>
      <PageHeader
        kicker="Catalog moderation"
        title={`Listing ${id}`}
        description="Admin moderation overlay. Take down hides immediately; retire removes platform-wide."
        actions={
          <div className="flex items-center gap-2">
            <MockDataBadge label="MOCKED — pending backend §5" />
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
      <ReasonActionDialog
        open={retiring}
        title="Retire listing platform-wide?"
        description="This is permanent. The listing cannot be republished without admin override."
        confirmLabel="Retire"
        danger
        onClose={() => setRetiring(false)}
        onConfirm={(reason) => retire.mutate(reason)}
      />
    </Page>
  );
}
