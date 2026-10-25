import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Actor } from '../auth/actor';
import { AuditService } from '../common/audit.service';
import { countTotal, money } from '../common/money';
import { RequestWorkflowService } from '../common/request-workflow.service';
import { parse } from '../common/validation';
import { LedgerService } from '../ledger/ledger.service';
import { FinalizeSchema } from './dto/finalize.dto';
import { ReturnForCorrectionSchema } from './dto/return-for-correction.dto';
import { SettleSchema } from './dto/settle.dto';
type Requester = { name: string };
@Injectable()
export class SettlementsService {
  constructor(
    private readonly workflow: RequestWorkflowService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}
  async settle(id: string, body: unknown, a: Actor) {
    const d = parse(SettleSchema, body);
    return this.workflow.run(id, 'settle', d, a, (_tx, r) => {
      const update: Prisma.PettyCashRequestUpdateInput = {};
      const declared = Prisma.Decimal.max(
        0,
        r.totalCashIssued.sub(r.expenses.reduce((sum, e) => sum.add(e.amount), money(0))),
      );
      update.declaredCashReturn = declared;
      update.status = 'pending_closure';
      update.correctionNote = null;
      const type = 'created';
      const title = 'Submitted for Financial Closure';
      const description = `GS submitted invoices and declared MVR ${declared.toString()} cash handover to Finance.`;
      return { update, type, title, description };
    });
  }
  async returnForCorrection(id: string, body: unknown, a: Actor) {
    const d = parse(ReturnForCorrectionSchema, body);
    return this.workflow.run(id, 'returnForCorrection', d, a, () => {
      const update: Prisma.PettyCashRequestUpdateInput = {};
      update.status = 'returned_for_correction';
      update.correctionNote = d.note;
      const type = 'expense_returned';
      const title = 'Settlement Returned for Correction';
      const description = d.note;
      return { update, type, title, description };
    });
  }
  async finalize(id: string, body: unknown, a: Actor, key?: string) {
    const d = parse(FinalizeSchema, body);
    return this.workflow.run(
      id,
      'finalize',
      d,
      a,
      async (tx, r) => {
        const update: Prisma.PettyCashRequestUpdateInput = {};
        const spent = r.expenses.reduce((sum, e) => sum.add(e.amount), money(0));
        const balance = r.totalCashIssued.sub(spent);
        const reference = d.dynamicsReference || id;
        if (balance.isNegative()) {
          await this.ledger.post(tx, a, {
            type: 'reimbursement',
            amount: balance,
            reference,
            requestId: id,
            operationKey: `finalize:${id}`,
          });
          await this.audit.record(
            tx,
            id,
            a,
            'return_recorded',
            'Overspend Reimbursed',
            `MVR ${balance.abs().toString()}`,
          );
        } else if (balance.gt(0)) {
          if (!d.denominations)
            throw new BadRequestException('Count the returned cash before closing.');
          const actual = countTotal(d.denominations),
            difference = actual.sub(balance);
          await tx.cashReturn.create({
            data: {
              requestId: id,
              expectedAmount: balance,
              actualAmount: actual,
              difference,
              denominations: d.denominations,
              receivedBy: a.name,
              returnedBy: (r.requester as Requester).name,
            },
          });
          await this.ledger.post(tx, a, {
            type: 'cash_returned',
            amount: actual,
            reference,
            requestId: id,
            operationKey: `finalize:${id}`,
          });
          await this.audit.record(
            tx,
            id,
            a,
            'return_recorded',
            'Cash Return Recorded & Acknowledged',
            `Expected MVR ${balance.toString()}; counted MVR ${actual.toString()}; difference MVR ${difference.toString()}.`,
          );
        }
        update.status = 'closed';
        update.closedBy = a.name;
        update.closedAt = new Date();
        update.dynamicsReference = d.dynamicsReference || null;
        const type = 'closed';
        const title = 'Request Closed';
        const description = d.dynamicsReference
          ? `Dynamics reference: ${d.dynamicsReference}`
          : 'Finalized by Finance.';
        return { update, type, title, description };
      },
      key,
    );
  }
}
