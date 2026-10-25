import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Actor } from '../auth/actor';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { NotificationWriterService } from './notification-writer.service';
import { ACTION_STATES, allowedActions } from './request-policy';
import { RequestRecordsService, requestDetail } from './request-records.service';
import { TransactionsService } from './transactions.service';
export type LockedRequest = Prisma.PettyCashRequestGetPayload<{ include: typeof requestDetail }>;
export type RequestChange = {
  update: Prisma.PettyCashRequestUpdateInput;
  type: string;
  title: string;
  description: string;
};
@Injectable()
export class RequestWorkflowService {
  constructor(
    private readonly db: PrismaService,
    private readonly records: RequestRecordsService,
    private readonly transactions: TransactionsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationWriterService,
  ) {}
  async run(
    id: string,
    action: keyof typeof ACTION_STATES,
    data: { expectedVersion: number },
    actor: Actor,
    change: (
      tx: Prisma.TransactionClient,
      request: LockedRequest,
    ) => RequestChange | null | Promise<RequestChange | null>,
    key?: string,
  ) {
    const operation = async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM requests WHERE id = ${id} FOR UPDATE`;
      const request = await tx.pettyCashRequest.findUnique({ where: { id }, include: requestDetail });
      if (!request) throw new NotFoundException('Request not found.');
      if (!ACTION_STATES[action].includes(request.status))
        throw new ConflictException(
          `Request ${id} is ${request.status}; this action is no longer available.`,
        );
      if (!allowedActions(request, actor).includes(action))
        throw new ForbiddenException('You cannot perform this action on this request.');
      if (data.expectedVersion !== request.version)
        throw new ConflictException('This request changed. Refresh it before trying again.');
      const result = await change(tx, request);
      if (!result) return this.records.get(id, actor, tx);
      const { update, type, title, description } = result;
      await tx.pettyCashRequest.update({
        where: { id },
        data: { ...update, version: { increment: 1 } },
      });
      await this.audit.record(tx, id, actor, type, title, description);
      if (['edit', 'authorize', 'settle'].includes(action))
        await this.notifications.create(tx, title, description, `/requests/${id}`, {
          audience: action === 'edit' ? 'GS_MANAGER' : 'FINANCE_STAFF',
        });
      if (
        [
          'authorize',
          'reject',
          'notifyCollection',
          'sendReminder',
          'returnForCorrection',
          'finalize',
        ].includes(action)
      )
        await this.notifications.create(tx, title, description, `/requests/${id}`, {
          recipientId: request.requesterId,
        });
      return this.records.get(id, actor, tx);
    };
    if (['confirmReceipt', 'finalize'].includes(action) || (action === 'addExpense' && key))
      return this.transactions.run(actor, `${id}:${action}`, key, data, operation);
    return this.db.$transaction(operation, { timeout: 15000 });
  }
}
