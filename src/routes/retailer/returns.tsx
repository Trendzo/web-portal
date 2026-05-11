import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge, returnDecisionMeta } from '@/lib/status';
import type { ReturnKind, StoreReturnDecision } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ReturnRow = {
  id: string;
  orderItemId: string;
  kind: ReturnKind;
  openedAt: string;
  reasonText: string | null;
  storeDecision: StoreReturnDecision;
  verificationWindowExpiresAt: string | null;
  orderItem: {
    orderId: string;
    listingNameSnap: string;
    attributesLabelSnap: string;
    order: { id: string; consumerNameSnap: string };
  };
};

export default function RetailerReturns() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'returns'],
    queryFn: () => api<ReturnRow[]>('/retailer/returns?limit=100'),
  });
  const list = data ?? [];

  return (
    <Page>
      <PageHeader
        kicker="Returns"
        title="Returns verification queue"
        description="Door returns from try-and-buy visits and standard returns from delivered orders. Accept to refund or reject to dispute."
      />

      <Tabs defaultValue="door">
        <TabsList>
          <TabsTrigger value="door">
            Door returns
            <span className="ml-1.5 text-ink-3">{list.filter((r) => r.kind === 'door_return').length}</span>
          </TabsTrigger>
          <TabsTrigger value="standard">
            Standard returns
            <span className="ml-1.5 text-ink-3">{list.filter((r) => r.kind === 'standard_return').length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="door"><ReturnList loading={isLoading} list={list.filter((r) => r.kind === 'door_return')} /></TabsContent>
        <TabsContent value="standard"><ReturnList loading={isLoading} list={list.filter((r) => r.kind === 'standard_return')} /></TabsContent>
      </Tabs>
    </Page>
  );
}

function ReturnList({ loading, list }: { loading: boolean; list: ReturnRow[] }) {
  if (loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (list.length === 0) return <Empty kicker="All clear" title="No returns in this bucket." />;
  return (
    <ul className="space-y-2">
      {list.map((r) => {
        const meta = returnDecisionMeta(r.storeDecision);
        const expiresIn = r.verificationWindowExpiresAt
          ? Math.round((new Date(r.verificationWindowExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60))
          : null;
        return (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-ink">{r.orderItem.listingNameSnap}</span>
                    <Badge tone={meta.tone} pulse={r.storeDecision === 'pending'}>{meta.label}</Badge>
                    <CopyableId value={r.id} label="return id" />
                  </div>
                  <div className="mt-1 text-[12.5px] text-ink-2">
                    {r.orderItem.attributesLabelSnap} · {r.orderItem.order.consumerNameSnap}
                  </div>
                  <div className="mt-1 text-[12px] text-ink-3">
                    Opened {formatAge(r.openedAt)}
                    {expiresIn !== null && (
                      <> · Verification window {expiresIn > 0 ? `${expiresIn}h left` : 'expired'}</>
                    )}
                    {r.reasonText && <> · <em>{r.reasonText}</em></>}
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                  <Link to={`/retailer/orders/${r.orderItem.orderId}`}>Open order</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </ul>
  );
}
