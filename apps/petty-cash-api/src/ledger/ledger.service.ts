import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Actor } from '../auth/actor';
import { FUND_ID } from '../common/constants';
import { money } from '../common/money';
@Injectable()
export class LedgerService {
  async lock(tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM funds WHERE id = ${FUND_ID} FOR UPDATE`;
    const fund = await tx.fund.findUnique({ where: { id: FUND_ID } });
    if (!fund) throw new ServiceUnavailableException('The MPAO fund has not been initialized.');
    return fund;
  }
  async post(
    tx: Prisma.TransactionClient,
    a: Actor,
    input: {
      type: string;
      amount: Prisma.Decimal.Value;
      reference: string;
      operationKey: string;
      requestId?: string;
      notes?: string;
    },
  ) {
    const fund = await this.lock(tx);
    const amount = money(input.amount);
    const runningBalance = fund.currentExpectedBalance.add(amount);
    if (runningBalance.isNegative())
      throw new ConflictException('There is insufficient cash in the vault.');
    const row = await tx.fundTransaction.create({
      data: {
        ...input,
        amount,
        runningBalance,
        fundId: FUND_ID,
        recordedBy: a.name,
        actorId: a.id,
      },
    });
    await tx.fund.update({
      where: { id: FUND_ID },
      data: { currentExpectedBalance: runningBalance },
    });
    return row;
  }
}
