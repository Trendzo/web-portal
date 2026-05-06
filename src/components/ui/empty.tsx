import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type EmptyProps = {
  kicker?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Empty state — like a blank gallery wall, with a kicker / title / optional CTA. */
export function Empty({ kicker = 'Nothing to show', title, description, action, className }: EmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'border border-dashed border-rule-strong bg-surface/40',
        'px-6 py-20 rounded-xs',
        className,
      )}
    >
      <div className="kicker mb-4">— {kicker} —</div>
      <h3 className="font-display italic text-[36px] leading-[0.95] max-w-md text-ink">{title}</h3>
      {description && (
        <p className="mt-3 max-w-md text-sm text-ink-2 leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
