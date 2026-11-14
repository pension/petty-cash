import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { can, type Actor } from '../auth/actor';
import { FUND_ID, ACTIVE_REQUEST_STATES as active } from '../common/constants';
import { dateFilter } from '../common/dates';
import { pageQuery, type ListQuery } from '../common/pagination';
import { wire } from '../common/serialization';
import { TransactionsService } from '../common/transactions.service';
import { parse } from '../common/validation';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { TopUpSchema } from './dto/top-up.dto';
@Injectable()
export class FundService {
  constructor(
    private readonly db: PrismaService,
    private readonly ledger: LedgerService,
    private readonly transactionsService: TransactionsService,
  ) {}
  async fund() {
    const [fund, staff] = await this.db.$transaction([
      this.db.fund.findUnique({ where: { id: FUND_ID } }),
      this.db.pettyCashRequest.aggregate({
        where: { status: { in: active } },
        _sum: { totalCashIssued: true },
      }),
    ]);
    if (!fund) throw new NotFoundException('The MPAO fund has not been initialized.');
    return wire({ ...fund, cashWithStaff: staff._sum.totalCashIssued || 0 });
  }
  async transactions(q: ListQuery) {
    const { page, pageSize } = parse(pageQuery, q);
    const where: Prisma.FundTransactionWhereInput = {
      fundId: FUND_ID,
      ...(q.type ? { type: q.type } : {}),
      ...dateFilter(q, 'date'),
    };
    const [data, total] = await this.db.$transaction([
      this.db.fundTransaction.findMany({
        where,
        orderBy: { sequence: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.fundTransaction.count({ where }),
    ]);
    return wire({ data, total, page, pageSize });
  }
  async topUp(body: unknown, a: Actor, key?: string) {
    if (!can(a, 'fund.topup')) throw new ForbiddenException();
    const d = parse(TopUpSchema, body);
    return this.transactionsService.run(a, 'top-up', key, d, (tx, operationKey) =>
      this.ledger.post(tx, a, {
        ...d,
        type: 'top_up',
        operationKey,
      }),
    );
  }
}
