export type ReceiptExtraction = {
  documentType: 'bill' | 'receipt' | 'invoice' | 'other' | 'unknown';
  category: string | null;
  supplierName: string | null;
  expenseDate: string | null;
  amount: number | null;
  invoiceNumber: string | null;
  description: string | null;
};
export type ReceiptForm = {
  category: string;
  supplierName: string;
  expenseDate: string;
  amount: string;
  invoiceNumber: string;
  description: string;
};
/** Fill untouched fields only; typing while AI runs always takes precedence. */
export function applyReceiptExtraction(
  form: ReceiptForm,
  before: ReceiptForm,
  result: ReceiptExtraction,
  edited: Set<string>,
) {
  for (const field of [
    'supplierName',
    'expenseDate',
    'amount',
    'invoiceNumber',
    'description',
    'category',
  ] as const) {
    const value = result[field];
    if (
      value !== null &&
      value !== undefined &&
      !edited.has(field) &&
      form[field] === before[field]
    ) {
      form[field] = String(value);
    }
  }
}

export type BulkReceiptExtraction = { receipts: (ReceiptExtraction & { fileId: string })[] };
