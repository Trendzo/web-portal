import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const Overlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function Overlay({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        className,
      )}
      {...rest}
    />
  );
});

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(function DialogContent({ className, children, ...rest }, ref) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-lg ' +
            '-translate-x-1/2 -translate-y-1/2 flex-col max-h-[calc(100vh-2rem)] ' +
            'bg-bg border border-line rounded-xl shadow-lg ' +
            'focus-visible:outline-none',
          className,
        )}
        {...rest}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
          {children}
        </div>
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute right-3 top-3 p-1.5 text-ink-3 hover:text-ink hover:bg-bg-3 rounded-md transition-colors"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function DialogHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-5 space-y-1.5', className)} {...rest} />;
}

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-[17px] font-semibold text-ink leading-snug', className)}
      {...rest}
    />
  );
});

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-[13px] text-ink-3 leading-relaxed', className)}
      {...rest}
    />
  );
});

export function DialogFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-6 flex items-center justify-end gap-2', className)}
      {...rest}
    />
  );
}
