import { FundBootstrapService } from '../../src/fund/fund-bootstrap.service';
import type { PrismaService } from '../../src/prisma/prisma.service';

export async function seedFund(db: PrismaService) {
  // Approved initial values. Keep the effective date fixed so later reruns are repeat-safe.
  await new FundBootstrapService(db).initialize({
    openingBalance: '0',
    effectiveDate: '2026-10-20',
    custodian: 'Team',
  });
}
