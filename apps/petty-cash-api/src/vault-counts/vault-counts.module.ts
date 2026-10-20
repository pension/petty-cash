import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { VaultCountsController } from './vault-counts.controller';
import { VaultCountsService } from './vault-counts.service';
@Module({
  imports: [AuthModule, CommonModule],
  controllers: [VaultCountsController],
  providers: [VaultCountsService],
  exports: [VaultCountsService],
})
export class VaultCountsModule {}
