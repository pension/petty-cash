import { Injectable, Logger } from '@nestjs/common';
import { IdentityService } from '@pension/midgard';
import { NOTIFICATIONS_URL } from '../../env';
import { StaffDirectoryService } from '../staff-directory/staff-directory.service';

const BLINK_USER_NOTIFICATION_TYPE = 7;

/**
 * Best-effort Blink push notification. Runs fire-and-forget: a failure here must
 * never fail the business action it's attached to, so every method swallows its
 * own errors and only logs a diagnostic reason (never email/name/body content).
 *
 * The recipient's Blink user ID comes straight from the existing employee directory
 * lookup (StaffDirectoryService.findByEmail), which resolves by email alone and so
 * works for anyone — not just GS staff with a staff_assignments entry.
 */
@Injectable()
export class BlinkNotificationsService {
  private readonly logger = new Logger(BlinkNotificationsService.name);
  constructor(
    private readonly identity: IdentityService,
    private readonly directory: StaffDirectoryService,
  ) {}

  notify(email: string, body: string): void {
    if (!NOTIFICATIONS_URL) return;
    void this.send(email, body).catch((error) => {
      this.logger.warn({
        event: 'blink_notification_failed',
        reason: error instanceof Error ? error.message : 'UNKNOWN',
      });
    });
  }

  private async send(email: string, body: string) {
    const employee = await this.directory.findByEmail(email);
    if (!employee.blinkId) return;
    await this.identity.makeRequest(
      `${NOTIFICATIONS_URL}/api/notifications`,
      'POST',
      {},
      {
        notification_type_id: BLINK_USER_NOTIFICATION_TYPE,
        body,
        priority_id: 3,
        hidden: true,
        recipients: [employee.blinkId],
        tags: ['petty-cash'],
      },
    );
  }
}
