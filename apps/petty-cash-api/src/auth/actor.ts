import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '@pension/midgard';
import type { Permission } from './permissions';
export const ROLES = ['GS_REQUESTER', 'GS_MANAGER', 'FINANCE_STAFF', 'FINANCE_SUPERVISOR'] as const;
export type Role = (typeof ROLES)[number];
export type Actor = {
  id: string;
  entityId?: number;
  name: string;
  email: string;
  avatar?: string;
  permissions: Permission[];
  /** Workflow audience labels only; authorization checks individual permissions. */
  roles: Role[];
};
export const can = (actor: Actor, permission: Permission) => actor.permissions.includes(permission);
export function actorFrom(user: AuthUser, permissions: Permission[]): Actor {
  if (!user?.uuid) throw new ForbiddenException('A Bifrost user identity is required.');
  const audiences: Record<Role, Permission[]> = {
    GS_REQUESTER: [
      'requests.create',
      'requests.edit',
      'disbursements.confirmreceipt',
      'expenses.addexpense',
      'expenses.removeexpense',
      'settlements.settle',
    ],
    GS_MANAGER: ['approvals.authorize', 'approvals.reject'],
    FINANCE_STAFF: [
      'disbursements.notifycollection',
      'settlements.returnforcorrection',
      'settlements.finalize',
      'fund.topup',
      'vaultcounts.recordcount',
      'notifications.sendreminder',
    ],
    FINANCE_SUPERVISOR: ['vaultcounts.resolve'],
  };
  return {
    id: user.uuid,
    entityId: user.entity_id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    permissions,
    roles: ROLES.filter((role) =>
      audiences[role].some((permission) => permissions.includes(permission)),
    ),
  };
}
