import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { formatAge } from '@/lib/status';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermission } from '@/lib/use-permission';

type DriverStatus = 'active' | 'inactive' | 'suspended';
type Driver = {
  id: string;
  name: string | null;
  phone: string;
  vehicleType: string | null;
  vehicleNumber: string | null;
  city: string | null;
  status: DriverStatus;
  activeDeliveries: number;
  lastLocationAt: string | null;
  createdAt: string;
  cashOutstandingPaise: number;
  pendingDeposit: { id: string; amountPaise: number } | null;
};

const inr = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const STATUS_TONE: Record<DriverStatus, 'success' | 'danger' | 'neutral'> = {
  active: 'success',
  suspended: 'danger',
  inactive: 'neutral',
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

export function DriversPanel() {
  const qc = useQueryClient();
  const canManage = usePermission('drivers.manage');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | DriverStatus>('all');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'drivers'],
    queryFn: () => api<Driver[]>('/admin/drivers'),
    refetchInterval: 15_000,
  });

  const setStatusM = useMutation({
    mutationFn: (v: { id: string; action: 'suspend' | 'activate' }) =>
      api(`/admin/drivers/${v.id}/${v.action}`, { method: 'POST' }),
    onSuccess: (_r, v) => {
      toast.success(v.action === 'suspend' ? 'Driver suspended' : 'Driver activated');
      void qc.invalidateQueries({ queryKey: ['admin', 'drivers'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'dispatch'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
  });

  // COD deposit desk: confirm books the 'deposited' ledger entry; reject moves nothing.
  const decideDepositM = useMutation({
    mutationFn: (v: { driverId: string; depositId: string; action: 'confirm' | 'reject' }) =>
      api(`/admin/drivers/${v.driverId}/cash/deposits/${v.depositId}/${v.action}`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: (_r, v) => {
      toast.success(v.action === 'confirm' ? 'Deposit confirmed — cash booked' : 'Deposit rejected');
      void qc.invalidateQueries({ queryKey: ['admin', 'drivers'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
  });

  const all = data ?? [];
  const digits = q.replace(/\D/g, '');
  const filtered = all.filter((d) => {
    if (status !== 'all' && d.status !== status) return false;
    if (!q.trim()) return true;
    const hay = `${d.name ?? ''} ${d.vehicleNumber ?? ''} ${d.city ?? ''}`.toLowerCase();
    return hay.includes(q.toLowerCase()) || (digits.length > 0 && d.phone.replace(/\D/g, '').includes(digits));
  });

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-ink-3">
        Delivery drivers on the platform. Suspend to block a driver's login and pull them from dispatch; activate to restore.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-4" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, vehicle, city…" className="pl-8" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : isError ? (
        <Empty kicker="Connection lost" title="Couldn't load drivers" action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>} />
      ) : filtered.length === 0 ? (
        <Empty
          kicker={all.length === 0 ? 'No drivers yet' : 'No matches'}
          title={all.length === 0 ? 'No drivers have signed up.' : 'No drivers match these filters.'}
          description={all.length === 0 ? 'Drivers appear here after they sign up in the driver app.' : undefined}
        />
      ) : (
        <div className="rounded-lg border border-line bg-bg overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-2 border-b border-line">
              <tr>
                <Th>Driver</Th>
                <Th>Vehicle</Th>
                <Th>City</Th>
                <Th>Status</Th>
                <Th>Active</Th>
                <Th>COD cash</Th>
                <Th>Joined</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-bg-2/40">
                  <Td>
                    <div className="text-ink">{d.name || <span className="text-ink-4">No name yet</span>}</div>
                    <div className="text-[12px] text-ink-3">{d.phone}</div>
                  </Td>
                  <Td className="text-ink-2">
                    {[d.vehicleType, d.vehicleNumber].filter(Boolean).join(' · ') || <span className="text-ink-4">—</span>}
                  </Td>
                  <Td className="text-ink-2">{d.city || <span className="text-ink-4">—</span>}</Td>
                  <Td><Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge></Td>
                  <Td className="tabular-nums text-ink-2">{d.activeDeliveries}</Td>
                  <Td>
                    <div className="tabular-nums text-ink-2">
                      {d.cashOutstandingPaise > 0 ? inr(d.cashOutstandingPaise) : <span className="text-ink-4">—</span>}
                    </div>
                    {d.pendingDeposit && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge tone="warning">deposit {inr(d.pendingDeposit.amountPaise)}</Badge>
                        {canManage && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              loading={decideDepositM.isPending && decideDepositM.variables?.depositId === d.pendingDeposit.id && decideDepositM.variables.action === 'confirm'}
                              onClick={() => decideDepositM.mutate({ driverId: d.id, depositId: d.pendingDeposit!.id, action: 'confirm' })}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              loading={decideDepositM.isPending && decideDepositM.variables?.depositId === d.pendingDeposit.id && decideDepositM.variables.action === 'reject'}
                              onClick={() => decideDepositM.mutate({ driverId: d.id, depositId: d.pendingDeposit!.id, action: 'reject' })}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </Td>
                  <Td className="text-ink-3">{formatAge(d.createdAt)}</Td>
                  <Td className="text-right">
                    {canManage ? (
                      d.status === 'active' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={setStatusM.isPending && setStatusM.variables?.id === d.id}
                          onClick={() => setStatusM.mutate({ id: d.id, action: 'suspend' })}
                        >
                          Suspend
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          loading={setStatusM.isPending && setStatusM.variables?.id === d.id}
                          onClick={() => setStatusM.mutate({ id: d.id, action: 'activate' })}
                        >
                          Activate
                        </Button>
                      )
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
    </div>
  );
}
