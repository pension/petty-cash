import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { ExternalNotificationsModule } from '../common/external-notifications.module';
import { DisbursementsController } from './disbursements.controller';
import { DisbursementsService } from './disbursements.service';
@Module({
  imports: [AuthModule, CommonModule, ExternalNotificationsModule],
  controllers: [DisbursementsController],
  providers: [DisbursementsService],
  exports: [DisbursementsService],
})
export class DisbursementsModule {}
