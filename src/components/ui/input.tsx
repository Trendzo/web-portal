import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Underline-style fields — single hairline at the bottom that thickens on focus, no
 * full-bordered box. Mono modifier flips the typeface for SKUs / GSTINs / IDs.
 */

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }
>(function Input({ className, mono, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn('field-underline text-[15px] leading-snug', mono && 'font-mono text-sm', className)}
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
        className={cn('field-underline text-[15px] leading-snug resize-y', className)}
        {...rest}
      />
    );
  },
);
