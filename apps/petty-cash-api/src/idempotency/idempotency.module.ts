import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IdempotencyController } from './idempotency.controller';
import { IdempotencyService } from './idempotency.service';

@Module({
  imports: [AuthModule],
  controllers: [IdempotencyController],
  providers: [IdempotencyService],
})
export class IdempotencyModule {}
