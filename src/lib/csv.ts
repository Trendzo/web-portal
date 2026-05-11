// MOCK_DEPENDENCY: §21 — client-side CSV export for report tables.
// Real exports route through backend (signed URL); this stub assembles in-memory rows.

import { useCallback } from 'react';
import { toast } from 'sonner';

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

export function useCsvExport<T>(filename: string, cols: CsvColumn<T>[]) {
  return useCallback(
    (rows: T[] | undefined) => {
      if (!rows || rows.length === 0) {
        toast.error('Nothing to export');
        return;
      }
      const csv = toCsv(rows, cols);
      const stamp = new Date().toISOString().slice(0, 10);
      const finalName = `${filename}_${stamp}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} rows`);
    },
    [filename, cols],
  );
}
