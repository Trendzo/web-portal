import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Smartphone } from 'lucide-react';
import { ApiError, apiValidated } from '@/lib/api';
import { ThemePreviewSchema } from '@/lib/schemas';
import type { SnapshotTheme } from '@/lib/types';
import { fromLocalInput } from '@/lib/datetime-local';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const VERSION_RE = /^\d+\.\d+(\.\d+)?$/;

/** '__none__' = don't send a platform (backend treats absence as "any"). */
type PlatformChoice = '__none__' | 'ios' | 'android';

const SWATCH_KEYS = ['accent', 'accentInk', 'accentSoft'] as const;

function fmtWindow(w: Pick<SnapshotTheme, 'startsAt' | 'endsAt'>): string {
  if (!w.startsAt && !w.endsAt) return 'Always on — no start or end';
  const from = w.startsAt ? new Date(w.startsAt).toLocaleString() : 'always';
  const until = w.endsAt ? new Date(w.endsAt).toLocaleString() : 'no end';
  return `${from} → ${until}`;
}

/**
 * "Who wins right now?" — runs the REAL resolver against draft or published
 * state for an arbitrary moment/city/platform/app version, so scheduling and
 * priority questions get answered by the backend, not by mental arithmetic.
 *
 * Text inputs keep a local draft and only commit to query state on blur/Enter
 * (a half-typed city shouldn't fire a request per keystroke); Segmented and
 * Select commit immediately.
 */
export function ResolverSimulator({
  defaultSource,
  onShowOnPhone,
}: {
  defaultSource: 'draft' | 'published';
  onShowOnPhone?: (winner: SnapshotTheme | null) => void;
}) {
  const [source, setSource] = useState<'draft' | 'published'>(defaultSource);
  const [platform, setPlatform] = useState<PlatformChoice>('__none__');

  // Committed query state vs in-flight drafts for the three text inputs.
  const [at, setAt] = useState('');
  const [city, setCity] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [atDraft, setAtDraft] = useState('');
  const [cityDraft, setCityDraft] = useState('');
  const [versionDraft, setVersionDraft] = useState('');

  const commit = () => {
    setAt(atDraft);
    setCity(cityDraft.trim());
    setAppVersion(versionDraft.trim());
  };
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
      e.currentTarget.blur();
    }
  };

  const versionWarns = appVersion !== '' && !VERSION_RE.test(appVersion);

  const preview = useQuery({
    queryKey: ['admin', 'themes', 'preview', source, at, city, platform, appVersion],
    queryFn: () => {
      const p = new URLSearchParams({ source });
      const iso = fromLocalInput(at);
      if (iso) p.set('at', iso);
      if (city) p.set('city', city);
      if (platform !== '__none__') p.set('platform', platform);
      if (appVersion) p.set('appVersion', appVersion);
      return apiValidated(`/admin/cms/themes/preview?${p.toString()}`, ThemePreviewSchema);
    },
    placeholderData: (prev) => prev,
  });

  // zod's `.optional()` parses token fields to `string | undefined`, while the
  // hand-written ThemeTokens is exact-optional `string` — same wire shape
  // (schemas and types are maintained in lockstep), so realign the type here.
  const winner = (preview.data?.winner ?? null) as SnapshotTheme | null;
  const swatches = winner
    ? SWATCH_KEYS.flatMap((k) => {
        const value = winner.tokens[k];
        return value ? [{ key: k, value }] : [];
      })
    : [];

  return (
    <section className="rounded-md border border-line p-4">
      <h3 className="text-[15px] font-semibold text-ink">Who wins right now?</h3>
      <p className="mt-1 text-[12.5px] text-ink-3">
        Asks the real resolver which theme a phone with this context would receive.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <Label>Source</Label>
          <Segmented
            value={source}
            onChange={setSource}
            options={[
              { value: 'draft' as const, label: 'Draft' },
              { value: 'published' as const, label: 'Published' },
            ]}
          />
        </div>
        <div>
          <Label htmlFor="sim-at" hint="blank = now">
            At
          </Label>
          <Input
            id="sim-at"
            type="datetime-local"
            value={atDraft}
            onChange={(e) => setAtDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onEnter}
            placeholder="now"
            className="w-52"
          />
        </div>
        <div>
          <Label htmlFor="sim-city">City</Label>
          <Input
            id="sim-city"
            value={cityDraft}
            onChange={(e) => setCityDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onEnter}
            placeholder="Any city"
            className="w-36"
          />
        </div>
        <div>
          <Label>Platform</Label>
          <Select value={platform} onValueChange={(v) => setPlatform(v as PlatformChoice)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Any</SelectItem>
              <SelectItem value="ios">iOS</SelectItem>
              <SelectItem value="android">Android</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="sim-app-version">App version</Label>
          <Input
            id="sim-app-version"
            value={versionDraft}
            onChange={(e) => setVersionDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onEnter}
            placeholder="1.4.0"
            mono
            className="w-28"
          />
        </div>
      </div>
      {versionWarns && (
        <p className="mt-1.5 text-[12px] text-warning">
          “{appVersion}” doesn’t look like a version (expected e.g. 1.4 or 1.4.0) — sent anyway.
        </p>
      )}

      <div className="mt-3">
        {preview.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : preview.isError ? (
          <p className="text-[12px] text-danger">
            {preview.error instanceof ApiError ? preview.error.message : 'Preview failed'}
          </p>
        ) : winner ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line bg-bg-2 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13.5px] font-semibold text-ink">{winner.name}</span>
                <span className="font-mono text-[11.5px] text-ink-3">{winner.slug}</span>
                <span className="text-[11.5px] text-ink-3">priority {winner.priority}</span>
              </div>
              <p className="mt-0.5 text-[12px] text-ink-3">{fmtWindow(winner)}</p>
              {swatches.length > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  {swatches.map((s) => (
                    <span key={s.key} className="flex items-center gap-1">
                      <span
                        className="inline-block size-4 shrink-0 rounded-sm border border-line"
                        style={{ backgroundColor: s.value }}
                        aria-hidden
                      />
                      <span className="font-mono text-[10.5px] text-ink-3">{s.key}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Smartphone className="size-3.5" />}
              onClick={() => onShowOnPhone?.(winner)}
            >
              Show on phone
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-bg-2 p-3">
            <p className="min-w-0 flex-1 text-[12.5px] text-ink-3">
              No theme wins for this context. Phones show the bundled LIGHT look.
            </p>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Smartphone className="size-3.5" />}
              onClick={() => onShowOnPhone?.(null)}
            >
              Show on phone
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
