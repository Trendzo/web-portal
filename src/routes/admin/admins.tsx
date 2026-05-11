import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { AdminSubRole, AdminTeamMember } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import { RoleGate } from '@/components/shell/RoleGate';
import { MockDataBadge } from '@/components/ui/mock-data-badge';

const SUB_ROLE_LABEL: Record<AdminSubRole, string> = {
  super_admin: 'Super admin',
  ops_admin: 'Ops admin',
  support: 'Support',
};

export default function AdminAdmins() {
  return (
    <RoleGate kind="admin" subRole="super_admin">
      <AdminAdminsInner />
    </RoleGate>
  );
}

function AdminAdminsInner() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'team'],
    queryFn: () => api<AdminTeamMember[]>('/admin/team'),
  });
  const list = data ?? [];

  return (
    <Page>
      <PageHeader
        kicker="Identity & Access"
        title="Admin team"
        description="Super-admin manages the platform admin roster. Each member's sub-role decides which queues and overrides are visible."
        actions={
          <div className="flex items-center gap-2">
            <MockDataBadge label="MOCKED — pending backend §1" />
            <Button iconLeft={<UserPlus className="size-3.5" />}>Invite admin</Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : list.length === 0 ? (
        <Empty kicker="No admins" title="No admin accounts on this platform." />
      ) : (
        <ul className="space-y-2">
          {list.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-medium text-ink">{m.name}</span>
                    <Badge tone={m.active ? 'success' : 'neutral'}>
                      {m.active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge tone={m.subRole === 'super_admin' ? 'danger' : 'info'} flat>
                      {SUB_ROLE_LABEL[m.subRole]}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-3">
                    <span>{m.email}</span>
                    <span>·</span>
                    <CopyableId value={m.id} label="admin id" />
                  </div>
                  <div className="mt-1 text-[11.5px] text-ink-4">
                    Last active {m.lastActiveAt ? formatAge(m.lastActiveAt) : 'never'} · Joined {formatAge(m.createdAt)}
                  </div>
                </div>
                <Button variant="ghost" size="sm">Audit</Button>
                {m.subRole !== 'super_admin' && (
                  <Button variant="outline" size="sm">Revoke</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </ul>
      )}
    </Page>
  );
}
