import { useState } from 'react';
import { cn } from '@/lib/cn';

export type HBarRow = {
  label: string;
  value: number;
  /** Right-aligned pretty value; defaults to String(value). */
  display?: string;
  /** Small grey annotation after the label (e.g. "12 orders"). */
  sub?: string;
  /** Per-row colour override. */
  color?: string;
};

/**
 * Ranked list with an inline data-bar — one compact line per row (rank · name ·
 * value) with the bar painted as a subtle tint fill *behind* the row, proportional
 * to value. Half the height of a label-over-bar layout, stays dense as the list
 * grows, and reads like a leaderboard. HTML/CSS so labels never truncate into an axis.
 */
export function HBarChart({
  rows,
  color = 'var(--color-ink)',
  className,
}: {
  rows: HBarRow[];
  color?: string;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className={cn('divide-y divide-line/60', className)}>
      {rows.map((r, i) => {
        const pct = Math.max(2, (Math.abs(r.value) / max) * 100);
        const c = r.color ?? color;
        const active = hover === i;
        return (
          <div
            key={`${r.label}-${i}`}
            className="relative flex h-8 items-center gap-3 overflow-hidden px-2"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {/* data-bar fill behind the row */}
            <div
              className="absolute inset-y-1 left-0 rounded-[5px] transition-[width] duration-500 ease-out"
              style={{
                width: `${pct}%`,
                background: `color-mix(in oklab, ${c} ${active ? 26 : 16}%, transparent)`,
                borderLeft: `2px solid color-mix(in oklab, ${c} ${active ? 90 : 70}%, transparent)`,
              }}
            />
            <span className="relative z-[1] w-5 shrink-0 font-mono text-[11px] tabular-nums text-ink-4">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="relative z-[1] min-w-0 flex-1 truncate text-[12.5px] text-ink">
              {r.label}
              {r.sub && <span className="ml-1.5 text-[11px] text-ink-4">{r.sub}</span>}
            </span>
            <span className="relative z-[1] shrink-0 font-mono text-[12.5px] tabular-nums text-ink">
              {r.display ?? String(r.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
