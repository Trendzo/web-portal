import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { RetailerStaff, RetailerStaffInvite, RetailerSubRole } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';

const SUB_ROLE_LABEL: Record<RetailerSubRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Floor staff',
};

export default function RetailerStaffPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const queryClient = useQueryClient();

  const staffQuery = useQuery({
    queryKey: ['retailer', 'staff'],
    queryFn: () => api<RetailerStaff[]>('/retailer/staff'),
  });
  const invitesQuery = useQuery({
    queryKey: ['retailer', 'staff', 'invites'],
    queryFn: () => api<RetailerStaffInvite[]>('/retailer/staff/invites'),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => api(`/retailer/staff/invites/${inviteId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retailer', 'staff', 'invites'] });
      toast.success('Invite revoked.');
    },
    onError: () => toast.error('Failed to revoke invite.'),
  });

  const visible = useMemo(() => {
    const list = staffQuery.data ?? [];
    if (filter === 'all') return list;
    if (filter === 'active') return list.filter((s) => s.status === 'active');
    return list.filter((s) => s.status !== 'active');
  }, [staffQuery.data, filter]);

  return (
    <Page>
      <PageHeader
        kicker="Identity & Access"
        title="Staff"
        description="Owner manages the people who can sign in to this store. Sub-role controls what each member can do."
        actions={
          <Button
            iconLeft={<UserPlus className="size-3.5" />}
            onClick={() => toast.info('Invite flow coming soon.')}
          >
            Invite member
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-1.5">
        {(['all', 'active', 'inactive'] as const).map((f) => (
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
            {f}
          </button>
        ))}
        <span className="ml-auto text-[12px] text-ink-3">{visible.length} member{visible.length === 1 ? '' : 's'}</span>
      </div>

      {staffQuery.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : visible.length === 0 ? (
        <Empty kicker="No members" title="No staff match this filter." />
      ) : (
        <ul className="space-y-2">
          {visible.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-medium text-ink">{s.legalName}</span>
                    <Badge tone={s.status === 'active' ? 'success' : 'neutral'}>
                      {s.status === 'active' ? 'Active' : s.status.replace(/_/g, ' ')}
                    </Badge>
                    <Badge tone="info" flat>
                      {SUB_ROLE_LABEL[s.subRole]}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-3">
                    <span>{s.email}</span>
                    <span>·</span>
                    <CopyableId value={s.id} label="staff id" />
                  </div>
                  <div className="mt-1 text-[11.5px] text-ink-4">
                    Joined {formatAge(s.createdAt)}
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm" iconRight={<ArrowUpRight className="size-3" />}>
                  <Link to={`/retailer/staff/${s.id}`}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </ul>
      )}

      <div className="mt-10">
        <SectionHeading
          kicker="Pending"
          title="Invites awaiting acceptance"
          hint={invitesQuery.data ? `${invitesQuery.data.length} open` : undefined}
        />
        {invitesQuery.isLoading ? (
          <Skeleton className="h-16" />
        ) : (invitesQuery.data ?? []).length === 0 ? (
          <Empty kicker="No invites" title="Nobody has been invited recently." />
        ) : (
          <ul className="space-y-2">
            {(invitesQuery.data ?? []).map((inv) => (
              <Card key={inv.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] text-ink">{inv.email}</div>
                    <div className="mt-0.5 text-[12px] text-ink-3">
                      {SUB_ROLE_LABEL[inv.subRole]} · expires {formatAge(inv.expiresAt)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revokeMutation.isPending}
                    onClick={() => revokeMutation.mutate(inv.id)}
                  >
                    Revoke
                  </Button>
                </CardContent>
              </Card>
            ))}
          </ul>
        )}
      </div>
    </Page>
  );
}
