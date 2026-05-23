import { useMemo, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

export type MultiSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

/**
 * Compact multi-select with searchable popover + checkbox rows + selected chips.
 * Stateless — caller controls `value` and gets `onChange(newValues)`.
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Pick options…',
  disabled,
  loading,
  emptyMessage = 'No options',
  id,
}: {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (!q.trim()) return options;
    const n = q.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(n) ||
        o.value.toLowerCase().includes(n) ||
        (o.hint?.toLowerCase().includes(n) ?? false),
    );
  }, [options, q]);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedOptions = options.filter((o) => selectedSet.has(o.value));

  function toggle(v: string) {
    if (selectedSet.has(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  }

  function remove(v: string) {
    onChange(value.filter((x) => x !== v));
  }

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled || loading}
            className={cn(
              'mt-1 flex w-full items-center justify-between rounded-md border border-line bg-bg px-3 py-2 text-left text-[13.5px] text-ink',
              'hover:bg-bg-2 focus:outline-none focus:ring-1 focus:ring-ink/30',
              (disabled || loading) && 'cursor-not-allowed opacity-60',
            )}
          >
            <span className={cn('truncate', value.length === 0 && 'text-ink-4')}>
              {loading
                ? 'Loading…'
                : value.length === 0
                  ? placeholder
                  : `${value.length} selected`}
            </span>
            <ChevronDown className="size-4 text-ink-3 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(420px,90vw)] p-0"
          align="start"
          onOpenAutoFocus={(e) => {
            // keep the search input as the focused element when the popover opens
            e.preventDefault();
            const input = (e.currentTarget as HTMLElement).querySelector(
              'input[type="text"]',
            ) as HTMLInputElement | null;
            input?.focus();
          }}
        >
          <div className="border-b border-line p-2">
            <Input
              type="text"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="text-[13px]"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-[12.5px] text-ink-3">{emptyMessage}</li>
            ) : (
              filtered.map((o) => {
                const checked = selectedSet.has(o.value);
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => toggle(o.value)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-bg-2',
                        checked && 'bg-bg-2',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded border',
                          checked ? 'border-ink bg-ink text-bg' : 'border-line',
                        )}
                      >
                        {checked && <Check className="size-3" />}
                      </span>
                      <span className="flex-1 truncate">
                        <span className="font-medium text-ink">{o.label}</span>
                        {o.hint && (
                          <span className="ml-2 font-mono text-[11px] text-ink-3">{o.hint}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedOptions.map((o) => (
            <span
              key={o.value}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-2 px-2 py-0.5 text-[12px] text-ink"
            >
              <span className="truncate max-w-[200px]">{o.label}</span>
              <button
                type="button"
                aria-label={`Remove ${o.label}`}
                onClick={() => remove(o.value)}
                className="text-ink-3 hover:text-ink"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
