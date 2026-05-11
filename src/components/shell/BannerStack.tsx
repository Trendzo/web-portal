import { Link } from 'react-router-dom';
import { ArrowUpRight, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { type BannerTone, useBannerStack } from '@/lib/banners';
import { Button } from '@/components/ui/button';

const toneStyles: Record<BannerTone, { container: string; kicker: string }> = {
  info: {
    container: 'border-info/30 bg-info-soft/40',
    kicker: 'text-info',
  },
  warning: {
    container: 'border-warning/30 bg-warning-soft/40',
    kicker: 'text-warning',
  },
  danger: {
    container: 'border-danger/30 bg-danger-soft/40',
    kicker: 'text-danger',
  },
  success: {
    container: 'border-success/30 bg-success-soft/40',
    kicker: 'text-success',
  },
};

/**
 * Vertical stack of dismissible banners rendered between the top bar and the
 * page outlet. Empty stack renders nothing (no spacer reserved). Order matches
 * push order — first pushed renders on top.
 */
export function BannerStack() {
  const banners = useBannerStack((s) => s.banners);
  const dismissBanner = useBannerStack((s) => s.dismissBanner);
  if (banners.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-b border-line bg-bg/50 px-4 py-2 sm:px-6">
      {banners.map((b) => {
        const t = toneStyles[b.tone];
        return (
          <div
            key={b.id}
            role="status"
            className={cn('flex items-start gap-3 rounded-md border px-3 py-2', t.container)}
          >
            <div className="min-w-0 flex-1">
              <div className={cn('text-[11px] font-semibold uppercase tracking-wide', t.kicker)}>
                {b.kind.replace(/_/g, ' ')}
              </div>
              <div className="mt-0.5 text-[13.5px] font-medium text-ink">{b.title}</div>
              {b.body && <p className="mt-0.5 text-[12.5px] text-ink-2">{b.body}</p>}
            </div>
            {b.cta && (
              <div className="shrink-0">
                {b.cta.href ? (
                  <Button
                    asChild
                    size="sm"
                    variant="ink"
                    iconRight={<ArrowUpRight className="size-3.5" />}
                  >
                    <Link to={b.cta.href}>{b.cta.label}</Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="ink" onClick={b.cta.onClick}>
                    {b.cta.label}
                  </Button>
                )}
              </div>
            )}
            {b.dismissible && (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismissBanner(b.id)}
                className="-m-1.5 shrink-0 rounded-md p-1.5 text-ink-3 hover:bg-bg-3 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
