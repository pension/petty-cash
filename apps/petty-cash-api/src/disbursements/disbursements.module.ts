import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { StaffDirectoryModule } from '../staff-directory/staff-directory.module';
import { BlinkNotificationsService } from './blink-notifications.service';
import { DisbursementsController } from './disbursements.controller';
import { DisbursementsService } from './disbursements.service';
@Module({
  imports: [AuthModule, CommonModule, StaffDirectoryModule],
  controllers: [DisbursementsController],
  providers: [DisbursementsService, BlinkNotificationsService],
  exports: [DisbursementsService],
})
export class DisbursementsModule {}
