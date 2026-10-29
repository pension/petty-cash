import { formatDate, formatMoney } from '~/utils/pettyCashFormat';
import { pettyCashAmount } from '~/utils/pettyCashStatus';
import type { PettyCashSummary } from '~/types/pettyCash';

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(',') + '\r\n';
}

export function downloadHistoryCsv(rows: PettyCashSummary[], filename: string) {
  const header = ['Closed', 'Voucher no', 'Requester', 'Particulars', 'Petty cash (MVR)', 'Dynamics ref'];
  let csv = csvRow(header);
  for (const item of rows) {
    csv += csvRow([
      formatDate(item.closedAt || item.updatedAt),
      item.id,
      item.requester.name,
      item.purpose,
      formatMoney(pettyCashAmount(item)),
      item.dynamicsReference || '',
    ]);
  }
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 60000);
}
