import { create } from 'zustand';
import type { BannerKind } from './types';

export type BannerTone = 'info' | 'warning' | 'danger' | 'success';

export type BannerCta = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export type Banner = {
  id: string;
  kind: BannerKind;
  tone: BannerTone;
  title: string;
  body?: string;
  cta?: BannerCta;
  dismissible?: boolean;
  /** Which portal owns this banner. Retailer layout clears 'admin' banners on mount and vice versa. */
  portal: 'admin' | 'retailer';
};

type BannerStore = {
  banners: Banner[];
  pushBanner: (banner: Banner) => void;
  dismissBanner: (id: string) => void;
  clearByKind: (kind: BannerKind) => void;
  clearByPortal: (portal: Banner['portal']) => void;
};

/**
 * Lightweight banner queue rendered by `<BannerStack />` in every layout.
 *
 * Push from anywhere — KYC due check, impersonation start, maintenance push,
 * etc. — and the top of the screen renders the stacked card. Pop by `id`
 * (one-off CTA) or by `kind` (e.g. on impersonation exit, clear all
 * `'impersonation'` banners regardless of id).
 *
 * Final wiring (server-pushed maintenance, etc.) lands with §22; today only
 * impersonation + KYC use this.
 */
export const useBannerStack = create<BannerStore>((set) => ({
  banners: [],
  pushBanner: (banner) =>
    set((state) =>
      state.banners.some((b) => b.id === banner.id)
        ? state
        : { banners: [...state.banners, banner] },
    ),
  dismissBanner: (id) =>
    set((state) => ({ banners: state.banners.filter((b) => b.id !== id) })),
  clearByKind: (kind) =>
    set((state) => ({ banners: state.banners.filter((b) => b.kind !== kind) })),
  clearByPortal: (portal) =>
    set((state) => ({ banners: state.banners.filter((b) => b.portal !== portal) })),
}));
