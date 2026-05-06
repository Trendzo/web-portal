import { useMemo, useState, useId } from 'react';
import { cn } from '@/lib/cn';

export type Series = {
  /** Display label, used in tooltip + legend. */
  label: string;
  /** Pure colour or CSS variable reference; we paint stroke + gradient with it. */
  color: string;
  /** One value per point, aligned to the labels array. */
  values: number[];
};

type LineChartProps = {
  /** X-axis tick labels, one per data point. */
  labels: string[];
  series: Series[];
  /** Pretty-print a y-axis value (e.g. "$15K"). */
  formatY?: (n: number) => string;
  /** Chart height in px (width auto-fills container). */
  height?: number;
  className?: string;
  /** Show the soft gradient under the highest-emphasis (first) series. */
  fillFirst?: boolean;
};

/**
 * Modern responsive line chart implemented as inline SVG.
 *  - Smooth Catmull-Rom-ish curve via Bezier control points
 *  - Gradient area under the primary series
 *  - Hover tooltip that follows the nearest x-tick
 *  - Animated stroke on first paint via the `.draw-line` keyframe
 */
export function LineChart({
  labels,
  series,
  formatY = (n) => String(n),
  height = 240,
  className,
  fillFirst = true,
}: LineChartProps) {
  const id = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const width = 800; // viewBox unit; SVG scales to container
  const padTop = 12;
  const padBottom = 32;
  const padLeft = 48;
  const padRight = 16;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const { yMin, yMax, yTicks } = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    if (all.length === 0) return { yMin: 0, yMax: 1, yTicks: [0, 0.5, 1] };
    let min = Math.min(...all);
    let max = Math.max(...all);
    if (min === max) {
      min = min - 1;
      max = max + 1;
    }
    // Round bounds to nice numbers
    const range = max - min;
    const pad = range * 0.15;
    const lo = Math.max(0, min - pad);
    const hi = max + pad;
    const step = (hi - lo) / 4;
    return {
      yMin: lo,
      yMax: hi,
      yTicks: [lo, lo + step, lo + 2 * step, lo + 3 * step, hi],
    };
  }, [series]);

  const x = (i: number) => padLeft + (innerW * i) / Math.max(1, labels.length - 1);
  const y = (v: number) => padTop + innerH * (1 - (v - yMin) / Math.max(0.0001, yMax - yMin));

  const linePath = (vals: number[]) => {
    if (vals.length === 0) return '';
    const pts: Array<[number, number]> = vals.map((v, i) => [x(i), y(v)]);
    const first = pts[0];
    if (!first) return '';
    let d = `M ${first[0]} ${first[1]}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      if (!prev || !curr) continue;
      const cx = (prev[0] + curr[0]) / 2;
      d += ` C ${cx} ${prev[1]}, ${cx} ${curr[1]}, ${curr[0]} ${curr[1]}`;
    }
    return d;
  };

  const areaPath = (vals: number[]) => {
    const line = linePath(vals);
    if (!line) return '';
    const lastX = x(vals.length - 1);
    const baseY = padTop + innerH;
    return `${line} L ${lastX} ${baseY} L ${padLeft} ${baseY} Z`;
  };

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const svg = e.currentTarget;
          const rect = svg.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * width;
          const i = Math.round(((px - padLeft) / innerW) * (labels.length - 1));
          setHover(Math.max(0, Math.min(labels.length - 1, i)));
        }}
      >
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`g-${id}-${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* horizontal grid */}
        {yTicks.map((t, i) => (
          <line
            key={i}
            x1={padLeft}
            x2={width - padRight}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--color-line)"
            strokeDasharray="3 4"
            strokeWidth="1"
            opacity={i === 0 ? 0 : 1}
          />
        ))}

        {/* y-axis labels */}
        {yTicks.map((t, i) => (
          <text
            key={i}
            x={padLeft - 8}
            y={y(t) + 4}
            textAnchor="end"
            className="fill-ink-4"
            style={{ fontSize: 11, fontFamily: 'var(--font-sans)' }}
          >
            {formatY(t)}
          </text>
        ))}

        {/* x-axis labels */}
        {labels.map((label, i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 10}
            textAnchor="middle"
            className="fill-ink-4"
            style={{ fontSize: 11, fontFamily: 'var(--font-sans)' }}
          >
            {label}
          </text>
        ))}

        {/* series — paint areas first so lines sit on top */}
        {series.map((s, i) => (
          fillFirst && i === 0 ? (
            <path
              key={`area-${i}`}
              d={areaPath(s.values)}
              fill={`url(#g-${id}-${i})`}
              opacity={0.9}
            />
          ) : null
        ))}
        {series.map((s, i) => (
          <path
            key={`line-${i}`}
            d={linePath(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="draw-line"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}

        {/* hover crosshair + dots */}
        {hover != null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padTop}
              y2={padTop + innerH}
              stroke="var(--color-line-strong)"
              strokeDasharray="2 3"
              strokeWidth="1"
            />
            {series.map((s, i) => (
              <circle
                key={i}
                cx={x(hover)}
                cy={y(s.values[hover] ?? 0)}
                r={4}
                fill="var(--color-bg)"
                stroke={s.color}
                strokeWidth={2}
              />
            ))}
          </>
        )}
      </svg>

      {hover != null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full surface-card px-3 py-2 text-[12px] shadow-md"
          style={{
            left: `${(x(hover) / width) * 100}%`,
            top: '12%',
            minWidth: 130,
          }}
        >
          <div className="kicker mb-1">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-ink-3">
                <span className="size-1.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="font-medium text-ink tabular">
                {formatY(s.values[hover] ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
