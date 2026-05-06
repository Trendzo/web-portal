import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(function SelectTrigger({ className, children, ...rest }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line-2 ' +
          'bg-bg px-3 py-2 text-[13.5px] text-ink ' +
          'transition-colors hover:border-line-strong ' +
          'focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/20 ' +
          'data-[placeholder]:text-ink-4 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...rest}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 text-ink-3" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent({ className, children, position = 'popper', ...rest }, ref) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        sideOffset={4}
        className={cn(
          'relative z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden ' +
            'rounded-lg border border-line bg-bg shadow-md',
          className,
        )}
        {...rest}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className, children, ...rest }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex w-full cursor-default select-none items-center gap-2 rounded-md ' +
          'py-1.5 pl-2 pr-8 text-[13px] text-ink ' +
          'outline-none focus:bg-bg-3 ' +
          'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...rest}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3.5 text-accent" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
});
