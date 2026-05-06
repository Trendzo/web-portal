import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Password field with a built-in show/hide eye toggle. Accepts the same props as
 * <Input>; the toggle button lives on the right edge of the underline.
 */
type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, ...rest }, ref) {
    const [revealed, setRevealed] = useState(false);
    return (
      <div className="relative flex items-center">
        <input
          ref={ref}
          type={revealed ? 'text' : 'password'}
          className={cn('field-underline pr-9 text-[15px] leading-snug', className)}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
          className={cn(
            'absolute right-0 grid size-9 place-items-center text-ink-3 hover:text-ink',
            'focus-visible:outline-none focus-visible:text-ink',
          )}
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
