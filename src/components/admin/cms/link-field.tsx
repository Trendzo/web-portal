import { useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import type { CmsLink } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Where a tile navigates.
 *
 * The route list comes from the schema, which the backend derives from the app's actual
 * navigation stack — so a route that no longer exists cannot be picked, and a write naming one
 * is rejected. That matters because a bad route is invisible here and only shows up as a tap
 * that does nothing on a customer's phone.
 *
 * Params are free-form key/value pairs because they differ per route (`{ label }` for a
 * category, `{ occasion }` for the occasion page). Values are strings; the backend accepts
 * numbers and booleans too, but nothing on home needs them and a typed editor for three
 * scalar kinds would cost more than it returns.
 */
export function LinkField({
  routes,
  value,
  onChange,
}: {
  routes: string[];
  value: CmsLink | null;
  onChange: (next: CmsLink | null) => void;
}) {
  const params = useMemo(
    () => Object.entries(value?.params ?? {}).map(([k, v]) => ({ k, v: String(v) })),
    [value],
  );

  function setParams(next: { k: string; v: string }[]) {
    if (!value) return;
    const record: Record<string, string> = {};
    for (const { k, v } of next) if (k.trim()) record[k.trim()] = v;
    onChange({ route: value.route, ...(Object.keys(record).length ? { params: record } : {}) });
  }

  return (
    <div className="space-y-2">
      <Label className="mb-0" hint="Where tapping this goes">
        Link
      </Label>
      <select
        value={value?.route ?? ''}
        onChange={(e) =>
          onChange(e.target.value ? { route: e.target.value, ...(value?.params ? { params: value.params } : {}) } : null)
        }
        className="h-9 w-full rounded-md border border-line bg-bg px-2 text-[13px] text-ink"
      >
        <option value="">No link (not tappable)</option>
        {routes.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

      {value && (
        <div className="space-y-1.5 rounded-md border border-line p-2">
          {params.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                value={p.k}
                onChange={(e) => {
                  const next = [...params];
                  next[i] = { k: e.target.value, v: p.v };
                  setParams(next);
                }}
                placeholder="param"
                className="h-8 flex-1"
              />
              <Input
                value={p.v}
                onChange={(e) => {
                  const next = [...params];
                  next[i] = { k: p.k, v: e.target.value };
                  setParams(next);
                }}
                placeholder="value"
                className="h-8 flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove param"
                onClick={() => setParams(params.filter((_, j) => j !== i))}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            iconLeft={<Plus className="size-3.5" />}
            onClick={() => setParams([...params, { k: '', v: '' }])}
          >
            Add param
          </Button>
        </div>
      )}
    </div>
  );
}
