import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Actor } from '../auth/actor';
import { RequestRecordsService } from '../common/request-records.service';
import { dateFilter } from '../common/dates';
import { pageQuery } from '../common/pagination';
import { ApprovalsService } from '../approvals/approvals.service';
import { DisbursementsService } from '../disbursements/disbursements.service';
import { FundService } from '../fund/fund.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VaultCountsService } from '../vault-counts/vault-counts.service';
import { PrismaService } from '../prisma/prisma.service';

const actor: Actor = {
  id: 'requester',
  name: 'Test',
  email: 'test@example.test',
  roles: [],
  permissions: [],
};
function setup() {
  const delegate = <T>() => ({
    findMany: jest.fn<Promise<never[]>, [T]>().mockResolvedValue([]),
    count: jest.fn<Promise<number>, [unknown?]>().mockResolvedValue(25),
  });
  const db = {
    floatRequest: delegate<Prisma.FloatRequestFindManyArgs>(),
    fundTransaction: delegate<Prisma.FundTransactionFindManyArgs>(),
    notification: delegate<Prisma.NotificationFindManyArgs>(),
    vaultCount: delegate<Prisma.VaultCountFindManyArgs>(),
    $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
  };
  return { db, prisma: db as unknown as PrismaService };
}

describe('list pagination and filters', () => {
  test('History searches all advertised fields, preserves ownership/status and uses stable ordering', async () => {
    const { db, prisma } = setup();
    const service = new RequestRecordsService(prisma);
    const result = await service.list(
      {
        page: '3',
        pageSize: '10',
        status: 'closed',
        mine: 'true',
        q: '  Paper & pens  ',
        sort: 'closedAt',
        order: 'desc',
      },
      actor,
    );
    const query = db.floatRequest.findMany.mock.calls[0][0];
    expect(query).toMatchObject({
      skip: 20,
      take: 10,
      orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
      where: { status: { in: ['closed'] }, requesterId: 'requester' },
    });
    expect(query.where?.OR).toEqual([
      { id: { contains: 'Paper & pens' } },
      { purpose: { contains: 'Paper & pens' } },
      { dynamicsReference: { contains: 'Paper & pens' } },
      { requester: { path: '$.name', string_contains: 'Paper & pens' } },
    ]);
    expect(db.floatRequest.count).toHaveBeenCalledWith({ where: query.where });
    expect(result).toMatchObject({ total: 25, page: 3, pageSize: 10 });
  });

  test('cleared or whitespace-only search removes text filtering', async () => {
    const { db, prisma } = setup();
    await new RequestRecordsService(prisma).list({ q: '   ' }, actor);
    expect(db.floatRequest.findMany.mock.calls[0][0].where?.OR).toBeUndefined();
  });

  test('approvals always constrain the list to pending approval', async () => {
    const records = { list: jest.fn() };
    const service = new ApprovalsService(null!, records as unknown as RequestRecordsService);
    await service.list({ status: 'closed', page: '2', q: 'Paper' }, actor);
    expect(records.list).toHaveBeenCalledWith(
      { status: 'pending_approval', page: '2', q: 'Paper' },
      actor,
    );
  });

  test.each([
    'pending_approval',
    'pending_finance,ready_for_collection',
    'cash_issued,returned_for_correction',
    'pending_closure',
  ])('Finance tab %s preserves filtering on every page', async (status) => {
    const records = { list: jest.fn() };
    const service = new DisbursementsService(
      null!,
      null!,
      records as unknown as RequestRecordsService,
    );
    await service.list({ status, page: '2' }, actor);
    expect(records.list).toHaveBeenCalledWith({ status, page: '2' }, actor);
    expect(() => service.list({ status: 'closed' }, actor)).toThrow(BadRequestException);
  });

  test('ledger type/date filters apply equally to rows and total, with Maldives date boundaries', async () => {
    const { db, prisma } = setup();
    await new FundService(prisma, null!, null!).transactions({
      page: '2',
      pageSize: '5',
      type: 'top_up',
      from: '2026-10-01',
      to: '2026-10-22',
    });
    const query = db.fundTransaction.findMany.mock.calls[0][0];
    expect(query).toMatchObject({
      skip: 5,
      take: 5,
      orderBy: { sequence: 'desc' },
      where: {
        fundId: 'FUND-MVR-01',
        type: 'top_up',
        date: {
          gte: new Date('2026-09-30T19:00:00.000Z'),
          lte: new Date('2026-10-22T18:59:59.999Z'),
        },
      },
    });
    expect(db.fundTransaction.count).toHaveBeenCalledWith({ where: query.where });
  });

  test('counts paginate with stable sequence ordering', async () => {
    const { db, prisma } = setup();
    const result = await new VaultCountsService(prisma, null!, null!, null!).counts({
      page: '2',
      pageSize: '10',
    });
    expect(db.vaultCount.findMany).toHaveBeenCalledWith({
      skip: 10,
      take: 10,
      orderBy: { sequence: 'desc' },
    });
    expect(result).toMatchObject({ total: 25, page: 2, pageSize: 10 });
  });

  test('notifications retain their audience filter and break timestamp ties for consistent pages', async () => {
    const { db, prisma } = setup();
    await new NotificationsService(prisma, null!, null!).notifications(
      { page: '2', pageSize: '20' },
      actor,
    );
    const query = db.notification.findMany.mock.calls[0][0];
    expect(query).toMatchObject({
      skip: 20,
      take: 20,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(query.where?.OR).toContainEqual({ recipientId: actor.id });
    expect(db.notification.count).toHaveBeenCalledWith({ where: query.where });
  });

  test.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: 'abc' },
    { pageSize: '0' },
    { pageSize: '101' },
  ])('invalid pagination %j is rejected', (query) => {
    expect(pageQuery.safeParse(query).success).toBe(false);
  });

  test('invalid and reversed date ranges fail instead of silently showing no matches', () => {
    expect(() => dateFilter({ from: '2026-02-30' }, 'date')).toThrow(BadRequestException);
    expect(() => dateFilter({ from: '2026-10-22', to: '2026-10-01' }, 'date')).toThrow(
      BadRequestException,
    );
  });
});
