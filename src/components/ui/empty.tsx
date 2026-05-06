import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type EmptyProps = {
  icon?: ReactNode;
  kicker?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function Empty({ icon, kicker, title, description, action, className }: EmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-line-2 ' +
          'bg-bg-2/40 px-6 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-bg-3 text-ink-3">
          {icon}
        </div>
      )}
      {kicker && <div className="kicker mb-1.5">{kicker}</div>}
      <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] text-ink-3 leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
