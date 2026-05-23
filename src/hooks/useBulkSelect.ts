import { useCallback, useMemo, useState } from 'react';

/**
 * Generic multi-row selection hook for admin tables.
 *
 * Returns a Set of selected ids plus helpers. `toggleAll` flips between
 * "all visible rows selected" and "nothing selected" based on the current
 * `rows` array passed in — switching pages / filters automatically narrows
 * the toggle target to the visible window.
 */
export function useBulkSelect<T extends { id: string }>(rows: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const isAllSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected],
  );

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const allHere = rows.length > 0 && rows.every((r) => prev.has(r.id));
      if (allHere) {
        const next = new Set(prev);
        rows.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      rows.forEach((r) => next.add(r.id));
      return next;
    });
  }, [rows]);

  const clear = useCallback(() => setSelected(new Set()), []);

  return {
    selected,
    selectedIds: useMemo(() => Array.from(selected), [selected]),
    selectedCount: selected.size,
    isSelected,
    isAllSelected,
    toggle,
    toggleAll,
    clear,
  };
}
