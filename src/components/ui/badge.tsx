import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import type { Tone } from '@/lib/status';

/**
 * Stamp badge — square, hairline-bordered, slightly rotated like an ink stamp.
 * Use the `flat` tone for a simple meta tag (no rotation, less visual weight).
 */
const stamp = cva('stamp', {
  variants: {
    tone: {
      neutral: 'text-ink-2 bg-paper-2 border-rule-strong',
      info: 'text-info bg-info-soft border-info/30',
      success: 'text-success bg-success-soft border-success/30',
      warning: 'text-warning bg-warning-soft border-warning/30',
      danger: 'text-danger bg-danger-soft border-danger/30',
    } satisfies Record<Tone, string>,
    flat: {
      true: '!transform-none !border-rule !bg-transparent text-ink-2 !tracking-[0.12em] !text-[10px]',
      false: '',
    },
    tilt: {
      l: 'tilt-l',
      r: 'tilt-r',
      none: '!transform-none',
    },
  },
  defaultVariants: { tone: 'neutral', tilt: 'none' },
});

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof stamp>;

export function Badge({ className, tone, flat, tilt, ...rest }: BadgeProps) {
  return <span className={cn(stamp({ tone, flat, tilt }), className)} {...rest} />;
}
