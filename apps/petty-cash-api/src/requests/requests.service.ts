import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { can, type Actor } from '../auth/actor';
import { AuditService } from '../common/audit.service';
import { FUND_ID } from '../common/constants';
import { today } from '../common/dates';
import { NotificationWriterService } from '../common/notification-writer.service';
import { type ListQuery } from '../common/pagination';
import { capabilities } from '../common/request-policy';
import { RequestRecordsService } from '../common/request-records.service';
import { RequestWorkflowService } from '../common/request-workflow.service';
import { parse } from '../common/validation';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchema } from './dto/create.dto';
import { EditSchema } from './dto/edit.dto';
@Injectable()
export class RequestsService {
  constructor(
    private readonly db: PrismaService,
    private readonly records: RequestRecordsService,
    private readonly workflow: RequestWorkflowService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationWriterService,
  ) {}
  async edit(id: string, body: unknown, a: Actor) {
    const d = parse(EditSchema, body);
    return this.workflow.run(id, 'edit', d, a, (_tx, r) => {
      const update: Prisma.PettyCashRequestUpdateInput = {};
      const changes: string[] = [];
      if (d.purpose !== undefined && d.purpose !== r.purpose) {
        update.purpose = d.purpose;
        changes.push(`Purpose: ${r.purpose} → ${d.purpose}`);
      }
      if (d.requestedAmount !== undefined && !r.requestedAmount.equals(d.requestedAmount)) {
        update.requestedAmount = d.requestedAmount;
        changes.push(`Amount: ${r.requestedAmount.toString()} → ${d.requestedAmount}`);
      }
      if (d.neededBy && d.neededBy !== r.effectiveClosingDate.toISOString().slice(0, 10)) {
        update.estimatedClosingDate = new Date(d.neededBy);
        update.effectiveClosingDate = new Date(d.neededBy);
        changes.push(
          `Needed by: ${r.effectiveClosingDate.toISOString().slice(0, 10)} → ${d.neededBy}`,
        );
      }
      if (!changes.length) return null;
      const type = 'created';
      const title = 'Request Edited';
      const description = changes.join('; ');
      return { update, type, title, description };
    });
  }
  async create(body: unknown, a: Actor) {
    if (!capabilities(a).createRequest)
      throw new ForbiddenException('Only GS Staff can request petty cash.');
    const d = parse(CreateSchema, body);
    return this.db.$transaction(async (tx) => {
      await this.ledger.lock(tx);
      const year = Number(today().slice(0, 4));
      const counter = await tx.voucherCounter.upsert({
        where: { year },
        create: { year, value: 1 },
        update: { value: { increment: 1 } },
      });
      const id = `PC-${year}-${String(counter.value).padStart(4, '0')}`;
      await tx.pettyCashRequest.create({
        data: {
          id,
          fundId: FUND_ID,
          purpose: d.purpose,
          requestedAmount: d.requestedAmount,
          requesterId: a.id,
          requester: {
            id: a.id,
            name: a.name,
            email: a.email,
            ...(a.avatar ? { avatar: a.avatar } : {}),
          },
          estimatedClosingDate: new Date(d.neededBy),
          effectiveClosingDate: new Date(d.neededBy),
        },
      });
      await this.audit.record(
        tx,
        id,
        a,
        'created',
        'Request Created & Submitted',
        `${a.name} requested MVR ${d.requestedAmount}.`,
      );
      await this.notifications.create(
        tx,
        'Petty cash approval required',
        d.purpose,
        `/requests/${id}`,
        {
          audience: 'GS_MANAGER',
        },
      );
      return this.records.get(id, a, tx);
    });
  }
  // For now a request is visible to its creator, plus GS approvers and Finance, who need
  // the detail page to authorize, prepare cash and finalize.
  async get(id: string, a: Actor) {
    const r = await this.db.pettyCashRequest.findUnique({
      where: { id },
      select: { requesterId: true },
    });
    if (!r) throw new NotFoundException('Request not found.');
    if (r.requesterId !== a.id && !can(a, 'approvals.list') && !can(a, 'disbursements.list'))
      throw new ForbiddenException('You can only view petty cash requests you created.');
    return this.records.get(id, a);
  }
  // Requests and History list only the caller's own requests. GS Approvals and the
  // Finance Desk use their own endpoints, which list every requester's requests.
  history(q: ListQuery, a: Actor) {
    return this.records.list(
      { ...q, requesterId: undefined, mine: 'true', status: 'closed', sort: 'closedAt' },
      a,
    );
  }
  list(q: ListQuery, a: Actor) {
    return this.records.list({ ...q, requesterId: undefined, mine: 'true' }, a);
  }
}
