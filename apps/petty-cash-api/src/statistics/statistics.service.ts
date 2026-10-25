import { Injectable } from '@nestjs/common';
import { FundService } from '../fund/fund.service';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class StatisticsService {
  constructor(
    private readonly db: PrismaService,
    private readonly fundService: FundService,
  ) {}
  async stats() {
    const [groups, fund, last, unresolved] = await Promise.all([
      this.db.pettyCashRequest.groupBy({ by: ['status'], _count: true }),
      this.fundService.fund(),
      this.db.vaultCount.findFirst({ orderBy: { sequence: 'desc' } }),
      this.db.vaultCount.count({ where: { status: 'discrepancy_pending' } }),
    ]);
    const n = (...s: string[]) =>
      groups.filter((g) => s.includes(g.status)).reduce((sum, g) => sum + g._count, 0);
    return {
      pendingApproval: n('pending_approval'),
      pendingDisbursement: n('pending_finance', 'ready_for_collection'),
      unsettled: n('cash_issued', 'returned_for_correction'),
      awaitingClosure: n('pending_closure'),
      cashInVault: fund.currentExpectedBalance,
      cashWithStaff: fund.cashWithStaff,
      lastCountAt: last?.countDate.toISOString() ?? null,
      unresolvedDiscrepancies: unresolved,
    };
  }
}
