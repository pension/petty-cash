import { Module } from '@nestjs/common';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditService } from './audit.service';
import { NotificationWriterService } from './notification-writer.service';
import { RequestRecordsService } from './request-records.service';
import { RequestWorkflowService } from './request-workflow.service';
import { TransactionsService } from './transactions.service';
@Module({
  imports: [PrismaModule],
  providers: [
    LedgerService,
    RequestRecordsService,
    RequestWorkflowService,
    TransactionsService,
    AuditService,
    NotificationWriterService,
  ],
  exports: [
    PrismaModule,
    LedgerService,
    RequestRecordsService,
    RequestWorkflowService,
    TransactionsService,
    AuditService,
    NotificationWriterService,
  ],
})
export class CommonModule {}
