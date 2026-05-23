import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, api } from '@/lib/api';
import { uploadMedia } from '@/lib/upload';
import type { AiListingQuota, AiSubmission, AiSubmissionMode, Listing } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, ImagePlus, Sparkles, Upload, X } from 'lucide-react';

const POSE_OPTIONS = ['front', 'back', 'three-quarter', 'side', 'detail', 'flat'];
const MAX_REFS = 5;

export default function RetailerAiCatalogNew() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const initialListingId = search.get('listingId') ?? '';
  const initialVariantId = search.get('variantId') ?? '';

  const [listingId, setListingId] = useState(initialListingId);
  const [variantId, setVariantId] = useState(initialVariantId);
  const [mode, setMode] = useState<AiSubmissionMode>('with_model');
  const [poses, setPoses] = useState<string[]>(['front', 'three-quarter']);
  const [prompt, setPrompt] = useState('');
  const [refs, setRefs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const listings = useQuery({
    queryKey: ['retailer', 'listings'],
    queryFn: () => api<Listing[]>('/retailer/listings'),
  });

  const listing = useQuery({
    queryKey: ['retailer', 'listing', listingId],
    queryFn: () => api<Listing>(`/retailer/listings/${listingId}`),
    enabled: Boolean(listingId),
  });

  const quota = useQuery({
    queryKey: ['retailer', 'ai-catalog', 'quota', listingId],
    queryFn: () =>
      api<AiListingQuota>(`/retailer/ai-catalog/quota?listingId=${encodeURIComponent(listingId)}`),
    enabled: Boolean(listingId),
  });

  // When the listing changes, reset variant + refs so the gallery picker is clean.
  useEffect(() => {
    setVariantId('');
    setRefs([]);
  }, [listingId]);

  const togglePose = (p: string) =>
    setPoses((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const toggleRef = (url: string) =>
    setRefs((cur) => {
      if (cur.includes(url)) return cur.filter((x) => x !== url);
      if (cur.length >= MAX_REFS) {
        toast.error(`Max ${MAX_REFS} reference images.`);
        return cur;
      }
      return [...cur, url];
    });

  async function onFilePicked(file: File) {
    if (refs.length >= MAX_REFS) {
      toast.error(`Max ${MAX_REFS} reference images.`);
      return;
    }
    setUploading(true);
    try {
      const res = await uploadMedia(file, { purpose: 'listing-gallery' });
      setRefs((cur) => [...cur, res.url]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!listingId) {
      toast.error('Pick a listing first.');
      return;
    }
    if (prompt.trim().length < 8) {
      toast.error('Prompt must be at least 8 characters.');
      return;
    }
    if (refs.length === 0) {
      toast.error('Add at least one reference image.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<AiSubmission>('/retailer/ai-catalog', {
        method: 'POST',
        body: {
          listingId,
          targetVariantId: variantId || undefined,
          mode,
          prompt: prompt.trim(),
          referenceImageUrls: refs,
          posePreferences: poses,
        },
      });
      toast.success('Generation complete. Review the output.');
      navigate(`/retailer/ai-catalog/${res.id}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Generation failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const galleryThumbs: { url: string; label: string }[] = [];
  if (listing.data?.galleryUrls) {
    for (const url of listing.data.galleryUrls) galleryThumbs.push({ url, label: 'Listing' });
  }
  for (const v of listing.data?.variants ?? []) {
    for (const url of v.imageUrls ?? []) galleryThumbs.push({ url, label: v.attributesLabel });
  }

  const quotaExhausted = Boolean(quota.data && quota.data.remaining <= 0);
  const noVariants = Boolean(quota.data && quota.data.variantCount === 0);

  return (
    <Page>
      <PageHeader
        kicker="AI Catalog"
        title="New AI submission"
        description="Provide a prompt and at least one reference image. Gemini returns one polished shot, which you can then accept or regenerate once with revision notes."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
              <Link to="/retailer/ai-catalog">Back</Link>
            </Button>
            <Button
              variant="accent"
              loading={submitting}
              disabled={!listingId || quotaExhausted || noVariants || refs.length === 0 || prompt.trim().length < 8}
              iconLeft={<Sparkles className="size-4" />}
              onClick={submit}
            >
              Generate
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <Label required>Target listing</Label>
              {listings.isLoading ? (
                <Skeleton className="h-9" />
              ) : (
                <Select value={listingId || ''} onValueChange={(v) => setListingId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a listing…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(listings.data ?? []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {quota.data && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                  <Badge tone={quotaExhausted ? 'danger' : noVariants ? 'warning' : 'neutral'} flat>
                    {quota.data.usedAttempts}/{quota.data.variantCount} attempts used
                  </Badge>
                  {noVariants && <span>Add at least one variant to generate images.</span>}
                  {quotaExhausted && !noVariants && (
                    <span>Per-listing quota exhausted — no more attempts possible.</span>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label>Target variant (optional)</Label>
              <Select
                value={variantId || 'none'}
                onValueChange={(v) => setVariantId(v === 'none' ? '' : v)}
                disabled={!listing.data}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Listing gallery (no variant)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Listing gallery (no variant) —</SelectItem>
                  {(listing.data?.variants ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.attributesLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['with_model', 'without_model'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={
                      'rounded-md border px-3 py-2 text-[13px] text-left transition-colors ' +
                      (mode === m
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-bg text-ink-2 hover:border-line-2')
                    }
                  >
                    <div className="font-semibold">{m === 'with_model' ? 'With model' : 'Without model'}</div>
                    <div className="mt-0.5 text-[11.5px] text-ink-3">
                      {m === 'with_model'
                        ? 'AI places the garment on a synthetic model.'
                        : 'Flat-lay or mannequin shots only.'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Pose preferences</Label>
              <div className="flex flex-wrap gap-1.5">
                {POSE_OPTIONS.map((p) => {
                  const on = poses.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePose(p)}
                      className={
                        'rounded-full border px-2.5 py-1 text-[11.5px] capitalize transition-colors ' +
                        (on
                          ? 'border-ink bg-ink text-bg'
                          : 'border-line bg-bg text-ink-2 hover:border-line-2')
                      }
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label required>Prompt</Label>
              <Textarea
                rows={4}
                placeholder="e.g. 'studio shot on neutral grey background, soft lighting, three-quarter pose, focus on fabric texture'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="mt-1 text-[11px] text-ink-4">{prompt.trim().length} / 800 chars (min 8)</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <SectionHeading
              kicker="References"
              title="Pick or upload reference images"
              hint={`${refs.length} / ${MAX_REFS} selected`}
            />
            <Tabs defaultValue="gallery">
              <TabsList>
                <TabsTrigger value="gallery">From gallery</TabsTrigger>
                <TabsTrigger value="upload">Upload new</TabsTrigger>
              </TabsList>

              <TabsContent value="gallery">
                {!listingId ? (
                  <div className="rounded-md border border-line bg-bg-2/30 p-4 text-[12.5px] text-ink-3 italic">
                    Pick a listing first to load its gallery.
                  </div>
                ) : listing.isLoading ? (
                  <Skeleton className="h-32" />
                ) : galleryThumbs.length === 0 ? (
                  <div className="rounded-md border border-line bg-bg-2/30 p-4 text-[12.5px] text-ink-3 italic">
                    This listing has no gallery or variant images yet. Use the “Upload new” tab.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {galleryThumbs.map(({ url, label }, i) => {
                      const on = refs.includes(url);
                      return (
                        <button
                          key={`${url}-${i}`}
                          type="button"
                          onClick={() => toggleRef(url)}
                          className={
                            'group relative aspect-[3/4] overflow-hidden rounded-md border-2 transition ' +
                            (on ? 'border-accent shadow-md' : 'border-line hover:border-line-strong')
                          }
                        >
                          <img src={url} alt={label} className="size-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-[10.5px] text-white">
                            {label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="upload">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFilePicked(f);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line-2 bg-bg-2/40 px-4 py-10 text-ink-3 hover:border-ink hover:text-ink transition-colors disabled:opacity-60"
                >
                  {uploading ? (
                    <span className="text-[12px]">Uploading…</span>
                  ) : (
                    <>
                      <Upload className="size-5" />
                      <span className="text-[12.5px]">Click to upload JPEG / PNG / WebP (max 5 MB)</span>
                    </>
                  )}
                </button>
              </TabsContent>
            </Tabs>

            {refs.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
                  Selected
                </div>
                <div className="flex flex-wrap gap-2">
                  {refs.map((url, i) => (
                    <div
                      key={url}
                      className="relative size-16 overflow-hidden rounded-md border border-line bg-bg-2"
                    >
                      <img src={url} alt={`ref ${i + 1}`} className="size-full object-cover" />
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => setRefs((cur) => cur.filter((x) => x !== url))}
                        className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-black/70 text-white hover:bg-black/90"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  {refs.length < MAX_REFS && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="grid size-16 place-items-center rounded-md border-2 border-dashed border-line-2 bg-bg-2/40 text-ink-4 hover:border-ink hover:text-ink"
                    >
                      <ImagePlus className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
