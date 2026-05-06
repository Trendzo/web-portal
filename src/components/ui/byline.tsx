import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Compact metadata strip — used sparingly. Original editorial-date-line treatment
 * is gone; this is now a simple tracked-uppercase strip kept for prop parity
 * with old call-sites.
 */
type BylineProps = HTMLAttributes<HTMLDivElement> & {
  segments: ReadonlyArray<ReactNode>;
};

export function Byline({ segments, className, ...rest }: BylineProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-1.5 text-[10.5px] uppercase tracking-[0.12em] ' +
          'text-ink-3 border-b border-line bg-bg overflow-x-auto whitespace-nowrap',
        className,
      )}
      {...rest}
    >
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="text-ink-4">·</span>}
          <span>{seg}</span>
        </span>
      ))}
    </div>
  );
}

/** Build the standard segments — day/date in IST, plus any extras. */
export function defaultBylineSegments(extras: ReactNode[] = []): ReactNode[] {
  const now = new Date();
  const day = now.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
  return [day, ...extras];
}
