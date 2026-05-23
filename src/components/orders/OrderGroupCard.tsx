// MOCK_DEPENDENCY: §8 — multi-retailer order envelope visual
//
// Used in admin order detail when a single consumer checkout fans out across
// multiple retailers. Group status pills + per-store cards.

import { Link } from 'react-router-dom';
import { ArrowUpRight, Store } from 'lucide-react';
import { formatAge, formatPaise, orderGroupStatusMeta, orderStatusMeta } from '@/lib/status';
import type { OrderGroupStatus, OrderListRow } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CopyableId } from '@/components/ui/copyable-id';

type Props = {
  groupId: string;
  status: OrderGroupStatus;
  placedAt: string;
  orders: OrderListRow[];
  /** Server-computed combined total across orders in the group (paise). */
  combinedTotalPaise?: number | undefined;
};

export function OrderGroupCard({ groupId, status, placedAt, orders, combinedTotalPaise }: Props) {
  const meta = orderGroupStatusMeta(status);
  const totalPaise =
    combinedTotalPaise ?? orders.reduce((n, o) => n + o.grandTotalPaise, 0);
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <CopyableId value={groupId} label="group id" />
            <span className="text-[11.5px] text-ink-3">placed {formatAge(placedAt)}</span>
          </div>
          <div className="text-[13.5px] font-semibold text-ink">
            {orders.length} retailer{orders.length === 1 ? '' : 's'} · {formatPaise(totalPaise)}
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {orders.map((o) => {
            const om = orderStatusMeta(o.status);
            return (
              <li key={o.id} className="flex items-center gap-3 rounded-md border border-line bg-bg-2/30 px-3 py-2.5">
                <Store className="size-4 shrink-0 text-ink-3" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-ink truncate">{o.storeName ?? o.storeId ?? 'Unknown store'}</div>
                  <div className="text-[11.5px] text-ink-3">
                    {o.itemCount} item{o.itemCount === 1 ? '' : 's'} · {formatPaise(o.grandTotalPaise)}
                  </div>
                </div>
                <Badge tone={om.tone} pulse={om.pulse}>{om.label}</Badge>
                <Button asChild variant="ghost" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                  <Link to={`/admin/orders/${o.id}`}>Open</Link>
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
