import { Injectable, Logger, Optional } from '@nestjs/common';
import { IdentityService } from '@pension/midgard';
import { NOTIFICATIONS_URL } from '../../env';
import { PrismaService } from '../prisma/prisma.service';
import { StaffDirectoryService } from '../staff-directory/staff-directory.service';
import { NotificationType } from './notification-type';

const NOTIFICATION_TYPE_ID: Record<NotificationType, number> = {
  [NotificationType.blink]: 7,
  [NotificationType.email]: 2,
};

/**
 * Best-effort external notification (Blink push or email) via the shared
 * Notifications API. Runs fire-and-forget: a failure here must never fail the
 * business action it's attached to, so every attempt is recorded in
 * notification_logs (pending -> success/error) instead of throwing back into
 * the caller. Blink additionally resolves the recipient's Blink user ID from
 * the employee directory (cached in blink_identities); email delivers
 * directly to the given address, no resolution needed.
 *
 * IdentityService is optional: the CLI maintenance context (src/cli.ts) has no
 * Bifrost connection and never triggers an external notification, so it never
 * registers this provider's module — see MaintenanceModule/NotificationsService.
 */
@Injectable()
export class ExternalNotificationsService {
  private readonly logger = new Logger(ExternalNotificationsService.name);
  constructor(
    private readonly directory: StaffDirectoryService,
    private readonly db: PrismaService,
    @Optional() private readonly identity?: IdentityService,
  ) {}

  notifyBlink(email: string, body: string, requestId?: string): void {
    void this.send(NotificationType.blink, email, body, {}, requestId);
  }

  notifyEmail(
    email: string,
    subject: string,
    body: string,
    replyTo: string,
    requestId?: string,
  ): void {
    void this.send(NotificationType.email, email, body, { subject, replyTo }, requestId);
  }

  private async send(
    type: NotificationType,
    email: string,
    body: string,
    extra: { subject?: string; replyTo?: string },
    requestId?: string,
  ) {
    const normalizedEmail = email.toLowerCase();
    const log = await this.db.notificationLog.create({
      data: {
        type,
        email: normalizedEmail,
        subject: extra.subject ?? null,
        body,
        replyTo: extra.replyTo ?? null,
        requestId: requestId ?? null,
      },
    });
    try {
      if (!this.identity) throw new Error('Bifrost identity service is not available.');
      if (!NOTIFICATIONS_URL) throw new Error('NOTIFICATIONS_URL is not configured.');
      const recipient =
        type === NotificationType.blink
          ? await this.resolveBlinkId(normalizedEmail)
          : normalizedEmail;
      if (!recipient) throw new Error('No Blink identity found for this email.');
      await this.identity.makeRequest(
        `${NOTIFICATIONS_URL}/api/notifications`,
        'POST',
        {},
        {
          notification_type_id: NOTIFICATION_TYPE_ID[type],
          body,
          recipients: [recipient],
          tags: ['petty-cash'],
          ...(type === NotificationType.blink ? { priority_id: 3, hidden: true } : {}),
          ...(type === NotificationType.email
            ? { subject: extra.subject, reply_to: extra.replyTo }
            : {}),
        },
      );
      await this.db.notificationLog.update({ where: { id: log.id }, data: { status: 'success' } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn({ event: 'external_notification_failed', type, reason: message });
      await this.db.notificationLog.update({
        where: { id: log.id },
        data: { status: 'error', error: message },
      });
    }
  }

  private async resolveBlinkId(email: string) {
    const cached = await this.db.blinkIdentity.findUnique({ where: { email } });
    if (cached) return cached.blinkId;
    const employee = await this.directory.findByEmail(email);
    await this.db.blinkIdentity.upsert({
      where: { email },
      create: { email, blinkId: employee.blinkId },
      update: { blinkId: employee.blinkId },
    });
    return employee.blinkId;
  }
}
