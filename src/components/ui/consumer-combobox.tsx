import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { ConsumerSummary } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

type Props = {
  value: string;
  onChange: (consumer: ConsumerSummary) => void;
  placeholder?: string;
  disabled?: boolean;
};

/**
 * Searchable consumer picker for admin dialogs (e.g. the test-order tool). Fetches the
 * consumer directory once and filters by name / email / phone in a popover, so admins can
 * type instead of scrolling a long native <select>.
 */
export function ConsumerCombobox({ value, onChange, placeholder = 'Pick a consumer', disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'consumers', 'place-order'],
    queryFn: () => api<ConsumerSummary[]>('/admin/consumers?limit=100'),
  });
  const consumers = data ?? [];

  const selected = consumers.find((c) => c.id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return consumers;
    return consumers.filter((c) =>
      (c.name?.toLowerCase().includes(q) ?? false) ||
      (c.email?.toLowerCase().includes(q) ?? false) ||
      (c.phone?.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ?? false),
    );
  }, [query, consumers]);

  const label = (c: ConsumerSummary) => c.name || c.email || c.phone || c.id;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line-2 bg-bg px-3 text-[13.5px]',
            'hover:border-line-strong focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/20',
            'disabled:cursor-not-allowed disabled:opacity-60',
            selected ? 'text-ink' : 'text-ink-4',
          )}
        >
          {selected ? (
            <span className="flex items-baseline gap-2 truncate">
              <span className="truncate">{label(selected)}</span>
              {selected.email && <span className="font-mono text-[11px] text-ink-3 truncate">{selected.email}</span>}
            </span>
          ) : (
            <span>{isLoading ? 'Loading consumers…' : placeholder}</span>
          )}
          <ChevronDown className="size-4 text-ink-3 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0">
        <div className="border-b border-line p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-ink-4" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, or phone…"
              className="pl-7 h-8 text-[12.5px]"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-ink-4">
              {isLoading ? 'Loading…' : 'No consumers match.'}
            </div>
          ) : (
            filtered.map((c) => {
              const active = c.id === value;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); setQuery(''); }}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-bg-2',
                    active && 'bg-bg-2',
                  )}
                >
                  <Check className={cn('size-3.5 mt-0.5 text-ink-3 shrink-0', !active && 'invisible')} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-ink">{label(c)}</div>
                    <div className="flex gap-2 text-[11px] text-ink-4">
                      {c.email && <span className="truncate font-mono">{c.email}</span>}
                      {c.phone && <span className="truncate">· {c.phone}</span>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
