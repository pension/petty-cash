import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
@Module({
  imports: [AuthModule, CommonModule],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
