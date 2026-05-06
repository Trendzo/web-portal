import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Atelier button. Sharp corners, ink-on-paper. Primary actions use small caps tracking;
 * everyday actions stay sentence-case for readability.
 */
const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-xs font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 select-none press',
  {
    variants: {
      variant: {
        // Filled ink — the workhorse primary
        ink: 'bg-ink text-paper hover:bg-ink/90 active:bg-ink/95',
        // Khadi indigo accent — sparing, for the most consequential CTA on the page
        accent: 'bg-accent text-accent-fg hover:brightness-110 active:brightness-95',
        // Hairline outline — secondary
        outline: 'border border-ink text-ink bg-transparent hover:bg-ink hover:text-paper',
        // Ghost — minimal toolbar buttons
        ghost: 'text-ink hover:bg-paper-2',
        // Danger — madder red
        danger: 'bg-danger text-paper hover:brightness-110',
        // Underlined link
        link: 'text-ink underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-[12.5px]',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'h-10 w-10',
      },
      caps: {
        true: 'uppercase tracking-[0.14em] text-[11.5px]! font-semibold',
        false: '',
      },
    },
    defaultVariants: { variant: 'ink', size: 'md', caps: false },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    asChild?: boolean;
    loading?: boolean;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    caps,
    asChild,
    loading,
    iconLeft,
    iconRight,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  // `Slottable` lets Slot identify which child is the merge target when icons are
  // rendered alongside the slotted content. Without it, Slot sees multiple children
  // and React.Children.only throws.
  return (
    <Comp
      ref={ref}
      className={cn(button({ variant, size, caps }), className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : iconLeft}
      <Slottable>{children}</Slottable>
      {iconRight}
    </Comp>
  );
});
