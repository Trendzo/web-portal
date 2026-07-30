import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { CmsGender, CmsItem, CmsLink, CmsSectionSpec } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MediaField } from './media-field';
import { LinkField } from './link-field';

/**
 * Create / edit one CMS item.
 *
 * The form is built from the section's spec rather than hand-written per section — that is the
 * whole point of the schema catalogue, and it is why adding a section later needs no new admin
 * code. Field-level validation stays on the backend, which owns the catalogue; this only
 * shapes the payload.
 */

/** `<input type="datetime-local">` wants local wall-clock, the API speaks ISO/UTC. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

type Draft = {
  key: string;
  gender: CmsGender;
  assetKey: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  link: CmsLink | null;
  content: Record<string, unknown>;
  isEnabled: boolean;
  startsAt: string;
  endsAt: string;
  citiesText: string;
  cityRestricted: boolean;
};

const EMPTY: Draft = {
  key: '',
  gender: 'all',
  assetKey: null,
  imageUrl: null,
  videoUrl: null,
  link: null,
  content: {},
  isEnabled: true,
  startsAt: '',
  endsAt: '',
  citiesText: '',
  cityRestricted: false,
};

export function ItemDialog({
  open,
  onOpenChange,
  sectionKey,
  spec,
  routes,
  target,
  defaultGender,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionKey: string;
  spec: CmsSectionSpec;
  routes: string[];
  /** null = create */
  target: CmsItem | null;
  defaultGender: CmsGender;
}) {
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(EMPTY);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  // Reseed whenever the dialog opens or the target changes — a stale draft leaking between two
  // items is the classic bug in this pattern.
  useEffect(() => {
    if (!open) return;
    if (!target) {
      setD({ ...EMPTY, gender: spec.genderSplit ? defaultGender : 'all' });
      return;
    }
    setD({
      key: target.key,
      gender: target.gender,
      assetKey: target.assetKey,
      imageUrl: target.imageUrl,
      videoUrl: target.videoUrl,
      link: target.link,
      content: target.content ?? {},
      isEnabled: target.isEnabled,
      startsAt: toLocalInput(target.startsAt),
      endsAt: toLocalInput(target.endsAt),
      citiesText: (target.cities ?? []).join(', '),
      cityRestricted: target.cities !== null,
    });
  }, [open, target, spec.genderSplit, defaultGender]);

  const save = useMutation({
    mutationFn: () => {
      const cities = d.cityRestricted
        ? d.citiesText.split(',').map((c) => c.trim()).filter(Boolean)
        : null;
      const body = {
        key: d.key.trim(),
        gender: d.gender,
        assetKey: d.assetKey,
        imageUrl: d.imageUrl,
        videoUrl: d.videoUrl,
        link: d.link,
        content: d.content,
        isEnabled: d.isEnabled,
        startsAt: fromLocalInput(d.startsAt),
        endsAt: fromLocalInput(d.endsAt),
        cities,
      };
      return target
        ? api<CmsItem>(`/admin/cms/items/${target.id}`, { method: 'PATCH', body })
        : api<CmsItem>(`/admin/cms/sections/${sectionKey}/items`, { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success(target ? 'Item updated' : 'Item added');
      void qc.invalidateQueries({ queryKey: ['admin', 'cms'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  function setContent(key: string, value: unknown) {
    setD((prev) => ({ ...prev, content: { ...prev.content, [key]: value } }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{target ? 'Edit item' : `Add to ${spec.label}`}</DialogTitle>
          <DialogDescription>{spec.description}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!d.key.trim()) {
              toast.error('An identifier is required');
              return;
            }
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cms-key" required hint="Stable — the app keys on it">
                Identifier
              </Label>
              <Input
                id="cms-key"
                value={d.key}
                onChange={(e) => set('key', e.target.value)}
                placeholder="hero-her-new1"
              />
              <p className="mt-1 text-[11.5px] text-ink-3">
                Unique within this section. Changing it on a live item resets any analytics keyed
                to it.
              </p>
            </div>

            {spec.genderSplit && (
              <div>
                <Label htmlFor="cms-gender">Rail</Label>
                <select
                  id="cms-gender"
                  value={d.gender}
                  onChange={(e) => set('gender', e.target.value as CmsGender)}
                  className="h-9 w-full rounded-md border border-line bg-bg px-2 text-[13px] text-ink"
                >
                  <option value="her">HER only</option>
                  <option value="him">HIM only</option>
                  <option value="all">Both rails</option>
                </select>
              </div>
            )}
          </div>

          {spec.media !== 'none' && (
            <MediaField
              kind={spec.media}
              assetKey={d.assetKey}
              imageUrl={d.imageUrl}
              videoUrl={d.videoUrl}
              onChange={(next) => setD((prev) => ({ ...prev, ...next }))}
            />
          )}

          {spec.itemFields.length > 0 && (
            <div className="space-y-3">
              {spec.itemFields.map((f) => {
                const raw = d.content[f.key];
                const common = { id: `cms-f-${f.key}` };
                return (
                  <div key={f.key}>
                    <Label htmlFor={common.id} {...(f.required ? { required: true } : {})} {...(f.help ? { hint: f.help } : {})}>
                      {f.label}
                    </Label>
                    {f.kind === 'textarea' ? (
                      <Textarea
                        {...common}
                        rows={3}
                        value={typeof raw === 'string' ? raw : ''}
                        onChange={(e) => setContent(f.key, e.target.value)}
                        {...(f.maxLength ? { maxLength: f.maxLength } : {})}
                      />
                    ) : f.kind === 'string_list' ? (
                      <Input
                        {...common}
                        value={Array.isArray(raw) ? (raw as string[]).join(', ') : ''}
                        onChange={(e) =>
                          setContent(
                            f.key,
                            e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          )
                        }
                        placeholder="Comma separated"
                      />
                    ) : f.kind === 'number' ? (
                      <Input
                        {...common}
                        type="number"
                        value={typeof raw === 'number' ? String(raw) : ''}
                        onChange={(e) =>
                          setContent(f.key, e.target.value === '' ? undefined : Number(e.target.value))
                        }
                      />
                    ) : f.kind === 'color' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={typeof raw === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : '#ffffff'}
                          onChange={(e) => setContent(f.key, e.target.value)}
                          className="h-9 w-12 cursor-pointer rounded border border-line bg-bg"
                        />
                        <Input
                          {...common}
                          value={typeof raw === 'string' ? raw : ''}
                          onChange={(e) => setContent(f.key, e.target.value)}
                          placeholder="#F2E63C"
                          className="flex-1"
                        />
                      </div>
                    ) : (
                      <Input
                        {...common}
                        value={typeof raw === 'string' ? raw : ''}
                        onChange={(e) => setContent(f.key, e.target.value)}
                        {...(f.maxLength ? { maxLength: f.maxLength } : {})}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {spec.link && <LinkField routes={routes} value={d.link} onChange={(v) => set('link', v)} />}

          {/* ── Scheduling & targeting ── */}
          <div className="space-y-3 rounded-md border border-line p-3">
            <div className="text-[12.5px] font-medium text-ink-2">Scheduling & targeting</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="cms-from" hint="Blank = live now">
                  Live from
                </Label>
                <Input
                  id="cms-from"
                  type="datetime-local"
                  value={d.startsAt}
                  onChange={(e) => set('startsAt', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="cms-to" hint="Blank = no end">
                  Live until
                </Label>
                <Input
                  id="cms-to"
                  type="datetime-local"
                  value={d.endsAt}
                  onChange={(e) => set('endsAt', e.target.value)}
                />
              </div>
            </div>
            <p className="text-[11.5px] text-ink-3">
              Windows are applied when a device reads the content, not when you publish — so a
              future date can be published today and will appear on its own.
            </p>

            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={d.cityRestricted}
                onChange={(e) => set('cityRestricted', e.target.checked)}
              />
              Restrict to specific cities
            </label>
            {d.cityRestricted && (
              <>
                <Input
                  value={d.citiesText}
                  onChange={(e) => set('citiesText', e.target.value)}
                  placeholder="Mumbai, Pune, Bengaluru"
                />
                <p className="text-[11.5px] text-ink-3">
                  A city-restricted item is hidden from anyone whose city the app has not sent —
                  a customer with no saved address will not see it.
                </p>
              </>
            )}

            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={d.isEnabled}
                onChange={(e) => set('isEnabled', e.target.checked)}
              />
              Enabled
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="solid" loading={save.isPending}>
              {target ? 'Save changes' : 'Add item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
