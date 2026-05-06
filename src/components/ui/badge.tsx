import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import type { Tone } from '@/lib/status';

/**
 * Status pill — circular dot prefix + label. The `pulse` modifier animates the dot
 * to attract eyes to "pending" / "needs action" states.
 */
const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ' +
    'text-[11px] font-medium leading-none whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-line-2 bg-bg-2 text-ink-2',
        info: 'border-info/20 bg-info-soft text-info',
        success: 'border-success/20 bg-success-soft text-success',
        warning: 'border-warning/20 bg-warning-soft text-warning',
        danger: 'border-danger/20 bg-danger-soft text-danger',
      } satisfies Record<Tone, string>,
      flat: {
        true: 'border-line bg-transparent text-ink-3',
        false: '',
      },
    },
    defaultVariants: { tone: 'neutral', flat: false },
  },
);

const dotColor: Record<Tone, string> = {
  neutral: 'bg-ink-3',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badge> & {
    pulse?: boolean | undefined;
    /** Hide the leading dot (e.g. for compact contexts). */
    nodot?: boolean | undefined;
    /** Deprecated — kept so existing callsites compile. */
    tilt?: 'l' | 'r' | 'none' | undefined;
  };

export function Badge({ className, tone, flat, pulse, nodot, tilt: _tilt, children, ...rest }: BadgeProps) {
  const t = tone ?? 'neutral';
  return (
    <span className={cn(badge({ tone: t, flat }), className)} {...rest}>
      {!nodot && (
        <span
          className={cn(
            'inline-block size-1.5 rounded-full shrink-0',
            dotColor[t],
            pulse && 'pulse-dot',
          )}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
