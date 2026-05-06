import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from 'react';
import * as DM from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/cn';

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DM.Content>,
  ComponentPropsWithoutRef<typeof DM.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, align = 'end', ...rest }, ref) {
  return (
    <DM.Portal>
      <DM.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-[280px] overflow-hidden rounded-xs',
          'border border-ink bg-surface shadow-[4px_4px_0_-1px_rgba(26,20,16,0.18)]',
          'p-1 text-ink',
          className,
        )}
        {...rest}
      />
    </DM.Portal>
  );
});

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof DM.Item>,
  ComponentPropsWithoutRef<typeof DM.Item>
>(function DropdownMenuItem({ className, ...rest }, ref) {
  return (
    <DM.Item
      ref={ref}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xs px-2 py-2 text-[13.5px] cursor-default outline-none',
        'focus:bg-paper-2 hover:bg-paper-2',
        'data-[disabled]:opacity-60 data-[disabled]:cursor-not-allowed',
        className,
      )}
      {...rest}
    />
  );
});

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof DM.Separator>,
  ComponentPropsWithoutRef<typeof DM.Separator>
>(function DropdownMenuSeparator({ className, ...rest }, ref) {
  return <DM.Separator ref={ref} className={cn('my-1 h-px bg-rule', className)} {...rest} />;
});

export function DropdownMenuLabel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('kicker px-2 pt-2 pb-1 text-ink-3', className)} {...rest} />;
}
