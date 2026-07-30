import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PowerOff, Store } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { usePermission } from '@/lib/use-permission';
import type { Store as StoreType } from '@/lib/types';

/**
 * Top-bar online/offline switch. The retailer's own "accepting orders" toggle —
 * distinct from the admin pause. Going offline stops new orders until the store's
 * next opening window (auto-reopen); the retailer can reopen early from here.
 *
 * `orderPauseUntil` is a future ISO timestamp while offline, null/absent online.
 */
export function StoreOnlineToggle({ store }: { store: StoreType }) {
  const qc = useQueryClient();
  const canEdit = usePermission('store.edit_profile');
  const online = !store.orderPauseUntil;

  const toggle = useMutation({
    mutationFn: (accepting: boolean) =>
      api('/retailer/store/order-acceptance', { method: 'PUT', body: { accepting } }),
    onSuccess: (_, accepting) => {
      void qc.invalidateQueries({ queryKey: ['retailer', 'me'] });
      toast.success(accepting ? 'Store is online — accepting orders' : 'Store is offline — orders paused');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not update store status'),
  });

  const reopenAt = store.orderPauseUntil
    ? new Date(store.orderPauseUntil).toLocaleString('en-IN', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <button
      type="button"
      disabled={!canEdit || toggle.isPending}
      onClick={() => toggle.mutate(!online)}
      title={
        online
          ? 'Accepting orders — click to go offline'
          : reopenAt
            ? `Offline — auto-reopens ${reopenAt}. Click to reopen now.`
            : 'Offline — click to reopen now'
      }
      className={cn(
        'flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium press transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        online
          ? 'bg-success/12 text-success hover:bg-success/20'
          : 'bg-danger/12 text-danger hover:bg-danger/20',
      )}
      aria-pressed={online}
    >
      <span
        className={cn('inline-block size-2 rounded-full', online ? 'bg-success' : 'bg-danger')}
        aria-hidden
      />
      {online ? <Store className="size-4" /> : <PowerOff className="size-4" />}
      <span className="hidden sm:inline">{online ? 'Online' : 'Offline'}</span>
    </button>
  );
}
