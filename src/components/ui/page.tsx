import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Page container — generous editorial gutters at large widths.
 * Pages stagger their children's reveal via [data-stagger] on first render.
 */
export function Page({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-stagger
      className={cn('mx-auto w-full max-w-[1280px] px-6 py-8 sm:px-10 sm:py-10', className)}
      {...rest}
    />
  );
}

type PageHeaderProps = {
  /** Optional small-caps label above the title — keep it brief. */
  kicker?: string;
  title: ReactNode;
  /** One-line plain-English description under the title. */
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Page header — kicker (optional, brief), large italic title, plain description,
 * actions, then a hairline.
 */
export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-8 sm:mb-10', className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          {kicker && <div className="kicker mb-2 text-ink-3">{kicker}</div>}
          <h1 className="editorial text-[40px] sm:text-[52px] lg:text-[64px] text-ink">
            {title}
          </h1>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 lg:mb-1">{actions}</div>
        )}
      </div>
      {description && (
        <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-ink-2">
          {description}
        </p>
      )}
      <hr className="rule mt-7" />
    </header>
  );
}

/** Section heading — smaller than PageHeader, used inside a page. */
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
    <div className="mb-5 flex items-end justify-between gap-3 border-b border-rule pb-3">
      <div>
        {kicker && <div className="kicker mb-1 text-ink-3">{kicker}</div>}
        <h2 className="font-display italic text-[22px] sm:text-[26px] leading-tight tracking-tight">
          {title}
        </h2>
      </div>
      {hint && <div className="text-[12px] uppercase tracking-[0.14em] text-ink-3">{hint}</div>}
    </div>
  );
}
