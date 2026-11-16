import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';

export type PickerOption = { value: string; label: string };

/**
 * Single-select dropdown with type-to-search. Options come from the backend; the
 * list filters as the user types, and an empty result says so instead of going blank.
 */
export function SearchablePicker({
  options, value, onChange, placeholder, searchPlaceholder = 'Search…',
  clearLabel, loading = false, emptyMessage = 'Nothing to choose from yet',
  footer, onOpenChange,
}: {
  options: PickerOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  /** When set, the list starts with a row that clears the value. */
  clearLabel?: string;
  loading?: boolean;
  emptyMessage?: string;
  /** Rendered under the list (e.g. a "Create new" action). */
  footer?: (close: () => void) => ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const needle = query.trim().toLowerCase();
  const filtered = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  const close = () => { setOpen(false); setQuery(''); };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(''); onOpenChange?.(next); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line-2 bg-bg px-3 text-left text-[13.5px] hover:border-line-strong focus:outline-none focus:border-ink"
        >
          <span className={cn('truncate', !selected && 'text-ink-4')}>
            {loading ? 'Loading…' : selected ? selected.label : value ? '…' : placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-ink-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0">
        <div className="relative border-b border-line p-2">
          <Search className="absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-ink-4" />
          <Input
            autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder} className="pl-7 h-8 text-[12.5px]"
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {clearLabel && !needle && (
            <button type="button" onClick={() => { onChange(''); close(); }}
              className="w-full px-3 py-2 text-left text-[12.5px] text-ink-3 hover:bg-bg-2">
              {clearLabel}
            </button>
          )}
          {filtered.map((o) => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); close(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-bg-2">
              <Check className={cn('size-3.5 shrink-0', o.value !== value && 'invisible')} />{o.label}
            </button>
          ))}
          {!filtered.length && (
            <p className="px-3 py-4 text-[12px] text-ink-4">
              {options.length ? `No match for “${query.trim()}”` : emptyMessage}
            </p>
          )}
        </div>
        {footer ? <div className="border-t border-line">{footer(close)}</div> : null}
      </PopoverContent>
    </Popover>
  );
}
