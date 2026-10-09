import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, CheckCircle2, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { CmsPublishStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCmsStatus, pendingCount } from './use-cms-status';

/**
 * The always-visible publish control. Lives in the page header, so from any tab the operator
 * sees how many unpublished changes exist and can publish without hunting for the Publish tab.
 * The dialog is a focused summary — a full preview / version history still lives on that tab.
 */
export function QuickPublish({
  canPublish,
  labelFor,
  onOpenFullView,
}: {
  canPublish: boolean;
  labelFor: (sectionKey: string) => string;
  onOpenFullView: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const qc = useQueryClient();
  const status = useCmsStatus();
  const pending = pendingCount(status.data);

  const publish = useMutation({
    mutationFn: () =>
      api<{ version: number | null; itemCount: number }>('/admin/cms/publish', {
        method: 'POST',
        body: note.trim() ? { note: note.trim() } : {},
      }),
    onSuccess: (r) => {
      toast.success(`Published v${r.version} — ${r.itemCount} items live`);
      setNote('');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['admin', 'cms'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Publish failed'),
  });

  const hasChanges = status.data?.hasChanges ?? false;

  return (
    <>
      <Button
        variant={pending > 0 ? 'solid' : 'outline'}
        size="sm"
        iconLeft={<Rocket className="size-3.5" />}
        onClick={() => setOpen(true)}
      >
        Publish
        {pending > 0 && (
          <span className="ml-1.5 inline-grid min-w-5 place-items-center rounded-full bg-white/20 px-1.5 text-[11px] font-semibold tabular-nums">
            {pending > 99 ? '99+' : pending}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Publish home content</DialogTitle>
            <DialogDescription>
              {status.data?.liveVersion != null ? (
                <>
                  Live now: <strong className="text-ink">v{status.data.liveVersion}</strong>
                  {status.data.livePublishedAt
                    ? ` · ${new Date(status.data.livePublishedAt).toLocaleString()}`
                    : ''}
                </>
              ) : (
                'Nothing has been published yet — the app is showing its bundled content.'
              )}
            </DialogDescription>
          </DialogHeader>

          {status.isLoading ? (
            <p className="py-6 text-center text-[13px] text-ink-3">Checking what changed…</p>
          ) : !hasChanges ? (
            <div className="flex items-center gap-2 rounded-md border border-success/20 bg-success-soft px-3 py-4 text-[13px] text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              Everything is published. Nothing to push.
            </div>
          ) : (
            <ChangeSummary status={status.data!} labelFor={labelFor} />
          )}

          <div>
            <Label htmlFor="quick-cms-note">Note (optional)</Label>
            <Input
              id="quick-cms-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Diwali campaign"
              disabled={!canPublish || !hasChanges}
            />
          </div>

          <DialogFooter className="items-center justify-between gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink"
              onClick={() => {
                setOpen(false);
                onOpenFullView();
              }}
            >
              Preview &amp; version history <ArrowUpRight className="size-3.5" />
            </button>
            <Button
              variant="solid"
              iconLeft={<Rocket className="size-3.5" />}
              loading={publish.isPending}
              disabled={!canPublish || !hasChanges}
              onClick={() => publish.mutate()}
            >
              Publish
              {status.data?.liveVersion != null ? ` v${status.data.liveVersion + 1}` : ''}
            </Button>
          </DialogFooter>

          {!canPublish && (
            <p className="text-[11.5px] text-ink-3">
              You can edit the draft, but publishing needs the <code>cms.publish</code> permission.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChangeSummary({
  status,
  labelFor,
}: {
  status: CmsPublishStatus;
  labelFor: (sectionKey: string) => string;
}) {
  const t = status.totals;
  const rows = Object.entries(status.sections)
    .filter(([, s]) => s.changed || s.counts.new + s.counts.changed + s.counts.removed > 0)
    .map(([key, s]) => ({ key, ...s }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {t.new > 0 && <Badge tone="info" flat>{t.new} new</Badge>}
        {t.changed > 0 && <Badge tone="warning" flat>{t.changed} edited</Badge>}
        {t.removed > 0 && <Badge tone="danger" flat>{t.removed} removed</Badge>}
        {t.sectionsChanged > 0 && (
          <Badge tone="neutral" flat>
            {t.sectionsChanged} section{t.sectionsChanged === 1 ? '' : 's'} edited
          </Badge>
        )}
      </div>

      <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-line p-1.5">
        {rows.map((s) => (
          <li
            key={s.key}
            className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-[12.5px]"
          >
            <span className="truncate text-ink">{labelFor(s.key)}</span>
            <span className="flex shrink-0 gap-1">
              {s.counts.new > 0 && <Badge tone="info" flat>+{s.counts.new}</Badge>}
              {s.counts.changed > 0 && <Badge tone="warning" flat>~{s.counts.changed}</Badge>}
              {s.counts.removed > 0 && <Badge tone="danger" flat>−{s.counts.removed}</Badge>}
              {s.changed && s.counts.new + s.counts.changed === 0 && (
                <Badge tone="warning" flat>edited</Badge>
              )}
            </span>
          </li>
        ))}
        {status.removedSections.map((key) => (
          <li key={key} className="flex items-center justify-between px-2 py-1.5 text-[12.5px]">
            <span className="truncate text-ink-3">{labelFor(key)}</span>
            <Badge tone="danger" flat>section removed</Badge>
          </li>
        ))}
      </ul>

      <p className="text-[11.5px] text-ink-3">
        Publishing freezes the current draft into a new version and serves it to every app.
        Scheduled items still honour their own dates.
      </p>
    </div>
  );
}
