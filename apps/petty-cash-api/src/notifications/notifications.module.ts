import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { ExternalNotificationsModule } from '../common/external-notifications.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
@Module({
  imports: [AuthModule, CommonModule, ExternalNotificationsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
