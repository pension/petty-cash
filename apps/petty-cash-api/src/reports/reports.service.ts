import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Actor } from '../auth/actor';
import { FUND_ID, ACTIVE_REQUEST_STATES as active } from '../common/constants';
import { dateFilter } from '../common/dates';
import { money } from '../common/money';
import { type ListQuery } from '../common/pagination';
import { wire } from '../common/serialization';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class ReportsService {
  constructor(private readonly db: PrismaService) {}
  async report(q: ListQuery, a: Actor) {
    return this.db.$transaction(
      async (tx) => {
        const fund = await tx.fund.findUniqueOrThrow({
          where: { id: FUND_ID },
        });
        const transactions = await tx.fundTransaction.findMany({
          where: dateFilter(q, 'date'),
          orderBy: { sequence: 'desc' },
        });
        const counts = await tx.vaultCount.findMany({
          where: dateFilter(q, 'countDate'),
          orderBy: { sequence: 'desc' },
        });
        const staff = await tx.pettyCashRequest.aggregate({
          where: { status: { in: active } },
          _sum: { totalCashIssued: true },
        });
        const total = (type: string) =>
          transactions
            .filter((t) => t.type === type)
            .reduce((sum, t) => sum.add(t.amount), money(0));
        return wire({
          fund,
          cashWithStaff: staff._sum.totalCashIssued || 0,
          transactions,
          counts,
          latestCount: counts[0] ?? null,
          totals: {
            topUps: total('top_up'),
            cashIssued: total('cash_issued').abs(),
            cashReturned: total('cash_returned'),
            reimbursements: total('reimbursement').abs(),
            adjustments: total('adjustment'),
          },
          generatedAt: new Date(),
          preparedBy: a.name,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
