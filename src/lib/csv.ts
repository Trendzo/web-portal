import { useCallback } from 'react';
import { toast } from 'sonner';
import { BASE } from './api';
import { getToken } from './auth';

export type CsvColumn<T> = {
  key: string;
  header: string;
  accessor: (row: T) => string | number;
};

function escape(v: string | number): string {
  const s = String(v ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv<T>(rows: T[], cols: CsvColumn<T>[]): string {
  const header = cols.map((c) => escape(c.header)).join(',');
  const body = rows
    .map((r) => cols.map((c) => escape(c.accessor(r))).join(','))
    .join('\n');
  return `${header}\n${body}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Legacy client-side CSV — kept for existing pages that assemble rows in JS. */
export function useCsvExport<T>(filename: string, cols: CsvColumn<T>[]) {
  return useCallback(
    (rows: T[] | undefined) => {
      if (!rows || rows.length === 0) {
        toast.error('Nothing to export');
        return;
      }
      const csv = toCsv(rows, cols);
      const stamp = new Date().toISOString().slice(0, 10);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      triggerDownload(blob, `${filename}_${stamp}.csv`);
      toast.success(`Exported ${rows.length} rows`);
    },
    [filename, cols],
  );
}

/**
 * Server-side CSV export. Hits the same report endpoint with `?format=csv`,
 * which the backend's `onSend` hook converts to a `text/csv` payload. Columns
 * are derived from the API response so a single source of truth.
 */
export function useServerCsv(filename: string, path: string, params?: Record<string, string | number | undefined>) {
  return useCallback(async () => {
    const search = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        search.set(k, String(v));
      }
    }
    search.set('format', 'csv');

    const url = `${BASE}${path}?${search.toString()}`;
    const headers = new Headers();
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        toast.error(`Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      triggerDownload(blob, `${filename}_${stamp}.csv`);
      toast.success('Export complete');
    } catch {
      toast.error('Export failed');
    }
  }, [filename, path, params]);
}
