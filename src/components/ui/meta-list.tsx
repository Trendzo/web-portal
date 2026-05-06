import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Item = {
  label: string;
  value: ReactNode;
  mono?: boolean;
  hint?: string;
};

/**
 * Definition list for key/value details. Hairline-separated rows by default;
 * pass `cols` for a grid layout.
 */
export function MetaList({
  items,
  className,
  cols = 1,
}: {
  items: ReadonlyArray<Item>;
  className?: string;
  cols?: 1 | 2 | 3;
}) {
  const grid = cols === 1 ? '' : cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';
  return (
    <dl className={cn('grid grid-cols-1 gap-x-8 gap-y-4', grid, className)}>
      {items.map((it) => (
        <div key={it.label} className="space-y-1">
          <dt className="kicker">{it.label}</dt>
          <dd
            className={cn(
              'text-[14px] text-ink leading-snug break-words',
              it.mono && 'font-mono text-[13px]',
            )}
          >
            {it.value}
          </dd>
          {it.hint && <p className="text-[11.5px] text-ink-3">{it.hint}</p>}
        </div>
      ))}
    </dl>
  );
}
