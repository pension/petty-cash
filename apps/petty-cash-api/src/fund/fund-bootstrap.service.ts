import { Injectable } from '@nestjs/common';
import { FUND_ID } from '../common/constants';
import { money } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class FundBootstrapService {
  constructor(private readonly db: PrismaService) {}
  async initialize({
    openingBalance: amount = process.env.FUND_OPENING_BALANCE,
    effectiveDate: date = process.env.FUND_EFFECTIVE_DATE,
    custodian = process.env.FUND_CUSTODIAN,
  }: { openingBalance?: string; effectiveDate?: string; custodian?: string } = {}) {
    if (
      !amount ||
      !date ||
      !custodian ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date ||
      !/^\d{1,12}(?:\.\d{1,2})?$/.test(amount) ||
      money(amount).isNegative() ||
      money(amount).decimalPlaces() > 2
    )
      throw new Error(
        'Provide FUND_OPENING_BALANCE, FUND_EFFECTIVE_DATE (YYYY-MM-DD), and FUND_CUSTODIAN.',
      );
    await this.db.$transaction(async (tx) => {
      const existing = await tx.fund.findUnique({ where: { id: FUND_ID } });
      if (existing) {
        if (
          !existing.openingBalance.equals(amount) ||
          existing.effectiveDate.toISOString().slice(0, 10) !== date ||
          existing.custodian !== custodian
        )
          throw new Error('Fund already exists with different opening details.');
        return;
      }
      await tx.fund.create({
        data: {
          id: FUND_ID,
          name: 'MPAO Petty Cash Fund',
          openingBalance: amount,
          currentExpectedBalance: amount,
          effectiveDate: new Date(date),
          custodian,
        },
      });
      await tx.fundTransaction.create({
        data: {
          fundId: FUND_ID,
          type: 'opening_balance',
          amount,
          runningBalance: amount,
          reference: 'OPENING',
          recordedBy: custodian,
          actorId: 'bootstrap',
          operationKey: 'opening',
        },
      });
    });
  }
}
