import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { FundBootstrapService } from './fund-bootstrap.service';
import { FundController } from './fund.controller';
import { FundService } from './fund.service';
@Module({
  imports: [AuthModule, CommonModule],
  controllers: [FundController],
  providers: [FundService, FundBootstrapService],
  exports: [FundService, FundBootstrapService],
})
export class FundModule {}
