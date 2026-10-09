import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { CmsSchema } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionPanel } from '@/components/admin/cms/section-panel';
import { PublishPanel } from '@/components/admin/cms/publish-panel';
import { CategoryImageryPanel } from '@/components/admin/cms/category-imagery-panel';
import { QuickPublish } from '@/components/admin/cms/quick-publish';
import { useCmsStatus } from '@/components/admin/cms/use-cms-status';

/**
 * Home CMS — every image, word and link on the consumer app's home page and the pages it opens.
 *
 * One tab per area of the home, URL-synced via `?tab=` (same shape as the platform-rules hub).
 * A tab renders one or more sections through ONE generic panel: what fields a section has,
 * whether it splits by rail, how many items it holds, and where its tiles can link all come
 * from `GET /admin/cms/schema`, which the backend derives from the section catalogue. Adding a
 * section to the app therefore adds a form here with no code change.
 *
 * Everything edited under these tabs is a DRAFT. The last tab is where it goes live.
 */
export default function AdminCms() {
  const [params, setParams] = useSearchParams();
  const perms = useAuth((s) => s.session?.permissions);
  const canEdit = !perms || perms['cms.edit'] === true;
  const canPublish = !perms || perms['cms.publish'] === true;

  const schema = useQuery({
    queryKey: ['admin', 'cms', 'schema'],
    queryFn: () => api<CmsSchema>('/admin/cms/schema'),
    staleTime: 10 * 60_000,
  });

  const status = useCmsStatus();

  // Section key → human label, for the publish summary and anywhere a key needs a name.
  const labelByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of schema.data?.tabs ?? []) for (const s of t.sections) m.set(s.key, s.label);
    return m;
  }, [schema.data]);
  const labelFor = (key: string) => labelByKey.get(key) ?? key;

  const tabs = useMemo(() => {
    const fromSchema = (schema.data?.tabs ?? []).map((t) => ({
      key: t.key,
      label: t.label,
      sections: t.sections,
    }));
    // Publish is not a content area, so it is not in the catalogue — it is appended here and
    // deliberately sits last, after everything it would publish.
    return [
      ...fromSchema,
      { key: 'category_imagery', label: 'Category imagery', sections: [] },
      { key: 'publish', label: 'Publish', sections: [] },
    ];
  }, [schema.data]);

  const fallback = tabs[0]?.key ?? 'hero';
  const requested = params.get('tab');
  const active = tabs.some((t) => t.key === requested) ? requested! : fallback;

  function setTab(key: string) {
    const next = new URLSearchParams(params);
    if (key === fallback) next.delete('tab');
    else next.set('tab', key);
    setParams(next);
  }

  // How many unpublished changes sit under a tab — drives the dot on its trigger.
  function tabPending(tab: { key: string; sections: { key: string }[] }): number {
    if (tab.key === 'publish') {
      const t = status.data?.totals;
      return t
        ? t.new + t.changed + t.removed + t.sectionsChanged + (status.data?.removedSections.length ?? 0)
        : 0;
    }
    let n = 0;
    for (const s of tab.sections) {
      const st = status.data?.sections[s.key];
      if (st) n += st.counts.new + st.counts.changed + st.counts.removed + (st.changed ? 1 : 0);
    }
    return n;
  }

  return (
    <Page>
      <PageHeader
        kicker="Content"
        title="Home CMS"
        description="Everything the app shows above its product feed — campaign banners, Top Stories, Steals, occasions, the Her and His Edit pages, and the category banners in Browse. Edits stay invisible until you publish."
        actions={
          <QuickPublish
            canPublish={canPublish}
            labelFor={labelFor}
            onOpenFullView={() => setTab('publish')}
          />
        }
      />

      {schema.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : schema.isError ? (
        <p className="text-[13px] text-danger">
          Could not load the CMS schema. The backend may be older than this dashboard.
        </p>
      ) : (
        <Tabs value={active} onValueChange={setTab}>
          <TabsList className="overflow-x-auto whitespace-nowrap">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                <span className="inline-flex items-center gap-1.5">
                  {t.label}
                  {tabPending(t) > 0 && (
                    <span
                      className="size-1.5 rounded-full bg-warning"
                      aria-label="Unpublished changes"
                    />
                  )}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((t) => (
            <TabsContent key={t.key} value={t.key}>
              {t.key === 'publish' ? (
                <PublishPanel canPublish={canPublish} />
              ) : t.key === 'category_imagery' ? (
                <CategoryImageryPanel canEdit={canEdit} />
              ) : (
                <div className="space-y-10">
                  {t.sections.map((spec) => (
                    <SectionPanel
                      key={spec.key}
                      sectionKey={spec.key}
                      spec={spec}
                      routes={schema.data?.routes ?? []}
                      canEdit={canEdit}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </Page>
  );
}
