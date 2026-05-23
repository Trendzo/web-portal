import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, api } from '@/lib/api';
import type { AiSubmission, Listing } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, ArrowLeft, Check, RefreshCw, Sparkles, X } from 'lucide-react';

export default function RetailerAiCatalogReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const submission = useQuery({
    queryKey: ['retailer', 'ai-catalog', id],
    queryFn: () => api<AiSubmission>(`/retailer/ai-catalog/${id}`),
    enabled: Boolean(id),
    refetchInterval: (q) => (q.state.data?.status === 'processing' ? 2000 : false),
  });

  const data = submission.data;
  const listing = useQuery({
    queryKey: ['retailer', 'listing', data?.listingId],
    queryFn: () => api<Listing>(`/retailer/listings/${data?.listingId}`),
    enabled: Boolean(data?.listingId),
  });

  const [targetVariantId, setTargetVariantId] = useState<string>('');
  const [reviseOpen, setReviseOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');

  const accept = useMutation({
    mutationFn: () =>
      api<{ id: string }>(`/retailer/ai-catalog/${id}/accept`, {
        method: 'POST',
        body: { targetVariantId: targetVariantId || data?.targetVariantId || undefined },
      }),
    onSuccess: () => {
      toast.success('Accepted — output attached.');
      qc.invalidateQueries({ queryKey: ['retailer', 'ai-catalog'] });
      qc.invalidateQueries({ queryKey: ['retailer', 'listing', data?.listingId] });
      navigate('/retailer/ai-catalog');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Accept failed'),
  });

  const reject = useMutation({
    mutationFn: () =>
      api<{ id: string }>(`/retailer/ai-catalog/${id}/reject`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Submission rejected.');
      qc.invalidateQueries({ queryKey: ['retailer', 'ai-catalog'] });
      navigate('/retailer/ai-catalog');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Reject failed'),
  });

  const regenerate = useMutation({
    mutationFn: () =>
      api<AiSubmission>(`/retailer/ai-catalog/${id}/regenerate`, {
        method: 'POST',
        body: { revisionNotes: revisionNotes.trim() },
      }),
    onSuccess: (child) => {
      setReviseOpen(false);
      setRevisionNotes('');
      toast.success('Revision generated.');
      qc.invalidateQueries({ queryKey: ['retailer', 'ai-catalog'] });
      navigate(`/retailer/ai-catalog/${child.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Regenerate failed'),
  });

  if (submission.isLoading || !data)
    return (
      <Page>
        <Skeleton className="h-72" />
      </Page>
    );

  const isRevision = Boolean(data.parentSubmissionId);
  const canRegenerate =
    !isRevision &&
    data.status === 'ready_for_review' &&
    !data.childSubmissionId;
  const output = data.outputUrls[0];

  return (
    <Page>
      <PageHeader
        kicker="AI Catalog"
        title={
          data.listingId
            ? `Listing ${data.listingId.slice(-6)}${isRevision ? ' · revision' : ''}`
            : 'Submission review'
        }
        description={`${data.referenceImageUrls.length} reference${data.referenceImageUrls.length === 1 ? '' : 's'} · ${data.mode === 'with_model' ? 'With model' : 'Without model'}`}
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/retailer/ai-catalog">Back</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge
          tone={
            data.status === 'ready_for_review'
              ? 'warning'
              : data.status === 'accepted'
                ? 'success'
                : data.status === 'failed'
                  ? 'danger'
                  : data.status === 'processing'
                    ? 'info'
                    : 'neutral'
          }
        >
          {data.status.replace(/_/g, ' ')}
        </Badge>
        {isRevision && (
          <Badge tone="info" flat>
            Revision of {data.parentSubmissionId?.slice(-6)}
          </Badge>
        )}
        {data.childSubmissionId && (
          <Link
            to={`/retailer/ai-catalog/${data.childSubmissionId}`}
            className="text-[12px] text-accent hover:underline"
          >
            Open revision #{data.childSubmissionId.slice(-6)} →
          </Link>
        )}
      </div>

      {data.status === 'failed' && (
        <Card className="mb-4 border-danger/40 bg-danger-soft">
          <CardContent className="p-4">
            <div className="flex items-start gap-2 text-danger">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <div className="flex-1 text-[13px]">
                <div className="font-semibold">Generation failed.</div>
                <div className="mt-0.5 text-[12.5px] opacity-90">
                  {data.errorMessage ?? 'The AI provider returned an error.'}
                </div>
                {data.listingId && (
                  <div className="mt-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/retailer/ai-catalog/new?listingId=${data.listingId}`}>
                        Submit new attempt
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <SectionHeading
                kicker="References"
                title={`${data.referenceImageUrls.length} image${data.referenceImageUrls.length === 1 ? '' : 's'}`}
              />
              <div className="grid grid-cols-2 gap-2">
                {data.referenceImageUrls.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className="aspect-[3/4] overflow-hidden rounded-md border border-line bg-bg-2"
                  >
                    <img src={url} alt={`ref ${i + 1}`} className="size-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Prompt</Label>
              <div className="rounded-md border border-line bg-bg-2/40 p-3 text-[12.5px] text-ink-2 whitespace-pre-wrap">
                {data.prompt || <span className="italic text-ink-4">No prompt recorded.</span>}
              </div>
            </div>

            {data.revisionNotes && (
              <div>
                <Label>Revision notes</Label>
                <div className="rounded-md border border-info/40 bg-info-soft p-3 text-[12.5px] text-ink-2 whitespace-pre-wrap">
                  {data.revisionNotes}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Output" title="The image Gemini generated" />
            {data.status === 'processing' ? (
              <div className="grid h-72 place-items-center rounded-md border border-line bg-bg-2/30">
                <div className="flex flex-col items-center gap-2 text-ink-3">
                  <Sparkles className="size-5 animate-pulse" />
                  <span className="text-[12.5px]">Generating… polling every 2 s</span>
                </div>
              </div>
            ) : output ? (
              <div className="aspect-[3/4] max-w-md overflow-hidden rounded-md border border-line bg-bg-2">
                <img src={output} alt="output" className="size-full object-cover" />
              </div>
            ) : (
              <div className="rounded-md border border-line bg-bg-2/30 p-4 text-[12.5px] text-ink-3 italic">
                No output image available.
              </div>
            )}

            {data.status === 'ready_for_review' && output && (
              <div className="mt-6 space-y-3">
                <div>
                  <Label>Attach to</Label>
                  <Select
                    value={targetVariantId || data.targetVariantId || 'gallery'}
                    onValueChange={(v) => setTargetVariantId(v === 'gallery' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Listing gallery" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gallery">Listing gallery (no specific variant)</SelectItem>
                      {(listing.data?.variants ?? []).map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          Variant — {v.attributesLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="accent"
                    iconLeft={<Check className="size-3.5" />}
                    loading={accept.isPending}
                    onClick={() => accept.mutate()}
                  >
                    Accept &amp; attach
                  </Button>
                  {canRegenerate && (
                    <Button
                      variant="outline"
                      iconLeft={<RefreshCw className="size-3.5" />}
                      onClick={() => setReviseOpen(true)}
                    >
                      Regenerate once
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    iconLeft={<X className="size-3.5" />}
                    className="text-danger border-danger/40 hover:bg-danger/5"
                    loading={reject.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Reject this output? This consumes one of your per-listing attempts.',
                        )
                      ) {
                        reject.mutate();
                      }
                    }}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={reviseOpen} onOpenChange={setReviseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate with revisions</DialogTitle>
            <DialogDescription>
              Describe what to change. Gemini receives the same prompt and references with these
              notes appended. You only get one revision per attempt.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            placeholder="e.g. 'use a warmer lighting tone and centre the model in the frame'"
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
          />
          <div className="text-[11px] text-ink-4">{revisionNotes.trim().length} / 400 chars (min 4)</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReviseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              loading={regenerate.isPending}
              disabled={revisionNotes.trim().length < 4}
              onClick={() => regenerate.mutate()}
            >
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
