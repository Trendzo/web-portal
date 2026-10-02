import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import {
  buildIdentifier,
  extractAccessToken,
  retryOtp as msg91Retry,
  sendOtp as msg91Send,
  useMsg91Widget,
  verifyOtp as msg91Verify,
} from '@/lib/msg91';
import { OtpError, slideIdentifier, slideRetry, slideSend, slideVerify, type SlideConfig } from './slide';

export { OtpError } from './slide';

/**
 * Provider-neutral phone-OTP client. The backend decides the provider (OTP_PROVIDER) and
 * publishes it at GET /auth/otp-config; this hook follows it, so flipping the provider
 * needs no client release. Both providers end the same way: an `accessToken` the backend
 * re-verifies, posted together with the provider tag to `/auth/<role>/otp/login`.
 */
export type OtpProvider = 'msg91' | 'slide';
export type OtpConfig = {
  provider: string;
  accepts?: string[];
  otpLength: number;
  resendSeconds: number;
  slide?: SlideConfig;
};

const CACHE_KEY = 'trendzo.otp-config.v1';
const CONFIG_TIMEOUT_MS = 4000;
/** What every MSG91 widget in use is configured for. */
const MSG91_DEFAULT: OtpConfig = { provider: 'msg91', otpLength: 4, resendSeconds: 30 };

function readCache(): OtpConfig | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as OtpConfig) : null;
  } catch {
    return null;
  }
}

function writeCache(cfg: OtpConfig): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cfg));
  } catch {
    /* private mode / quota: the cache is only an optimisation */
  }
}

/** Fresh config, or the last known one, or MSG91's — a config outage must never block login. */
/** The web portal has its own Slide widget (settings/analytics), selected with `?client=web`. */
const WEB_CONFIG_PATH = '/auth/otp-config?client=web';

export async function loadOtpConfig(path = WEB_CONFIG_PATH): Promise<OtpConfig> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const cfg = await Promise.race([
      api<OtpConfig>(path),
      new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(new Error('timeout')), CONFIG_TIMEOUT_MS);
      }),
    ]);
    writeCache(cfg);
    return cfg;
  } catch {
    return readCache() ?? MSG91_DEFAULT;
  } finally {
    clearTimeout(timer);
  }
}

/** Only a fully-specified Slide config is usable; anything else falls back to MSG91. */
export function resolveProvider(cfg: OtpConfig): OtpProvider {
  const s = cfg.slide;
  return cfg.provider === 'slide' && s?.baseUrl && s.widgetId && s.tokenAuth ? 'slide' : 'msg91';
}

export type OtpSession = {
  ready: boolean;
  error: string | null;
  provider: OtpProvider;
  otpLength: number;
  resendSeconds: number;
  send: (dial: string, national: string) => Promise<void>;
  resend: () => Promise<void>;
  /** Verify the code; returns the token + provider tag to post to the backend login. */
  verify: (code: string) => Promise<{ accessToken: string; provider: OtpProvider }>;
};

export function useOtp(configPath?: string): OtpSession {
  const [cfg, setCfg] = useState<OtpConfig | null>(null);
  useEffect(() => {
    let alive = true;
    void loadOtpConfig(configPath).then((c) => alive && setCfg(c));
    return () => {
      alive = false;
    };
  }, [configPath]);

  const resolved = cfg ?? MSG91_DEFAULT;
  const provider = resolveProvider(resolved);
  // MSG91's script is only loaded once we know it is the provider in use.
  const msg91 = useMsg91Widget(cfg !== null && provider === 'msg91');
  const requestId = useRef<string | null>(null);

  const slideCfg = resolved.slide as SlideConfig;

  const send = useCallback(
    async (dial: string, national: string) => {
      if (provider === 'slide') {
        requestId.current = await slideSend(slideCfg, slideIdentifier(dial, national));
      } else {
        await msg91Send(buildIdentifier(dial, national));
      }
    },
    [provider, slideCfg],
  );

  const resend = useCallback(async () => {
    if (provider === 'slide') {
      if (!requestId.current) throw new OtpError('Send the OTP first.');
      requestId.current = await slideRetry(slideCfg, requestId.current);
    } else {
      await msg91Retry(null);
    }
  }, [provider, slideCfg]);

  const verify = useCallback(
    async (code: string) => {
      if (provider === 'slide') {
        if (!requestId.current) throw new OtpError('Send the OTP first.');
        return { accessToken: await slideVerify(slideCfg, requestId.current, code), provider };
      }
      const accessToken = extractAccessToken(await msg91Verify(code));
      if (!accessToken) throw new OtpError('OTP verification failed');
      return { accessToken, provider };
    },
    [provider, slideCfg],
  );

  return {
    ready: cfg !== null && (provider === 'slide' || msg91.ready),
    error: provider === 'msg91' ? msg91.error : null,
    provider,
    otpLength: resolved.otpLength,
    resendSeconds: resolved.resendSeconds,
    send,
    resend,
    verify,
  };
}
