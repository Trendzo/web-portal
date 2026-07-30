import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImageOff, Search } from 'lucide-react';
import { api } from '@/lib/api';
import type { CmsAsset } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MediaGallery } from '@/components/ui/media-gallery';
import { Segmented } from '@/components/ui/segmented';

/**
 * The CMS's two-headed media picker.
 *
 * An item points at either art bundled in the app binary (an asset KEY, which the app resolves
 * locally — no network, works offline, and is how every tile on home performs today) or art
 * uploaded here (a URL, which takes effect without an app release). Both are legitimate, so
 * this offers both rather than pushing everyone onto uploads.
 *
 * The bundled grid shows a PREVIEW image rather than the real asset, because the real asset is
 * inside an APK and a browser cannot resolve a React Native `require()`. Those previews are
 * uploaded once by `backend/scripts/upload-cms-assets.ts`; a missing one means that script has
 * not been run against this environment yet, which is why the tile degrades to its key rather
 * than disappearing.
 */
export function MediaField({
  kind,
  assetKey,
  imageUrl,
  videoUrl,
  onChange,
}: {
  kind: 'image' | 'video';
  assetKey: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  onChange: (next: {
    assetKey: string | null;
    imageUrl: string | null;
    videoUrl: string | null;
  }) => void;
}) {
  const [mode, setMode] = useState<'bundled' | 'upload'>(
    imageUrl || videoUrl ? 'upload' : 'bundled',
  );
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>('');

  const assets = useQuery({
    queryKey: ['admin', 'cms', 'assets'],
    queryFn: () => api<{ assets: CmsAsset[]; categories: string[] }>('/admin/cms/assets'),
    staleTime: 5 * 60_000,
  });

  const filtered = useMemo(() => {
    const all = (assets.data?.assets ?? []).filter((a) => a.kind === kind);
    const byCategory = category ? all.filter((a) => a.category === category) : all;
    const needle = q.trim().toLowerCase();
    return needle ? byCategory.filter((a) => a.key.toLowerCase().includes(needle)) : byCategory;
  }, [assets.data, kind, category, q]);

  const categories = useMemo(
    () => [...new Set((assets.data?.assets ?? []).filter((a) => a.kind === kind).map((a) => a.category))].sort(),
    [assets.data, kind],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="mb-0">{kind === 'video' ? 'Video' : 'Image'}</Label>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'bundled', label: 'Bundled asset' },
            { value: 'upload', label: 'Upload' },
          ]}
        />
      </div>

      {mode === 'upload' ? (
        <div className="space-y-2">
          {/* An uploaded URL WINS over the asset key in the app, so both can be set safely —
              the key stays as a fallback for a build that predates the upload. */}
          <MediaGallery
            urls={(kind === 'video' ? videoUrl : imageUrl) ? [(kind === 'video' ? videoUrl : imageUrl)!] : []}
            onChange={(urls) => {
              const url = urls[0] ?? null;
              onChange(
                kind === 'video'
                  ? { assetKey, imageUrl, videoUrl: url }
                  : { assetKey, imageUrl: url, videoUrl },
              );
            }}
            uploadFolder="cms"
            maxImages={1}
          />
          <p className="text-[11.5px] text-ink-3">
            Uploads are served at the size you upload — there is no image resizing in front of
            the CDN. Keep hero art around 1080&nbsp;×&nbsp;1440 and tiles under ~300&nbsp;KB.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search asset keys…"
                className="pl-8"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 rounded-md border border-line bg-bg px-2 text-[13px] text-ink"
            >
              <option value="">All folders</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {assetKey && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange({ assetKey: null, imageUrl, videoUrl })}
              >
                Clear
              </Button>
            )}
          </div>

          {assets.isLoading ? (
            <p className="text-[13px] text-ink-3">Loading assets…</p>
          ) : filtered.length === 0 ? (
            <p className="text-[13px] text-ink-3">
              No bundled {kind}s match. Run <code>npm run cms:sync</code> in the backend if this
              list looks empty entirely.
            </p>
          ) : (
            <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto rounded-md border border-line p-2 sm:grid-cols-4">
              {filtered.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => onChange({ assetKey: a.key, imageUrl, videoUrl })}
                  className={cn(
                    'group overflow-hidden rounded border text-left transition-colors',
                    a.key === assetKey ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-ink-3',
                  )}
                  title={a.key}
                >
                  <div className="grid aspect-square place-items-center bg-bg-3">
                    {a.previewUrl ? (
                      <img src={a.previewUrl} alt={a.key} className="size-full object-contain" />
                    ) : (
                      <ImageOff className="size-4 text-ink-3" />
                    )}
                  </div>
                  <div className="truncate px-1.5 py-1 text-[10.5px] text-ink-3">{a.key}</div>
                </button>
              ))}
            </div>
          )}
          {assetKey && <p className="text-[12px] text-ink-2">Selected: <code>{assetKey}</code></p>}
        </div>
      )}
    </div>
  );
}
