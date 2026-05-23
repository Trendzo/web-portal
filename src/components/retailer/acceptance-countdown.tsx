import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'chip' | 'inline';

/**
 * Generic live-countdown chip. Originally the acceptance window helper; reused
 * for the try-on door visit (§9). Caller supplies the deadline + label.
 */
export function AcceptanceCountdown({
  deadlineAt,
  variant = 'chip',
  label = 'Acceptance window',
  className,
}: {
  deadlineAt: string | null | undefined;
  variant?: Variant;
  label?: string;
  className?: string;
}) {
  const expiresAt = deadlineAt ? new Date(deadlineAt).getTime() : null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [expiresAt]);

  if (!expiresAt) {
    return variant === 'inline' ? (
      <span className={cn('text-[11px] text-ink-4', className)}>—</span>
    ) : null;
  }

  const remainingMs = expiresAt - now;
  const expired = remainingMs <= 0;
  const mm = Math.max(0, Math.floor(remainingMs / 60_000));
  const ss = Math.max(0, Math.floor((remainingMs % 60_000) / 1000));
  const timeLabel = expired ? 'expired' : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  const tone = expired
    ? 'border-danger/30 bg-danger-soft text-danger'
    : remainingMs < 60_000
      ? 'border-warning/40 bg-warning-soft text-warning'
      : 'border-info/30 bg-info-soft text-info';

  if (variant === 'inline') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 font-mono text-[11.5px]',
          expired ? 'text-danger' : remainingMs < 60_000 ? 'text-warning' : 'text-ink-3',
          className,
        )}
        title={label}
      >
        {timeLabel}
      </span>
    );
  }

  return (
    <div
      className={cn(
        'mt-3 inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px]',
        tone,
        className,
      )}
    >
      <span className="font-semibold uppercase tracking-wide text-[11px]">{label}</span>
      <span className="font-mono">{expired ? 'expired' : `${timeLabel} left`}</span>
    </div>
  );
}
