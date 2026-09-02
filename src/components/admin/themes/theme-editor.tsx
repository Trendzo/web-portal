/**
 * Festival theme editor — bespoke panel (the CategoryImageryPanel precedent),
 * not the generic CmsFieldSpec renderer: a theme is one nested object with
 * cross-field rules, not a flat list of copy fields.
 *
 * State model: ONE plain-useState form object (the ItemDialog idiom — every
 * input here is already a controlled custom component, and the phone preview
 * wants the live draft on each keystroke). Seed-on-open keyed by [id, updatedAt]
 * so a restore/clone elsewhere reseeds after invalidation but local typing is
 * never clobbered. Save is an explicit PATCH of the full mapped body — no
 * autosave: PATCH bumps updatedAt (feeds "edited since publish") and runs
 * server validation, and neither wants half-typed hex values.
 *
 * The tabs live in this file as local components on purpose: they share one
 * TabProps seam and zero of them is reusable elsewhere.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import { api, apiValidated, ApiError } from '@/lib/api';
import { ThemeDraftSchema } from '@/lib/schemas';
import type { SnapshotTheme, ThemeDraft, ThemePlatform, ThemePreviewInput } from '@/lib/types';
import { AA_LARGE } from '@/lib/contrast';
import { toLocalInput, fromLocalInput } from '@/lib/datetime-local';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { ColorPicker } from '@/components/ui/color-picker';
import { MediaGallery } from '@/components/ui/media-gallery';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContrastCheck } from './contrast-check';
import { GradientField } from './gradient-field';
import { LottieField } from './lottie-field';
import { PhonePreview } from './phone-preview';
import { ResolverSimulator } from './resolver-simulator';

/** Festival-friendly picker presets (the ui default is the portal's own palette). */
const THEME_PRESETS = ['#C1121F', '#7B1E1E', '#F2E63C', '#0E8A45', '#E5006D', '#1A237E', '#FF6F00', '#FFFFFF'];

// ── Form model — server shape with edit-friendly substitutions ───────────────

type ThemeDraftForm = {
  slug: string;
  name: string;
  description: string;
  isEnabled: boolean;
  priority: string; // Input-friendly; parsed at save
  startsAt: string; // datetime-local, '' = open
  endsAt: string;
  cityRestricted: boolean;
  citiesText: string; // comma-separated
  platformRestricted: boolean;
  ios: boolean;
  android: boolean;
  minAppVersion: string;
  tokens: { accent: string; accentInk: string; accentSoft: string; surfaceAlt: string; hairline: string }; // '' = unset
  headerKind: 'default' | 'solid' | 'gradient' | 'image';
  headerColor: string;
  headerGradient: [string, string] | undefined;
  headerInk: string;
  statusBarStyle: 'light' | 'dark';
  wordmarkUrl: string;
  overlayUrl: string;
  overlayHeight: string;
  tabActiveInk: string;
  tabBadgeBg: string;
  decorKind: 'none' | 'image' | 'lottie';
  decorUrl: string;
  decorLoop: boolean;
  decorMaxPlays: string;
  greeting: string;
  searchPlaceholder: string;
};

function toForm(d: ThemeDraft): ThemeDraftForm {
  return {
    slug: d.slug,
    name: d.name,
    description: d.description ?? '',
    isEnabled: d.isEnabled,
    priority: String(d.priority),
    startsAt: toLocalInput(d.startsAt),
    endsAt: toLocalInput(d.endsAt),
    cityRestricted: d.cities !== null,
    citiesText: (d.cities ?? []).join(', '),
    platformRestricted: d.platforms !== null,
    ios: d.platforms === null || d.platforms.includes('ios'),
    android: d.platforms === null || d.platforms.includes('android'),
    minAppVersion: d.minAppVersion ?? '',
    tokens: {
      accent: d.tokens.accent ?? '',
      accentInk: d.tokens.accentInk ?? '',
      accentSoft: d.tokens.accentSoft ?? '',
      surfaceAlt: d.tokens.surfaceAlt ?? '',
      hairline: d.tokens.hairline ?? '',
    },
    headerKind: d.chrome.header.kind,
    headerColor: d.chrome.header.color ?? '',
    headerGradient: d.chrome.header.gradient,
    headerInk: d.chrome.header.ink ?? '',
    statusBarStyle: d.chrome.statusBarStyle,
    wordmarkUrl: d.chrome.header.wordmarkUrl ?? '',
    overlayUrl: d.chrome.header.overlayUrl ?? '',
    overlayHeight: d.chrome.header.overlayHeight != null ? String(d.chrome.header.overlayHeight) : '',
    tabActiveInk: d.chrome.tabBar.activeInk ?? '',
    tabBadgeBg: d.chrome.tabBar.badgeBg ?? '',
    decorKind: d.decor.kind,
    decorUrl: d.decor.url ?? '',
    decorLoop: d.decor.loop ?? false,
    decorMaxPlays: d.decor.maxPlays != null ? String(d.decor.maxPlays) : '',
    greeting: d.copy.greeting ?? '',
    searchPlaceholder: d.copy.searchPlaceholder ?? '',
  };
}

const hex = (v: string) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined);

/** Wire body for PATCH — null clears, absent leaves; empty strings mean "unset". */
function toPatchBody(f: ThemeDraftForm): Record<string, unknown> {
  const cities = f.cityRestricted
    ? f.citiesText.split(',').map((s) => s.trim()).filter(Boolean)
    : null;
  const platforms: ThemePlatform[] | null = f.platformRestricted
    ? ([...(f.ios ? (['ios'] as const) : []), ...(f.android ? (['android'] as const) : [])] as ThemePlatform[])
    : null;
  return {
    slug: f.slug,
    name: f.name.trim(),
    description: f.description.trim() ? f.description.trim() : null,
    isEnabled: f.isEnabled,
    priority: Number.parseInt(f.priority, 10) || 0,
    startsAt: fromLocalInput(f.startsAt),
    endsAt: fromLocalInput(f.endsAt),
    cities,
    platforms,
    minAppVersion: f.minAppVersion.trim() ? f.minAppVersion.trim() : null,
    tokens: {
      ...(hex(f.tokens.accent) ? { accent: f.tokens.accent } : {}),
      ...(hex(f.tokens.accentInk) ? { accentInk: f.tokens.accentInk } : {}),
      ...(hex(f.tokens.accentSoft) ? { accentSoft: f.tokens.accentSoft } : {}),
      ...(hex(f.tokens.surfaceAlt) ? { surfaceAlt: f.tokens.surfaceAlt } : {}),
      ...(hex(f.tokens.hairline) ? { hairline: f.tokens.hairline } : {}),
    },
    chrome: {
      statusBarStyle: f.statusBarStyle,
      header: {
        kind: f.headerKind,
        ...(f.headerKind === 'solid' && hex(f.headerColor) ? { color: f.headerColor } : {}),
        ...(f.headerKind === 'gradient' && f.headerGradient ? { gradient: f.headerGradient } : {}),
        ...(hex(f.headerInk) ? { ink: f.headerInk } : {}),
        ...(f.wordmarkUrl ? { wordmarkUrl: f.wordmarkUrl } : {}),
        ...(f.overlayUrl ? { overlayUrl: f.overlayUrl } : {}),
        ...(f.overlayHeight.trim() ? { overlayHeight: Number.parseInt(f.overlayHeight, 10) || 72 } : {}),
      },
      tabBar: {
        ...(hex(f.tabActiveInk) ? { activeInk: f.tabActiveInk } : {}),
        ...(hex(f.tabBadgeBg) ? { badgeBg: f.tabBadgeBg } : {}),
      },
    },
    decor: {
      kind: f.decorKind,
      ...(f.decorKind !== 'none' && f.decorUrl ? { url: f.decorUrl } : {}),
      ...(f.decorKind !== 'none' ? { placement: 'header' as const } : {}),
      ...(f.decorLoop ? { loop: true } : {}),
      ...(f.decorMaxPlays.trim() ? { maxPlays: Number.parseInt(f.decorMaxPlays, 10) || 1 } : {}),
      respectReduceMotion: true as const,
    },
    copy: {
      ...(f.greeting.trim() ? { greeting: f.greeting.trim() } : {}),
      ...(f.searchPlaceholder.trim() ? { searchPlaceholder: f.searchPlaceholder.trim() } : {}),
    },
  };
}

/** The live draft as the phone preview's input. */
function toPreviewInput(f: ThemeDraftForm): ThemePreviewInput {
  const body = toPatchBody(f);
  return {
    tokens: body.tokens as ThemePreviewInput['tokens'],
    chrome: body.chrome as ThemePreviewInput['chrome'],
    decor: body.decor as ThemePreviewInput['decor'],
    copy: body.copy as ThemePreviewInput['copy'],
  };
}

// key → tab, for the error dots on tab triggers
const ERROR_TAB: Record<string, string> = {
  name: 'basics', slug: 'basics', endsAt: 'basics', priority: 'basics',
  minAppVersion: 'targeting', platforms: 'targeting',
  headerColor: 'header', headerGradient: 'header', headerImage: 'header', overlayHeight: 'header',
  decorUrl: 'decoration', decorMaxPlays: 'decoration',
};

function validateForm(f: ThemeDraftForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.name.trim()) errors.name = 'Name is required';
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(f.slug)) errors.slug = 'Lowercase kebab-case, 2-80 chars';
  if (f.startsAt && f.endsAt && f.endsAt <= f.startsAt) errors.endsAt = 'Must be after the start';
  if (!/^\d+$/.test(f.priority.trim())) errors.priority = 'Whole number (0 or more)';
  if (f.minAppVersion.trim() && !/^\d+\.\d+(\.\d+)?$/.test(f.minAppVersion.trim()))
    errors.minAppVersion = 'Use x.y.z, e.g. 1.0.7';
  if (f.platformRestricted && !f.ios && !f.android) errors.platforms = 'No platform selected — visible nowhere';
  if (f.headerKind === 'solid' && !hex(f.headerColor)) errors.headerColor = 'Solid header needs a color';
  if (f.headerKind === 'gradient' && !f.headerGradient) errors.headerGradient = 'Pick both gradient stops';
  if (f.headerKind === 'image' && !f.overlayUrl) errors.headerImage = 'Image header needs an uploaded image';
  if (f.overlayHeight.trim() && !/^([1-9]\d{0,2})$/.test(f.overlayHeight.trim()))
    errors.overlayHeight = 'Whole number of points, 1-300';
  if (f.decorKind !== 'none' && !f.decorUrl) errors.decorUrl = 'Upload the decoration first';
  if (f.decorMaxPlays.trim() && !/^([1-9]|10)$/.test(f.decorMaxPlays.trim())) errors.decorMaxPlays = '1-10';
  return errors;
}

// ── Editor ───────────────────────────────────────────────────────────────────

type TabProps = {
  d: ThemeDraftForm;
  set: <K extends keyof ThemeDraftForm>(k: K, v: ThemeDraftForm[K]) => void;
  errors: Record<string, string>;
  canEdit: boolean;
};

export function ThemeEditor({ id, canEdit, canPublish, onClose }: {
  id: string;
  canEdit: boolean;
  canPublish: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'themes', 'detail', id],
    queryFn: () => apiValidated(`/admin/cms/themes/${id}`, ThemeDraftSchema),
  });

  const [form, setForm] = useState<ThemeDraftForm | null>(null);
  const [savedKey, setSavedKey] = useState('');
  /** Mirror of savedKey readable inside the reseed updater without re-running it. */
  const savedKeyRef = useRef('');
  const [tab, setTab] = useState('basics');
  const [rail, setRail] = useState<'her' | 'him'>('her');
  const [motion, setMotion] = useState<'on' | 'reduced'>('on');
  const [previewOverride, setPreviewOverride] = useState<{ winner: SnapshotTheme | null } | null>(null);

  // Seed on open / after external change. updatedAt in the key means a restore
  // or clone done elsewhere reseeds after invalidation; local edits (which do
  // not change updatedAt) are never clobbered mid-typing.
  useEffect(() => {
    if (!query.data) return;
    const f = toForm(query.data);
    // Reseed only when the editor has nothing unsaved. Saving bumps updatedAt and
    // refetches, which used to re-fire this effect and silently revert anything
    // typed while the PATCH was in flight. When dirty, keep the user's text and
    // let the next explicit Save reconcile.
    setForm((current) => {
      if (current !== null && JSON.stringify(current) !== savedKeyRef.current) return current;
      savedKeyRef.current = JSON.stringify(f);
      setSavedKey(savedKeyRef.current);
      return f;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data?.id, query.data?.updatedAt]);

  const errors = useMemo(() => (form ? validateForm(form) : {}), [form]);
  const dirty = form !== null && JSON.stringify(form) !== savedKey;

  const save = useMutation({
    mutationFn: () => api<ThemeDraft>(`/admin/cms/themes/${id}`, { method: 'PATCH', body: toPatchBody(form!) }),
    onSuccess: () => {
      toast.success('Theme saved');
      savedKeyRef.current = JSON.stringify(form);
      setSavedKey(savedKeyRef.current);
      void qc.invalidateQueries({ queryKey: ['admin', 'themes'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  if (query.isLoading || !form) return <Skeleton className="h-96" />;
  if (query.isError) return <p className="text-[13px] text-danger">Could not load this theme.</p>;

  const set: TabProps['set'] = (k, v) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const tabProps: TabProps = { d: form, set, errors, canEdit };

  const errorTabs = new Set(Object.keys(errors).map((k) => ERROR_TAB[k] ?? 'basics'));
  const previewTheme: ThemePreviewInput | null = previewOverride
    ? previewOverride.winner
      ? { tokens: previewOverride.winner.tokens, chrome: previewOverride.winner.chrome, decor: previewOverride.winner.decor, copy: previewOverride.winner.copy }
      : null
    : toPreviewInput(form);

  const TABS: { key: string; label: string; body: React.ReactNode }[] = [
    { key: 'basics', label: 'Basics', body: <BasicsTab {...tabProps} /> },
    { key: 'targeting', label: 'Targeting', body: <TargetingTab {...tabProps} /> },
    { key: 'colors', label: 'Colors', body: <ColorsTab {...tabProps} /> },
    { key: 'header', label: 'Header', body: <HeaderTab {...tabProps} /> },
    { key: 'navigation', label: 'Navigation', body: <NavigationTab {...tabProps} /> },
    { key: 'decoration', label: 'Decoration', body: <DecorTab {...tabProps} /> },
    { key: 'copy', label: 'Copy', body: <CopyTab {...tabProps} /> },
  ];

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-4" />} onClick={onClose}>
            All themes
          </Button>
          <h2 className="text-[16px] font-semibold text-ink">{form.name || 'Untitled theme'}</h2>
          <Badge tone={form.isEnabled ? 'success' : 'neutral'} flat>
            {form.isEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
          {dirty && <Badge tone="warning" flat>Unsaved changes</Badge>}
          <div className="ml-auto">
            <Button
              variant="solid"
              size="sm"
              iconLeft={<Save className="size-4" />}
              disabled={!canEdit || !dirty || Object.keys(errors).length > 0}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="overflow-x-auto whitespace-nowrap">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
                {errorTabs.has(t.key) && <span className="ml-1 inline-block size-1.5 rounded-full bg-danger align-middle" />}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => (
            <TabsContent key={t.key} value={t.key}>
              <div className="max-w-xl space-y-5 pt-4">{t.body}</div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <div className="flex items-center justify-between gap-2">
          <Segmented
            options={[{ value: 'her', label: 'HER' }, { value: 'him', label: 'HIM' }]}
            value={rail}
            onChange={setRail}
          />
          <Segmented
            options={[{ value: 'on', label: 'Motion' }, { value: 'reduced', label: 'Reduced' }]}
            value={motion}
            onChange={setMotion}
          />
        </div>
        {previewOverride && (
          <button
            type="button"
            className="w-full rounded-xs border border-info/40 bg-info-soft px-3 py-2 text-left text-[12px] text-ink-2"
            onClick={() => setPreviewOverride(null)}
          >
            Showing resolver result — click to go back to the draft you are editing.
          </button>
        )}
        <PhonePreview theme={previewTheme} rail={rail} reducedMotion={motion === 'reduced'} />
        <ResolverSimulator
          defaultSource="draft"
          onShowOnPhone={(winner) => setPreviewOverride({ winner })}
        />
        {canPublish ? null : (
          <p className="text-[11.5px] text-ink-3">
            You can edit drafts; publishing needs the publish permission.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

/** View-only fallback: MediaGallery has no disabled mode, and a read-only admin
 *  must not be able to upload or clear art. */
function ReadOnlyAsset({ url }: { url: string }) {
  if (!url) return <p className="text-[12px] text-ink-3">Not set</p>;
  return (
    <div className="flex items-center gap-2 rounded-xs border border-line bg-bg-2 p-2">
      <img src={url} alt="" className="size-10 rounded-xs object-contain" />
      <span className="truncate font-mono text-[11px] text-ink-3">{url}</span>
    </div>
  );
}

function CheckboxRow({ checked, onChange, disabled, children }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-ink-2">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

function BasicsTab({ d, set, errors, canEdit }: TabProps) {
  return (
    <>
      <div>
        <Label required>Name</Label>
        <Input value={d.name} disabled={!canEdit} onChange={(e) => set('name', e.target.value)} />
        <FieldError>{errors.name}</FieldError>
      </div>
      <div>
        <Label required hint="Public identifier — lowercase-kebab">Slug</Label>
        <Input mono value={d.slug} disabled={!canEdit} onChange={(e) => set('slug', e.target.value)} />
        <FieldError>{errors.slug}</FieldError>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea rows={2} value={d.description} disabled={!canEdit} onChange={(e) => set('description', e.target.value)} />
      </div>
      <CheckboxRow checked={d.isEnabled} disabled={!canEdit} onChange={(v) => set('isEnabled', v)}>
        Enabled — included in the next publish
      </CheckboxRow>
      <div>
        <Label hint="Higher wins when windows overlap">Priority</Label>
        <Input type="number" value={d.priority} disabled={!canEdit} onChange={(e) => set('priority', e.target.value)} />
        <FieldError>{errors.priority}</FieldError>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label hint="Blank = live once published">Live from</Label>
          <Input type="datetime-local" value={d.startsAt} disabled={!canEdit} onChange={(e) => set('startsAt', e.target.value)} />
        </div>
        <div>
          <Label hint="Blank = no end">Live until</Label>
          <Input type="datetime-local" value={d.endsAt} disabled={!canEdit} onChange={(e) => set('endsAt', e.target.value)} />
          <FieldError>{errors.endsAt}</FieldError>
        </div>
      </div>
      <p className="text-[11.5px] text-ink-3">
        Windows are evaluated when phones fetch, not when you publish — schedule Friday's theme today and it lights up on its own.
      </p>
    </>
  );
}

function TargetingTab({ d, set, errors, canEdit }: TabProps) {
  return (
    <>
      <CheckboxRow checked={d.cityRestricted} disabled={!canEdit} onChange={(v) => set('cityRestricted', v)}>
        Restrict to specific cities
      </CheckboxRow>
      {d.cityRestricted && (
        <div>
          <Label hint="Comma separated">Cities</Label>
          <Input value={d.citiesText} placeholder="Mumbai, Pune, Indore" disabled={!canEdit} onChange={(e) => set('citiesText', e.target.value)} />
          {!d.citiesText.trim() && (
            <p className="mt-1.5 text-[12px] text-warning">Restricted with no cities — visible nowhere.</p>
          )}
        </div>
      )}
      <CheckboxRow checked={d.platformRestricted} disabled={!canEdit} onChange={(v) => set('platformRestricted', v)}>
        Restrict to specific platforms
      </CheckboxRow>
      {d.platformRestricted && (
        <div className="flex gap-5">
          <CheckboxRow checked={d.ios} disabled={!canEdit} onChange={(v) => set('ios', v)}>iOS</CheckboxRow>
          <CheckboxRow checked={d.android} disabled={!canEdit} onChange={(v) => set('android', v)}>Android</CheckboxRow>
        </div>
      )}
      <FieldError>{errors.platforms}</FieldError>
      <div>
        <Label hint="Older builds keep the default look">Minimum app version</Label>
        <Input mono value={d.minAppVersion} placeholder="1.0.7" disabled={!canEdit} onChange={(e) => set('minAppVersion', e.target.value)} />
        <FieldError>{errors.minAppVersion}</FieldError>
      </div>
    </>
  );
}

function ColorsTab({ d, set, canEdit }: TabProps) {
  const tok = (k: keyof ThemeDraftForm['tokens'], label: string, hint?: string) => (
    <div key={k}>
      <Label {...(hint ? { hint } : {})}>{label}</Label>
      <ColorPicker
        value={d.tokens[k]}
        presets={THEME_PRESETS}
        placeholder="App default"
        disabled={!canEdit}
        onChange={(v) => set('tokens', { ...d.tokens, [k]: v })}
      />
    </div>
  );
  return (
    <>
      <p className="text-[11.5px] text-ink-3">
        Unset colors keep the app's bundled value. Status colors (success/warn/error/savings) are locked and cannot be themed.
      </p>
      {tok('accent', 'Accent', 'Repaints every campaign surface app-wide')}
      {tok('accentInk', 'Accent ink', 'Text/icons ON accent surfaces')}
      {tok('accentSoft', 'Accent soft')}
      {tok('surfaceAlt', 'Alternate surface')}
      {tok('hairline', 'Hairline')}
      <ContrastCheck fg={hex(d.tokens.accentInk)} bg={hex(d.tokens.accent)} label="Accent ink on accent" />
    </>
  );
}

function HeaderTab({ d, set, errors, canEdit }: TabProps) {
  return (
    <>
      <div>
        <Label>Header style</Label>
        <Segmented
          options={[
            { value: 'default', label: 'Default' },
            { value: 'solid', label: 'Solid' },
            { value: 'gradient', label: 'Gradient' },
            { value: 'image', label: 'Image' },
          ]}
          value={d.headerKind}
          onChange={(v) => (canEdit ? set('headerKind', v) : undefined)}
        />
      </div>
      {d.headerKind === 'solid' && (
        <div>
          <Label required>Header color</Label>
          <ColorPicker value={d.headerColor} presets={THEME_PRESETS} disabled={!canEdit} onChange={(v) => set('headerColor', v)} />
          <FieldError>{errors.headerColor}</FieldError>
        </div>
      )}
      {d.headerKind === 'gradient' && (
        <div>
          <Label required>Gradient</Label>
          <GradientField value={d.headerGradient} disabled={!canEdit} onChange={(v) => set('headerGradient', v)} />
          <FieldError>{errors.headerGradient}</FieldError>
        </div>
      )}
      {d.headerKind !== 'default' && (
        <div>
          <Label hint="Wordmark, copy and icons in the header">Header ink</Label>
          <ColorPicker value={d.headerInk} presets={['#FFFFFF', '#111111', ...THEME_PRESETS]} disabled={!canEdit} onChange={(v) => set('headerInk', v)} />
          {d.headerKind === 'solid' && <ContrastCheck fg={hex(d.headerInk)} bg={hex(d.headerColor)} label="Ink on header" />}
          {d.headerKind === 'gradient' && d.headerGradient && (
            <>
              <ContrastCheck fg={hex(d.headerInk)} bg={hex(d.headerGradient[0])} label="Ink on top stop" />
              <ContrastCheck fg={hex(d.headerInk)} bg={hex(d.headerGradient[1])} label="Ink on bottom stop" />
            </>
          )}
        </div>
      )}
      <div>
        <Label hint="Icons in the phone's status bar">Status bar</Label>
        <Segmented
          options={[{ value: 'light', label: 'Light icons' }, { value: 'dark', label: 'Dark icons' }]}
          value={d.statusBarStyle}
          onChange={(v) => (canEdit ? set('statusBarStyle', v) : undefined)}
        />
      </div>
      <div>
        <Label hint="PNG/WebP, up to 1 MB — pre-colored, never tinted">Festival wordmark</Label>
        {canEdit ? (
          <MediaGallery
            urls={d.wordmarkUrl ? [d.wordmarkUrl] : []}
            onChange={(u) => set('wordmarkUrl', u[0] ?? '')}
            maxImages={1}
            uploadFolder="themes"
            purpose="theme-wordmark"
          />
        ) : (
          <ReadOnlyAsset url={d.wordmarkUrl} />
        )}
      </div>
      <div>
        <Label hint={d.headerKind === 'image' ? 'THE header image (full-bleed)' : 'Art strip along the band bottom - up to 2 MB'}>
          {d.headerKind === 'image' ? 'Header image' : 'Overlay art'}
        </Label>
        {canEdit ? (
          <MediaGallery
            urls={d.overlayUrl ? [d.overlayUrl] : []}
            onChange={(u) => set('overlayUrl', u[0] ?? '')}
            maxImages={1}
            uploadFolder="themes"
            purpose="theme-overlay"
          />
        ) : (
          <ReadOnlyAsset url={d.overlayUrl} />
        )}
        <FieldError>{errors.headerImage}</FieldError>
      </div>
      {d.headerKind !== 'image' && d.overlayUrl ? (
        <div>
          <Label hint="Points; the app clamps 24-160">Overlay height</Label>
          <Input type="number" value={d.overlayHeight} placeholder="72" disabled={!canEdit} onChange={(e) => set('overlayHeight', e.target.value)} />
          <FieldError>{errors.overlayHeight}</FieldError>
        </div>
      ) : null}
    </>
  );
}

function NavigationTab({ d, set, canEdit }: TabProps) {
  return (
    <>
      <div>
        <Label hint="Active tab icon + label">Tab active color</Label>
        <ColorPicker value={d.tabActiveInk} presets={THEME_PRESETS} placeholder="App default" disabled={!canEdit} onChange={(v) => set('tabActiveInk', v)} />
      </div>
      <div>
        <Label hint="Cart count badge">Badge background</Label>
        <ColorPicker value={d.tabBadgeBg} presets={THEME_PRESETS} placeholder="App default" disabled={!canEdit} onChange={(v) => set('tabBadgeBg', v)} />
      </div>
      {/* Inline strip mock so the effect is visible without scrolling to the phone */}
      <div className="flex items-center justify-around rounded-xs border border-line bg-white px-2 py-2">
        {['Home', 'Reel', 'Category', 'Bag'].map((label, i) => (
          <div key={label} className="relative flex flex-col items-center gap-0.5">
            <div className="size-4 rounded-[2px]" style={{ background: i === 0 ? d.tabActiveInk || '#111111' : '#66666633' }} />
            <span className="text-[9px]" style={{ color: i === 0 ? d.tabActiveInk || '#111111' : '#666666' }}>{label}</span>
            {label === 'Bag' && (
              <span className="absolute -right-2 -top-1 flex size-3.5 items-center justify-center text-[7px] text-white" style={{ background: d.tabBadgeBg || '#111111' }}>2</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function DecorTab({ d, set, errors, canEdit }: TabProps) {
  return (
    <>
      <div>
        <Label>Decoration</Label>
        <Segmented
          options={[{ value: 'none', label: 'None' }, { value: 'image', label: 'Image' }, { value: 'lottie', label: 'Lottie' }]}
          value={d.decorKind}
          onChange={(v) => {
            // Re-clicking the selected segment must not discard the upload.
            if (!canEdit || v === d.decorKind) return;
            set('decorKind', v);
            set('decorUrl', '');
          }}
        />
      </div>
      {d.decorKind === 'image' && (
        <div>
          <Label hint="Overlays the header band, never intercepts taps">Decoration image</Label>
          {canEdit ? (
            <MediaGallery
              urls={d.decorUrl ? [d.decorUrl] : []}
              onChange={(u) => set('decorUrl', u[0] ?? '')}
              maxImages={1}
              uploadFolder="themes"
              purpose="theme-overlay"
            />
          ) : (
            <ReadOnlyAsset url={d.decorUrl} />
          )}
          <FieldError>{errors.decorUrl}</FieldError>
        </div>
      )}
      {d.decorKind === 'lottie' && (
        <div>
          <Label hint="JSON, up to 512 KB — ships to every phone">Lottie animation</Label>
          <LottieField value={d.decorUrl || null} disabled={!canEdit} onChange={(u) => set('decorUrl', u ?? '')} />
          <FieldError>{errors.decorUrl}</FieldError>
        </div>
      )}
      {d.decorKind !== 'none' && (
        <>
          <CheckboxRow checked={d.decorLoop} disabled={!canEdit || !!d.decorMaxPlays.trim()} onChange={(v) => set('decorLoop', v)}>
            Loop forever {d.decorMaxPlays.trim() ? '(disabled while max plays is set)' : ''}
          </CheckboxRow>
          <div>
            <Label hint="Blank = play once (or loop)">Max plays</Label>
            <Input type="number" value={d.decorMaxPlays} placeholder="3" disabled={!canEdit} onChange={(e) => set('decorMaxPlays', e.target.value)} />
            <FieldError>{errors.decorMaxPlays}</FieldError>
          </div>
          <CheckboxRow checked disabled onChange={() => {}}>
            Respect the OS reduce-motion setting (always on)
          </CheckboxRow>
        </>
      )}
    </>
  );
}

function CopyTab({ d, set, canEdit }: TabProps) {
  return (
    <>
      <div>
        <Label hint={`${d.greeting.length}/40`}>Greeting</Label>
        <Input value={d.greeting} maxLength={40} placeholder="Happy Diwali" disabled={!canEdit} onChange={(e) => set('greeting', e.target.value)} />
      </div>
      <div>
        <Label hint={`${d.searchPlaceholder.length}/60`}>Search placeholder</Label>
        <Input value={d.searchPlaceholder} maxLength={60} placeholder="Shop the festive drop" disabled={!canEdit} onChange={(e) => set('searchPlaceholder', e.target.value)} />
      </div>
    </>
  );
}

// Re-exported so the page shell can reference the AA_LARGE-based status hint if needed later.
export { AA_LARGE };
