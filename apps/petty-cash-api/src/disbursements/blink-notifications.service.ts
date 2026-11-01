import { Injectable, Logger } from '@nestjs/common';
import { IdentityService } from '@pension/midgard';
import { NOTIFICATIONS_URL } from '../../env';
import { PrismaService } from '../prisma/prisma.service';
import { StaffDirectoryService } from '../staff-directory/staff-directory.service';

const BLINK_USER_NOTIFICATION_TYPE = 7;

/**
 * Best-effort Blink push notification. Runs fire-and-forget: a failure here must
 * never fail the business action it's attached to, so every attempt is recorded
 * in blink_notification_logs (pending -> success/error with a message) instead
 * of throwing back into the caller.
 *
 * The recipient's Blink user ID comes from the employee directory lookup
 * (StaffDirectoryService.findByEmail), which resolves by email alone and so
 * works for anyone — not just GS staff with a staff_assignments entry. Resolved
 * ids are cached in blink_identities so repeat notifications to the same email
 * skip the Common Service gRPC call.
 */
@Injectable()
export class BlinkNotificationsService {
  private readonly logger = new Logger(BlinkNotificationsService.name);
  constructor(
    private readonly identity: IdentityService,
    private readonly directory: StaffDirectoryService,
    private readonly db: PrismaService,
  ) {}

  notify(email: string, body: string, requestId?: string): void {
    void this.send(email, body, requestId);
  }

  private async send(email: string, body: string, requestId?: string) {
    const normalizedEmail = email.toLowerCase();
    const log = await this.db.blinkNotificationLog.create({
      data: { email: normalizedEmail, body, requestId: requestId ?? null },
    });
    try {
      if (!NOTIFICATIONS_URL) throw new Error('NOTIFICATIONS_URL is not configured.');
      const cached = await this.db.blinkIdentity.findUnique({ where: { email: normalizedEmail } });
      const blinkId = cached ? cached.blinkId : await this.resolveAndCache(normalizedEmail);
      if (!blinkId) throw new Error('No Blink identity found for this email.');
      await this.identity.makeRequest(
        `${NOTIFICATIONS_URL}/api/notifications`,
        'POST',
        {},
        {
          notification_type_id: BLINK_USER_NOTIFICATION_TYPE,
          body,
          priority_id: 3,
          hidden: true,
          recipients: [blinkId],
          tags: ['petty-cash'],
        },
      );
      await this.db.blinkNotificationLog.update({
        where: { id: log.id },
        data: { status: 'success' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn({ event: 'blink_notification_failed', reason: message });
      await this.db.blinkNotificationLog.update({
        where: { id: log.id },
        data: { status: 'error', error: message },
      });
    }
  }

  private async resolveAndCache(email: string) {
    const employee = await this.directory.findByEmail(email);
    await this.db.blinkIdentity.upsert({
      where: { email },
      create: { email, blinkId: employee.blinkId },
      update: { blinkId: employee.blinkId },
    });
    return employee.blinkId;
  }
}
