import { formatDate, formatMoney } from '~/utils/floatFormat';
import type {
  DailyReconciliation,
  FundTransaction,
  PettyCashFund,
  PettyCashRequest,
} from '~/types/float';
import { FLOAT_DENOMINATIONS, floatAmount, cashDifference, cashSum } from '~/utils/floatStatus';

// PDFs are rendered from an HTML string with inline styles (html2canvas ignores app CSS classes
// it can't resolve off-screen). Request receipts are appended before the single download.

const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const money = (n: number) => `MVR ${formatMoney(n)}`;

const now = () =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Indian/Maldives',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());

const STYLE = {
  page: 'font-family:Helvetica,Arial,sans-serif;color:#0f172a;font-size:11px;line-height:1.45;padding:4px;',
  h1: 'font-size:18px;font-weight:700;margin:0;',
  sub: 'color:#64748b;font-size:10px;margin:2px 0 0;',
  h2: 'font-size:12px;font-weight:700;margin:18px 0 6px;padding-bottom:4px;border-bottom:1px solid #cbd5e1;',
  table: 'width:100%;border-collapse:collapse;',
  th: 'text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;padding:5px 6px;border-bottom:1px solid #cbd5e1;background:#f8fafc;',
  thR: 'text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;padding:5px 6px;border-bottom:1px solid #cbd5e1;background:#f8fafc;',
  td: 'padding:5px 6px;border-bottom:1px solid #e2e8f0;vertical-align:top;',
  tdR: 'padding:5px 6px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;vertical-align:top;',
  label: 'color:#64748b;width:38%;padding:3px 0;vertical-align:top;',
  value: 'padding:3px 0;font-weight:600;',
};

function header(title: string, subtitle: string, right: string) {
  return `
    <table style="${STYLE.table}margin-bottom:6px;"><tr>
      <td style="vertical-align:bottom;">
        <div style="font-size:9px;font-weight:700;letter-spacing:.08em;color:#0369a1;text-transform:uppercase;">Pension Office · Petty Cash</div>
        <h1 style="${STYLE.h1}">${esc(title)}</h1>
        <p style="${STYLE.sub}">${esc(subtitle)}</p>
      </td>
      <td style="vertical-align:bottom;text-align:right;color:#64748b;font-size:10px;">${right}</td>
    </tr></table>
    <div style="height:2px;background:#0f172a;margin-bottom:4px;"></div>`;
}

function keyValues(rows: [string, string][]) {
  return `<table style="${STYLE.table}">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="${STYLE.label}">${esc(k)}</td><td style="${STYLE.value}">${esc(v)}</td></tr>`,
    )
    .join('')}</table>`;
}

function footer() {
  return `<p style="margin-top:18px;color:#94a3b8;font-size:9px;">Generated ${esc(now())}. System-generated document.</p>`;
}

async function save(html: string, filename: string, append?: (voucher: Blob) => Promise<Blob>) {
  const { default: html2pdf } = await import('html2pdf.js');
  const blob = await html2pdf()
    .set({
      filename,
      margin: [12, 12, 14, 12],
      image: { type: 'jpeg', quality: 0.96 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        // html2canvas can't parse Tailwind 4's oklch() colours. The report only uses inline
        // styles, so drop the app's stylesheets from the clone it renders.
        onclone: (doc: Document) => {
          doc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => node.remove());
        },
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' },
    })
    .from(`<div style="${STYLE.page}">${html}</div>`, 'string')
    .outputPdf('blob');
  const url = URL.createObjectURL(append ? await append(blob) : blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  // Keep the link and URL alive while the browser starts its download.
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 60000);
}

// ---------------------------------------------------------------------------
// Closed request voucher
// ---------------------------------------------------------------------------
export async function downloadRequestPdf(
  req: PettyCashRequest,
  loadReceipt: (fileId: string) => Promise<Blob>,
) {
  const spent = req.expenseTotal ?? cashSum(req.expenses.map((e) => e.amount));
  const returned = cashSum(req.returns.map((r) => r.actualAmount));
  const received = req.totalCashIssued || floatAmount(req);
  const overspend = Math.max(0, cashDifference(spent, received));

  const details: [string, string][] = [
    ['Voucher no', req.id],
    ['Particulars', req.purpose],
    ['Requester', `${req.requester.name} (${req.department || 'General Services'})`],
    ['Requested', money(req.requestedAmount)],
    ['Disbursed', money(received)],
    ['Dynamics reference', req.dynamicsReference || '—'],
    ['Requested on', formatDate(req.createdAt)],
    ['Closed on', req.closedAt ? `${formatDate(req.closedAt)} by ${req.closedBy}` : '—'],
  ];

  const receipts = req.expenses.length
    ? `<table style="${STYLE.table}">
        <tr><th style="${STYLE.th}">Date</th><th style="${STYLE.th}">Vendor</th><th style="${STYLE.th}">Description</th><th style="${STYLE.th}">Invoice</th><th style="${STYLE.thR}">Amount</th></tr>
        ${req.expenses
          .map(
            (e) => `<tr>
              <td style="${STYLE.td}white-space:nowrap;">${esc(formatDate(e.expenseDate))}</td>
              <td style="${STYLE.td}">${esc(e.supplierName)}</td>
              <td style="${STYLE.td}">${esc(e.description)}${e.receiptFileName ? '' : ' <span style="color:#c2410c;">(no attachment)</span>'}</td>
              <td style="${STYLE.td}">${esc(e.invoiceNumber)}</td>
              <td style="${STYLE.tdR}">${esc(formatMoney(e.amount))}</td>
            </tr>`,
          )
          .join('')}
        <tr><td colspan="4" style="${STYLE.td}font-weight:700;">Total spent</td><td style="${STYLE.tdR}font-weight:700;">${esc(formatMoney(spent))}</td></tr>
      </table>`
    : `<p style="color:#64748b;">No receipts recorded.</p>`;

  const settlement: [string, string][] = [
    ['Cash received', money(received)],
    ['Total spent', money(spent)],
    overspend > 0
      ? ['Reimbursed to requester', money(overspend)]
      : ['Cash returned', money(returned)],
  ];

  const timeline = `<table style="${STYLE.table}">
    ${[...req.timeline]
      .reverse()
      .map(
        (t) => `<tr>
          <td style="${STYLE.td}white-space:nowrap;color:#64748b;width:22%;">${esc(t.timestamp)}</td>
          <td style="${STYLE.td}"><strong>${esc(t.title)}</strong><br><span style="color:#475569;">${esc(t.description)}</span></td>
        </tr>`,
      )
      .join('')}
  </table>`;

  const signatures = `<table style="${STYLE.table}margin-top:28px;"><tr>
    ${['Requested by', 'Authorized by (GS)', 'Closed by (Finance)']
      .map(
        (l) =>
          `<td style="width:33%;padding-right:16px;"><div style="border-top:1px solid #94a3b8;padding-top:4px;color:#64748b;font-size:10px;">${l}</div></td>`,
      )
      .join('')}
  </tr></table>`;

  const html = `
    ${header('Petty Cash Voucher', req.purpose, `<div style="font-size:14px;font-weight:700;color:#0f172a;">${esc(req.id)}</div>Closed`)}
    <h2 style="${STYLE.h2}">Details</h2>${keyValues(details)}
    <h2 style="${STYLE.h2}">Receipts</h2>${receipts}
    <h2 style="${STYLE.h2}">Settlement</h2>${keyValues(settlement)}
    <h2 style="${STYLE.h2}">Activity</h2>${timeline}
    ${signatures}
    ${footer()}`;

  await save(html, `${req.id}.pdf`, async (voucher) => {
    const { appendReceiptPdfs } = await import('~/utils/receiptPdf');
    return appendReceiptPdfs(voucher, req.expenses, loadReceipt);
  });
}

// ---------------------------------------------------------------------------
// Vault counts (shared by the reconciliation report and single-count PDFs)
// ---------------------------------------------------------------------------
const statusLabel = (s: DailyReconciliation['status']) =>
  s === 'balanced' ? 'Balanced' : s === 'resolved' ? 'Resolved' : 'Discrepancy';

function denominationTable(count: DailyReconciliation) {
  const rows = FLOAT_DENOMINATIONS.map((d) => {
    const n = Number((count.denominations as unknown as Record<string, number>)[d.key]) || 0;
    return n
      ? `<tr><td style="${STYLE.td}">${esc(d.label)}</td><td style="${STYLE.tdR}">${n}</td><td style="${STYLE.tdR}">${esc(formatMoney(n * d.value))}</td></tr>`
      : '';
  }).join('');
  return `<table style="${STYLE.table}margin-top:8px;">
    <tr><th style="${STYLE.th}">Denomination</th><th style="${STYLE.thR}">Pieces</th><th style="${STYLE.thR}">Value</th></tr>
    ${rows || `<tr><td colspan="3" style="${STYLE.td}color:#64748b;">No cash counted.</td></tr>`}
    <tr><td colspan="2" style="${STYLE.td}font-weight:700;">Total counted</td><td style="${STYLE.tdR}font-weight:700;">${esc(formatMoney(count.actualCashCount))}</td></tr>
  </table>`;
}

function countDetails(count: DailyReconciliation) {
  return `${keyValues([
    ['Counted on', `${formatDate(count.countDate)} by ${count.countedBy}`],
    ['Ledger balance at count', money(count.expectedBalance)],
    ['Cash counted', money(count.actualCashCount)],
    ['Difference', count.difference === 0 ? 'Balanced' : money(count.difference)],
  ])}${denominationTable(count)}`;
}

export async function downloadVaultCountPdf(input: {
  count: DailyReconciliation;
  fundName: string;
  preparedBy: string;
}) {
  const { count, fundName, preparedBy } = input;
  const summary: [string, string][] = [
    ['Status', statusLabel(count.status)],
    ['Notes', count.notes || '—'],
  ];
  if (count.status === 'resolved')
    summary.push(
      [
        'Resolved',
        [
          count.resolvedAt && formatDate(count.resolvedAt),
          count.resolvedBy && `by ${count.resolvedBy}`,
        ]
          .filter(Boolean)
          .join(' ') || '—',
      ],
      ['Resolution notes', count.resolutionNotes || '—'],
    );

  const signatures = `<table style="${STYLE.table}margin-top:28px;"><tr>
    ${['Counted by', 'Reviewed by']
      .map(
        (l) =>
          `<td style="width:50%;padding-right:16px;"><div style="border-top:1px solid #94a3b8;padding-top:4px;color:#64748b;font-size:10px;">${l}</div></td>`,
      )
      .join('')}
  </tr></table>`;

  const html = `
    ${header('Vault Count', fundName, `<div style="font-size:14px;font-weight:700;color:#0f172a;">${esc(formatDate(count.countDate))}</div>Prepared by ${esc(preparedBy)}`)}
    <h2 style="${STYLE.h2}">Count</h2>${countDetails(count)}
    <h2 style="${STYLE.h2}">Review</h2>${keyValues(summary)}
    ${signatures}
    ${footer()}`;

  await save(html, `vault-count-${count.countDate.slice(0, 10)}-${count.id.slice(0, 8)}.pdf`);
}

// ---------------------------------------------------------------------------
// Vault reconciliation report
// ---------------------------------------------------------------------------
export async function downloadReconciliationReport(input: {
  fund: PettyCashFund;
  transactions: FundTransaction[];
  reconciliations: DailyReconciliation[];
  cashWithStaff: number;
  preparedBy: string;
  totals: {
    topUps: number;
    cashIssued: number;
    cashReturned: number;
    reimbursements: number;
    adjustments: number;
  };
}) {
  const { fund, transactions, reconciliations, cashWithStaff, preparedBy, totals } = input;

  const latest = reconciliations[0];

  const summary: [string, string][] = [
    ['Opening balance', `${money(fund.openingBalance)} (${formatDate(fund.effectiveDate)})`],
    ['Top-ups', money(totals.topUps)],
    ['Cash issued to GS staff', money(totals.cashIssued)],
    ['Cash returned by GS staff', money(totals.cashReturned)],
    ['Reimbursements', money(totals.reimbursements)],
    ['Adjustments', money(totals.adjustments)],
    ['Expected cash in vault (ledger)', money(fund.currentExpectedBalance)],
    ['Out with GS staff', money(cashWithStaff)],
  ];

  const latestCount = latest
    ? countDetails(latest)
    : `<p style="color:#64748b;">No vault counts recorded yet.</p>`;

  const history = `<table style="${STYLE.table}">
    <tr><th style="${STYLE.th}">Date</th><th style="${STYLE.th}">Counted by</th><th style="${STYLE.thR}">Ledger</th><th style="${STYLE.thR}">Counted</th><th style="${STYLE.thR}">Difference</th><th style="${STYLE.th}">Status</th></tr>
    ${reconciliations
      .map(
        (r) => `<tr>
          <td style="${STYLE.td}white-space:nowrap;">${esc(formatDate(r.countDate))}</td>
          <td style="${STYLE.td}">${esc(r.countedBy)}${r.resolutionNotes ? `<br><span style="color:#64748b;">Resolved: ${esc(r.resolutionNotes)}</span>` : ''}</td>
          <td style="${STYLE.tdR}">${esc(formatMoney(r.expectedBalance))}</td>
          <td style="${STYLE.tdR}">${esc(formatMoney(r.actualCashCount))}</td>
          <td style="${STYLE.tdR}color:${r.difference === 0 ? '#15803d' : '#c2410c'};">${r.difference === 0 ? 'Balanced' : esc(formatMoney(r.difference))}</td>
          <td style="${STYLE.td}">${statusLabel(r.status)}</td>
        </tr>`,
      )
      .join('')}
  </table>`;

  const ledger = `<table style="${STYLE.table}">
    <tr><th style="${STYLE.th}">Date</th><th style="${STYLE.th}">Description</th><th style="${STYLE.th}">Reference</th><th style="${STYLE.thR}">Amount</th><th style="${STYLE.thR}">Balance</th></tr>
    ${[...transactions]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(
        (t) => `<tr>
          <td style="${STYLE.td}white-space:nowrap;">${esc(formatDate(t.date))}</td>
          <td style="${STYLE.td}">${esc(t.notes || t.type)}</td>
          <td style="${STYLE.td}">${esc(t.reference)}</td>
          <td style="${STYLE.tdR}">${t.amount > 0 ? '+' : ''}${esc(formatMoney(t.amount))}</td>
          <td style="${STYLE.tdR}">${esc(formatMoney(t.runningBalance))}</td>
        </tr>`,
      )
      .join('')}
  </table>`;

  const html = `
    ${header('Vault Reconciliation Report', fund.name, `Prepared by ${esc(preparedBy)}<br>${esc(formatDate(new Date().toISOString()))}`)}
    <h2 style="${STYLE.h2}">Fund summary</h2>${keyValues(summary)}
    <h2 style="${STYLE.h2}">Latest vault count</h2>${latestCount}
    <h2 style="${STYLE.h2}">Count history</h2>${history}
    <h2 style="${STYLE.h2}">Ledger</h2>${ledger}
    ${footer()}`;

  await save(
    html,
    `vault-reconciliation-${new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Maldives', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}.pdf`,
  );
}
