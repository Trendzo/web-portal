import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Mark } from '@/components/ui/mark';

type AuthShellProps = {
  title: ReactNode;
  kicker?: string;
  blurb?: ReactNode;
  /** Right column overline shown above the form. */
  pretitle?: string;
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * Two-column auth layout. Left = headline + blurb. Right = the form on a paper card
 * with an offset ink plate behind. No decorative byline / kicker chrome.
 */
export function AuthShell({ title, kicker, blurb, pretitle, footer, children }: AuthShellProps) {
  return (
    <div className="flex min-h-full flex-col bg-paper">
      <header className="border-b border-rule px-5 sm:px-10 py-5">
        <div className="mx-auto flex max-w-[1360px] items-center justify-between">
          <Link to="/" aria-label="ClosetX home">
            <Mark size="md" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.16em] text-ink-3 hover:text-ink"
          >
            <ArrowLeft className="size-3.5" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1360px] px-5 sm:px-10 py-14 sm:py-20" data-stagger>
        <div className="grid items-start gap-14 lg:grid-cols-12 lg:gap-20">
          <section className="lg:col-span-7">
            {kicker && <div className="kicker mb-5 text-ink-3">{kicker}</div>}
            <h1 className="editorial text-[48px] sm:text-[68px] lg:text-[80px] text-ink">
              {title}
            </h1>
            {blurb && (
              <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-ink-2">{blurb}</p>
            )}
          </section>

          <section className="lg:col-span-5">
            <div className="relative">
              <div aria-hidden className="absolute inset-0 translate-x-1.5 translate-y-1.5 bg-ink/85" />
              <div className="relative border border-ink bg-surface p-7 sm:p-9">
                {pretitle && <div className="kicker mb-4 text-ink-3">{pretitle}</div>}
                {children}
                {footer && (
                  <p className="mt-6 border-t border-rule pt-4 text-center text-[13px] text-ink-2">
                    {footer}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
