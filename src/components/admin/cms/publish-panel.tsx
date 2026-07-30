import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { History, Rocket, RotateCcw } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { CmsPreview, CmsPublication } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Going live, and seeing exactly what that means first.
 *
 * Editing the CMS changes a draft nobody can see. This tab is the one place where a change
 * reaches customers, so it shows both sides before the button: `draft` is what publishing would
 * ship, `published` is what phones are receiving right now. The difference between them is the
 * pending change set.
 *
 * The preview is the REAL response shape, filtered by the rail and city you pick — the same
 * function the public endpoint runs — rather than a mock-up of it. A campaign dated for next
 * week correctly shows as absent today.
 */
export function PublishPanel({ canPublish }: { canPublish: boolean }) {
  const qc = useQueryClient();
  const [rail, setRail] = useState<'her' | 'him'>('her');
  const [source, setSource] = useState<'draft' | 'published'>('draft');
  const [city, setCity] = useState('');
  const [note, setNote] = useState('');

  const preview = useQuery({
    queryKey: ['admin', 'cms', 'preview', source, rail, city],
    queryFn: () => {
      const p = new URLSearchParams({ gender: rail, source });
      if (city.trim()) p.set('city', city.trim());
      return api<CmsPreview>(`/admin/cms/preview?${p.toString()}`);
    },
  });

  const publications = useQuery({
    queryKey: ['admin', 'cms', 'publications'],
    queryFn: () => api<CmsPublication[]>('/admin/cms/publications'),
  });

  const publish = useMutation({
    mutationFn: () =>
      api<{ version: number | null; sectionCount: number; itemCount: number }>('/admin/cms/publish', {
        method: 'POST',
        body: note.trim() ? { note: note.trim() } : {},
      }),
    onSuccess: (r) => {
      toast.success(`Published v${r.version} — ${r.itemCount} items live`);
      setNote('');
      void qc.invalidateQueries({ queryKey: ['admin', 'cms'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Publish failed'),
  });

  const restore = useMutation({
    mutationFn: (version: number) =>
      api<{ restoredVersion: number }>(`/admin/cms/publications/${version}/restore`, {
        method: 'POST',
      }),
    onSuccess: (r) => {
      toast.success(`Draft restored from v${r.restoredVersion} — publish to make it live`);
      void qc.invalidateQueries({ queryKey: ['admin', 'cms'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Restore failed'),
  });

  const live = publications.data?.[0] ?? null;
  const sections = preview.data?.sections ?? [];
  const itemCount = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="space-y-6">
      {/* ── Publish ── */}
      <section className="rounded-md border border-line p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-ink">Publish</h3>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-3">
              Everything you have edited so far is a draft that customers cannot see. Publishing
              freezes it into a new version and serves that to every app. Scheduled items still
              honour their own dates afterwards.
            </p>
            {live && (
              <p className="mt-2 text-[12px] text-ink-3">
                Live now: <strong className="text-ink">v{live.version}</strong> ·{' '}
                {new Date(live.publishedAt).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-end gap-2">
            <div>
              <Label htmlFor="cms-note">Note (optional)</Label>
              <Input
                id="cms-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Diwali campaign"
                className="w-56"
                disabled={!canPublish}
              />
            </div>
            <Button
              variant="solid"
              iconLeft={<Rocket className="size-3.5" />}
              loading={publish.isPending}
              disabled={!canPublish}
              onClick={() => publish.mutate()}
            >
              Publish
            </Button>
          </div>
        </div>
      </section>

      {/* ── Preview ── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-ink">Preview</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={source}
              onChange={setSource}
              options={[
                { value: 'draft' as const, label: 'Draft (unpublished)' },
                { value: 'published' as const, label: 'Live now' },
              ]}
            />
            <Segmented
              value={rail}
              onChange={setRail}
              options={[
                { value: 'her' as const, label: 'HER' },
                { value: 'him' as const, label: 'HIM' },
              ]}
            />
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City (optional)"
              className="w-40"
            />
          </div>
        </div>

        {preview.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <p className="text-[12.5px] text-ink-3">
              {sections.length} sections · {itemCount} items would render right now
              {city.trim() ? ` in ${city.trim()}` : ' with no city sent'}.
            </p>
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full min-w-[520px] text-left text-[12.5px]">
                <thead className="border-b border-line bg-bg-2 text-ink-3">
                  <tr>
                    <th className="px-3 py-2 font-medium">Section</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Heading</th>
                    <th className="px-3 py-2 font-medium">Items</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {sections.map((s) => (
                    <tr key={s.key}>
                      <td className="px-3 py-2 font-mono text-[11.5px] text-ink-2">{s.key}</td>
                      <td className="px-3 py-2 text-ink-3">{s.type}</td>
                      <td className="max-w-[220px] truncate px-3 py-2 text-ink">
                        {s.title ?? <span className="text-ink-3">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {s.items.length === 0 ? (
                          <Badge tone="warning" flat>
                            empty
                          </Badge>
                        ) : (
                          s.items.length
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="rounded-md border border-line">
              <summary className="cursor-pointer px-3 py-2 text-[12.5px] text-ink-2">
                Raw payload (exactly what the app receives)
              </summary>
              <pre className="max-h-96 overflow-auto border-t border-line bg-bg-2 p-3 text-[11px] leading-relaxed text-ink-2">
                {JSON.stringify(preview.data, null, 2)}
              </pre>
            </details>
          </>
        )}
      </section>

      {/* ── History ── */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <History className="size-4" /> Version history
        </h3>
        {publications.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (publications.data ?? []).length === 0 ? (
          <p className="text-[13px] text-ink-3">Nothing published yet — the app is rendering its own bundled content.</p>
        ) : (
          <ul className="divide-y divide-rule rounded-md border border-line">
            {(publications.data ?? []).map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-16 font-mono text-[12px] text-ink">v{p.version}</span>
                {i === 0 && <Badge tone="success" flat>live</Badge>}
                <span className="flex-1 truncate text-[12.5px] text-ink-3">
                  {p.note ?? <span className="italic">no note</span>}
                </span>
                <span className="shrink-0 text-[11.5px] text-ink-3">
                  {new Date(p.publishedAt).toLocaleString()}
                </span>
                {canPublish && i !== 0 && (
                  <Button
                    variant="ghost"
                    size="xs"
                    iconLeft={<RotateCcw className="size-3.5" />}
                    loading={restore.isPending}
                    onClick={() => restore.mutate(p.version)}
                  >
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11.5px] text-ink-3">
          Restoring copies an old version back over the draft. Nothing customers see changes until
          you publish again — which is deliberate, so a restore can be reviewed first.
        </p>
      </section>
    </div>
  );
}
