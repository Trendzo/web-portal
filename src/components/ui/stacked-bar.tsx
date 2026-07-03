import { useState } from 'react';
import { cn } from '@/lib/cn';

export type StackSegment = {
  label: string;
  value: number;
  /** Segment colour; any CSS colour or var. */
  color: string;
};

type StackedBarProps = {
  segments: StackSegment[];
  /** Pretty-print a value for labels (e.g. formatPaise). */
  formatValue?: (n: number) => string;
  className?: string;
};

/**
 * 100% stacked horizontal bar — the compact part-to-whole viz for a single total
 * (e.g. gross = net + commission + tcs). Reads left-to-right, uses full width, and labels
 * every part inline. Segments ≥10% carry their share on the bar; all parts are named in the
 * legend row below with amount + percent. Hovering a segment lifts its legend entry.
 */
export function StackedBar({ segments, formatValue = (n) => String(n), className }: StackedBarProps) {
  const [hover, setHover] = useState<number | null>(null);
  const data = segments.filter((s) => s.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div className={cn('space-y-3', className)}>
      {/* the bar */}
      <div
        className="flex h-7 w-full overflow-hidden rounded-lg bg-bg-3"
        role="img"
        aria-label={data.map((d) => `${d.label} ${((d.value / total) * 100).toFixed(0)}%`).join(', ')}
      >
        {data.map((d, i) => {
          const pct = (d.value / total) * 100;
          return (
            <div
              key={i}
              className="flex items-center justify-center transition-[filter,opacity] duration-150"
              style={{
                width: `${pct}%`,
                background: d.color,
                opacity: hover == null || hover === i ? 1 : 0.45,
                filter: hover === i ? 'brightness(1.05)' : undefined,
              }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              title={`${d.label}: ${formatValue(d.value)} (${pct.toFixed(1)}%)`}
            >
              {pct >= 10 && (
                <span className="truncate px-1 text-[11px] font-medium text-white/95">
                  {pct.toFixed(0)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* legend — every part named, amount + share */}
      <ul className="flex flex-wrap gap-x-6 gap-y-1.5">
        {data.map((d, i) => {
          const pct = (d.value / total) * 100;
          return (
            <li
              key={i}
              className={cn(
                'flex items-center gap-2 rounded-md px-1.5 py-0.5 text-[12.5px] transition-colors',
                hover === i && 'bg-bg-2',
              )}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} />
              <span className="text-ink-2">{d.label}</span>
              <span className="font-mono text-ink">{formatValue(d.value)}</span>
              <span className="text-[11px] text-ink-4">{pct.toFixed(1)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
