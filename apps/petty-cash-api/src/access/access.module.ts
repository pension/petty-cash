import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
@Module({
  imports: [AuthModule, CommonModule],
  controllers: [AccessController],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
