import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/cn';

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
          className={cn('text-[12.5px] font-medium text-ink-2', className)}
          {...rest}
        >
          {children}
          {required && <span className="ml-0.5 text-accent">*</span>}
        </LabelPrimitive.Root>
        {hint && <span className="text-[11.5px] text-ink-3 font-normal">{hint}</span>}
      </div>
    );
  },
);

type FieldErrorChild =
  | ReactNode
  | { message?: string | undefined }
  | undefined;

export function FieldError({ children }: { children?: FieldErrorChild }) {
  if (children == null || children === false) return null;
  const text =
    typeof children === 'object' && 'message' in (children as object)
      ? (children as { message?: string | undefined }).message
      : (children as ReactNode);
  if (!text) return null;
  return <p className="mt-1.5 text-[12px] text-danger leading-snug">{text}</p>;
}
