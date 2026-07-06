import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { usePermission } from '@/lib/use-permission';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type TermsVersion = {
  id: string;
  label: string;
  shortText: string;
  createdAt: string;
  createdByAdminId: string;
  isCurrent: boolean;
  acceptedCount: number;
  declinedCount: number;
};
type TermsData = {
  current: { version: string; label: string; shortText: string };
  versions: TermsVersion[];
};
type Decision = {
  id: string;
  storeName: string | null;
  accountName: string | null;
  decision: string;
  at: string;
  ip: string | null;
};

export default function AdminTerms() {
  const qc = useQueryClient();
  const canEdit = usePermission('platform_config.edit');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'terms'],
    queryFn: () => api<TermsData>('/admin/terms'),
  });

  // Controlled draft with a fallback to the current text; reset after publish re-seeds it.
  const [draft, setDraft] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const text = draft ?? data?.current.shortText ?? '';

  const publish = useMutation({
    mutationFn: () =>
      api('/admin/terms', { method: 'POST', body: { shortText: text, label: label.trim() || undefined } }),
    onSuccess: () => {
      toast.success('New terms published — all retailers will be re-prompted to accept.');
      setDraft(null);
      setLabel('');
      void qc.invalidateQueries({ queryKey: ['admin', 'terms'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not publish'),
  });

  const dirty = draft !== null && draft.trim() !== (data?.current.shortText ?? '').trim();

  return (
    <Page>
      <PageHeader
        kicker="Legal"
        title="Retailer Terms & Conditions"
        description="Edit the terms retailers must accept. Publishing a new version re-prompts every retailer to accept it."
      />

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-5">
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <SectionHeading kicker="Current" title={`Version ${data?.current.label ?? ''}`} />
                <Badge tone="success">Live</Badge>
              </div>
              <textarea
                value={text}
                onChange={(e) => setDraft(e.target.value)}
                rows={16}
                disabled={!canEdit}
                className="w-full rounded-lg border border-line bg-bg p-3 font-mono text-[12.5px] leading-relaxed text-ink"
              />
              {canEdit && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Version label (optional, e.g. v2 / 2026-07)"
                    className="w-72"
                  />
                  <Button
                    variant="ink"
                    loading={publish.isPending}
                    disabled={!dirty || text.trim().length < 20}
                    onClick={() => publish.mutate()}
                  >
                    Publish new version
                  </Button>
                  {dirty && <span className="text-[12px] text-warning">Unpublished changes</span>}
                </div>
              )}
              {!canEdit && <p className="mt-2 text-[12px] text-ink-4">Read-only — you lack platform-config edit permission.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <SectionHeading kicker="Audit" title="Version history & acceptances" />
              <div className="mt-3 overflow-hidden rounded-lg border border-line">
                <table className="w-full text-[13px]">
                  <thead className="bg-bg-2 text-[11px] uppercase text-ink-4">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Version</th>
                      <th className="px-3 py-2 text-left font-medium">Published</th>
                      <th className="px-3 py-2 text-right font-medium">Accepted</th>
                      <th className="px-3 py-2 text-right font-medium">Declined</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.versions ?? []).length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-[13px] text-ink-3 italic">No published versions yet — the built-in draft is live until you publish one.</td></tr>
                    ) : (
                      (data?.versions ?? []).map((v) => (
                        <Fragment key={v.id}>
                          <tr className="border-t border-line">
                            <td className="px-3 py-2">
                              <span className="font-medium text-ink">{v.label}</span>
                              {v.isCurrent && <Badge tone="success" flat className="ml-2">current</Badge>}
                            </td>
                            <td className="px-3 py-2 text-ink-3">{new Date(v.createdAt).toLocaleString('en-IN')}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-success">{v.acceptedCount}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-danger">{v.declinedCount}</td>
                            <td className="px-3 py-2 text-right">
                              <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === v.id ? null : v.id)}>
                                {expanded === v.id ? 'Hide' : 'View'}
                              </Button>
                            </td>
                          </tr>
                          {expanded === v.id && (
                            <tr className="border-t border-line bg-bg-2/40">
                              <td colSpan={5} className="px-3 py-2">
                                <DecisionsTable version={v.id} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Page>
  );
}

function DecisionsTable({ version }: { version: string }) {
  const { data } = useQuery({
    queryKey: ['admin', 'terms', version, 'decisions'],
    queryFn: () => api<{ decisions: Decision[] }>(`/admin/terms/${version}/decisions`),
  });
  const rows = data?.decisions ?? [];
  if (rows.length === 0) return <div className="py-2 text-[12.5px] text-ink-3 italic">No decisions recorded for this version.</div>;
  return (
    <div className="space-y-1">
      {rows.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <Badge tone={d.decision === 'accepted' ? 'success' : 'danger'} flat>{d.decision}</Badge>
          <span className="font-medium text-ink">{d.accountName ?? '—'}</span>
          <span className="text-ink-3">{d.storeName ?? ''}</span>
          <span className="ml-auto text-ink-4">{new Date(d.at).toLocaleString('en-IN')}{d.ip ? ` · ${d.ip}` : ''}</span>
        </div>
      ))}
    </div>
  );
}
