import { useId, useState } from 'react';
import { cn } from '@/lib/cn';
import { GRAD, gradId } from './chart-palette';

export type PieSlice = {
  label: string;
  value: number;
  /** Slice colour; any CSS colour or var. */
  color: string;
};

type PieChartProps = {
  slices: PieSlice[];
  /** Pretty-print a value for labels (e.g. formatPaise). */
  formatValue?: (n: number) => string;
  /** Outer diameter of the ring in px (viewBox units). */
  size?: number;
  /** Big metric shown in the donut hole (e.g. the gross total). */
  centerValue?: string;
  /** Small caption under the center value. */
  centerLabel?: string;
  className?: string;
};

const TAU = Math.PI * 2;

/** Point on a circle of radius r at the given angle (0 = 12 o'clock, clockwise). */
function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) };
}

/** SVG donut-segment path between two radii, a0 → a1 (radians, clockwise from top). */
function segment(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number) {
  if (a1 - a0 >= TAU) a1 = a0 + TAU - 0.0001;
  const o0 = polar(cx, cy, rOuter, a0);
  const o1 = polar(cx, cy, rOuter, a1);
  const i1 = polar(cx, cy, rInner, a1);
  const i0 = polar(cx, cy, rInner, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i0.x} ${i0.y}`,
    'Z',
  ].join(' ');
}

/**
 * Donut chart — premium soft-depth part-to-whole viz. A thick ring of same-hue
 * gradient slices around a bold center metric, with a hover-synced legend grid
 * below (dot + name + amount + share). Large slices carry their % on the ring.
 * Hovering a slice (or its legend row) lifts the slice and halos it; the rest dim.
 */
export function PieChart({
  slices,
  formatValue = (n) => String(n),
  size = 196,
  centerValue,
  centerLabel,
  className,
}: PieChartProps) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const data = slices.filter((s) => s.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  const pad = 16; // room for the hover halo so it never clips
  const r = size / 2;
  const rInner = r * 0.62;
  const cx = pad + r;
  const cy = pad + r;
  const box = size + pad * 2;
  const gap = 0.012; // radians of breathing room between slices

  let acc = 0;
  const arcs = data.map((d) => {
    const frac = d.value / total;
    const a0 = acc * TAU + gap / 2;
    const a1 = (acc + frac) * TAU - gap / 2;
    acc += frac;
    return { ...d, a0: Math.min(a0, a1), a1, mid: (a0 + a1) / 2, pct: frac * 100 };
  });

  return (
    <div className={cn('flex flex-col items-center gap-5 sm:flex-row sm:gap-7', className)}>
      <svg
        viewBox={`0 0 ${box} ${box}`}
        className="block w-full max-w-[240px] shrink-0"
        role="img"
        aria-label={arcs.map((a) => `${a.label} ${a.pct.toFixed(0)}%`).join(', ')}
      >
        <defs>
          {arcs.map((a, i) => (
            <linearGradient key={i} id={gradId(uid, i)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={a.color} stopOpacity={GRAD.fill.top} />
              <stop offset="100%" stopColor={a.color} stopOpacity={GRAD.fill.bottom} />
            </linearGradient>
          ))}
          {arcs.map((a, i) => (
            <filter key={i} id={`${gradId(uid, i)}-glow`} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1" stdDeviation="3.5" floodColor={a.color} floodOpacity="0.5" />
            </filter>
          ))}
        </defs>

        {arcs.map((a, i) => {
          const dim = hover != null && hover !== i;
          const lifted = hover === i;
          const off = lifted ? polar(0, 0, 5, a.mid) : { x: 0, y: 0 };
          const onRing = polar(cx, cy, (r + rInner) / 2, a.mid);
          return (
            <g
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="cursor-default"
            >
              <path
                d={segment(cx, cy, r, rInner, a.a0, a.a1)}
                fill={`url(#${gradId(uid, i)})`}
                stroke="var(--color-bg)"
                strokeWidth={2}
                strokeLinejoin="round"
                transform={`translate(${off.x} ${off.y})`}
                filter={lifted ? `url(#${gradId(uid, i)}-glow)` : undefined}
                style={{ opacity: dim ? 0.4 : 1, transition: 'opacity 160ms, transform 180ms ease-out' }}
              />
              {a.pct >= 8 && (
                <text
                  x={onRing.x + off.x}
                  y={onRing.y + off.y + 4}
                  textAnchor="middle"
                  className="pointer-events-none fill-white text-[11px] font-semibold"
                  style={{ opacity: dim ? 0.4 : 1, transition: 'opacity 160ms' }}
                >
                  {a.pct.toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}

        {/* center metric */}
        {(centerValue || centerLabel) && (
          <g className="pointer-events-none">
            {centerLabel && (
              <text
                x={cx}
                y={cy - 8}
                textAnchor="middle"
                className="fill-ink-3 text-[10px] font-medium uppercase"
                style={{ letterSpacing: '0.06em' }}
              >
                {centerLabel}
              </text>
            )}
            {centerValue && (
              <text
                x={cx}
                y={cy + 12}
                textAnchor="middle"
                className="fill-ink font-mono text-[17px] font-semibold"
              >
                {centerValue}
              </text>
            )}
          </g>
        )}
      </svg>

      {/* legend grid — hover-synced with the ring */}
      <ul className="grid w-full grid-cols-1 gap-1.5 sm:max-w-[260px] sm:grid-cols-1">
        {arcs.map((a, i) => {
          const active = hover === i;
          const dim = hover != null && !active;
          return (
            <li
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors',
                active && 'bg-bg-2',
              )}
              style={{ opacity: dim ? 0.5 : 1 }}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{a.label}</span>
              <span className="shrink-0 font-mono text-[12.5px] text-ink">{formatValue(a.value)}</span>
              <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-ink-4">
                {a.pct.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
