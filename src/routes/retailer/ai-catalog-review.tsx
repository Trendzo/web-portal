import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, Sparkles, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { AiSubmission } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function RetailerAiCatalogReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'ai-catalog', id],
    queryFn: () => api<AiSubmission>(`/retailer/ai-catalog/${id}`),
    enabled: Boolean(id),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const accept = useMutation({
    mutationFn: (selectedUrls: string[]) =>
      api(`/retailer/ai-catalog/${id}/accept`, {
        method: 'POST',
        body: JSON.stringify({ selectedUrls, listingId: data?.listingId ?? undefined }),
      }),
    onSuccess: () => {
      toast.success('Accepted — selected outputs attached to listing gallery.');
      qc.invalidateQueries({ queryKey: ['retailer', 'ai-catalog'] });
      navigate('/retailer/ai-catalog');
    },
  });

  const reject = useMutation({
    mutationFn: () =>
      api(`/retailer/ai-catalog/${id}/reject`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Submission rejected.');
      qc.invalidateQueries({ queryKey: ['retailer', 'ai-catalog'] });
      navigate('/retailer/ai-catalog');
    },
  });

  if (isLoading) return <Page><Skeleton className="h-72" /></Page>;
  if (!data) return <Page><PageHeader title="Submission not found" /></Page>;

  const toggle = (url: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(url)) next.delete(url);
    else next.add(url);
    return next;
  });

  return (
    <Page>
      <PageHeader
        kicker="AI Catalog"
        title={data.listingId ? `Listing ${data.listingId.slice(-6)}` : 'Submission review'}
        description={`${data.rawPhotos.length} input${data.rawPhotos.length === 1 ? '' : 's'} · ${data.mode === 'with_model' ? 'With model' : 'Without model'}`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
              <Link to="/retailer/ai-catalog">Back</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={data.status === 'ready_for_review' ? 'warning' : 'neutral'}>{data.status.replace(/_/g, ' ')}</Badge>
        <span className="text-[12px] text-ink-3">{selected.size} of {data.outputUrls.length} selected</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Inputs" title={`${data.rawPhotos.length} photo${data.rawPhotos.length === 1 ? '' : 's'}`} />
            <div className="grid grid-cols-2 gap-2">
              {data.rawPhotos.map((url, i) => (
                <div key={i} className="aspect-[3/4] overflow-hidden rounded-md border border-line bg-bg-2">
                  <img src={url} alt={`input ${i + 1}`} className="size-full object-cover" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Outputs" title="Pick the shots to keep" />
            {data.outputUrls.length === 0 ? (
              <div className="rounded-md border border-line bg-bg-2/30 p-4 text-[12.5px] text-ink-3 italic">No outputs yet — check back when processing completes.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.outputUrls.map((url, i) => {
                  const on = selected.has(url);
                  return (
                    <button
                      key={url}
                      type="button"
                      onClick={() => toggle(url)}
                      className={
                        'group relative aspect-[3/4] overflow-hidden rounded-md border-2 transition ' +
                        (on ? 'border-accent shadow-md' : 'border-line hover:border-line-strong')
                      }
                    >
                      <img src={url} alt={`output ${i + 1}`} className="size-full object-cover" />
                      {on && (
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-end bg-black/60 px-2 py-1">
                          <Check className="size-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {data.status === 'ready_for_review' && (
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  variant="accent"
                  iconLeft={<Sparkles className="size-3.5" />}
                  disabled={selected.size === 0}
                  loading={accept.isPending}
                  onClick={() => accept.mutate([...selected])}
                >
                  Attach selected to gallery
                </Button>
                <Button
                  variant="outline"
                  iconLeft={<X className="size-3.5" />}
                  className="text-danger border-danger/40 hover:bg-danger/5"
                  loading={reject.isPending}
                  onClick={() => reject.mutate()}
                >
                  Reject all
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
