import { can, type Actor } from '../auth/actor';
export function capabilities(a: Actor) {
  return {
    uploadReceipts: can(a, 'files.upload'),
    extractReceipts: can(a, 'ocr.receipt'),
    viewSettings: can(a, 'staffassignments.list'),
    lookupStaff: can(a, 'staffassignments.lookup'),
    addStaff: can(a, 'staffassignments.add'),
    removeStaff: can(a, 'staffassignments.remove'),
    viewRequests: can(a, 'requests.list'),
    viewRequest: can(a, 'requests.get'),
    viewApprovals: can(a, 'approvals.list'),
    viewFinance: can(a, 'disbursements.list'),
    viewHistory: can(a, 'requests.history'),
    viewReconciliation: can(a, 'vaultcounts.list'),
    viewLedger: can(a, 'fund.transactions'),
    viewFund: can(a, 'fund.get'),
    viewStatistics: can(a, 'statistics.get'),
    viewNotifications: can(a, 'notifications.list'),
    createRequest: can(a, 'requests.create'),
    topUp: can(a, 'fund.topup'),
    recordCount: can(a, 'vaultcounts.recordcount'),
    resolveCount: can(a, 'vaultcounts.resolve'),
  };
}
export function allowedActions(r: { status: string; requesterId: string }, a: Actor): string[] {
  const own = r.requesterId === a.id;
  const actions: string[] = [];
  if (r.status === 'pending_approval') {
    if (own && can(a, 'requests.edit')) actions.push('edit');
    if (can(a, 'approvals.authorize')) actions.push('authorize');
    if (can(a, 'approvals.reject')) actions.push('reject');
  }
  if (r.status === 'pending_finance' && can(a, 'disbursements.notifycollection'))
    actions.push('notifyCollection');
  if (r.status === 'ready_for_collection' && own && can(a, 'disbursements.confirmreceipt'))
    actions.push('confirmReceipt');
  if (['cash_issued', 'returned_for_correction'].includes(r.status)) {
    if (own && can(a, 'expenses.addexpense')) actions.push('addExpense');
    if (own && (can(a, 'expenses.addexpense') || can(a, 'expenses.removeexpense')))
      actions.push('removeExpense');
    if (own && can(a, 'settlements.settle')) actions.push('settle');
    if (can(a, 'notifications.sendreminder')) actions.push('sendReminder');
  }
  if (r.status === 'pending_closure') {
    if (can(a, 'settlements.returnforcorrection')) actions.push('returnForCorrection');
    if (can(a, 'settlements.finalize')) actions.push('finalize');
  }
  if (r.status === 'closed' && can(a, 'requests.get')) actions.push('downloadPdf');
  return actions;
}
export const ACTION_STATES: Record<string, string[]> = {
  edit: ['pending_approval'],
  authorize: ['pending_approval'],
  reject: ['pending_approval'],
  notifyCollection: ['pending_finance'],
  confirmReceipt: ['ready_for_collection'],
  addExpense: ['cash_issued', 'returned_for_correction'],
  removeExpense: ['cash_issued', 'returned_for_correction'],
  settle: ['cash_issued', 'returned_for_correction'],
  sendReminder: ['cash_issued', 'returned_for_correction'],
  returnForCorrection: ['pending_closure'],
  finalize: ['pending_closure'],
};
