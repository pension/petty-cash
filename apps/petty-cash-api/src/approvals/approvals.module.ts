import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
@Module({
  imports: [AuthModule, CommonModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
