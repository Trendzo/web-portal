import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Mark } from '@/components/ui/mark';

type AuthShellProps = {
  /** Short kicker label above the title (e.g. "Admin sign in"). */
  kicker?: string;
  title: ReactNode;
  /** Sentence describing what happens after sign in. */
  blurb?: ReactNode;
  /** Bullet list of features / value props shown on the marketing pane. */
  highlights?: ReactNode[];
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * Two-column auth layout. Marketing/context on the left, form on the right.
 * On mobile it stacks: form first, marketing collapses below.
 */
export function AuthShell({ kicker, title, blurb, highlights, footer, children }: AuthShellProps) {
  return (
    <div className="flex min-h-full flex-col bg-bg lg:bg-bg-2">
      <header className="border-b border-line bg-bg">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" aria-label="Trendzo home">
            <Mark size="md" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1400px] px-5 sm:px-8 py-8 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-16">
          {/* Form (mobile: first, desktop: right) */}
          <section className="lg:col-span-5 lg:col-start-8 lg:row-start-1 order-1 lg:order-2">
            <div className="bg-bg border border-line rounded-xl shadow-sm p-6 sm:p-8 accent-strip">
              {kicker && <div className="kicker mb-3">{kicker}</div>}
              <h1 className="text-[24px] font-semibold text-ink leading-tight tracking-tight mb-2">
                {title}
              </h1>
              {blurb && (
                <p className="text-[13.5px] text-ink-3 leading-relaxed mb-6">{blurb}</p>
              )}
              {children}
              {footer && (
                <p className="mt-5 pt-5 border-t border-line text-center text-[13px] text-ink-3">
                  {footer}
                </p>
              )}
            </div>
          </section>

          {/* Marketing / value props (mobile: below, desktop: left) */}
          {highlights && highlights.length > 0 && (
            <aside className="lg:col-span-6 lg:row-start-1 order-2 lg:order-1 mt-2 lg:mt-0 lg:pt-2">
              <div className="kicker mb-3">What you get</div>
              <ul className="space-y-3">
                {highlights.map((h, i) => (
                  <li key={i} className="flex gap-3 text-[14px] text-ink-2 leading-relaxed">
                    <span
                      aria-hidden
                      className="mt-2 inline-block size-1.5 rounded-full bg-accent shrink-0"
                    />
                    {h}
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
