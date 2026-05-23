import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, KeyRound, Power } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge } from '@/lib/status';
import { SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StaffTempPasswordModal } from '@/components/retailer/staff-temp-password-modal';

export type AccountRow = {
  id: string;
  legalName: string;
  email: string;
  phone: string;
  subRole: 'owner' | 'manager' | 'staff';
  status: 'pending_approval' | 'active' | 'terminated' | string;
  createdAt: string;
};

const SUB_ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Floor staff',
};

/**
 * Shared roster of every account belonging to a retailer (owner + managers + staff).
 * Used on the admin retailer-detail page and the admin store-detail page so both
 * surfaces expose deep links + quick actions (reset password, deactivate, reactivate)
 * against the same identity records. `focusedAccountId` highlights one row — pass the
 * retailer owner's id from retailer-detail; leave undefined on store-detail.
 */
export function AccountsOnStoreCard({
  retailerId,
  focusedAccountId,
}: {
  retailerId: string;
  focusedAccountId?: string;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'retailers', retailerId, 'staff'],
    queryFn: () => api<AccountRow[]>(`/admin/retailers/${retailerId}/staff`),
  });

  const [resetTarget, setResetTarget] = useState<AccountRow | null>(null);
  const [tempPasswordShown, setTempPasswordShown] = useState<{
    email: string;
    tempPassword: string;
  } | null>(null);

  const resetMut = useMutation({
    mutationFn: (target: AccountRow) =>
      api<{ id: string; tempPassword?: string }>(
        `/admin/retailers/${retailerId}/staff/${target.id}/reset-password`,
        { method: 'POST', body: {} },
      ),
    onSuccess: (res, target) => {
      if (res.tempPassword) {
        setTempPasswordShown({ email: target.email, tempPassword: res.tempPassword });
      }
      setResetTarget(null);
      toast.success('Password reset · hand the temp password to the user');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Reset failed'),
  });

  const deactivateMut = useMutation({
    mutationFn: (accountId: string) =>
      api(`/admin/retailers/${retailerId}/staff/${accountId}/deactivate`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Account deactivated');
      void qc.invalidateQueries({ queryKey: ['admin', 'retailers', retailerId, 'staff'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Deactivate failed'),
  });
  const reactivateMut = useMutation({
    mutationFn: (accountId: string) =>
      api(`/admin/retailers/${retailerId}/staff/${accountId}/reactivate`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Account reactivated');
      void qc.invalidateQueries({ queryKey: ['admin', 'retailers', retailerId, 'staff'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Reactivate failed'),
  });

  const rows = data ?? [];

  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <SectionHeading kicker="Identity & Access" title={`Accounts on this store · ${rows.length}`} />
          <Button asChild variant="ghost" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
            <Link to={`/admin/retailers/${retailerId}/staff`}>Manage staff</Link>
          </Button>
        </div>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : rows.length === 0 ? (
          <p className="text-[13px] text-ink-3 italic">No staff yet — only the owner account exists.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/60">
                <tr className="border-b border-line">
                  <th className="kicker px-3 py-2 text-left text-ink-3">Name</th>
                  <th className="kicker px-3 py-2 text-left text-ink-3">Role</th>
                  <th className="kicker px-3 py-2 text-left text-ink-3">Status</th>
                  <th className="kicker px-3 py-2 text-left text-ink-3">Joined</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((a) => {
                  const isFocused = a.id === focusedAccountId;
                  const isActive = a.status === 'active';
                  return (
                    <tr key={a.id} className="hover:bg-bg-2/40">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink truncate">{a.legalName}</span>
                          {isFocused && <Badge tone="info" flat>You opened this</Badge>}
                        </div>
                        <div className="mt-0.5 text-[11.5px] text-ink-3">
                          {a.email} · {a.phone || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone="info" flat>{SUB_ROLE_LABEL[a.subRole] ?? a.subRole}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={isActive ? 'success' : 'neutral'}>{a.status.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="px-3 py-2 text-ink-3">{formatAge(a.createdAt)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          {!isFocused && (
                            <Button asChild variant="ghost" size="sm" iconRight={<ArrowUpRight className="size-3" />}>
                              <Link to={`/admin/retailers/${a.id}`}>Open</Link>
                            </Button>
                          )}
                          {a.subRole !== 'owner' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                iconLeft={<KeyRound className="size-3.5" />}
                                onClick={() => setResetTarget(a)}
                              >
                                Reset pw
                              </Button>
                              {isActive ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  iconLeft={<Power className="size-3.5" />}
                                  className="text-ink-3 hover:text-danger"
                                  loading={deactivateMut.isPending && deactivateMut.variables === a.id}
                                  onClick={() => {
                                    if (!window.confirm(`Deactivate ${a.legalName}? They lose access immediately.`)) return;
                                    deactivateMut.mutate(a.id);
                                  }}
                                >
                                  Deactivate
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  iconLeft={<Power className="size-3.5" />}
                                  className="text-ink-3 hover:text-success"
                                  loading={reactivateMut.isPending && reactivateMut.variables === a.id}
                                  onClick={() => reactivateMut.mutate(a.id)}
                                >
                                  Reactivate
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={resetTarget !== null} onOpenChange={(o) => { if (!o) setResetTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password?</DialogTitle>
            <DialogDescription>
              Generates a fresh temporary password for{' '}
              <span className="font-medium text-ink">{resetTarget?.email ?? ''}</span>. Their current
              password stops working immediately. You'll see the new password once.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button
              variant="ink"
              loading={resetMut.isPending}
              onClick={() => resetTarget && resetMut.mutate(resetTarget)}
            >
              Generate temp password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StaffTempPasswordModal
        info={tempPasswordShown}
        onClose={() => setTempPasswordShown(null)}
      />
    </Card>
  );
}
