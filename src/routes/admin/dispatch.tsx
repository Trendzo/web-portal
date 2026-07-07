import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw, Truck, UserX } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatPaise, formatAge } from '@/lib/status';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { usePermission } from '@/lib/use-permission';

type Driver = {
  id: string;
  phone: string;
  name: string | null;
  vehicleType: string | null;
  vehicleNumber: string | null;
  city: string | null;
  status: 'active' | 'inactive' | 'suspended';
  activeDeliveries: number;
  lastLocationAt: string | null;
};

type PackedOrder = {
  id: string;
  storeNameSnap: string;
  deliveryMethod: string;
  consumerNameSnap: string;
  addressCitySnap: string | null;
  addressPincodeSnap: string | null;
  grandTotalPaise: number;
  placedAt: string;
  assignedAgentId: string | null;
  assignedDriver: { id: string; name: string | null; phone: string } | null;
};

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-3 ${className ?? ''}`}>
      {children}
    </th>
  );
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className ?? ''}`}>{children}</td>;
}

export default function AdminDispatch() {
  const qc = useQueryClient();
  const canManage = usePermission('dispatch.manage');

  const ordersQ = useQuery({
    queryKey: ['admin', 'dispatch', 'orders'],
    queryFn: () => api<PackedOrder[]>('/admin/dispatch/orders'),
    refetchInterval: 5000,
  });
  const driversQ = useQuery({
    queryKey: ['admin', 'dispatch', 'drivers'],
    queryFn: () => api<Driver[]>('/admin/dispatch/drivers'),
    refetchInterval: 10000,
  });

  const [target, setTarget] = useState<PackedOrder | null>(null);
  const [driverId, setDriverId] = useState('');
  const close = () => { setTarget(null); setDriverId(''); };

  // The backend `assign` handles both first-assign and reassign (re-mints the handoff code).
  const assign = useMutation({
    mutationFn: (v: { orderId: string; driverId: string }) =>
      api(`/admin/dispatch/orders/${v.orderId}/assign`, { method: 'POST', body: { driverId: v.driverId } }),
    onSuccess: () => {
      toast.success('Driver assigned');
      void qc.invalidateQueries({ queryKey: ['admin', 'dispatch'] });
      close();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Assign failed'),
  });
  const unassign = useMutation({
    mutationFn: (orderId: string) =>
      api(`/admin/dispatch/orders/${orderId}/unassign`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Driver unassigned');
      void qc.invalidateQueries({ queryKey: ['admin', 'dispatch'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Unassign failed'),
  });

  const orders = ordersQ.data ?? [];
  const drivers = driversQ.data ?? [];
  const activeDrivers = drivers.filter((d) => d.status === 'active');
  const waiting = orders.filter((o) => !o.assignedAgentId).length;

  const openAssign = (o: PackedOrder) => { setTarget(o); setDriverId(o.assignedDriver?.id ?? ''); };

  return (
    <Page>
      <PageHeader
        title="Dispatch"
        description="Assign or reassign drivers to packed orders — manual override for when auto-dispatch fails. Assigning mints a fresh handoff code the store verifies at pickup."
        actions={
          <div className="flex items-center gap-3">
            <div className="text-[12.5px] text-ink-3">
              <span className="font-semibold text-ink">{activeDrivers.length}</span> active driver{activeDrivers.length === 1 ? '' : 's'} ·{' '}
              <span className="font-semibold text-ink">{waiting}</span> awaiting
            </div>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<RefreshCw className={`size-3.5 ${ordersQ.isFetching ? 'animate-spin' : ''}`} />}
              onClick={() => void qc.invalidateQueries({ queryKey: ['admin', 'dispatch'] })}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {ordersQ.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : ordersQ.isError ? (
        <Empty
          kicker="Connection lost"
          title="Couldn't load the dispatch board"
          action={<Button variant="outline" onClick={() => ordersQ.refetch()}>Retry</Button>}
        />
      ) : orders.length === 0 ? (
        <Empty
          kicker="All clear"
          title="No packed orders awaiting dispatch"
          description="Orders appear here once a store packs them. Drivers can also self-accept via broadcast."
        />
      ) : (
        <div className="rounded-lg border border-line bg-bg overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-2 border-b border-line">
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Store</Th>
                <Th>Value</Th>
                <Th>Driver</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-bg-2/40">
                  <Td>
                    <div className="font-mono text-[12px] text-ink-2">{o.id.slice(0, 14)}…</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-[11px] uppercase tracking-wide text-ink-3">{o.deliveryMethod.replace(/_/g, ' ')}</span>
                      <span className="text-[11px] text-ink-4">· {formatAge(o.placedAt)}</span>
                    </div>
                  </Td>
                  <Td>
                    <div className="text-ink">{o.consumerNameSnap}</div>
                    <div className="text-[12px] text-ink-3">{[o.addressCitySnap, o.addressPincodeSnap].filter(Boolean).join(' ')}</div>
                  </Td>
                  <Td className="text-ink-2">{o.storeNameSnap}</Td>
                  <Td className="font-medium tabular-nums text-ink">{formatPaise(o.grandTotalPaise)}</Td>
                  <Td>
                    {o.assignedDriver ? (
                      <div>
                        <div className="text-ink">{o.assignedDriver.name || 'Driver'}</div>
                        <div className="text-[12px] text-ink-3">{o.assignedDriver.phone}</div>
                      </div>
                    ) : (
                      <Badge tone="warning">Unassigned</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    {canManage ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button variant={o.assignedDriver ? 'outline' : 'ink'} size="sm" iconLeft={<Truck className="size-3.5" />} onClick={() => openAssign(o)}>
                          {o.assignedDriver ? 'Reassign' : 'Assign'}
                        </Button>
                        {o.assignedDriver && (
                          <Button
                            variant="ghost"
                            size="sm"
                            iconLeft={<UserX className="size-3.5" />}
                            loading={unassign.isPending && unassign.variables === o.id}
                            onClick={() => unassign.mutate(o.id)}
                          >
                            Unassign
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[12px] text-ink-4">View only</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!target} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target?.assignedDriver ? 'Reassign driver' : 'Assign driver'}</DialogTitle>
            <DialogDescription>
              Pick an active driver for this packed order. A fresh handoff code is minted; the store verifies it at pickup.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="drv" required>Driver</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger id="drv">
                <SelectValue placeholder="Choose a driver" />
              </SelectTrigger>
              <SelectContent>
                {activeDrivers.length === 0 ? (
                  <div className="px-3 py-2 text-[12.5px] text-ink-3">No active drivers online.</div>
                ) : (
                  activeDrivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {(d.name || d.phone)} · {d.phone} · {d.activeDeliveries} active
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button
              variant="ink"
              loading={assign.isPending}
              disabled={!driverId}
              onClick={() => target && driverId && assign.mutate({ orderId: target.id, driverId })}
            >
              {target?.assignedDriver ? 'Reassign' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
