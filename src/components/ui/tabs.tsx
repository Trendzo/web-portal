import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/cn';

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...rest }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex items-center gap-0.5 border-b border-line w-full',
        className,
      )}
      {...rest}
    />
  );
});

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...rest }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'relative -mb-px px-3 py-2 text-[13px] font-medium ' +
          'text-ink-3 hover:text-ink transition-colors ' +
          'border-b-2 border-transparent ' +
          'data-[state=active]:text-ink data-[state=active]:border-accent ' +
          'focus-visible:outline-none focus-visible:bg-bg-3 rounded-t-md',
        className,
      )}
      {...rest}
    />
  );
});

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...rest }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn('mt-5 focus-visible:outline-none', className)}
      {...rest}
    />
  );
});
