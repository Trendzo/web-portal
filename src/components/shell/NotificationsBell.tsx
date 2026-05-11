import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Notification } from '@/lib/types';

export function NotificationsBell() {
  const session = useAuth((s) => s.session);
  const isAdmin = session?.kind === 'admin';
  const inboxHref = isAdmin ? '/admin/inbox' : '/retailer/inbox';
  const endpoint = isAdmin ? '/admin/inbox?limit=50' : '/retailer/inbox?limit=50';

  const { data } = useQuery({
    queryKey: ['notifications', isAdmin ? 'admin' : 'retailer', 'bell'],
    queryFn: () => api<Notification[]>(endpoint),
    refetchInterval: 60_000,
    enabled: Boolean(session),
  });
  const unread = (data ?? []).filter((n) => !n.readAt).length;

  return (
    <Link
      to={inboxHref}
      aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
      className="relative grid size-9 place-items-center rounded-full text-ink-2 hover:bg-bg-3 press"
    >
      <Bell className="size-[18px]" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-[16px] h-4 place-items-center rounded-full bg-danger px-1 font-mono text-[10px] font-semibold text-bg">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
