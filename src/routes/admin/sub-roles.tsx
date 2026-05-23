import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { AdminSubRole, RetailerSubRole, SubRolePermissionMatrix } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RoleGate } from '@/components/shell/RoleGate';

type RawMatrix = Record<string, Record<string, boolean>>;
type BackendResponse = { admin: RawMatrix; retailer: RawMatrix };

function toMatrix<R extends string>(raw: RawMatrix | undefined | null): SubRolePermissionMatrix<R> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { subRoles: [], actions: [], cells: {} };
  const subRoles = Object.keys(raw) as R[];
  const actions = subRoles.length > 0 ? Object.keys(Object.values(raw)[0]!) : [];
  const cells: Record<string, Record<R, boolean>> = {};
  for (const action of actions) {
    cells[action] = {} as Record<R, boolean>;
    for (const role of subRoles) {
      cells[action]![role] = raw[role]?.[action] ?? false;
    }
  }
  return { subRoles, actions, cells };
}

export default function AdminSubRoles() {
  return (
    <RoleGate kind="admin" subRole="super_admin">
      <AdminSubRolesInner />
    </RoleGate>
  );
}

function AdminSubRolesInner() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'sub-roles'],
    queryFn: () => api<BackendResponse>('/admin/sub-roles'),
  });

  const adminMatrix = data ? toMatrix<AdminSubRole>(data.admin) : null;
  const retailerMatrix = data ? toMatrix<RetailerSubRole>(data.retailer) : null;

  const saveMutation = useMutation({
    mutationFn: async (patches: Array<{ scope: 'admin' | 'retailer'; subRole: string; action: string; allowed: boolean }>) => {
      await Promise.all(patches.map((p) => api('/admin/sub-roles', { method: 'PATCH', body: p })));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'sub-roles'] });
      toast.success('Permissions saved');
    },
    onError: () => toast.error('Failed to save permissions'),
  });

  return (
    <Page>
      <PageHeader
        kicker="Identity & Access"
        title="Sub-role permissions"
        description="Action × sub-role grid. Edits take effect on next sign-in."
      />

      <Tabs defaultValue="admin">
        <TabsList>
          <TabsTrigger value="admin">Admin sub-roles</TabsTrigger>
          <TabsTrigger value="retailer">Retailer sub-roles</TabsTrigger>
        </TabsList>

        <TabsContent value="admin">
          {isLoading || !adminMatrix ? (
            <Skeleton className="h-80" />
          ) : (
            <PermissionGrid
              scope="admin"
              matrix={adminMatrix}
              saving={saveMutation.isPending}
              onSave={(patches) => saveMutation.mutate(patches)}
            />
          )}
        </TabsContent>
        <TabsContent value="retailer">
          {isLoading || !retailerMatrix ? (
            <Skeleton className="h-80" />
          ) : (
            <PermissionGrid
              scope="retailer"
              matrix={retailerMatrix}
              saving={saveMutation.isPending}
              onSave={(patches) => saveMutation.mutate(patches)}
            />
          )}
        </TabsContent>
      </Tabs>
    </Page>
  );
}

type Patch = { scope: 'admin' | 'retailer'; subRole: string; action: string; allowed: boolean };

function PermissionGrid<R extends string>({
  scope,
  matrix,
  saving,
  onSave,
}: {
  scope: 'admin' | 'retailer';
  matrix: SubRolePermissionMatrix<R>;
  saving: boolean;
  onSave: (patches: Patch[]) => void;
}) {
  const [cells, setCells] = useState(matrix.cells);
  const dirty = JSON.stringify(cells) !== JSON.stringify(matrix.cells);

  function handleSave() {
    const patches: Patch[] = [];
    for (const action of matrix.actions) {
      for (const role of matrix.subRoles) {
        if ((cells[action]?.[role] ?? false) !== (matrix.cells[action]?.[role] ?? false)) {
          patches.push({ scope, subRole: role, action, allowed: cells[action]![role]! });
        }
      }
    }
    if (patches.length > 0) onSave(patches);
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 bg-bg-2/40">
        <div className="text-[12px] text-ink-3">
          {dirty ? <span className="text-warning">Unsaved changes</span> : 'Tick or untick to grant or revoke an action for that sub-role.'}
        </div>
        <Button size="sm" variant="accent" disabled={!dirty || saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-line bg-bg-2/40">
              <th className="px-4 py-3 text-left font-medium text-ink-3">Action</th>
              {matrix.subRoles.map((role) => (
                <th key={role} className="px-4 py-3 text-center font-medium text-ink-3 capitalize">
                  {String(role).replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.actions.map((action) => (
              <tr key={action} className="border-b border-line last:border-b-0">
                <td className="px-4 py-2.5 text-ink font-mono text-[12px]">{action}</td>
                {matrix.subRoles.map((role) => {
                  const checked = cells[action]?.[role] ?? false;
                  return (
                    <td key={role} className="px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setCells((c) => {
                            const next = { ...c } as Record<string, Record<R, boolean>>;
                            next[action] = { ...(c[action] ?? ({} as Record<R, boolean>)), [role]: e.target.checked };
                            return next;
                          })
                        }
                        className="size-4 cursor-pointer accent-accent"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
