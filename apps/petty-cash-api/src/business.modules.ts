import { StaffAssignmentsModule } from './staff-assignments/staff-assignments.module';
import { AccessModule } from './access/access.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { DisbursementsModule } from './disbursements/disbursements.module';
import { ExpensesModule } from './expenses/expenses.module';
import { FilesModule } from './files/files.module';
import { FundModule } from './fund/fund.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OcrModule } from './ocr/ocr.module';
import { ReportsModule } from './reports/reports.module';
import { RequestsModule } from './requests/requests.module';
import { SettlementsModule } from './settlements/settlements.module';
import { StatisticsModule } from './statistics/statistics.module';
import { VaultCountsModule } from './vault-counts/vault-counts.module';
export const BUSINESS_MODULES = [
  AccessModule,
  StaffAssignmentsModule,
  IdempotencyModule,
  RequestsModule,
  ApprovalsModule,
  DisbursementsModule,
  ExpensesModule,
  SettlementsModule,
  FundModule,
  VaultCountsModule,
  FilesModule,
  NotificationsModule,
  StatisticsModule,
  ReportsModule,
  OcrModule,
];
