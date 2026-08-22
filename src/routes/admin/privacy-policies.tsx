import { lazy, Suspense, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, BASE } from '@/lib/api';
import { usePermission } from '@/lib/use-permission';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const RichTextEditor = lazy(() =>
  import('@/components/ui/rich-text-editor').then((m) => ({ default: m.RichTextEditor })),
);

type PrivacyApp = 'customer' | 'retailer' | 'driver';

type PolicyListItem = {
  app: PrivacyApp;
  label: string;
  title: string;
  effectiveDate: string;
  source: 'custom' | 'default';
  updatedAt: string | null;
  publicPath: string;
};
type PolicyDetail = PolicyListItem & { bodyHtml: string };

const APPS: PrivacyApp[] = ['customer', 'retailer', 'driver'];

/**
 * Per-app privacy policy editor. Each app (shopping / retailer / delivery partner) ships a
 * DIFFERENT policy served at /privacy/:app — this is what Google Play's per-app review wants.
 * Until an admin saves one, the public page renders the built-in default (source: "default").
 */
export default function AdminPrivacyPolicies() {
  const canEdit = usePermission('platform_config.edit');
  const [active, setActive] = useState<PrivacyApp>('customer');

  const { data: list, isLoading } = useQuery({
    queryKey: ['admin', 'legal-pages', 'list'],
    queryFn: () => api<{ items: PolicyListItem[] }>(`/admin/legal-pages/privacy`),
  });

  return (
    <Page>
      <PageHeader
        kicker="Legal"
        title="Privacy Policies (per app)"
        description="Each app has its own privacy policy, served publicly at /privacy/<app> for the Google Play listing. Edit each one individually. Unsaved apps render a built-in default."
      />

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {(list?.items ?? APPS.map((a) => ({ app: a, label: a }) as PolicyListItem)).map((it) => (
              <button
                key={it.app}
                onClick={() => setActive(it.app)}
                className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition ${
                  active === it.app
                    ? 'border-ink bg-ink text-white'
                    : 'border-line bg-bg text-ink-3 hover:border-ink-3'
                }`}
              >
                {it.label}
                {it.source === 'default' && active !== it.app && (
                  <span className="ml-2 text-[10px] uppercase opacity-70">default</span>
                )}
              </button>
            ))}
          </div>

          <PolicyEditor app={active} canEdit={canEdit} />
        </div>
      )}
    </Page>
  );
}

function PolicyEditor({ app, canEdit }: { app: PrivacyApp; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'legal-pages', app],
    queryFn: () => api<PolicyDetail>(`/admin/legal-pages/privacy/${app}`),
  });

  const [title, setTitle] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [seeded, setSeeded] = useState<string | null>(null);

  // Seed the form once per app load (re-seed when switching apps).
  useEffect(() => {
    if (data && seeded !== app) {
      setTitle(data.title);
      setEffectiveDate(data.effectiveDate);
      setBodyHtml(data.bodyHtml);
      setSeeded(app);
    }
  }, [data, app, seeded]);
  // Reset the seed guard when the active app changes.
  useEffect(() => setSeeded(null), [app]);

  const save = useMutation({
    mutationFn: () =>
      api(`/admin/legal-pages/privacy/${app}`, {
        method: 'PUT',
        body: { title: title.trim(), effectiveDate: effectiveDate.trim(), bodyHtml },
      }),
    onSuccess: () => {
      toast.success('Privacy policy saved — the public page updates immediately.');
      void qc.invalidateQueries({ queryKey: ['admin', 'legal-pages'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save'),
  });

  if (isLoading || seeded !== app) return <Skeleton className="h-[520px]" />;

  const publicUrl = `${BASE.replace(/\/api\/v1$/, '')}${data?.publicPath ?? `/privacy/${app}`}`;
  const canSave =
    canEdit && title.trim().length > 0 && effectiveDate.trim().length > 0 && bodyHtml.trim().length > 20;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <SectionHeading kicker={data?.label ?? app} title="Privacy policy" />
          <div className="flex items-center gap-2">
            <Badge tone={data?.source === 'custom' ? 'success' : 'neutral'} flat>
              {data?.source === 'custom' ? 'Custom' : 'Built-in default'}
            </Badge>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[12.5px] font-medium text-ink underline"
            >
              View public page ↗
            </a>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink-3">Title</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink-3">Effective date</span>
            <Input
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              placeholder="e.g. 22 August 2026"
              disabled={!canEdit}
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="mb-1 block text-[12px] font-medium text-ink-3">Policy body</span>
          <Suspense fallback={<Skeleton className="h-72" />}>
            <RichTextEditor value={bodyHtml} onChange={setBodyHtml} uploadFolder="legal/privacy" />
          </Suspense>
        </div>

        {canEdit ? (
          <div className="mt-4 flex items-center gap-2">
            <Button variant="ink" loading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>
              Save policy
            </Button>
            <span className="text-[12px] text-ink-4">
              Saving publishes to {data?.publicPath} immediately.
            </span>
          </div>
        ) : (
          <p className="mt-4 text-[12px] text-ink-4">Read-only — you lack platform-config edit permission.</p>
        )}
      </CardContent>
    </Card>
  );
}
