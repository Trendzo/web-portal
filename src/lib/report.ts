import { useEffect, useRef } from 'react';

/**
 * Backend retailer/admin report endpoints wrap responses via `wrapReport()`:
 *   - Array payloads → `{ rows: T[], meta: ReportMeta }`
 *   - Object payloads → `{ ...payload, meta: ReportMeta }`
 *
 * `meta.generatedAtIst` powers the "as of HH:MM IST" freshness label.
 */
export type ReportMeta = {
  generatedAt: string;
  generatedAtIst: string;
};

export type ArrayEnvelope<T> = { rows: T[]; meta: ReportMeta };
export type ObjectEnvelope<T extends object> = T & { meta: ReportMeta };

/**
 * When several report panels are stacked under one tab (e.g. the Products grid),
 * the parent owns one shared chart/table view toggle and passes it down. A panel
 * that receives `controls` hides its own freshness/view/CSV cluster and reads the
 * view from here — but keeps its report-specific filter (date range, listing id,
 * days-without-sale), since those differ per report and can't be merged.
 */
export type ReportControls = {
  view: import('@/components/ui/view-toggle').ReportView;
};

/**
 * Props a report panel accepts when it lives inside a shared shell (the Products
 * accordion). `collapsed` lets the panel keep fetching + reporting its row count
 * while rendering no body; `onCount` bubbles the current row count up to the shell
 * header. Both optional — standalone report pages pass neither.
 */
export type ReportShellProps = {
  controls?: ReportControls;
  collapsed?: boolean;
  onCount?: (n: number) => void;
};

/**
 * Fire `cb(n)` whenever `n` changes, always calling the latest `cb` without making
 * it an effect dependency — so an inline `onCount` arrow never causes a render loop.
 */
export function useReportCount(cb: ((n: number) => void) | undefined, n: number) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    ref.current?.(n);
  }, [n]);
}

export function unwrapRows<T>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === 'object' && 'rows' in (data as Record<string, unknown>)) {
    const rows = (data as { rows?: unknown }).rows;
    return Array.isArray(rows) ? (rows as T[]) : [];
  }
  return [];
}

export function unwrapMeta(data: unknown): ReportMeta | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const meta = (data as { meta?: unknown }).meta;
  if (!meta || typeof meta !== 'object') return undefined;
  const m = meta as Partial<ReportMeta>;
  if (typeof m.generatedAtIst !== 'string') return undefined;
  return {
    generatedAt: typeof m.generatedAt === 'string' ? m.generatedAt : '',
    generatedAtIst: m.generatedAtIst,
  };
}
