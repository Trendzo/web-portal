import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * The brand wordmark — Fraunces italic Closet, then a thin separator, then a roman X.
 * Used in the masthead. Optional `kicker` underneath (e.g. "Admin", "Retailer").
 */
type MarkProps = HTMLAttributes<HTMLDivElement> & {
  kicker?: string;
  size?: 'sm' | 'md' | 'lg';
};

const sizeClass: Record<NonNullable<MarkProps['size']>, string> = {
  sm: 'text-[22px]',
  md: 'text-[28px]',
  lg: 'text-[36px]',
};

export function Mark({ kicker, size = 'md', className, ...rest }: MarkProps) {
  return (
    <div className={cn('flex flex-col leading-none', className)} {...rest}>
      <div className={cn('flex items-baseline font-display', sizeClass[size])}>
        <span className="italic font-medium tracking-[-0.02em]">Closet</span>
        <span aria-hidden className="mx-1 text-ink-3 font-light italic">/</span>
        <span className="font-medium not-italic tracking-[0.02em]">X</span>
      </div>
      {kicker && (
        <div className="mt-1 kicker text-ink-3">{kicker}</div>
      )}
    </div>
  );
}
