import type { Permission } from '../auth/permissions';
import type { Role } from '../auth/actor';
const read: Permission[] = [
  'requests.list',
  'requests.get',
  'fund.get',
  'fund.transactions',
  'vaultcounts.list',
  'files.download',
  'notifications.list',
  'notifications.markread',
  'statistics.get',
  'reports.reconciliation',
];
const finance: Permission[] = [
  'disbursements.notifycollection',
  'settlements.returnforcorrection',
  'settlements.finalize',
  'fund.topup',
  'vaultcounts.recordcount',
  'notifications.sendreminder',
];
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  GS_REQUESTER: [
    ...read,
    'requests.create',
    'requests.edit',
    'disbursements.confirmreceipt',
    'expenses.addexpense',
    'expenses.removeexpense',
    'settlements.settle',
    'files.upload',
    'ocr.receipt',
  ],
  GS_MANAGER: [...read, 'approvals.authorize', 'approvals.reject'],
  FINANCE_STAFF: [...read, ...finance],
  FINANCE_SUPERVISOR: [...read, ...finance, 'vaultcounts.resolve'],
};
