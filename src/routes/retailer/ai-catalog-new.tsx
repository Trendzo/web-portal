import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ImagePlus, Sparkles, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { AiSubmissionMode, Listing } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const POSE_OPTIONS = ['front', 'back', 'three-quarter', 'side', 'detail', 'flat'];

export default function RetailerAiCatalogNew() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const initialListingId = search.get('listingId') ?? '';
  const [listingId, setListingId] = useState(initialListingId);
  const [mode, setMode] = useState<AiSubmissionMode>('with_model');
  const [poses, setPoses] = useState<string[]>(['front', 'three-quarter']);
  const [inputs, setInputs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const listings = useQuery({
    queryKey: ['retailer', 'listings'],
    queryFn: () => api<Listing[]>('/retailer/listings'),
  });

  const togglePose = (p: string) =>
    setPoses((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const addInput = () => {
    setInputs((cur) => [...cur, `https://placehold.co/512x768/171717/ffffff?text=input+${cur.length + 1}`]);
  };
  const removeInput = (i: number) => setInputs((cur) => cur.filter((_, idx) => idx !== i));

  async function submit() {
    if (inputs.length === 0) {
      toast.error('Add at least one input photo first.');
      return;
    }
    setSubmitting(true);
    try {
      await api('/retailer/ai-catalog', {
        method: 'POST',
        body: JSON.stringify({
          listingId: listingId || undefined,
          mode,
          rawPhotos: inputs,
          posePreferences: poses,
        }),
      });
      toast.success('Submission queued. We will notify you when outputs are ready.');
      navigate('/retailer/ai-catalog');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page>
      <PageHeader
        kicker="AI Catalog"
        title="New AI submission"
        description="Upload product photos and pick the output style. The AI takes a few minutes; you'll get a notification when outputs are ready."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
              <Link to="/retailer/ai-catalog">Back</Link>
            </Button>
            <Button variant="accent" loading={submitting} iconLeft={<Sparkles className="size-4" />} onClick={submit}>
              Generate
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <Label required>Target listing (optional)</Label>
              {listings.isLoading ? (
                <Skeleton className="h-9" />
              ) : (
                <Select value={listingId || 'none'} onValueChange={(v) => setListingId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Pick a listing…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None (general submission) —</SelectItem>
                    {(listings.data ?? []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
                      {m === 'with_model' ? 'AI places the garment on a synthetic model.' : 'Flat-lay or mannequin shots only.'}
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Inputs" title="Upload product photos" hint={`${inputs.length} added`} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {inputs.map((url, i) => (
                <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-md border border-line bg-bg-2">
                  <img src={url} alt={`input ${i + 1}`} className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => removeInput(i)}
                    className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addInput}
                className="aspect-[3/4] flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line-2 bg-bg-2/40 text-ink-3 hover:border-ink hover:text-ink transition-colors"
              >
                <ImagePlus className="size-5" />
                <span className="text-[11.5px]">Add photo (mock)</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
