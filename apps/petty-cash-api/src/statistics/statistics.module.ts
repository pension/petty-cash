import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { FundModule } from '../fund/fund.module';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
@Module({
  imports: [AuthModule, CommonModule, FundModule],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
