// MOCK_DEPENDENCY: §1 Identity & Access
//
// Fixtures backing every §1 surface that has no real endpoint yet. Each
// exported function returns the same shape the realigned backend will return
// (RetailerStaff, AdminTeamMember, SubRolePermissionMatrix, etc.) so swapping
// in the live `api()` call is a one-line change at the call site.

import type {
  AdminSubRole,
  AdminTeamMember,
  Notification,
  NotificationKind,
  RetailerStaff,
  RetailerStaffInvite,
  RetailerSubRole,
  SubRolePermissionMatrix,
} from '@/lib/types';

export function mockRetailerStaff(): RetailerStaff[] {
  return [
    {
      id: 'staff_owner',
      storeId: null,
      email: 'owner@example.com',
      legalName: 'Aanya Shah',
      phone: '9876543210',
      gstin: 'AAAPL1234C',
      subRole: 'owner',
      status: 'active',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
    },
    {
      id: 'staff_manager',
      storeId: null,
      email: 'manager@example.com',
      legalName: 'Rohan Kapoor',
      phone: '9876543211',
      gstin: 'AAAPL1235C',
      subRole: 'manager',
      status: 'active',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    },
    {
      id: 'staff_floor_a',
      storeId: null,
      email: 'floor.a@example.com',
      legalName: 'Sara Iyer',
      phone: '9876543212',
      gstin: 'AAAPL1236C',
      subRole: 'staff',
      status: 'active',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    },
    {
      id: 'staff_floor_b',
      storeId: null,
      email: 'floor.b@example.com',
      legalName: 'Vikram Joshi',
      phone: '9876543213',
      gstin: 'AAAPL1237C',
      subRole: 'staff',
      status: 'deactivated',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
    },
  ];
}

export function mockRetailerStaffInvites(): RetailerStaffInvite[] {
  return [
    {
      id: 'invite_1',
      email: 'newhire@example.com',
      subRole: 'staff',
      invitedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
    },
  ];
}

export function mockAdminTeam(): AdminTeamMember[] {
  return [
    {
      id: 'admin_super',
      email: 'super@closetx.local',
      name: 'Super Admin',
      subRole: 'super_admin',
      active: true,
      lastActiveAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString(),
    },
    {
      id: 'admin_ops_a',
      email: 'ops.a@closetx.local',
      name: 'Operations Lead',
      subRole: 'ops_admin',
      active: true,
      lastActiveAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 200).toISOString(),
    },
    {
      id: 'admin_support_a',
      email: 'support.a@closetx.local',
      name: 'Support Specialist',
      subRole: 'support',
      active: true,
      lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
    },
  ];
}

const ADMIN_ACTIONS = [
  'retailers.approve',
  'retailers.reject',
  'retailers.suspend',
  'retailers.terminate',
  'compliance.review',
  'compliance.override',
  'orders.cancel',
  'refunds.force',
  'promotions.publish',
  'promotions.revoke',
  'admins.invite',
  'admins.revoke',
] as const;

const RETAILER_ACTIONS = [
  'staff.invite',
  'staff.deactivate',
  'staff.reset_password',
  'listings.publish',
  'listings.retire',
  'inventory.import',
  'inventory.export',
  'promotions.create',
  'orders.accept',
  'orders.cancel',
  'returns.accept',
  'returns.reject',
] as const;

export function mockAdminPermissionMatrix(): SubRolePermissionMatrix<AdminSubRole> {
  const cells: Record<string, Record<AdminSubRole, boolean>> = {};
  for (const action of ADMIN_ACTIONS) {
    cells[action] = {
      super_admin: true,
      ops_admin:
        action.startsWith('retailers.') ||
        action.startsWith('orders.') ||
        action.startsWith('refunds.'),
      support: action === 'orders.cancel' || action === 'compliance.review',
    };
  }
  return {
    actions: [...ADMIN_ACTIONS],
    subRoles: ['super_admin', 'ops_admin', 'support'],
    cells,
  };
}

export function mockRetailerPermissionMatrix(): SubRolePermissionMatrix<RetailerSubRole> {
  const cells: Record<string, Record<RetailerSubRole, boolean>> = {};
  for (const action of RETAILER_ACTIONS) {
    cells[action] = {
      owner: true,
      manager: !action.startsWith('staff.'),
      staff:
        action === 'orders.accept' ||
        action === 'returns.accept' ||
        action === 'returns.reject' ||
        action === 'inventory.import',
    };
  }
  return {
    actions: [...RETAILER_ACTIONS],
    subRoles: ['owner', 'manager', 'staff'],
    cells,
  };
}

export function mockNotifications(): Notification[] {
  const kinds: NotificationKind[] = ['order', 'refund', 'kyc', 'system'];
  return kinds.map((kind, i) => ({
    id: `notif_${i}`,
    kind,
    title:
      kind === 'order'
        ? 'New order needs acceptance'
        : kind === 'refund'
          ? 'Refund partially disbursed'
          : kind === 'kyc'
            ? 'KYC re-verification due in 7 days'
            : 'Scheduled maintenance tonight 11pm IST',
    body: 'Tap to open the relevant detail screen.',
    deepLink: kind === 'order' ? '/retailer/orders' : null,
    readAt: i > 1 ? new Date().toISOString() : null,
    createdAt: new Date(Date.now() - 1000 * 60 * 30 * (i + 1)).toISOString(),
  }));
}

export function mockUnreadCount(): number {
  return mockNotifications().filter((n) => !n.readAt).length;
}
