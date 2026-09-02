import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, Copy, Palette, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import type { z } from 'zod';
import { api, ApiError, apiValidated } from '@/lib/api';
import type { ThemeDraft, ThemePlatform } from '@/lib/types';
import { ThemeDraftListSchema, ThemePublicationListSchema } from '@/lib/schemas';
import { deriveThemeStatus, themeStatusMeta } from '@/lib/status';
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
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { TypeConfirmDialog } from '@/components/admin/type-confirm-dialog';
import { CreateThemeDialog } from './create-theme-dialog';

/**
 * Every festival theme at a glance — what is live, what is queued, and who each one
 * targets. Row actions stay shallow (edit / clone / delete); the one deep action is
 * the kill switch, which disables AND republishes in a single step so a broken theme
 * can be pulled without remembering a second publish.
 */

type ThemeRow = z.infer<typeof ThemeDraftListSchema>[number];

// Mirrors the backend validator (2-80 chars).
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;

/**
 * Zod-inferred rows type `inLatestPublication` as `boolean | undefined`, which
 * exactOptionalPropertyTypes rejects against `Pick<ThemeDraft, …>` — rebuild the
 * pick with the house conditional-spread style before handing it over.
 */
function statusOf(t: ThemeRow) {
  return deriveThemeStatus({
    isEnabled: t.isEnabled,
    startsAt: t.startsAt,
    endsAt: t.endsAt,
    ...(t.inLatestPublication === undefined ? {} : { inLatestPublication: t.inLatestPublication }),
  });
}

function platformLabel(platforms: ThemePlatform[] | null): string {
  if (!platforms || platforms.length !== 1) return 'Both';
  return platforms[0] === 'ios' ? 'iOS' : 'Android';
}

const chip =
  'inline-flex items-center rounded-full border border-line bg-bg-2 px-1.5 py-0.5 text-[11px] leading-none text-ink-2';

export function ThemeList({
  canEdit,
  canPublish,
  onOpen,
}: {
  canEdit: boolean;
  canPublish: boolean;
  onOpen: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<{ id: string; name: string } | null>(null);
  const [cloneSlug, setCloneSlug] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [disableTarget, setDisableTarget] = useState<{ id: string; name: string } | null>(null);

  const themesQ = useQuery({
    queryKey: ['admin', 'themes', 'list'],
    queryFn: () => apiValidated('/admin/cms/themes', ThemeDraftListSchema),
  });
  const pubsQ = useQuery({
    queryKey: ['admin', 'themes', 'publications'],
    queryFn: () => apiValidated('/admin/cms/themes/publications', ThemePublicationListSchema),
  });

  const clone = useMutation({
    mutationFn: (v: { id: string; slug: string; name: string }) =>
      api<ThemeDraft>(`/admin/cms/themes/${v.id}/clone`, {
        method: 'POST',
        body: { slug: v.slug, name: v.name },
      }),
    onSuccess: (row) => {
      toast.success(`Cloned into "${row.name}"`);
      void qc.invalidateQueries({ queryKey: ['admin', 'themes'] });
      setCloneTarget(null);
      onOpen(row.id);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Clone failed'),
  });

  const del = useMutation({
    mutationFn: (id: string) => api<unknown>(`/admin/cms/themes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Theme deleted');
      void qc.invalidateQueries({ queryKey: ['admin', 'themes'] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const disableNow = useMutation({
    mutationFn: (id: string) =>
      api<unknown>(`/admin/cms/themes/${id}/disable-now`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Theme disabled and republished');
      void qc.invalidateQueries({ queryKey: ['admin', 'themes'] });
      setDisableTarget(null);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Disable failed'),
  });

  const themes = themesQ.data ?? [];
  const latestPub = pubsQ.data?.[0] ?? null;

  const cloneSlugError =
    cloneSlug && !SLUG_RE.test(cloneSlug)
      ? 'Lowercase letters, digits and hyphens; must start with a letter or digit'
      : '';
  const cloneDisabled = !cloneName.trim() || !SLUG_RE.test(cloneSlug);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">Themes</h3>
          <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-3">
            Drafts here reach phones only after a publish. When several themes match the same
            customer, the highest priority wins.
          </p>
        </div>
        {canEdit && (
          <Button
            variant="solid"
            iconLeft={<Plus className="size-3.5" />}
            onClick={() => setCreateOpen(true)}
          >
            New theme
          </Button>
        )}
      </div>

      {themesQ.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : themes.length === 0 ? (
        <Empty
          icon={<Palette className="size-5" />}
          title="No themes yet"
          description="Reskin the app for a festival — colours, header, greeting — without an app release. Themes start as disabled drafts, so nothing reaches customers until you publish."
          {...(canEdit
            ? {
                action: (
                  <Button
                    variant="solid"
                    iconLeft={<Plus className="size-3.5" />}
                    onClick={() => setCreateOpen(true)}
                  >
                    New theme
                  </Button>
                ),
              }
            : {})}
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[880px] text-left text-[12.5px]">
            <thead className="border-b border-line bg-bg-2 text-ink-3">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Window</th>
                <th className="px-3 py-2 font-medium">Audience</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {themes.map((t) => {
                const status = statusOf(t);
                const meta = themeStatusMeta(status);
                const editedSincePublish =
                  t.inLatestPublication === true &&
                  latestPub !== null &&
                  new Date(t.updatedAt).getTime() > new Date(latestPub.publishedAt).getTime();
                return (
                  <tr key={t.id}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-ink">{t.name}</div>
                      <div className="font-mono text-[11px] text-ink-3">{t.slug}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={meta.tone} flat>
                        {meta.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {!t.startsAt && !t.endsAt ? (
                        <span className="text-ink-3">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-2">
                          <Clock className="size-3.5 shrink-0 text-ink-3" />
                          <span>
                            {t.startsAt ? new Date(t.startsAt).toLocaleString() : 'always'}
                            {' → '}
                            {t.endsAt ? new Date(t.endsAt).toLocaleString() : 'open'}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex max-w-[280px] flex-wrap items-center gap-1">
                        {t.cities === null ? (
                          <span className="text-ink-3">Everywhere</span>
                        ) : t.cities.length === 0 ? (
                          <Badge tone="warning" flat>
                            nowhere
                          </Badge>
                        ) : (
                          t.cities.map((c) => (
                            <span key={c} className={chip}>
                              {c}
                            </span>
                          ))
                        )}
                        <span className={chip}>{platformLabel(t.platforms)}</span>
                        {t.minAppVersion && (
                          <span className={`${chip} font-mono`}>&ge; {t.minAppVersion}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-ink-2">{t.priority}</td>
                    <td className="px-3 py-2.5">
                      <div className="whitespace-nowrap text-ink-3">
                        {new Date(t.updatedAt).toLocaleString()}
                      </div>
                      {editedSincePublish && (
                        <div className="mt-1">
                          <Badge tone="warning" flat>
                            edited since publish
                          </Badge>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          iconLeft={<Pencil className="size-3.5" />}
                          onClick={() => onOpen(t.id)}
                        >
                          Edit
                        </Button>
                        {canEdit && (
                          <>
                            <Button
                              variant="ghost"
                              size="xs"
                              iconLeft={<Copy className="size-3.5" />}
                              onClick={() => {
                                setCloneTarget({ id: t.id, name: t.name });
                                setCloneSlug(`${t.slug}-copy`);
                                setCloneName(`${t.name} copy`);
                              }}
                            >
                              Clone
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              className="text-danger hover:text-danger"
                              iconLeft={<Trash2 className="size-3.5" />}
                              onClick={() => setDeleteTarget({ id: t.id, name: t.name })}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                        {canPublish && t.inLatestPublication && (
                          <Button
                            variant="danger"
                            size="xs"
                            iconLeft={<Power className="size-3.5" />}
                            onClick={() => setDisableTarget({ id: t.id, name: t.name })}
                          >
                            Disable now
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateThemeDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onOpen} />

      {/* ── Clone ── */}
      <Dialog
        open={cloneTarget !== null}
        onOpenChange={(o) => {
          if (!o) setCloneTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clone theme</DialogTitle>
            <DialogDescription>
              Copies every setting of {cloneTarget?.name ?? 'this theme'} into a new disabled
              draft under a fresh slug.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="theme-clone-name" required>
                Name
              </Label>
              <Input
                id="theme-clone-name"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="theme-clone-slug" required>
                Slug
              </Label>
              <Input
                id="theme-clone-slug"
                mono
                value={cloneSlug}
                onChange={(e) => setCloneSlug(e.target.value)}
              />
              <FieldError>{cloneSlugError}</FieldError>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloneTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="solid"
              loading={clone.isPending}
              disabled={cloneDisabled}
              onClick={() => {
                if (!cloneTarget) return;
                clone.mutate({ id: cloneTarget.id, slug: cloneSlug.trim(), name: cloneName.trim() });
              }}
            >
              Clone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete ── */}
      <TypeConfirmDialog
        open={deleteTarget !== null}
        title="Delete theme"
        description={`Permanently removes the draft "${deleteTarget?.name ?? ''}". If it is part of the live publication it keeps rendering on phones until the next publish.`}
        confirmText={deleteTarget?.name ?? ''}
        confirmLabel="Delete theme"
        danger
        requireReason={false}
        loading={del.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) del.mutate(deleteTarget.id);
        }}
      />

      {/* ── Kill switch ── */}
      <TypeConfirmDialog
        open={disableTarget !== null}
        title="Disable now"
        description="Switches the theme off and republishes the live set in one step — phones return to the default look on their next refresh (within ~30 min). This is the kill switch; scheduling is not consulted."
        confirmText={disableTarget?.name ?? ''}
        confirmLabel="Disable now"
        danger
        requireReason={false}
        loading={disableNow.isPending}
        onClose={() => setDisableTarget(null)}
        onConfirm={() => {
          if (disableTarget) disableNow.mutate(disableTarget.id);
        }}
      />
    </div>
  );
}
