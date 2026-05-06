import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/cn';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const Overlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function Overlay({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn('fixed inset-0 z-50 bg-ink/45 backdrop-blur-[1px]', className)}
      {...rest}
    />
  );
});

type Side = 'top' | 'right' | 'left' | 'bottom';

const sideStyles: Record<Side, string> = {
  top: 'inset-x-0 top-0 border-b border-ink',
  bottom: 'inset-x-0 bottom-0 border-t border-ink',
  left: 'inset-y-0 left-0 w-80 border-r border-ink',
  right: 'inset-y-0 right-0 w-80 border-l border-ink',
};

export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: Side }
>(function SheetContent({ className, side = 'top', children, ...rest }, ref) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-50 bg-paper text-ink shadow-[0_8px_30px_-12px_rgba(26,20,16,0.35)]',
          'focus-visible:outline-none flex flex-col',
          sideStyles[side],
          className,
        )}
        {...rest}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function SheetHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4 border-b border-rule', className)} {...rest} />;
}
