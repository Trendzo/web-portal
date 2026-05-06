import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Item = {
  label: string;
  value: ReactNode;
  mono?: boolean;
  hint?: string;
};

/** Hairline-separated key/value list — kicker labels above mono-friendly values. */
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
    <dl className={cn('grid grid-cols-1 gap-x-8 gap-y-5', grid, className)}>
      {items.map((it) => (
        <div key={it.label} className="border-t border-rule pt-3 first:border-t-0 first:pt-0 sm:border-t sm:pt-3 sm:first:border-t">
          <dt className="kicker mb-1 text-ink-3">{it.label}</dt>
          <dd
            className={cn(
              'text-[15px] text-ink leading-snug break-words',
              it.mono && 'font-mono text-[13.5px]',
            )}
          >
            {it.value}
          </dd>
          {it.hint && <p className="mt-0.5 text-[12px] text-ink-3">{it.hint}</p>}
        </div>
      ))}
    </dl>
  );
}
