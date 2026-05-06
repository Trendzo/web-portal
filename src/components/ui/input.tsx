import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const baseField =
  'w-full rounded-md border border-line-2 bg-bg px-3 py-2 text-[14px] text-ink ' +
  'placeholder:text-ink-4 placeholder:font-normal ' +
  'focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/20 ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-60 ' +
  'disabled:bg-bg-2';

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }
>(function Input({ className, mono, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(baseField, 'h-9', mono && 'font-mono text-[13px]', className)}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(baseField, 'resize-y leading-relaxed', className)}
        {...rest}
      />
    );
  },
);
