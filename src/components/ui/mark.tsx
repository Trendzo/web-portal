import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Brand wordmark. Trendzo — tight wordmark, no editorial flourish.
 */
type MarkProps = HTMLAttributes<HTMLDivElement> & {
  kicker?: string;
  size?: 'sm' | 'md' | 'lg';
};

const sizeClass: Record<NonNullable<MarkProps['size']>, string> = {
  sm: 'text-[18px]',
  md: 'text-[20px]',
  lg: 'text-[28px]',
};

export function Mark({ kicker, size = 'md', className, ...rest }: MarkProps) {
  return (
    <div className={cn('flex flex-col leading-none', className)} {...rest}>
      <div className={cn('font-semibold tracking-tight text-ink', sizeClass[size])}>
        Trendzo
      </div>
      {kicker && (
        <div className="mt-1 text-[10.5px] uppercase tracking-[0.12em] text-ink-3 font-medium">
          {kicker}
        </div>
      )}
    </div>
  );
}
