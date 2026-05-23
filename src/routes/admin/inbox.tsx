import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, Check, Coins, Inbox as InboxIcon, Receipt, ShieldAlert, ShieldCheck, Tag, Wrench } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { Notification, NotificationKind } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

const KIND_ICON: Record<NotificationKind, typeof InboxIcon> = {
  order: Receipt,
  refund: Coins,
  kyc: ShieldCheck,
  system: Wrench,
  issue: InboxIcon,
  payout: Coins,
  promotion: Tag,
  compliance: ShieldAlert,
};

const QK = ['admin', 'inbox'];

export default function AdminInbox() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');

  const { data, isLoading } = useQuery({
    queryKey: QK,
    queryFn: () => api<Notification[]>('/admin/inbox?limit=100'),
  });
  const list = data ?? [];

  const visible = useMemo(() => filter === 'all' ? list : list.filter((n) => !n.readAt), [list, filter]);
  const unread = list.filter((n) => !n.readAt).length;

  const markAllRead = useMutation({
    mutationFn: () => api('/admin/inbox/read-all', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success('All notifications marked read');
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/admin/inbox/${id}/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  return (
    <Page>
      <PageHeader
        kicker="Notifications"
        title="Admin inbox"
        description="Platform-wide alerts (failed payouts, KYC overdue, dispute triage, tail-of-cycle, performance breaches)."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Check className="size-3.5" />}
              disabled={unread === 0}
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-1.5">
        {(['unread', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              'rounded-full border px-3 py-1 text-[12px] capitalize transition-colors ' +
              (filter === f
                ? 'border-ink bg-ink text-bg'
                : 'border-line bg-bg text-ink-2 hover:border-line-2')
            }
          >
            {f === 'unread' ? `Unread (${unread})` : `All (${list.length})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : visible.length === 0 ? (
        <Empty kicker="All clear" title={filter === 'unread' ? 'No unread notifications.' : 'Inbox empty.'} />
      ) : (
        <ul className="space-y-2">
          {visible.map((n) => {
            const Icon = KIND_ICON[n.kind];
            const unreadFlag = !n.readAt;
            return (
              <Card key={n.id} className={unreadFlag ? 'border-accent/40' : undefined}>
                <CardContent className="flex items-start gap-3 p-4">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-md ${unreadFlag ? 'bg-accent text-accent-fg' : 'bg-bg-3 text-ink-2'}`}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral" flat>{n.kind}</Badge>
                      {unreadFlag && <Badge tone="info">Unread</Badge>}
                      <span className="text-[11.5px] text-ink-4">{formatAge(n.createdAt)}</span>
                    </div>
                    <div className="mt-1 text-[13.5px] font-medium text-ink">{n.title}</div>
                    <div className="text-[12.5px] text-ink-3">{n.body}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {n.deepLink && (
                      <Button asChild size="sm" variant="outline" iconRight={<ArrowUpRight className="size-3.5" />}>
                        <Link to={n.deepLink} onClick={() => unreadFlag && markRead.mutate(n.id)}>Open</Link>
                      </Button>
                    )}
                    {unreadFlag && !n.deepLink && (
                      <Button size="sm" variant="ghost" iconLeft={<Check className="size-3.5" />} onClick={() => markRead.mutate(n.id)}>
                        Mark read
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
