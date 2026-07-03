import { useEffect, useState } from 'react';

/**
 * MSG91 sendOTP web-widget integration for retailer phone-OTP login.
 *
 * The widget (loaded from verify.msg91.com) runs the OTP send/verify against MSG91 and hands
 * back a short-lived access token. We forward that token to the backend
 * (`POST /auth/retailer/otp/msg91`), which re-verifies it server-side and mints our JWT — the
 * client token is never trusted on its own.
 *
 * widgetId / tokenAuth are PUBLIC (they live in the client). The secret account authkey lives
 * only in the backend. The web widget uses a different widgetId than the mobile SDK, but the
 * same MSG91 account, so the backend's retailer authkey verifies both.
 */
export const MSG91_WIDGET_ID: string =
  import.meta.env.VITE_MSG91_WIDGET_ID || '3667636f5135383239383234';
export const MSG91_TOKEN_AUTH: string =
  import.meta.env.VITE_MSG91_TOKEN_AUTH || '547225TSvi20QFa026a47d90aP1';

const PROVIDER_URLS = [
  'https://verify.msg91.com/otp-provider.js',
  'https://verify.phone91.com/otp-provider.js',
];

/** Curated country codes for the login picker. Extend as new markets come online. */
export type CountryCode = { iso: string; name: string; dial: string };
export const COUNTRY_CODES: CountryCode[] = [
  { iso: 'IN', name: 'India', dial: '91' },
  { iso: 'US', name: 'United States', dial: '1' },
  { iso: 'GB', name: 'United Kingdom', dial: '44' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '971' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '966' },
  { iso: 'QA', name: 'Qatar', dial: '974' },
  { iso: 'OM', name: 'Oman', dial: '968' },
  { iso: 'KW', name: 'Kuwait', dial: '965' },
  { iso: 'SG', name: 'Singapore', dial: '65' },
  { iso: 'MY', name: 'Malaysia', dial: '60' },
  { iso: 'AU', name: 'Australia', dial: '61' },
  { iso: 'CA', name: 'Canada', dial: '1' },
  { iso: 'BD', name: 'Bangladesh', dial: '880' },
  { iso: 'LK', name: 'Sri Lanka', dial: '94' },
  { iso: 'NP', name: 'Nepal', dial: '977' },
  { iso: 'PK', name: 'Pakistan', dial: '92' },
  { iso: 'DE', name: 'Germany', dial: '49' },
  { iso: 'FR', name: 'France', dial: '33' },
];

/** Build the MSG91 identifier: dial code + national number, digits only, no '+'. */
export function buildIdentifier(dial: string, nationalNumber: string): string {
  return dial.replace(/\D/g, '') + nationalNumber.replace(/\D/g, '');
}

/** Pull the server-verification access token out of the widget's success payload. */
export function extractAccessToken(data: unknown): string | null {
  if (typeof data === 'string') return data.length ? data : null;
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    for (const k of ['message', 'access_token', 'accessToken', 'token', 'authToken']) {
      const v = o[k];
      if (typeof v === 'string' && v.length > 0) return v;
    }
  }
  return null;
}

// Load + initialise once per page, shared across mounts.
let widgetPromise: Promise<void> | null = null;
let initialised = false;

function initialiseOnce(): void {
  if (initialised) return;
  window.initSendOTP?.({
    widgetId: MSG91_WIDGET_ID,
    tokenAuth: MSG91_TOKEN_AUTH,
    exposeMethods: true, // expose sendOtp/verifyOtp/retryOtp; no popup
    // No app logic here — the promisified methods below own success/failure so we don't
    // get duplicate events (per MSG91 docs).
    success: () => {},
    failure: () => {},
  });
  initialised = true;
}

function loadWidget(): Promise<void> {
  if (widgetPromise) return widgetPromise;
  widgetPromise = new Promise<void>((resolve, reject) => {
    if (typeof window.initSendOTP === 'function') {
      initialiseOnce();
      resolve();
      return;
    }
    let i = 0;
    const attempt = () => {
      const s = document.createElement('script');
      s.src = PROVIDER_URLS[i]!;
      s.async = true;
      s.onload = () => {
        try {
          initialiseOnce();
          resolve();
        } catch (e) {
          reject(e instanceof Error ? e : new Error('MSG91 widget init failed'));
        }
      };
      s.onerror = () => {
        i += 1;
        if (i < PROVIDER_URLS.length) attempt();
        else reject(new Error('Could not load the OTP provider'));
      };
      document.head.appendChild(s);
    };
    attempt();
  });
  return widgetPromise;
}

/** Loads + initialises the widget on mount. `ready` gates the send/verify calls. */
export function useMsg91Widget(): { ready: boolean; error: string | null } {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadWidget()
      .then(() => alive && setReady(true))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'OTP unavailable'));
    return () => {
      alive = false;
    };
  }, []);
  return { ready, error };
}

export function sendOtp(identifier: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!window.sendOtp) return reject(new Error('OTP widget not ready'));
    window.sendOtp(identifier, resolve, reject);
  });
}

export function verifyOtp(otp: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!window.verifyOtp) return reject(new Error('OTP widget not ready'));
    window.verifyOtp(otp, resolve, reject);
  });
}

export function retryOtp(channel: string | null = null): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!window.retryOtp) return reject(new Error('OTP widget not ready'));
    window.retryOtp(channel, resolve, reject);
  });
}
