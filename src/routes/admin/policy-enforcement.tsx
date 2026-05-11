import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { enforcementStepMeta, formatAge } from '@/lib/status';
import type { PolicyEnforcementAction } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';

export default function AdminPolicyEnforcement() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'policy-enforcement'],
    queryFn: () => api<PolicyEnforcementAction[]>('/admin/compliance/policy-enforcement?limit=100'),
  });
  const list = data ?? [];

  return (
    <Page>
      <PageHeader
        kicker="Compliance"
        title="Policy enforcement"
        description="Warning ladder, suspensions and terminations tracked per retailer. Move up the ladder when breaches recur; lift the warning when fixed."
      />

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : list.length === 0 ? (
        <Empty kicker="All clear" title="No active policy enforcement actions." />
      ) : (
        <ul className="space-y-3">
          {list.map((e) => {
            const stepMeta = enforcementStepMeta(e.step);
            return (
              <Card key={e.id}>
                <CardContent className="flex items-start justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={stepMeta.tone}>{stepMeta.label}</Badge>
                      <Badge tone="neutral" flat>{e.breachKind.replace(/_/g, ' ')}</Badge>
                      <CopyableId value={e.storeId} label="store" />
                    </div>
                    {e.reason && (
                      <p className="mt-2 text-[13px] italic text-ink-2">{e.reason}</p>
                    )}
                    <div className="mt-1 text-[11.5px] text-ink-4">
                      {formatAge(e.actedAt)}
                      {e.actedByAdminId && ` · ${e.actedByAdminId.slice(0, 12)}…`}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                    <Link to={`/admin/retailers/${e.storeId}`}>Open retailer</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
