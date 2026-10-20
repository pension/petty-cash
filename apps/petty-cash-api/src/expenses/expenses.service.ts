import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Actor } from '../auth/actor';
import { RequestWorkflowService } from '../common/request-workflow.service';
import { parse } from '../common/validation';
import { type AddExpenseDto, CreateExpensesSchema } from './dto/add-expense.dto';
import { RemoveExpenseSchema } from './dto/remove-expense.dto';
@Injectable()
export class ExpensesService {
  constructor(private readonly workflow: RequestWorkflowService) {}
  async addExpense(id: string, body: unknown, a: Actor, key?: string) {
    const d = parse(CreateExpensesSchema, body);
    const bulk = 'receipts' in d;
    if (bulk && !key) throw new BadRequestException('A valid Idempotency-Key header is required.');
    const receipts: Omit<AddExpenseDto, 'expectedVersion'>[] = bulk ? d.receipts : [d];
    return this.workflow.run(
      id,
      'addExpense',
      d,
      a,
      async (tx) => {
        // Lock files in a stable order before attaching any of them. Failure rolls back the whole batch.
        const fileIds = receipts
          .map((r) => r.fileId)
          .filter((id): id is string => !!id)
          .sort();
        for (const fileId of fileIds) {
          await tx.$queryRaw`SELECT id FROM receipt_files WHERE id = ${fileId} FOR UPDATE`;
          const file = await tx.receiptFile.findUnique({
            where: { id: fileId },
            include: { expense: true },
          });
          if (!file || file.ownerId !== a.id || file.state !== 'ready' || file.expense)
            throw new BadRequestException(
              'Receipt attachment is unavailable. No receipts were saved.',
            );
        }
        for (const receipt of receipts) await this.createExpense(tx, id, receipt);
        return {
          update: {},
          type: 'expense_added',
          title: bulk ? 'Receipts Recorded' : 'Expense Recorded',
          description: receipts.map((r) => `${r.supplierName}: MVR ${r.amount}`).join('; '),
        };
      },
      bulk ? key : undefined,
    );
  }
  private async createExpense(
    tx: Prisma.TransactionClient,
    id: string,
    d: Omit<AddExpenseDto, 'expectedVersion'>,
  ) {
    await tx.expense.create({
      data: {
        requestId: id,
        supplierName: d.supplierName,
        category: d.category,
        description: d.description,
        amount: d.amount,
        fileId: d.fileId,
        expenseDate: new Date(d.expenseDate),
        invoiceNumber: d.invoiceNumber || `INV-${randomUUID().slice(0, 12)}`,
      },
    });
  }
  async removeExpense(id: string, body: unknown, a: Actor, expenseId: string) {
    const d = parse(RemoveExpenseSchema, body);
    return this.workflow.run(id, 'removeExpense', d, a, async (tx) => {
      const update: Prisma.FloatRequestUpdateInput = {};
      const result = await tx.expense.updateMany({
        where: { id: expenseId, requestId: id, removedAt: null },
        data: { removedAt: new Date(), removedBy: a.id },
      });
      if (!result.count) throw new NotFoundException('Receipt not found.');
      const type = 'expense_returned';
      const title = 'Receipt Removed';
      const description = `Receipt ${expenseId} removed by ${a.name}.`;
      return { update, type, title, description };
    });
  }
}
