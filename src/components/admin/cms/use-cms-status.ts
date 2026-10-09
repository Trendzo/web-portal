import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CmsPublishStatus } from '@/lib/types';

/**
 * Draft-vs-live publish status for the whole Home CMS. Shared by the always-visible Publish
 * button, the per-section badges and the per-item chips — one request, cached under the
 * `['admin','cms']` tree so every section/item write and every publish already invalidates it.
 */
export function useCmsStatus() {
  return useQuery({
    queryKey: ['admin', 'cms', 'status'],
    queryFn: () => api<CmsPublishStatus>('/admin/cms/status'),
    staleTime: 5_000,
  });
}

/** Total count of things Publish would change — items added/edited/removed, plus sections. */
export function pendingCount(status?: CmsPublishStatus): number {
  if (!status) return 0;
  const t = status.totals;
  return t.new + t.changed + t.removed + t.sectionsChanged + status.removedSections.length;
}
