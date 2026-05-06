import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Surface card. Add `accent-strip` class to draw the vermillion top-strip
 * (used for the page's primary action card).
 */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-bg border border-line rounded-lg shadow-xs text-ink',
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
      className={cn('flex items-start justify-between gap-3 px-5 pt-4 pb-3', className)}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-[15px] font-semibold text-ink leading-snug', className)}
      {...rest}
    />
  );
}

export function CardDescription({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[12.5px] text-ink-3 mt-0.5 leading-relaxed', className)} {...rest} />;
}

export function CardContent({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5', className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-2 px-5 py-3 border-t border-line bg-bg-2/50', className)}
      {...rest}
    />
  );
}
