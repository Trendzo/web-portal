import { useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageOff } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { CategoryRow, CmsAsset, CmsGender, CmsItem, CmsSectionDetail } from '@/lib/types';
import { thumbUrl } from '@/lib/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { MediaGallery } from '@/components/ui/media-gallery';

type TreeNode = CategoryRow & { children: TreeNode[]; depth: number };
type Rail = Extract<CmsGender, 'her' | 'him'>;

const SECTION_KEY = 'page.category_banners';

export function CategoryImageryPanel({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api<CategoryRow[]>('/admin/categories'),
  });
  const banners = useQuery({
    queryKey: ['admin', 'cms', 'section', SECTION_KEY],
    queryFn: () => api<CmsSectionDetail>(`/admin/cms/sections/${SECTION_KEY}`),
  });
  const assets = useQuery({
    queryKey: ['admin', 'cms', 'assets'],
    queryFn: () => api<{ assets: CmsAsset[]; categories: string[] }>('/admin/cms/assets'),
    staleTime: 5 * 60_000,
  });

  const tree = useMemo(() => buildTree(categories.data ?? []), [categories.data]);
  const itemByKey = useMemo(
    () => new Map((banners.data?.items ?? []).map((i) => [i.key, i])),
    [banners.data],
  );
  const previewByAsset = useMemo(
    () => new Map((assets.data?.assets ?? []).map((a) => [a.key, a.previewUrl])),
    [assets.data],
  );

  const patchCategoryImage = useMutation({
    mutationFn: ({ id, imageUrl }: { id: string; imageUrl: string | null }) =>
      api(`/admin/categories/${id}`, { method: 'PATCH', body: { imageUrl } }),
    onSuccess: () => {
      toast.success('Category image saved');
      void qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save category image'),
  });

  const saveBanner = useMutation({
    mutationFn: async ({
      item,
      rail,
      slug,
      imageUrl,
    }: {
      item: CmsItem | null;
      rail: Rail;
      slug: string;
      imageUrl: string | null;
    }) => {
      if (item && imageUrl) {
        return api<CmsItem>(`/admin/cms/items/${item.id}`, {
          method: 'PATCH',
          body: { imageUrl },
        });
      }
      if (item && imageUrl === null) {
        if (item.assetKey) {
          return api<CmsItem>(`/admin/cms/items/${item.id}`, {
            method: 'PATCH',
            body: { imageUrl: null },
          });
        }
        return api<{ id: string }>(`/admin/cms/items/${item.id}`, { method: 'DELETE' });
      }
      if (imageUrl) {
        return api<CmsItem>(`/admin/cms/sections/${SECTION_KEY}/items`, {
          method: 'POST',
          body: {
            key: `${rail}-${slug}`,
            gender: rail,
            assetKey: null,
            imageUrl,
            videoUrl: null,
            link: null,
            content: { textH: 'left', textV: 'bottom' },
            isEnabled: true,
            startsAt: null,
            endsAt: null,
            cities: null,
          },
        });
      }
      return null;
    },
    onSuccess: () => {
      toast.success('Banner draft saved');
      void qc.invalidateQueries({ queryKey: ['admin', 'cms'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save banner'),
  });

  if (categories.isLoading || banners.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (categories.isError || banners.isError || !banners.data) {
    return <Empty kicker="Connection lost" title="Couldn't load category imagery." />;
  }

  if (tree.length === 0) {
    return <Empty kicker="Empty taxonomy" title="No categories yet." />;
  }

  return (
    <section className="space-y-5">
      <header className="max-w-3xl">
        <h3 className="text-[15px] font-semibold text-ink">Category imagery</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
          Tile images update catalog categories immediately. Top-level banners save into the CMS
          draft and require publishing before customers see them.
        </p>
      </header>

      <div className="space-y-3">
        {tree.flatMap((node) => renderNode(node, itemByKey, previewByAsset, {
          canEdit,
          onCategoryImage: (id, imageUrl) => patchCategoryImage.mutate({ id, imageUrl }),
          categoryBusy: patchCategoryImage.isPending,
          bannerBusy: saveBanner.isPending,
          onBannerImage: (rail, item, slug, imageUrl) =>
            saveBanner.mutate({ rail, item, slug, imageUrl }),
        }))}
      </div>
    </section>
  );
}

function renderNode(
  node: TreeNode,
  itemByKey: Map<string, CmsItem>,
  previewByAsset: Map<string, string | null>,
  ctx: {
    canEdit: boolean;
    categoryBusy: boolean;
    bannerBusy: boolean;
    onCategoryImage: (id: string, imageUrl: string | null) => void;
    onBannerImage: (
      rail: Rail,
      item: CmsItem | null,
      slug: string,
      imageUrl: string | null,
    ) => void;
  },
): ReactNode[] {
  const rails: Rail[] =
    node.parentId === null
      ? node.gender === 'her'
        ? ['her']
        : node.gender === 'him'
          ? ['him']
          : ['her', 'him']
      : [];

  const row = (
    <div key={node.id} className="rounded-md border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span style={{ width: node.depth * 18 }} aria-hidden />
            <span className="truncate text-[13.5px] font-semibold text-ink">{node.label}</span>
            <Badge tone="neutral" flat>{node.gender.toUpperCase()}</Badge>
            {node.parentId === null ? <Badge tone="info" flat>Top-level</Badge> : null}
          </div>
          <div className="mt-1 font-mono text-[11.5px] text-ink-3">/{node.slug}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className={rails.length ? undefined : 'lg:col-span-3'}>
          <div className="mb-2 text-[12.5px] font-medium text-ink-2">Category/subcategory tile</div>
          {ctx.canEdit ? (
            <MediaGallery
              urls={node.imageUrl ? [node.imageUrl] : []}
              onChange={(urls) => ctx.onCategoryImage(node.id, urls[0] ?? null)}
              uploadFolder={`categories/${node.slug}`}
              maxImages={1}
              busy={ctx.categoryBusy}
            />
          ) : (
            <ImagePreview url={node.imageUrl} />
          )}
        </div>

        {rails.map((rail) => {
          const item = itemByKey.get(`${rail}-${node.slug}`) ?? null;
          const fallbackItem = itemByKey.get(node.slug) ?? null;
          const previewItem = item ?? fallbackItem;
          return (
            <BannerEditor
              key={rail}
              rail={rail}
              item={item}
              fallbackKey={fallbackItem && !item ? fallbackItem.key : null}
              previewUrl={
                previewItem?.imageUrl ?? previewByAsset.get(previewItem?.assetKey ?? '') ?? null
              }
              slug={node.slug}
              canEdit={ctx.canEdit}
              busy={ctx.bannerBusy}
              onChange={(imageUrl) => ctx.onBannerImage(rail, item, node.slug, imageUrl)}
            />
          );
        })}
      </div>
    </div>
  );

  return [row, ...node.children.flatMap((c) => renderNode(c, itemByKey, previewByAsset, ctx))];
}

function BannerEditor({
  rail,
  item,
  fallbackKey,
  previewUrl,
  slug,
  canEdit,
  busy,
  onChange,
}: {
  rail: Rail;
  item: CmsItem | null;
  fallbackKey: string | null;
  previewUrl: string | null;
  slug: string;
  canEdit: boolean;
  busy: boolean;
  onChange: (imageUrl: string | null) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-ink-2">{rail.toUpperCase()} browse banner</span>
        {item?.assetKey ? <code className="truncate text-[10.5px] text-ink-3">{item.assetKey}</code> : null}
      </div>
      {fallbackKey ? (
        <p className="mb-2 text-[11px] text-ink-3">
          Currently falling back to CMS key <code>{fallbackKey}</code>. Saving creates the
          rail-specific key below.
        </p>
      ) : null}
      {previewUrl && !item?.imageUrl ? (
        <div className="mb-2 grid h-20 place-items-center overflow-hidden rounded border border-line bg-bg-3">
          <img src={thumbUrl(previewUrl, 240) ?? previewUrl} alt="" className="size-full object-cover" />
        </div>
      ) : !item ? (
        <div className="mb-2 grid h-20 place-items-center rounded border border-dashed border-line bg-bg-3">
          <ImageOff className="size-4 text-ink-3" />
        </div>
      ) : null}
      {canEdit ? (
        <MediaGallery
          urls={item?.imageUrl ? [item.imageUrl] : []}
          onChange={(urls) => onChange(urls[0] ?? null)}
          uploadFolder={`category-banners/${rail}/${slug}`}
          maxImages={1}
          busy={busy}
        />
      ) : (
        <ImagePreview url={item?.imageUrl ?? previewUrl} />
      )}
      <p className="mt-1 text-[11px] text-ink-3">
        CMS key: <code>{rail}-{slug}</code>
      </p>
      {item?.imageUrl && item.assetKey ? (
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => onChange(null)}>
          Revert to bundled asset
        </Button>
      ) : null}
    </div>
  );
}

function ImagePreview({ url }: { url: string | null | undefined }) {
  if (!url) {
    return (
      <div className="grid h-20 place-items-center rounded border border-dashed border-line bg-bg-3">
        <ImageOff className="size-4 text-ink-3" />
      </div>
    );
  }
  return (
    <div className="grid h-20 place-items-center overflow-hidden rounded border border-line bg-bg-3">
      <img src={thumbUrl(url, 240) ?? url} alt="" className="size-full object-cover" />
    </div>
  );
}

function buildTree(rows: CategoryRow[]): TreeNode[] {
  const byParent = new Map<string | null, CategoryRow[]>();
  for (const r of rows) {
    const k = r.parentId ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(r);
  }
  const attach = (parentId: string | null, depth: number): TreeNode[] =>
    (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
      .map((r) => ({ ...r, depth, children: attach(r.id, depth + 1) }));
  return attach(null, 0);
}
