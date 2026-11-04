import { Module } from '@nestjs/common';
import { StaffDirectoryModule } from '../staff-directory/staff-directory.module';
import { ExternalNotificationsService } from './external-notifications.service';
// Not part of CommonModule: StaffDirectoryModule requires COMMON_GRPC_URL at
// module init, which the CLI maintenance context (imports CommonModule, no
// Bifrost connection) must not be forced to configure. Import this module
// directly in feature modules that dispatch Blink/email notifications.
@Module({
  imports: [StaffDirectoryModule],
  providers: [ExternalNotificationsService],
  exports: [ExternalNotificationsService],
})
export class ExternalNotificationsModule {}
