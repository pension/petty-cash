import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';
@Module({
  imports: [AuthModule, CommonModule],
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
