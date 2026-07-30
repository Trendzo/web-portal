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

  const tabs = useMemo(() => {
    const fromSchema = (schema.data?.tabs ?? []).map((t) => ({
      key: t.key,
      label: t.label,
      sections: t.sections,
    }));
    // Publish is not a content area, so it is not in the catalogue — it is appended here and
    // deliberately sits last, after everything it would publish.
    return [...fromSchema, { key: 'publish', label: 'Publish', sections: [] }];
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

  return (
    <Page>
      <PageHeader
        kicker="Content"
        title="Home CMS"
        description="Everything the app shows above its product feed — campaign banners, Top Stories, Steals, occasions, the Her and His Edit pages, and the category banners in Browse. Edits stay invisible until you publish."
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
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((t) => (
            <TabsContent key={t.key} value={t.key}>
              {t.key === 'publish' ? (
                <PublishPanel canPublish={canPublish} />
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
