import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { can, type Actor } from '../auth/actor';
import { FUND_ID } from '../common/constants';
import { countTotal } from '../common/money';
import { NotificationWriterService } from '../common/notification-writer.service';
import { pageQuery, type ListQuery } from '../common/pagination';
import { wire } from '../common/serialization';
import { TransactionsService } from '../common/transactions.service';
import { parse } from '../common/validation';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CountSchema } from './dto/count.dto';
import { ResolveSchema } from './dto/resolve.dto';
@Injectable()
export class VaultCountsService {
  constructor(
    private readonly db: PrismaService,
    private readonly ledger: LedgerService,
    private readonly transactions: TransactionsService,
    private readonly notifications: NotificationWriterService,
  ) {}
  async counts(q: ListQuery) {
    const { page, pageSize } = parse(pageQuery, q);
    const [data, total] = await this.db.$transaction([
      this.db.vaultCount.findMany({
        orderBy: { sequence: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.vaultCount.count(),
    ]);
    return wire({ data, total, page, pageSize });
  }
  async recordCount(body: unknown, a: Actor) {
    if (!can(a, 'vaultcounts.recordcount')) throw new ForbiddenException();
    const d = parse(CountSchema, body);
    return this.db.$transaction(async (tx) => {
      const fund = await this.ledger.lock(tx),
        actualCashCount = countTotal(d.denominations),
        difference = actualCashCount.sub(fund.currentExpectedBalance);
      const last = await tx.fundTransaction.findFirst({
        orderBy: { sequence: 'desc' },
      });
      const row = await tx.vaultCount.create({
        data: {
          ...d,
          fundId: FUND_ID,
          actualCashCount,
          difference,
          expectedBalance: fund.currentExpectedBalance,
          countedBy: a.name,
          status: difference.isZero() ? 'balanced' : 'discrepancy_pending',
          ledgerSequence: last?.sequence ?? 0,
        },
      });
      if (!difference.isZero())
        await this.notifications.create(
          tx,
          'Vault discrepancy recorded',
          `Difference MVR ${difference.toString()}`,
          '/reconciliation',
          { audience: 'FINANCE_SUPERVISOR' },
        );
      return wire(row);
    });
  }
  async resolve(id: string, body: unknown, a: Actor, key?: string) {
    if (!can(a, 'vaultcounts.resolve')) throw new ForbiddenException();
    const d = parse(ResolveSchema, body);
    return this.transactions.run(a, `resolve:${id}`, key, d, async (tx) => {
      await this.ledger.lock(tx);
      const count = await tx.vaultCount.findUnique({ where: { id } });
      if (!count) throw new NotFoundException();
      if (count.status !== 'discrepancy_pending')
        throw new ConflictException('This discrepancy is already resolved.');
      if (d.adjustLedger) {
        const newer = await tx.vaultCount.findFirst({
          where: { sequence: { gt: count.sequence } },
        });
        const adjusted = await tx.fundTransaction.findFirst({
          where: {
            type: 'adjustment',
            sequence: { gt: count.ledgerSequence },
          },
        });
        if (newer || adjusted)
          throw new ConflictException(
            'This count is stale. Record a fresh physical count before adjusting.',
          );
        await this.ledger.post(tx, a, {
          type: 'adjustment',
          amount: count.difference,
          reference: `ADJ-${id}`,
          notes: d.resolutionNotes,
          operationKey: `resolve:${id}`,
        });
      }
      return tx.vaultCount.update({
        where: { id },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: a.name,
          resolutionNotes: d.resolutionNotes,
        },
      });
    });
  }
}
