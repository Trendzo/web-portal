import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Page container — comfortable max-width, generous gutters at desktop, edge-to-edge on mobile.
 */
export function Page({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-stagger
      className={cn(
        // Container scales with the viewport so large monitors don't leave wide
        // empty gutters: 1600px cap by default, widening (and padding stepping up)
        // through the xl / 2xl breakpoints. Pass a `max-w-*` to override per-page.
        'mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8 2xl:max-w-[1880px] 2xl:px-10',
        className,
      )}
      {...rest}
    />
  );
}

type PageHeaderProps = {
  /** Optional kicker label above the title — keep it brief. */
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Page header — kicker / title / description / actions in a clean flex row.
 * Title is heavy weight body text, not display serif. No decorative rule.
 */
export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-6 sm:mb-8', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          {kicker && <div className="kicker mb-1.5">{kicker}</div>}
          <h1 className="text-[22px] sm:text-[26px] font-semibold text-ink leading-tight tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-[13.5px] text-ink-3 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </header>
  );
}

/** Section heading inside a page (smaller than PageHeader). */
export function SectionHeading({
  kicker,
  title,
  hint,
}: {
  kicker?: string;
  title: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        {kicker && <div className="kicker mb-1">{kicker}</div>}
        <h2 className="text-[15px] font-semibold text-ink leading-tight">{title}</h2>
      </div>
      {hint && <div className="text-[12px] text-ink-3">{hint}</div>}
    </div>
  );
}
