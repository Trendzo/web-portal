import { lazy, Suspense } from 'react';
import type { CSSProperties } from 'react';
import { Bell } from 'lucide-react';
import { contrastRatio, AA_LARGE } from '@/lib/contrast';
import type { ThemeChrome, ThemeCopy, ThemeDecor, ThemePreviewInput, ThemeTokens } from '@/lib/types';

/**
 * Phone-frame theme preview — a static HTML approximation of the consumer app's
 * home screen with a festival theme applied. It exists so an admin can eyeball a
 * draft (or a resolver winner) without a device build: every themable surface —
 * accent, header chrome, decor, copy — is driven by CSS vars computed per render,
 * so the frame repaints live as the editor types.
 *
 * `theme === null` renders the pure LIGHT fallback: what phones show when no
 * theme wins (the bundled look).
 */

/* mirror of consumer-app src/theme/brutal.ts LIGHT — approximation only; keep in lockstep */
const LIGHT = {
  bg: '#FFFFFF',
  ink: '#000000',
  dim: '#666666',
  hairline: '#e6e6e6',
  accent: '#F2E63C',
  accentInk: '#111111',
  accentSoft: '#FCF8D8',
  surfaceAlt: '#F4F4F4',
};

/** Frame is ~300px wide, scaled from a 390pt device. */
const PREVIEW_SCALE = 300 / 390;

// Lazy: lottie-web (~250 KB) stays out of the bundle until a lottie decor is previewed.
const LottiePreview = lazy(() => import('./lottie-preview'));

/** Un-themed chrome — the bundled app's white-on-photo hero header. */
const FALLBACK_CHROME: ThemeChrome = {
  statusBarStyle: 'light',
  header: { kind: 'default' },
  tabBar: {},
};
const FALLBACK_DECOR: ThemeDecor = { kind: 'none', respectReduceMotion: true };

const TABS = ['Home', 'Reel', 'Category', 'Bag'] as const;

export function PhonePreview({
  theme,
  rail,
  reducedMotion,
}: {
  theme: ThemePreviewInput | null;
  rail: 'her' | 'him';
  reducedMotion: boolean;
}) {
  const tokens: ThemeTokens = theme?.tokens ?? {};
  const chrome: ThemeChrome = theme?.chrome ?? FALLBACK_CHROME;
  const decor: ThemeDecor = theme?.decor ?? FALLBACK_DECOR;
  const copy: ThemeCopy = theme?.copy ?? {};
  const header = chrome.header;

  const vars = {
    '--t-accent': tokens.accent ?? LIGHT.accent,
    '--t-accent-ink': tokens.accentInk ?? LIGHT.accentInk,
    '--t-accent-soft': tokens.accentSoft ?? LIGHT.accentSoft,
    '--t-surface-alt': tokens.surfaceAlt ?? LIGHT.surfaceAlt,
    '--t-hairline': tokens.hairline ?? LIGHT.hairline,
    // On the real app the un-themed header is white text over a photo carousel,
    // so the default ink is WHITE over a dark hero backdrop — not LIGHT.ink.
    // kind 'default' IGNORES a stored ink, exactly as the app does (HomeScreen
    // uses '#fff' whenever the header is not themed) — otherwise the preview
    // shows a custom ink the device will never apply.
    '--t-header-ink': header.kind === 'default' ? '#FFFFFF' : header.ink ?? '#FFFFFF',
    '--t-tab-active': chrome.tabBar.activeInk ?? '#111111',
    '--t-badge-bg': chrome.tabBar.badgeBg ?? '#111111',
  } as CSSProperties;

  // ── Header backdrop per kind ─────────────────────────────────────────
  let headerClass = '';
  let headerStyle: CSSProperties = {};
  /** Effective top-of-header color the status bar glyphs sit on; null = unknowable (photo). */
  let headerTopColor: string | null;
  switch (header.kind) {
    case 'default':
      // Dark photo stand-in — the real hero is a photo carousel with white text.
      headerClass = 'bg-neutral-800';
      headerStyle = {
        backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,.08) 0%, rgba(0,0,0,.25) 100%)',
      };
      headerTopColor = '#262626'; // neutral-800
      break;
    case 'solid':
      headerStyle = { backgroundColor: header.color ?? LIGHT.bg };
      headerTopColor = header.color ?? LIGHT.bg;
      break;
    case 'gradient': {
      const from = header.gradient?.[0] ?? LIGHT.bg;
      const to = header.gradient?.[1] ?? LIGHT.bg;
      headerStyle = { backgroundImage: `linear-gradient(180deg, ${from}, ${to})` };
      headerTopColor = from;
      break;
    }
    case 'image':
      headerStyle = header.overlayUrl
        ? {
            backgroundImage: `url(${header.overlayUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : { backgroundColor: '#262626' };
      headerTopColor = null; // a photo has no single color to test against
      break;
  }

  const statusColor = chrome.statusBarStyle === 'light' ? '#FFFFFF' : '#000000';
  const statusContrast = headerTopColor ? contrastRatio(statusColor, headerTopColor) : null;
  const statusBarAtRisk = statusContrast !== null && statusContrast < AA_LARGE;

  // Clamp exactly as the app does (theme/remoteTheme.ts) — an unclamped preview
  // would show a 250pt strip the device renders at 160.
  const overlayHeightPx = Math.round(
    Math.min(160, Math.max(24, header.overlayHeight ?? 72)) * PREVIEW_SCALE,
  );

  return (
    <div className="w-[300px]">
      <div
        className="overflow-hidden rounded-[2.5rem] border-8 border-ink bg-white shadow-lg"
        style={vars}
      >
        {/* Header backdrop wraps the status bar too — glyphs sit on the hero, as on device.
            Paint order relies on every layer being positioned: scrim, content, overlay, decor. */}
        <div className={`relative ${headerClass}`} style={headerStyle}>
          {header.kind === 'image' && <div className="absolute inset-0 bg-black/25" />}

          <div className="relative">
            {/* Status bar strip */}
            <div
              className="flex h-7 items-center justify-between px-5 text-[11px] font-semibold"
              style={{ color: statusColor }}
            >
              <span>9:41</span>
              <span className="flex items-center gap-1" aria-hidden>
                <span className="size-1.5 rounded-full bg-current" />
                <span className="size-1.5 rounded-full bg-current" />
                <span className="size-1.5 rounded-full bg-current" />
              </span>
            </div>

            <div className="px-4 pb-3">
              <div className="flex items-center gap-2">
                {header.wordmarkUrl ? (
                  <img src={header.wordmarkUrl} alt="wordmark" className="h-5 object-contain" />
                ) : (
                  <span
                    className="text-sm font-extrabold lowercase tracking-tight"
                    style={{ color: 'var(--t-header-ink)' }}
                  >
                    trendzo
                  </span>
                )}
                {copy.greeting ? (
                  <span className="min-w-0 truncate text-[10px]" style={{ color: 'var(--t-header-ink)' }}>
                    {copy.greeting}
                  </span>
                ) : null}
                <Bell className="ml-auto size-3.5 shrink-0" style={{ color: 'var(--t-header-ink)' }} />
              </div>

              <p className="mt-1 text-[10px] font-medium" style={{ color: 'var(--t-header-ink)' }}>
                60 minutes · 3 stores nearby
              </p>

              <div
                className="mt-2 rounded-none border border-white/60 px-2 py-1.5"
                style={{
                  backgroundColor:
                    chrome.statusBarStyle === 'light' ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.5)',
                }}
              >
                <span className="text-[10px]" style={{ color: 'var(--t-header-ink)', opacity: 0.7 }}>
                  {copy.searchPlaceholder ?? 'Search 60-min drops...'}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom overlay strip (bunting, garlands…) — the image kind already IS the backdrop */}
          {header.overlayUrl && header.kind !== 'image' && (
            <img
              src={header.overlayUrl}
              alt=""
              className="absolute bottom-0 left-0 w-full object-cover"
              style={{ height: overlayHeightPx }}
            />
          )}

          {/* Decor layer — purely ornamental, floats over the whole header */}
          {decor.kind !== 'none' && decor.url && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {decor.kind === 'image' ? (
                <img src={decor.url} alt="" className="h-full w-full object-cover opacity-90" />
              ) : (
                <>
                  <Suspense fallback={null}>
                    <LottiePreview
                      url={decor.url}
                      paused={reducedMotion}
                      {...(decor.loop !== undefined ? { loop: decor.loop } : {})}
                      {...(decor.maxPlays !== undefined ? { maxPlays: decor.maxPlays } : {})}
                    />
                  </Suspense>
                  {reducedMotion && (
                    <span className="absolute bottom-1 right-1 bg-black/50 px-1 py-0.5 text-[8px] text-white/90">
                      decor paused (reduced motion)
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Main content — always the app's white ground, whatever the portal theme */}
        <div className="space-y-3 bg-white px-3 py-3">
          <div className="flex gap-4 border-b pb-0 border-[var(--t-hairline)]">
            {(['her', 'him'] as const).map((r) => (
              <span
                key={r}
                className={`-mb-px border-b-2 pb-1 text-[11px] uppercase ${
                  r === rail ? 'font-bold' : 'font-medium'
                }`}
                style={
                  r === rail
                    ? { color: '#111111', borderColor: 'var(--t-accent)' }
                    : { color: '#666666', borderColor: 'transparent' }
                }
              >
                {r}
              </span>
            ))}
          </div>

          <div
            className="space-y-2 rounded-none border p-2 border-[var(--t-hairline)] bg-[var(--t-surface-alt)]"
          >
            <div className="grid grid-cols-2 gap-2">
              {[1299, 899, 2499, 649].map((price, i) => (
                <div key={i} className="relative h-16 bg-neutral-200">
                  <span
                    className="absolute bottom-1 left-1 px-1 py-0.5 text-[9px] font-semibold"
                    style={{ backgroundColor: 'var(--t-accent-soft)', color: 'var(--t-ink, #111)' }}
                  >
                    ₹{price.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="w-full rounded-none px-3 py-1.5 text-[11px] font-bold"
              style={{ backgroundColor: 'var(--t-accent)', color: 'var(--t-accent-ink)' }}
            >
              Shop the edit
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex justify-around border-t bg-white py-2 border-[var(--t-hairline)]">
          {TABS.map((label, i) => (
            <div
              key={label}
              className="relative flex flex-col items-center gap-0.5"
              style={{ color: i === 0 ? 'var(--t-tab-active)' : '#666666' }}
            >
              <span className="size-3 border-2 border-current" aria-hidden />
              <span className="text-[8px] font-medium">{label}</span>
              {label === 'Bag' && (
                <span
                  className="absolute -right-2 -top-1 flex size-3.5 items-center justify-center text-[9px] font-bold text-white"
                  style={{ backgroundColor: 'var(--t-badge-bg)' }}
                >
                  2
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {statusBarAtRisk && (
        <div className="mt-2 flex justify-center">
          <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-warning">
            status bar glyphs may be invisible on this header
          </span>
        </div>
      )}

      <p className="mt-2 text-center text-[11px] text-ink-3">
        HTML approximation — spacing, fonts and motion differ from the real app.
      </p>
    </div>
  );
}
