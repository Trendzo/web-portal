import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Heart, MessageCircle, Bookmark, Eye, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { AdminReelRow, AdminReelDetail, ReelStatus } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CopyableId } from '@/components/ui/copyable-id';
import { Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import type { Tone } from '@/lib/status';

const STATUS_TONE: Record<ReelStatus, Tone> = {
  active: 'success',
  taken_down: 'danger',
  hidden_pending_review: 'warning',
};

/** A takedown target — either the reel itself or one of its comments. */
type TakedownTarget =
  | { kind: 'reel'; reelId: string; label: string }
  | { kind: 'comment'; reelId: string; commentId: string; label: string };

export default function AdminReels() {
  const active = useReels('active');
  const pending = useReels('hidden_pending_review');
  const takenDown = useReels('taken_down');

  const [detailId, setDetailId] = useState<string | null>(null);
  const [takedown, setTakedown] = useState<TakedownTarget | null>(null);

  return (
    <Page>
      <PageHeader
        kicker="Community"
        title="Reels"
        description="Consumer-posted product videos. Review, take down policy-breaking reels or comments, and restore on appeal."
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="hidden_pending_review">Pending review</TabsTrigger>
          <TabsTrigger value="taken_down">Taken down</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <ReelList q={active} onReview={setDetailId} onTakedown={setTakedown} />
        </TabsContent>
        <TabsContent value="hidden_pending_review">
          <ReelList q={pending} onReview={setDetailId} onTakedown={setTakedown} />
        </TabsContent>
        <TabsContent value="taken_down">
          <ReelList q={takenDown} onReview={setDetailId} onTakedown={setTakedown} />
        </TabsContent>
      </Tabs>

      {detailId && (
        <ReelDetailDialog
          reelId={detailId}
          onClose={() => setDetailId(null)}
          onTakedown={setTakedown}
        />
      )}

      {takedown && <TakedownDialog target={takedown} onClose={() => setTakedown(null)} />}
    </Page>
  );
}

function useReels(status: ReelStatus) {
  return useQuery({
    queryKey: ['admin', 'reels', status],
    queryFn: () => api<AdminReelRow[]>(`/admin/reels?status=${status}`),
  });
}

function ReelList({
  q,
  onReview,
  onTakedown,
}: {
  q: ReturnType<typeof useReels>;
  onReview: (id: string) => void;
  onTakedown: (t: TakedownTarget) => void;
}) {
  if (q.isLoading)
    return <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-24" />)}</div>;
  const list = q.data ?? [];
  if (list.length === 0) return <Empty kicker="All clear" title="No reels in this state." />;

  return (
    <ul className="space-y-2">
      {list.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex flex-wrap items-start gap-3 p-4">
            <img
              src={r.thumbnailUrl}
              alt=""
              className="h-24 w-16 shrink-0 rounded-md object-cover bg-surface-2"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CopyableId value={r.id} label="reel" />
                <Badge tone={STATUS_TONE[r.status]} flat>
                  {r.status.replace(/_/g, ' ')}
                </Badge>
                <span className="text-[12px] text-ink-3">by {r.authorName ?? r.consumerId.slice(0, 12)}</span>
              </div>
              {r.caption && <p className="mt-1 line-clamp-2 text-[13px] text-ink-2">{r.caption}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-ink-3">
                <Stat icon={<Heart className="size-3.5" />} n={r.likeCount} />
                <Stat icon={<MessageCircle className="size-3.5" />} n={r.commentCount} />
                <Stat icon={<Bookmark className="size-3.5" />} n={r.saveCount} />
                <Stat icon={<Eye className="size-3.5" />} n={r.viewCount} />
                <span>· {formatAge(r.createdAt)}</span>
              </div>
              {r.status === 'taken_down' && r.takedownReason && (
                <p className="mt-1 flex items-center gap-1 text-[12px] text-danger">
                  <AlertTriangle className="size-3.5" /> {r.takedownReason}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Button variant="outline" size="sm" onClick={() => onReview(r.id)}>
                Review
              </Button>
              {r.status === 'taken_down' ? (
                <RestoreReelButton reelId={r.id} />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onTakedown({ kind: 'reel', reelId: r.id, label: r.caption || 'this reel' })
                  }
                >
                  Take down
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </ul>
  );
}

function Stat({ icon, n }: { icon: React.ReactNode; n: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {icon}
      {n}
    </span>
  );
}

function RestoreReelButton({ reelId }: { reelId: string }) {
  const qc = useQueryClient();
  const restore = useMutation({
    mutationFn: () => api(`/admin/reels/${reelId}/restore`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Reel restored');
      void qc.invalidateQueries({ queryKey: ['admin', 'reels'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'reel', reelId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Restore failed'),
  });
  return (
    <Button variant="outline" size="sm" onClick={() => restore.mutate()} disabled={restore.isPending}>
      Restore
    </Button>
  );
}

function ReelDetailDialog({
  reelId,
  onClose,
  onTakedown,
}: {
  reelId: string;
  onClose: () => void;
  onTakedown: (t: TakedownTarget) => void;
}) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ['admin', 'reel', reelId],
    queryFn: () => api<AdminReelDetail>(`/admin/reels/${reelId}`),
  });

  const restoreComment = useMutation({
    mutationFn: (commentId: string) =>
      api(`/admin/reels/${reelId}/comments/${commentId}/restore`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Comment restored');
      void qc.invalidateQueries({ queryKey: ['admin', 'reel', reelId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Restore failed'),
  });

  const r = detail.data;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Reel review</DialogTitle>
          <DialogDescription>
            {r ? `by ${r.authorName ?? r.consumerId.slice(0, 12)} · ${formatAge(r.createdAt)}` : 'Loading…'}
          </DialogDescription>
        </DialogHeader>

        {detail.isLoading && <Skeleton className="h-64" />}
        {r && (
          <div className="grid gap-4 sm:grid-cols-[240px_1fr]">
            <video
              src={r.videoUrl}
              poster={r.thumbnailUrl}
              controls
              className="w-full rounded-md bg-black"
            />
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[r.status]} flat>
                  {r.status.replace(/_/g, ' ')}
                </Badge>
                {r.product && <Badge tone="info" flat>{r.product.name}</Badge>}
                {r.durationSec != null && (
                  <span className="text-[12px] text-ink-3">{r.durationSec}s</span>
                )}
              </div>
              {r.caption && <p className="text-[13px] text-ink-2">{r.caption}</p>}
              <div className="flex flex-wrap gap-3 text-[12px] text-ink-3">
                <Stat icon={<Heart className="size-3.5" />} n={r.likeCount} />
                <Stat icon={<MessageCircle className="size-3.5" />} n={r.commentCount} />
                <Stat icon={<Bookmark className="size-3.5" />} n={r.saveCount} />
                <Stat icon={<Eye className="size-3.5" />} n={r.viewCount} />
              </div>
              {r.status !== 'taken_down' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onTakedown({ kind: 'reel', reelId: r.id, label: r.caption || 'this reel' })}
                >
                  Take down reel
                </Button>
              ) : (
                <RestoreReelButton reelId={r.id} />
              )}

              <div className="border-t border-line pt-3">
                <p className="mb-2 text-[12px] font-medium text-ink-2">
                  Comments ({r.comments.length})
                </p>
                {r.comments.length === 0 && <p className="text-[12px] text-ink-3">No comments.</p>}
                <ul className="space-y-2">
                  {r.comments.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-2 text-[12.5px]">
                      <div className="min-w-0">
                        <span className="text-ink-3">{c.authorName ?? c.consumerId.slice(0, 8)}: </span>
                        <span className={c.status === 'taken_down' ? 'text-ink-3 line-through' : 'text-ink-2'}>
                          {c.body}
                        </span>
                      </div>
                      {c.status === 'taken_down' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => restoreComment.mutate(c.id)}
                          disabled={restoreComment.isPending}
                        >
                          Restore
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onTakedown({
                              kind: 'comment',
                              reelId: r.id,
                              commentId: c.id,
                              label: c.body,
                            })
                          }
                        >
                          Take down
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TakedownDialog({ target, onClose }: { target: TakedownTarget; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const url =
    target.kind === 'reel'
      ? `/admin/reels/${target.reelId}/takedown`
      : `/admin/reels/${target.reelId}/comments/${target.commentId}/takedown`;

  const mut = useMutation({
    mutationFn: () => api(url, { method: 'POST', body: { reason: reason.trim() } }),
    onSuccess: () => {
      toast.success(target.kind === 'reel' ? 'Reel taken down' : 'Comment taken down');
      void qc.invalidateQueries({ queryKey: ['admin', 'reels'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'reel', target.reelId] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Takedown failed'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Take down {target.kind === 'reel' ? 'reel' : 'comment'}</DialogTitle>
          <DialogDescription className="line-clamp-2">“{target.label}”</DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          rows={3}
          placeholder="Reason (shown in the audit log; min 3 characters)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="danger"
            onClick={() => mut.mutate()}
            disabled={reason.trim().length < 3 || mut.isPending}
          >
            Take down
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
