import { Injectable } from '@nestjs/common';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
@Injectable()
export class MaintenanceService {
  constructor(
    private readonly files: FilesService,
    private readonly notifications: NotificationsService,
  ) {}
  async run() {
    if (!process.env.FILE_STORAGE) throw new Error('Set FILE_STORAGE explicitly for maintenance.');
    await this.files.cleanup();
    await this.notifications.dueReminder();
  }
}
