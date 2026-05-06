import { useCountUp } from '@/lib/useCountUp';
import { cn } from '@/lib/cn';

type CountProps = {
  value: number | undefined;
  /** Optional currency-style prefix, e.g. "$" or "₹". */
  prefix?: string | undefined;
  /** Optional suffix (e.g. "%" or "K"). */
  suffix?: string | undefined;
  /** Show a thousands separator. */
  format?: 'plain' | 'comma';
  className?: string | undefined;
  duration?: number | undefined;
};

/**
 * Animated number counter. Mounts at 0, walks up to `value` over `duration` ms.
 * Renders an em-dash placeholder while value is unknown so layout doesn't shift.
 */
export function Count({
  value,
  prefix,
  suffix,
  format = 'comma',
  className,
  duration = 1200,
}: CountProps) {
  const shown = useCountUp(value, duration);
  if (shown == null) {
    return <span className={cn('tabular text-ink-4', className)}>—</span>;
  }
  const text = format === 'comma'
    ? shown.toLocaleString(undefined, { maximumFractionDigits: shown < 100 ? 2 : 0 })
    : String(shown);
  return (
    <span className={cn('tabular', className)}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}
