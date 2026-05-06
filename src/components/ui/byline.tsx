import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Newspaper-style byline strip — thin top rule with metadata segments
 * separated by a centred dot. Used at the very top of authenticated pages and login screens.
 */
type BylineProps = HTMLAttributes<HTMLDivElement> & {
  segments: ReadonlyArray<ReactNode>;
};

export function Byline({ segments, className, ...rest }: BylineProps) {
  return (
    <div
      className={cn(
        'border-y border-ink/80 bg-paper px-5 sm:px-8 py-1.5',
        'text-[10.5px] uppercase tracking-[0.2em] text-ink-2',
        'flex items-center gap-2 overflow-x-auto whitespace-nowrap',
        className,
      )}
      {...rest}
    >
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="text-ink-4">·</span>}
          <span className="text-ink-2">{seg}</span>
        </span>
      ))}
    </div>
  );
}

/** Build the standard segments — day/date in IST, and any extra context. */
export function defaultBylineSegments(extras: ReactNode[] = []): ReactNode[] {
  const now = new Date();
  const day = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const time = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
    hour12: false,
  });
  return [`${day} · ${time} IST`, ...extras];
}
