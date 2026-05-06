import { useEffect, useRef, useState } from 'react';

/**
 * Animate a number from 0 to `value` over `duration` ms using easeOutQuart.
 * Re-runs whenever `value` changes (so a fetch landing later still gets animated
 * from the placeholder zero). Returns `null` while value is unknown so callers
 * can show a skeleton.
 */
export function useCountUp(value: number | undefined, duration = 1200): number | null {
  const [shown, setShown] = useState<number | null>(value == null ? null : 0);
  const frame = useRef<number | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (value == null) {
      setShown(null);
      return;
    }

    if (frame.current != null) cancelAnimationFrame(frame.current);
    start.current = null;
    const target = value;
    const from = 0;

    const tick = (now: number) => {
      if (start.current == null) start.current = now;
      const elapsed = now - start.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      const current = from + (target - from) * eased;
      setShown(target >= 100 ? Math.round(current) : Math.round(current * 100) / 100);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [value, duration]);

  return shown;
}
