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
      className={cn('fixed inset-0 z-50 bg-black/50 backdrop-blur-sm', className)}
      {...rest}
    />
  );
});

type Side = 'top' | 'right' | 'left' | 'bottom';
const sideStyles: Record<Side, string> = {
  top: 'inset-x-0 top-0 border-b border-line',
  bottom: 'inset-x-0 bottom-0 border-t border-line',
  left: 'inset-y-0 left-0 w-80 max-w-[85vw] border-r border-line',
  right: 'inset-y-0 right-0 w-80 max-w-[85vw] border-l border-line',
};

export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: Side }
>(function SheetContent({ className, side = 'left', children, ...rest }, ref) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-50 bg-bg text-ink shadow-lg flex flex-col focus-visible:outline-none',
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
  return <div className={cn('px-5 py-4 border-b border-line', className)} {...rest} />;
}
