import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Page, PageHeader } from '@/components/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeList } from '@/components/admin/themes/theme-list';
import { ThemeEditor } from '@/components/admin/themes/theme-editor';
import { ThemePublishPanel } from '@/components/admin/themes/theme-publish-panel';

/**
 * Festival Themes — server-driven skins for the consumer app (Diwali colors,
 * header chrome, decorations, greeting copy) that go live on phones without an
 * app release. Full architecture: backend/docs/festival-theming-API.md.
 *
 * Everything here edits a DRAFT; the Publish tab is where the enabled set goes
 * live, and each live row carries the Disable-now kill switch. `?theme=<id>`
 * opens the editor (URL-synced so refresh and back behave); `?tab=` mirrors the
 * Home CMS hub idiom.
 */
export default function AdminThemes() {
  const [params, setParams] = useSearchParams();
  const perms = useAuth((s) => s.session?.permissions);
  const canEdit = !perms || perms['cms.edit'] === true;
  const canPublish = !perms || perms['cms.publish'] === true;

  const requested = params.get('tab');
  const active = requested === 'publish' ? 'publish' : 'themes';
  const editingId = params.get('theme');

  function setTab(key: string) {
    const next = new URLSearchParams(params);
    if (key === 'themes') next.delete('tab');
    else next.set('tab', key);
    next.delete('theme');
    setParams(next);
  }

  function openTheme(id: string | null) {
    const next = new URLSearchParams(params);
    if (id) next.set('theme', id);
    else next.delete('theme');
    setParams(next);
  }

  return (
    <Page>
      <PageHeader
        kicker="Content"
        title="Festival Themes"
        description="Skins the consumer app for festivals and campaigns — colors, header, decorations and copy — without an app release. Edits are drafts; the Publish tab makes the enabled set live, and phones revert to the default look at each theme's end date on their own."
      />

      {editingId ? (
        <ThemeEditor id={editingId} canEdit={canEdit} canPublish={canPublish} onClose={() => openTheme(null)} />
      ) : (
        <Tabs value={active} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="themes">Themes</TabsTrigger>
            <TabsTrigger value="publish">Publish</TabsTrigger>
          </TabsList>
          <TabsContent value="themes">
            <div className="pt-4">
              <ThemeList canEdit={canEdit} canPublish={canPublish} onOpen={(id) => openTheme(id)} />
            </div>
          </TabsContent>
          <TabsContent value="publish">
            <div className="pt-4">
              <ThemePublishPanel canPublish={canPublish} />
            </div>
          </TabsContent>
        </Tabs>
      )}

    </Page>
  );
}
