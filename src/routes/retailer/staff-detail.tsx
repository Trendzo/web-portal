import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { RetailerStaff, RetailerSubRole } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { CopyableId } from '@/components/ui/copyable-id';

const SUB_ROLE_LABEL: Record<RetailerSubRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Floor staff',
};

export default function RetailerStaffDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'staff', id],
    queryFn: () => api<RetailerStaff>(`/retailer/staff/${id}`),
    enabled: Boolean(id),
  });

  return (
    <Page>
      <PageHeader
        kicker="Identity & Access"
        title={data?.legalName ?? 'Staff member'}
        description={data ? `${SUB_ROLE_LABEL[data.subRole]} · ${data.email}` : undefined}
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/retailer/staff">Back to staff</Link>
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !data ? (
        <Card><CardContent className="p-6 text-[13px] text-ink-3">Staff member not found.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <MetaList
              cols={2}
              items={[
                { label: 'Sub-role', value: <Badge tone="info" flat>{SUB_ROLE_LABEL[data.subRole]}</Badge> },
                { label: 'Status', value: <Badge tone={data.status === 'active' ? 'success' : 'neutral'}>{data.status.replace(/_/g, ' ')}</Badge> },
                { label: 'Email', value: data.email },
                { label: 'Phone', value: data.phone },
                { label: 'Joined', value: formatAge(data.createdAt) },
                { label: 'Identifier', value: <CopyableId value={data.id} label="staff id" />, mono: true },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </Page>
  );
}
