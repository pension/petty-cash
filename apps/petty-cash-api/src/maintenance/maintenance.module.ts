import { StorageModule } from '../storage/storage.module';
import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { FilesService } from '../files/files.service';
import { FundBootstrapService } from '../fund/fund-bootstrap.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MaintenanceService } from './maintenance.service';
// Command context has no HTTP controllers or Bifrost connection.
@Module({
  imports: [StorageModule, CommonModule],
  providers: [FilesService, FundBootstrapService, NotificationsService, MaintenanceService],
})
export class MaintenanceModule {}
