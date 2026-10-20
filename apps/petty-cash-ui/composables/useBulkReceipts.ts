import { computed, ref } from 'vue';
import type { BulkReceiptExtraction } from '~/utils/receiptExtraction';
export const MAX_BULK_RECEIPTS = 20;
export type BulkReceiptInput = {
  fileId: string;
  supplierName: string;
  expenseDate: string;
  amount: number;
  invoiceNumber?: string;
  category?: string;
  description: string;
};
export type BulkReceiptRow = {
  id: number;
  file: File;
  fileId: string;
  status: 'queued' | 'uploading' | 'uploaded' | 'extracting' | 'ready' | 'manual' | 'upload_failed';
  message: string;
  form: {
    supplierName: string;
    expenseDate: string;
    amount: string;
    invoiceNumber: string;
    category: string;
    description: string;
  };
};
type ReceiptApi = {
  uploadReceipt: (file: File) => Promise<{ fileId: string }>;
  extractReceipts: (fileIds: string[]) => Promise<BulkReceiptExtraction>;
  addExpenses: (requestId: string, receipts: BulkReceiptInput[]) => Promise<unknown>;
};
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Indian/Maldives',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export function useBulkReceipts(api: ReceiptApi) {
  const rows = ref<BulkReceiptRow[]>([]);
  const stage = ref<'select' | 'processing' | 'review'>('select');
  const error = ref('');
  const saving = ref(false);
  let generation = 0;
  let nextId = 0;
  const completed = computed(
    () => rows.value.filter((r) => ['ready', 'manual', 'upload_failed'].includes(r.status)).length,
  );
  const total = computed(
    () =>
      rows.value.reduce(
        (sum, r) =>
          sum +
          (Number.isFinite(Number(r.form.amount)) ? Math.round(Number(r.form.amount) * 100) : 0),
        0,
      ) / 100,
  );
  function rowError(row: BulkReceiptRow) {
    if (!row.fileId) return 'Upload this file again or remove it before confirming.';
    const f = row.form;
    if (
      !f.supplierName.trim() ||
      !f.description.trim() ||
      !f.expenseDate ||
      !(Number(f.amount) > 0)
    )
      return 'Enter vendor, date, total and what was bought.';
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(f.expenseDate) ||
      Number.isNaN(Date.parse(f.expenseDate)) ||
      new Date(f.expenseDate).toISOString().slice(0, 10) !== f.expenseDate ||
      f.expenseDate > today()
    )
      return 'Use a valid receipt date no later than today.';
    if (!/^\d+(\.\d{1,2})?$/.test(f.amount) || Number(f.amount) > 999999999999.99)
      return 'Use an MVR amount with at most two decimal places.';
    if (
      f.supplierName.trim().length > 2000 ||
      f.description.trim().length > 2000 ||
      f.invoiceNumber.trim().length > 100
    )
      return 'Shorten the vendor, description or invoice number.';
    return '';
  }
  const canConfirm = computed(
    () =>
      stage.value === 'review' &&
      !saving.value &&
      rows.value.length > 0 &&
      rows.value.every((r) => !rowError(r)),
  );
  function select(files: File[]) {
    if (stage.value === 'processing' || saving.value) return;
    error.value = '';
    for (const file of files) {
      if (
        rows.value.some(
          (r) =>
            r.file.name === file.name &&
            r.file.size === file.size &&
            r.file.lastModified === file.lastModified,
        )
      )
        continue;
      if (rows.value.length >= MAX_BULK_RECEIPTS) {
        error.value = `Choose up to ${MAX_BULK_RECEIPTS} files at a time.`;
        break;
      }
      if (file.size === 0 || file.size > 10 * 1024 * 1024) {
        error.value = `${file.name}: choose a nonempty file no larger than 10 MB.`;
        continue;
      }
      if (!/\.(jpe?g|png|heic|heif|webp|pdf)$/i.test(file.name)) {
        error.value = `${file.name}: use JPEG, PNG, HEIC, WebP or PDF.`;
        continue;
      }
      rows.value.push({
        id: ++nextId,
        file,
        fileId: '',
        status: 'queued',
        message: '',
        form: {
          supplierName: '',
          expenseDate: today(),
          amount: '',
          invoiceNumber: '',
          category: 'Office Supplies',
          description: '',
        },
      });
    }
    stage.value = 'select';
  }
  function remove(id: number) {
    if (saving.value || stage.value === 'processing') return;
    rows.value = rows.value.filter((r) => r.id !== id);
  }
  async function process() {
    if (!rows.value.length || saving.value || stage.value === 'processing') return;
    const run = ++generation;
    stage.value = 'processing';
    error.value = '';
    const pending = rows.value.filter((r) => ['queued', 'upload_failed'].includes(r.status));
    let cursor = 0;
    async function worker() {
      while (run === generation && cursor < pending.length) {
        const row = pending[cursor++];
        row.status = 'uploading';
        row.message = 'Uploading attachment…';
        try {
          const file = await api.uploadReceipt(row.file);
          if (run !== generation) return;
          row.fileId = file.fileId;
        } catch (e) {
          if (run !== generation) return;
          row.status = 'upload_failed';
          row.message =
            e instanceof Error ? e.message : 'Upload failed. Retry or remove this file.';
          continue;
        }
        row.status = 'uploaded';
        row.message = 'Uploaded. Waiting for the other files…';
      }
    }
    await Promise.all([worker(), worker()]);
    if (run !== generation) return;
    const uploaded = pending.filter((row) => row.status === 'uploaded');
    if (uploaded.length) {
      for (const row of uploaded) {
        row.status = 'extracting';
        row.message = 'Reading all uploaded receipts together…';
      }
      try {
        const { receipts } = await api.extractReceipts(uploaded.map((row) => row.fileId));
        if (run !== generation) return;
        for (const row of uploaded) {
          const matches = receipts.filter((result) => result.fileId === row.fileId);
          const result = matches.length === 1 ? matches[0] : undefined;
          if (!result || result.documentType === 'other' || result.documentType === 'unknown') {
            row.status = 'manual';
            row.message = result
              ? 'Not identified as a bill, receipt or invoice. Enter details manually or remove this row.'
              : 'AI could not read this receipt. The attachment is saved; enter details manually.';
          } else {
            for (const field of [
              'supplierName',
              'expenseDate',
              'amount',
              'invoiceNumber',
              'category',
              'description',
            ] as const)
              if (result[field] !== null && result[field] !== undefined)
                row.form[field] = String(result[field]);
            row.status = 'ready';
            row.message = 'Extracted. Check the details before confirming.';
          }
        }
      } catch {
        if (run !== generation) return;
        for (const row of uploaded) {
          row.status = 'manual';
          row.message =
            'AI could not read this receipt. The attachment is saved; enter details manually.';
        }
      }
    }
    if (run === generation) stage.value = 'review';
  }
  async function confirm(requestId: string) {
    if (!canConfirm.value) return false;
    saving.value = true;
    error.value = '';
    try {
      const receipts = rows.value.map((r) => ({
        fileId: r.fileId,
        supplierName: r.form.supplierName.trim(),
        expenseDate: r.form.expenseDate,
        amount: Number(r.form.amount),
        invoiceNumber: r.form.invoiceNumber.trim() || undefined,
        category: r.form.category,
        description: r.form.description.trim(),
      }));
      await api.addExpenses(requestId, receipts);
      return true;
    } catch (e) {
      error.value =
        e instanceof Error
          ? e.message
          : 'Could not save receipts. Your review is preserved; retry confirmation.';
      return false;
    } finally {
      saving.value = false;
    }
  }
  function reset() {
    generation++;
    rows.value = [];
    stage.value = 'select';
    error.value = '';
  }
  function cancel() {
    if (!saving.value) reset();
  }
  return {
    rows,
    stage,
    error,
    saving,
    completed,
    total,
    canConfirm,
    rowError,
    select,
    remove,
    process,
    confirm,
    reset,
    cancel,
  };
}
