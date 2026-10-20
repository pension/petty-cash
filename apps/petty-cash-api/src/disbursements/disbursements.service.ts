import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Actor } from '../auth/actor';
import { RequestWorkflowService } from '../common/request-workflow.service';
import { parse } from '../common/validation';
import { LedgerService } from '../ledger/ledger.service';
import { ConfirmReceiptSchema } from './dto/confirm-receipt.dto';
import { NotifyCollectionSchema } from './dto/notify-collection.dto';
@Injectable()
export class DisbursementsService {
  constructor(
    private readonly workflow: RequestWorkflowService,
    private readonly ledger: LedgerService,
  ) {}
  async notifyCollection(id: string, body: unknown, a: Actor) {
    const d = parse(NotifyCollectionSchema, body);
    return this.workflow.run(id, 'notifyCollection', d, a, (_tx, r) => {
      const update: Prisma.FloatRequestUpdateInput = {};
      if (!r.requestedAmount.equals(d.amount) && !d.reason)
        throw new BadRequestException({
          message: 'A reason is required when changing the amount.',
          errors: { reason: ['Explain the different amount.'] },
          statusCode: 400,
        });
      update.status = 'ready_for_collection';
      update.approvedAmount = d.amount;
      update.preparedBy = a.name;
      update.preparedById = a.id;
      const type = 'finance_processed';
      const title = 'Cash Prepared for Collection';
      const description = `MVR ${d.amount}; requested MVR ${r.requestedAmount.toString()}.${d.reason ? ' Reason: ' + d.reason : ''}`;
      return { update, type, title, description };
    });
  }
  async confirmReceipt(id: string, body: unknown, a: Actor, key?: string) {
    const d = parse(ConfirmReceiptSchema, body);
    return this.workflow.run(
      id,
      'confirmReceipt',
      d,
      a,
      async (tx, r) => {
        const update: Prisma.FloatRequestUpdateInput = {};
        await tx.cashIssuance.create({
          data: {
            requestId: id,
            amount: r.approvedAmount,
            issuedBy: r.preparedBy!,
            acknowledgedBy: a.name,
          },
        });
        await this.ledger.post(tx, a, {
          type: 'cash_issued',
          amount: r.approvedAmount.negated(),
          reference: id,
          requestId: id,
          operationKey: `issue:${id}`,
        });
        update.status = 'cash_issued';
        update.totalCashIssued = r.approvedAmount;
        const type = 'acknowledged';
        const title = 'Cash Handed Over & Receipt Acknowledged';
        const description = `${a.name} received MVR ${r.approvedAmount.toString()} prepared by ${r.preparedBy}.`;
        return { update, type, title, description };
      },
      key,
    );
  }
}
