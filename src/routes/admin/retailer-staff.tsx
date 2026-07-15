import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, UserPlus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StaffRow {
  id: string;
  email: string;
  legalName: string;
  phone: string;
  subRole: 'owner' | 'manager' | 'staff';
  status: 'pending_approval' | 'active' | 'terminated' | 'closed';
  createdAt: string;
}

export default function AdminRetailerStaff() {
  const { id: retailerId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<StaffRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'retailer-staff', retailerId],
    queryFn: () => api<StaffRow[]>(`/admin/retailers/${retailerId}/staff`),
    enabled: Boolean(retailerId),
  });

  const changeRole = useMutation({
    mutationFn: ({ accountId, subRole }: { accountId: string; subRole: 'owner' | 'manager' | 'staff' }) =>
      api(`/admin/retailers/${retailerId}/staff/${accountId}`, { method: 'PATCH', body: { subRole } }),
    onSuccess: () => {
      toast.success('Role updated');
      void qc.invalidateQueries({ queryKey: ['admin', 'retailer-staff', retailerId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  const deactivate = useMutation({
    mutationFn: (accountId: string) =>
      api(`/admin/retailers/${retailerId}/staff/${accountId}/deactivate`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Staff terminated');
      void qc.invalidateQueries({ queryKey: ['admin', 'retailer-staff', retailerId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Deactivate failed'),
  });

  const reactivate = useMutation({
    mutationFn: (accountId: string) =>
      api(`/admin/retailers/${retailerId}/staff/${accountId}/reactivate`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Staff reactivated');
      void qc.invalidateQueries({ queryKey: ['admin', 'retailer-staff', retailerId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Reactivate failed'),
  });

  const rows = data ?? [];

  return (
    <Page>
      <PageHeader
        kicker="Retailer"
        title="Staff management"
        description="Invite, edit roles, and deactivate retailer staff directly."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
              <Link to={`/admin/retailers/${retailerId}`}>Back</Link>
            </Button>
            <Button variant="ink" size="sm" iconLeft={<UserPlus className="size-3.5" />} onClick={() => setInviteOpen(true)}>
              Add staff
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6"><p className="text-[13px] text-ink-3 italic">No staff accounts yet.</p></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-2/40 border-b border-line">
                <tr>
                  <Th>Member</Th>
                  <Th>Contact</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <div className="font-medium text-ink">{r.legalName}</div>
                      <div className="text-[11px] text-ink-4 font-mono">{r.id}</div>
                    </Td>
                    <Td>
                      <div>{r.email}</div>
                      <div className="text-[12px] text-ink-3">{r.phone}</div>
                    </Td>
                    <Td>
                      <Select
                        value={r.subRole}
                        onValueChange={(v) => changeRole.mutate({ accountId: r.id, subRole: v as 'owner' | 'manager' | 'staff' })}
                      >
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">owner</SelectItem>
                          <SelectItem value="manager">manager</SelectItem>
                          <SelectItem value="staff">staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </Td>
                    <Td>
                      <Badge tone={r.status === 'active' ? 'success' : 'neutral'}>{r.status}</Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="inline-flex gap-1.5">
                        <Button variant="outline" size="sm" iconLeft={<KeyRound className="size-3.5" />} onClick={() => setResetTarget(r)}>
                          Reset password
                        </Button>
                        {r.status === 'active' ? (
                          <Button variant="outline" size="sm" className="text-danger border-danger/40" onClick={() => deactivate.mutate(r.id)}>
                            Deactivate
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => reactivate.mutate(r.id)}>
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        retailerId={retailerId ?? ''}
        onCreated={() => {
          setInviteOpen(false);
          void qc.invalidateQueries({ queryKey: ['admin', 'retailer-staff', retailerId] });
        }}
      />
      <ResetPasswordDialog
        target={resetTarget}
        retailerId={retailerId ?? ''}
        onClose={() => setResetTarget(null)}
      />
    </Page>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-3 ${className ?? ''}`}>{children}</th>;
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ''}`}>{children}</td>;
}

function InviteDialog({
  open,
  onClose,
  retailerId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  retailerId: string;
  onCreated: () => void;
}) {
  const [legalName, setLegalName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [subRole, setSubRole] = useState<'manager' | 'staff'>('staff');

  const create = useMutation({
    mutationFn: () =>
      api(`/admin/retailers/${retailerId}/staff`, {
        method: 'POST',
        body: { legalName: legalName.trim(), email: email.trim(), phone: phone.trim(), password, subRole },
      }),
    onSuccess: () => {
      toast.success('Staff added');
      setLegalName(''); setEmail(''); setPhone(''); setPassword(''); setSubRole('staff');
      onCreated();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add staff member</DialogTitle>
          <DialogDescription>Creates an active retailer account with the chosen sub-role. Credentials are stored hashed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="legalName" required>Legal name</Label>
            <Input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email" required>Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="phone" required>Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password" required>Initial password</Label>
            <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <FieldError>{password && password.length < 4 ? 'Min 4 chars' : ''}</FieldError>
          </div>
          <div>
            <Label htmlFor="subRole" required>Sub-role</Label>
            <Select value={subRole} onValueChange={(v) => setSubRole(v as 'manager' | 'staff')}>
              <SelectTrigger id="subRole"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">manager</SelectItem>
                <SelectItem value="staff">staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="ink"
            loading={create.isPending}
            disabled={!legalName || !email || !phone || password.length < 4}
            onClick={() => create.mutate()}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  target,
  retailerId,
  onClose,
}: {
  target: StaffRow | null;
  retailerId: string;
  onClose: () => void;
}) {
  const [pwd, setPwd] = useState('');
  const reset = useMutation({
    mutationFn: () =>
      api(`/admin/retailers/${retailerId}/staff/${target?.id}/reset-password`, {
        method: 'POST',
        body: { newPassword: pwd },
      }),
    onSuccess: () => {
      toast.success(`Password reset for ${target?.email}`);
      setPwd('');
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Reset failed'),
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o) { setPwd(''); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Force-set a new password for <span className="font-mono">{target?.email}</span>. The staff member will be notified.</DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="newPwd" required>New password</Label>
          <PasswordInput id="newPwd" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" />
          <FieldError>{pwd && pwd.length < 4 ? 'Min 4 chars' : ''}</FieldError>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setPwd(''); onClose(); }}>Cancel</Button>
          <Button variant="ink" disabled={pwd.length < 4} loading={reset.isPending} onClick={() => reset.mutate()}>
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
