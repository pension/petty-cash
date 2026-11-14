import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  type CashHandover,
  type CashIssuance,
  type CashReturn,
  type Expense,
  type PettyCashRequest,
  type ReceiptFile,
  type TimelineEvent,
} from '@prisma/client';
import type { Actor } from '../auth/actor';
import { PrismaService } from '../prisma/prisma.service';
import { dateFilter } from './dates';
import { money } from './money';
import { pageQuery, type ListQuery } from './pagination';
import { allowedActions } from './request-policy';
import { wire } from './serialization';
import { parse } from './validation';
export type RequestRecord = PettyCashRequest & {
  expenses?: (Expense & { file?: ReceiptFile | null })[];
  issuances?: CashIssuance[];
  returns?: CashReturn[];
  handovers?: CashHandover[];
  timeline?: TimelineEvent[];
};
export const requestDetail = {
  expenses: { where: { removedAt: null }, include: { file: true } },
  issuances: true,
  returns: true,
  handovers: { orderBy: { acceptedAt: 'asc' as const } },
  timeline: { orderBy: { sequence: 'asc' as const } },
};
@Injectable()
export class RequestRecordsService {
  constructor(private readonly db: PrismaService) {}
  private serialize(r: RequestRecord, a: Actor) {
    const expenses = r.expenses?.filter((e) => !e.removedAt);
    return wire({
      ...r,
      requesterId: undefined,
      preparedById: undefined,
      lastReminderAt: undefined,
      estimatedClosingDate: r.estimatedClosingDate.toISOString().slice(0, 10),
      effectiveClosingDate: r.effectiveClosingDate.toISOString().slice(0, 10),
      closingDateExtensions: [],
      additionalCashRequests: [],
      allowedActions: allowedActions(r, a),
      expenseCount: expenses?.length ?? 0,
      expenseTotal: expenses?.reduce((sum: Prisma.Decimal, e) => sum.add(e.amount), money(0)) ?? 0,
      expenses: expenses?.map((e) => ({
        ...e,
        file: undefined,
        expenseDate: e.expenseDate.toISOString().slice(0, 10),
        receiptFileName: e.file?.fileName,
        receiptContentType: e.file?.contentType,
        receiptUrl: e.fileId ? `/files/${e.fileId}` : undefined,
      })),
      timeline: r.timeline?.map((t) => ({
        id: t.id,
        type: t.type,
        title: t.title,
        description: t.description,
        timestamp: t.createdAt,
        actor: { name: t.actorName, role: t.actorRole },
      })),
    });
  }
  async get(id: string, a: Actor, tx: Prisma.TransactionClient = this.db) {
    const r = await tx.pettyCashRequest.findUnique({
      where: { id },
      include: requestDetail,
    });
    if (!r) throw new NotFoundException('Request not found.');
    return this.serialize(r, a);
  }
  async list(q: ListQuery, a: Actor) {
    const { page, pageSize } = parse(pageQuery, q);
    const search = q.q?.trim();
    const statuses = q.status?.split(',');
    const where: Prisma.PettyCashRequestWhereInput = {
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(q.mine === 'true'
        ? { requesterId: a.id }
        : q.requesterId
          ? { requesterId: q.requesterId }
          : {}),
      ...dateFilter(q, 'closedAt'),
      ...(search
        ? {
            OR: [
              { id: { contains: search } },
              { purpose: { contains: search } },
              { dynamicsReference: { contains: search } },
              { requester: { path: '$.name', string_contains: search } },
            ],
          }
        : {}),
    };
    const sort = q.sort === 'closedAt' ? 'closedAt' : 'createdAt';
    const order = q.order === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await this.db.$transaction([
      this.db.pettyCashRequest.findMany({
        where,
        orderBy: [{ [sort]: order }, { id: order }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { expenses: { where: { removedAt: null } } },
      }),
      this.db.pettyCashRequest.count({ where }),
    ]);
    return {
      data: rows.map((r) => {
        const v = this.serialize(r, a);
        delete v.expenses;
        delete v.issuances;
        delete v.returns;
        delete v.handovers;
        delete v.timeline;
        return v;
      }),
      total,
      page,
      pageSize,
    };
  }
}
