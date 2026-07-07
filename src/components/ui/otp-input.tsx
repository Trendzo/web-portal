import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

/**
 * Segmented OTP input — one box per digit. Digits only, hard-capped at `length`.
 * Typing auto-advances; Backspace on an empty box steps back; pasting a full code
 * fills every box; editing any single box replaces only that position (forward
 * boxes are untouched). `value` is the joined string, `onChange` gets the new one.
 */
export function OtpInput({
  value,
  onChange,
  length = 4,
  autoFocus = false,
  disabled = false,
  onComplete,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  onComplete?: (code: string) => void;
  className?: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.replace(/\D/g, '').slice(0, length).split('');

  const focus = (i: number) => refs.current[i]?.focus();

  function setAt(i: number, digit: string) {
    const arr = value.replace(/\D/g, '').slice(0, length).split('');
    while (arr.length < length) arr.push('');
    arr[i] = digit;
    const next = arr.join('').replace(/\s/g, '');
    onChange(next);
    if (next.length === length && !next.includes(' ')) onComplete?.(next);
    return next;
  }

  function handleChange(i: number, raw: string) {
    // Take the last typed digit (handles a box that already had a value).
    const d = raw.replace(/\D/g, '').slice(-1);
    if (!d) return;
    setAt(i, d);
    if (i < length - 1) focus(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) {
        setAt(i, '');
      } else if (i > 0) {
        setAt(i - 1, '');
        focus(i - 1);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      focus(i - 1);
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      focus(i + 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    if (pasted.length === length) onComplete?.(pasted);
    focus(Math.min(pasted.length, length - 1));
  }

  return (
    <div className={cn('flex gap-2', className)}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={digits[i] ?? ''}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-12 w-12 rounded-lg border text-center text-[20px] font-semibold tabular-nums text-ink',
            'border-line-2 bg-bg focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/20',
            'disabled:opacity-50',
          )}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
