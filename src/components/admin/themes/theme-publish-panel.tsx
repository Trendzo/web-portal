import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { History, Rocket, RotateCcw } from 'lucide-react';
import { api, ApiError, apiValidated } from '@/lib/api';
import { ThemeDraftListSchema, ThemePublicationListSchema } from '@/lib/schemas';
import { contrastRatio, AA_TEXT } from '@/lib/contrast';
import { deriveThemeStatus, themeStatusMeta } from '@/lib/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { TypeConfirmDialog } from '@/components/admin/type-confirm-dialog';

/**
 * Going live, and seeing exactly what that means first.
 *
 * Editing themes changes drafts nobody's phone can see. This tab is the one place a change
 * reaches devices: publishing snapshots ALL enabled themes into a new live set that phones
 * resolve against. The roster above the button is the full manifest of that snapshot — every
 * theme, whether it is enabled, where it is in its window, and any contrast pair the server's
 * publish gate would reject. The warnings here are advisory (same WCAG math as the backend),
 * but the server is authoritative: a blocked publish comes back as a 422 with per-slug
 * failures, rendered below the button.
 */
export function ThemePublishPanel({ canPublish }: { canPublish: boolean }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blocked, setBlocked] = useState<string[] | null>(null);

  const themes = useQuery({
    queryKey: ['admin', 'themes', 'list'],
    queryFn: () => apiValidated('/admin/cms/themes', ThemeDraftListSchema),
  });

  const publications = useQuery({
    queryKey: ['admin', 'themes', 'publications'],
    queryFn: () => apiValidated('/admin/cms/themes/publications', ThemePublicationListSchema),
  });

  const publish = useMutation({
    mutationFn: () =>
      api<{ version: number | null }>('/admin/cms/themes/publish', {
        method: 'POST',
        body: note.trim() ? { note: note.trim() } : {},
      }),
    onSuccess: (r) => {
      toast.success(`Published v${r.version} — phones pick it up on their next refresh`);
      setNote('');
      setBlocked(null);
      setConfirmOpen(false);
      void qc.invalidateQueries({ queryKey: ['admin', 'themes'] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) {
        const d = e.details as { failures?: unknown } | null | undefined;
        if (d && typeof d === 'object' && Array.isArray(d.failures)) {
          setBlocked(d.failures.map(formatFailure));
        }
      }
      setConfirmOpen(false);
      toast.error(e instanceof ApiError ? e.message : 'Publish failed');
    },
  });

  const restore = useMutation({
    mutationFn: (version: number) =>
      api<{ restoredVersion: number }>(`/admin/cms/themes/publications/${version}/restore`, {
        method: 'POST',
      }),
    onSuccess: (_r, version) => {
      toast.success(`Restored v${version} into the draft — publish to make it live`);
      void qc.invalidateQueries({ queryKey: ['admin', 'themes'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Restore failed'),
  });

  const roster = themes.data ?? [];
  const enabled = roster.filter((t) => t.isEnabled);
  const failuresBySlug = new Map(enabled.map((t) => [t.slug, contrastFailures(t)]));
  const warningCount = [...failuresBySlug.values()].reduce((n, f) => n + f.length, 0);
  const live = publications.data?.[0] ?? null;

  return (
    <div className="space-y-6">
      {/* ── Roster ── */}
      <section className="space-y-3">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">What this publish snapshots</h3>
          <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-3">
            Every enabled theme below is frozen into the live set, windows and all — a theme
            outside its window ships in the snapshot but stays dormant until its start date.
            Disabled themes are left out entirely. Contrast warnings mirror the server&apos;s
            publish gate; the server has the final say.
          </p>
        </div>
        {themes.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : roster.length === 0 ? (
          <p className="text-[13px] text-ink-3">No themes yet — publishing would ship an empty set.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead className="border-b border-line bg-bg-2 text-ink-3">
                <tr>
                  <th className="px-3 py-2 font-medium">Theme</th>
                  <th className="px-3 py-2 font-medium">Enabled</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Window</th>
                  <th className="px-3 py-2 font-medium">Contrast</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {roster.map((t) => {
                  const status = themeStatusMeta(
                    deriveThemeStatus({
                      isEnabled: t.isEnabled,
                      startsAt: t.startsAt,
                      endsAt: t.endsAt,
                      ...(t.inLatestPublication !== undefined
                        ? { inLatestPublication: t.inLatestPublication }
                        : {}),
                    }),
                  );
                  const failures = failuresBySlug.get(t.slug);
                  return (
                    <tr key={t.id}>
                      <td className="max-w-[220px] px-3 py-2">
                        <div className="truncate text-ink">{t.name}</div>
                        <div className="truncate font-mono text-[11px] text-ink-3">{t.slug}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={t.isEnabled ? 'success' : 'neutral'} flat>
                          {t.isEnabled ? 'On' : 'Off'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={status.tone} flat>
                          {status.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-ink-3">{formatWindow(t)}</td>
                      <td className="px-3 py-2">
                        {!t.isEnabled ? (
                          <span className="text-ink-3">—</span>
                        ) : !failures || failures.length === 0 ? (
                          <span className="text-ink-3">passes AA</span>
                        ) : (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            {failures.map((f) => (
                              <span key={f.label} className="whitespace-nowrap text-[11.5px] text-danger">
                                {f.label} {f.ratio.toFixed(1)}:1
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Publish ── */}
      <section className="rounded-md border border-line p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-ink">Publish</h3>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-3">
              Freezes the {enabled.length} enabled theme{enabled.length === 1 ? '' : 's'} above
              into a new version and serves that set to every phone. Draft edits after this stay
              invisible until the next publish.
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
              <Label htmlFor="themes-note">Note (optional)</Label>
              <Input
                id="themes-note"
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
              onClick={() => setConfirmOpen(true)}
            >
              Publish themes
            </Button>
          </div>
        </div>

        {blocked && (
          <div className="mt-4 rounded-md border border-danger/30 bg-danger-soft/40 p-3">
            <p className="text-[13px] font-semibold text-danger">Publish blocked by the server</p>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Nothing was published. Fix the failures below and publish again.
            </p>
            <ul className="mt-2 space-y-1">
              {blocked.map((b, i) => (
                <li key={i} className="font-mono text-[11.5px] text-danger">
                  {b}
                </li>
              ))}
            </ul>
          </div>
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
          <p className="text-[13px] text-ink-3">Nothing published yet — phones are on the app&apos;s default look.</p>
        ) : (
          <ul className="divide-y divide-rule rounded-md border border-line">
            {(publications.data ?? []).map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-16 font-mono text-[12px] text-ink">v{p.version}</span>
                {i === 0 && (
                  <Badge tone="success" flat>
                    live
                  </Badge>
                )}
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

      <TypeConfirmDialog
        open={confirmOpen}
        title="Publish all enabled themes"
        description={`Snapshots all ${enabled.length} enabled themes as the live set phones resolve against. Themes outside their window stay dormant until their start date. ${warningCount} contrast warnings below would be rejected by the server.`}
        confirmText="PUBLISH"
        confirmLabel="Publish themes"
        requireReason={false}
        loading={publish.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => publish.mutate()}
      />
    </div>
  );
}

type ContrastFailure = { label: string; ratio: number };

/** Structural — both the exact-optional ThemeDraft and the zod-parsed row satisfy it. */
type ContrastSource = {
  tokens: { accent?: string | undefined; accentInk?: string | undefined };
  chrome: {
    header: {
      color?: string | undefined;
      ink?: string | undefined;
      gradient?: [string, string] | undefined;
    };
  };
};

/**
 * The same pairs the server's publish gate checks, with the shared WCAG math from
 * '@/lib/contrast' so numbers here match the 422 failures exactly. Advisory only —
 * failing pairs never disable the button.
 */
function contrastFailures(t: ContrastSource): ContrastFailure[] {
  const out: ContrastFailure[] = [];
  const check = (label: string, fg: string | undefined, bg: string | undefined) => {
    if (!fg || !bg) return;
    const ratio = contrastRatio(fg, bg);
    if (ratio !== null && ratio < AA_TEXT) out.push({ label, ratio });
  };
  check('accentInk on accent', t.tokens.accentInk, t.tokens.accent);
  const header = t.chrome.header;
  check('header ink on color', header.ink, header.color);
  if (header.gradient) {
    check('header ink on gradient start', header.ink, header.gradient[0]);
    check('header ink on gradient end', header.ink, header.gradient[1]);
  }
  return out;
}

function formatWindow(t: { startsAt: string | null; endsAt: string | null }): string {
  if (!t.startsAt && !t.endsAt) return 'Always on';
  const from = t.startsAt ? new Date(t.startsAt).toLocaleString() : 'always';
  const to = t.endsAt ? new Date(t.endsAt).toLocaleString() : 'no end';
  return `${from} → ${to}`;
}

/** 422 details are server-owned; render defensively rather than trusting the shape. */
function formatFailure(f: unknown): string {
  if (
    f &&
    typeof f === 'object' &&
    typeof (f as { slug?: unknown }).slug === 'string' &&
    typeof (f as { message?: unknown }).message === 'string'
  ) {
    const { slug, field, message } = f as { slug: string; field?: unknown; message: string };
    return typeof field === 'string' && field ? `${slug} — ${field}: ${message}` : `${slug} — ${message}`;
  }
  return String(JSON.stringify(f)).slice(0, 160);
}
