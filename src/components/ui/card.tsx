import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Section — paper surface with hairline border. Less SaaS-card, more newsprint panel.
 * Square corners by default, generous padding.
 */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'border border-rule bg-surface text-ink rounded-xs',
          'shadow-[0_1px_0_0_rgba(26,20,16,0.04),0_1px_2px_-1px_rgba(26,20,16,0.05)]',
          className,
        )}
        {...rest}
      />
    );
  },
);

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'p-6 pb-4 flex items-start justify-between gap-3 border-b border-rule',
        className,
      )}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-display italic text-[20px] leading-tight text-ink', className)}
      {...rest}
    />
  );
}

export function CardDescription({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[13px] text-ink-2 mt-1', className)} {...rest} />;
}

export function CardContent({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6', className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-6 py-4 border-t border-rule flex items-center gap-2', className)}
      {...rest}
    />
  );
}
