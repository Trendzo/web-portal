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
