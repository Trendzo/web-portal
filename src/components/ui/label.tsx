import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/cn';

/**
 * Label — small caps + tracking, kicker style, sits above an underline input.
 */
type LabelProps = ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & {
  required?: boolean;
  hint?: ReactNode;
};

export const Label = forwardRef<ElementRef<typeof LabelPrimitive.Root>, LabelProps>(
  function Label({ className, children, required, hint, ...rest }, ref) {
    return (
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <LabelPrimitive.Root
          ref={ref}
          className={cn(
            'kicker text-ink-2',
            className,
          )}
          {...rest}
        >
          {children}
          {required && <span className="ml-1 text-danger lowercase">·</span>}
        </LabelPrimitive.Root>
        {hint && (
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-3">{hint}</span>
        )}
      </div>
    );
  },
);

type FieldErrorChild =
  | ReactNode
  | { message?: string | undefined }
  | undefined;

/** Inline error — shows beneath fields. Accepts either text or an RHF FieldError. */
export function FieldError({ children }: { children?: FieldErrorChild }) {
  if (children == null || children === false) return null;
  const text =
    typeof children === 'object' && 'message' in (children as object)
      ? (children as { message?: string | undefined }).message
      : (children as ReactNode);
  if (!text) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-danger">
      <span aria-hidden>·</span>
      <span>{text}</span>
    </p>
  );
}
