import type { StaffEligibility } from '~/types/staffAssignments';
const requesterActions = new Set([
  'edit',
  'confirmReceipt',
  'addExpense',
  'removeExpense',
  'settle',
  'handOver',
  'acceptHandover',
  'cancelHandover',
  'declineHandover',
]);
export function eligibleActions(actions: string[], eligibility: StaffEligibility): string[] {
  return actions.filter((action) => {
    if (requesterActions.has(action)) return eligibility.requester;
    if (action === 'authorize' || action === 'reject') return eligibility.approver;
    return true;
  });
}
