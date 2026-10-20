import { z } from 'zod';
import { today } from '../../common/dates';
import { amount, date, revision, text } from '../../common/validation';
export const AddExpenseSchema = z.object({
  supplierName: text,
  expenseDate: date.refine((s) => s <= today(), 'Receipt date cannot be in the future'),
  amount,
  description: text,
  category: z
    .enum([
      'Office Supplies',
      'Hospitality & Food',
      'Hardware & Tools',
      'Transport & Delivery',
      'Maintenance & Repairs',
      'Printing & Stationery',
    ])
    .optional(),
  invoiceNumber: z.string().trim().max(100).optional(),
  fileId: z.string().uuid().optional(),
  ...revision,
});
export type AddExpenseDto = z.infer<typeof AddExpenseSchema>;

export const BulkExpenseSchema = z.object({
  receipts: z
    .array(AddExpenseSchema.omit({ expectedVersion: true }).extend({ fileId: z.string().uuid() }))
    .min(1)
    .max(20)
    .refine(
      (rows) => new Set(rows.map((r) => r.fileId)).size === rows.length,
      'Each attachment can be included only once',
    ),
  ...revision,
});
export const CreateExpensesSchema = z.union([BulkExpenseSchema, AddExpenseSchema]);

export type CreateExpensesDto = z.infer<typeof CreateExpensesSchema>;
