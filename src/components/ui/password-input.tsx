import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Password field with a built-in show/hide eye toggle. Matches the regular Input
 * styling so it lines up next to email/text inputs in the same form. Used on
 * every form that takes a hidden value (login pages, signup, future change-password).
 */
type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

const baseField =
  'w-full rounded-md border border-line-2 bg-bg px-3 py-2 text-[14px] text-ink ' +
  'placeholder:text-ink-4 placeholder:font-normal ' +
  'focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/20 ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-bg-2';

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, ...rest }, ref) {
    const [revealed, setRevealed] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={revealed ? 'text' : 'password'}
          className={cn(baseField, 'h-9 pr-10', className)}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
          className={cn(
            'absolute inset-y-0 right-0 grid w-9 place-items-center text-ink-3',
            'hover:text-ink focus-visible:outline-none focus-visible:text-ink',
          )}
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
