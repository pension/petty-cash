import PETTY_CASH_DENOMINATIONS from '@petty-cash/denominations';
import type { RequestStatus } from '~/types/pettyCash';

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'gray' },
  pending_approval: { label: 'Pending GS approval', color: 'yellow' },
  rejected: { label: 'Rejected', color: 'red' },
  pending_finance: { label: 'Pending disbursement', color: 'blue' },
  ready_for_collection: { label: 'Pending user collection', color: 'orange' },
  cash_issued: { label: 'Disbursed', color: 'blue' },
  returned_for_correction: { label: 'Needs correction', color: 'orange' },
  pending_closure: { label: 'Settled', color: 'yellow' },
  closed: { label: 'Closed', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'gray' },
};

/** Largest petty cash amount (MVR) per request; the API enforces the same limit. */
export const MAX_REQUEST_AMOUNT = 5000;

export function pettyCashStatus(status: RequestStatus) {
  return STATUS_CONFIG[status] || { label: status, color: 'gray' };
}

export function pettyCashAmount(req: { approvedAmount: number; requestedAmount: number }) {
  return req.approvedAmount || req.requestedAmount;
}

export { default as PETTY_CASH_DENOMINATIONS } from '@petty-cash/denominations';

export function emptyDenominationCounts(): Record<string, number | ''> {
  return Object.fromEntries(PETTY_CASH_DENOMINATIONS.map((d) => [d.key, '']));
}

export function denominationTotal(counts: Record<string, number | string>): number {
  return (
    PETTY_CASH_DENOMINATIONS.reduce((sum, d) => sum + (Number(counts[d.key]) || 0) * d.minorUnits, 0) /
    100
  );
}

// Display calculations operate in laari; financial writes are recomputed by the API.
export const cashDifference = (a: number, b: number) =>
  (Math.round(a * 100) - Math.round(b * 100)) / 100;
export const cashSum = (amounts: number[]) =>
  amounts.reduce((n, a) => n + Math.round(a * 100), 0) / 100;
