import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ListQuery } from '../common/pagination';
import { RequestRecordsService } from '../common/request-records.service';
import type { Actor } from '../auth/actor';
import { RequestWorkflowService } from '../common/request-workflow.service';
import { parse } from '../common/validation';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmReceiptSchema } from './dto/confirm-receipt.dto';
import { HandOverSchema } from './dto/hand-over.dto';
import { NotifyCollectionSchema } from './dto/notify-collection.dto';
import {
  AcceptHandoverSchema,
  CancelHandoverSchema,
  DeclineHandoverSchema,
} from './dto/respond-handover.dto';
@Injectable()
export class DisbursementsService {
  constructor(
    private readonly workflow: RequestWorkflowService,
    private readonly ledger: LedgerService,
    private readonly records: RequestRecordsService,
    private readonly db: PrismaService,
  ) {}
  list(q: ListQuery, a: Actor) {
    const statuses = [
      'pending_approval',
      'pending_finance',
      'ready_for_collection',
      'cash_issued',
      'returned_for_correction',
      'pending_closure',
    ];
    const selected = q.status?.split(',') ?? ['pending_finance', 'ready_for_collection'];
    if (!selected.length || selected.some((status) => !statuses.includes(status)))
      throw new BadRequestException('Invalid Finance Desk status.');
    return this.records.list({ ...q, status: selected.join(',') }, a);
  }
  async notifyCollection(id: string, body: unknown, a: Actor) {
    const d = parse(NotifyCollectionSchema, body);
    return this.workflow.run(id, 'notifyCollection', d, a, (_tx, r) => {
      const update: Prisma.PettyCashRequestUpdateInput = {};
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
        const update: Prisma.PettyCashRequestUpdateInput = {};
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
        update.custodianEmployeeId = a.entityId;
        update.custodianName = a.name;
        const type = 'acknowledged';
        const title = 'Cash Handed Over & Receipt Acknowledged';
        const description = `${a.name} received MVR ${r.approvedAmount.toString()} prepared by ${r.preparedBy}.`;
        return { update, type, title, description };
      },
      key,
    );
  }
  handoverCandidates(a: Actor) {
    return this.db.staffAssignment.findMany({
      where: { type: 'requester', removedAt: null, NOT: { employeeId: a.entityId ?? -1 } },
      select: { employeeId: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
  async handOver(id: string, body: unknown, a: Actor) {
    const d = parse(HandOverSchema, body);
    const target = await this.db.staffAssignment.findFirst({
      where: { type: 'requester', removedAt: null, employeeId: d.toEmployeeId },
    });
    if (!target) throw new BadRequestException('Select an active requester to hand over to.');
    if (target.employeeId === a.entityId)
      throw new BadRequestException('You already hold this cash.');
    return this.workflow.run(id, 'handOver', d, a, (_tx, r) => ({
      update: {
        pendingCustodianEmployeeId: target.employeeId,
        pendingCustodianName: target.name,
        pendingHandoverNote: d.note ?? null,
      },
      type: 'handover_requested',
      title: 'Cash Hand-over Offered',
      description: `${a.name} offered to hand MVR ${r.totalCashIssued.toString()} to ${target.name}.${d.note ? ' Note: ' + d.note : ''}`,
    }));
  }
  async acceptHandover(id: string, body: unknown, a: Actor) {
    const d = parse(AcceptHandoverSchema, body);
    return this.workflow.run(id, 'acceptHandover', d, a, async (tx, r) => {
      await tx.cashHandover.create({
        data: {
          requestId: id,
          fromEmployeeId: r.custodianEmployeeId!,
          fromName: r.custodianName!,
          toEmployeeId: a.entityId!,
          toName: a.name,
          note: r.pendingHandoverNote,
        },
      });
      return {
        update: {
          custodianEmployeeId: a.entityId,
          custodianName: a.name,
          pendingCustodianEmployeeId: null,
          pendingCustodianName: null,
          pendingHandoverNote: null,
        },
        type: 'handover_accepted',
        title: 'Cash Custody Accepted',
        description: `${a.name} accepted custody of MVR ${r.totalCashIssued.toString()} from ${r.custodianName}.`,
      };
    });
  }
  async cancelHandover(id: string, body: unknown, a: Actor) {
    const d = parse(CancelHandoverSchema, body);
    return this.workflow.run(id, 'cancelHandover', d, a, (_tx, r) => ({
      update: {
        pendingCustodianEmployeeId: null,
        pendingCustodianName: null,
        pendingHandoverNote: null,
      },
      type: 'handover_cancelled',
      title: 'Cash Hand-over Withdrawn',
      description: `${a.name} withdrew the offer to hand over cash to ${r.pendingCustodianName}.`,
    }));
  }
  async declineHandover(id: string, body: unknown, a: Actor) {
    const d = parse(DeclineHandoverSchema, body);
    return this.workflow.run(id, 'declineHandover', d, a, (_tx, r) => ({
      update: {
        pendingCustodianEmployeeId: null,
        pendingCustodianName: null,
        pendingHandoverNote: null,
      },
      type: 'handover_declined',
      title: 'Cash Hand-over Declined',
      description: `${a.name} declined to take over cash custody from ${r.custodianName}.`,
    }));
  }
}
