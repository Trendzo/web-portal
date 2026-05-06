import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Workstation button — clean modern fills, clear hierarchy.
 *  - `accent`: vermillion CTA, the highest-emphasis primary action
 *  - `solid`:  ink solid for less-prominent primary
 *  - `outline`: bordered secondary
 *  - `ghost`:  transparent toolbar button
 *  - `danger`: destructive
 *  - `link`:   inline text link
 */
const button = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium ' +
    'whitespace-nowrap transition-colors press select-none ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        accent:
          'bg-accent text-accent-fg hover:bg-accent-2 shadow-xs',
        solid:
          'bg-ink text-bg hover:bg-ink-2 shadow-xs',
        // Alias for `solid` — kept for source-compatibility with the old API.
        ink:
          'bg-ink text-bg hover:bg-ink-2 shadow-xs',
        outline:
          'border border-line-2 bg-bg text-ink hover:bg-bg-2 hover:border-line-strong shadow-xs',
        ghost:
          'text-ink-2 hover:bg-bg-3 hover:text-ink',
        danger:
          'bg-danger text-white hover:brightness-110 shadow-xs',
        link:
          'text-accent underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        xs: 'h-7 px-2.5 text-[12px]',
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-9 px-3.5 text-[13.5px]',
        lg: 'h-11 px-5 text-[14.5px]',
        icon: 'h-9 w-9',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'solid', size: 'md' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    asChild?: boolean;
    loading?: boolean;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
    /** Deprecated — kept for source-compatibility with the old button API. */
    caps?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    asChild,
    loading,
    iconLeft,
    iconRight,
    children,
    disabled,
    caps: _caps,
    ...rest
  },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(button({ variant, size }), className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : iconLeft}
      <Slottable>{children}</Slottable>
      {iconRight}
    </Comp>
  );
});
