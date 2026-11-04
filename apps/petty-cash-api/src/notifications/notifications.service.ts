import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Actor } from '../auth/actor';
import { today } from '../common/dates';
import { NotificationWriterService } from '../common/notification-writer.service';
import { pageQuery, type ListQuery } from '../common/pagination';
import { RequestWorkflowService } from '../common/request-workflow.service';
import { wire } from '../common/serialization';
import { parse } from '../common/validation';
import { ExternalNotificationsService } from '../common/external-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SendReminderSchema } from './dto/send-reminder.dto';
@Injectable()
export class NotificationsService {
  constructor(
    private readonly db: PrismaService,
    private readonly workflow: RequestWorkflowService,
    private readonly writer: NotificationWriterService,
    // Optional: the CLI maintenance context (src/cli.ts) instantiates NotificationsService
    // directly (not via NotificationsModule) and never calls sendReminder, so
    // ExternalNotificationsModule isn't part of its graph. See MaintenanceModule.
    // Named `external` (not `notifications`) to avoid colliding with the notifications() method below.
    @Optional() private readonly external?: ExternalNotificationsService,
  ) {}
  async sendReminder(id: string, body: unknown, a: Actor) {
    const d = parse(SendReminderSchema, body);
    let requesterEmail = '';
    let requesterName = '';
    let cashIssued = '';
    const result = await this.workflow.run(id, 'sendReminder', d, a, (_tx, r) => {
      const update: Prisma.PettyCashRequestUpdateInput = {};
      if (r.lastReminderAt && Date.now() - r.lastReminderAt.getTime() < 86400000)
        throw new ConflictException(
          `A reminder was already sent at ${r.lastReminderAt.toISOString()}. Please wait 24 hours.`,
        );
      update.lastReminderAt = new Date();
      const requester = r.requester as { name: string; email: string };
      requesterEmail = requester.email;
      requesterName = requester.name;
      cashIssued = r.totalCashIssued.toString();
      const type = 'reminder';
      const title = 'Settlement Reminder Sent';
      const description = `Please settle ${id}; cash issued MVR ${cashIssued}.`;
      return { update, type, title, description };
    });
    // Fire-and-forget: an email delivery failure must never fail this response.
    this.external?.notifyEmail(
      requesterEmail,
      'Settlement Reminder',
      `Hi ${requesterName}, this is a reminder to settle petty cash request ${id}. Cash issued: MVR ${cashIssued}. Please log in to Petty Cash to submit your receipts and settle.`,
      a.email,
      id,
    );
    return result;
  }
  private audience(a: Actor) {
    return {
      OR: [
        { recipientId: a.id },
        {
          audience: {
            in: [...a.roles, ...(a.roles.includes('FINANCE_SUPERVISOR') ? ['FINANCE_STAFF'] : [])],
          },
        },
        ...(a.entityId != null ? [{ recipientEntityId: a.entityId }] : []),
      ],
    };
  }
  async notifications(q: ListQuery, a: Actor) {
    const { page, pageSize } = parse(pageQuery, q),
      where = this.audience(a);
    const [rows, total, unread] = await this.db.$transaction([
      this.db.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { reads: { where: { userId: a.id } } },
      }),
      this.db.notification.count({ where }),
      this.db.notification.count({
        where: { ...where, reads: { none: { userId: a.id } } },
      }),
    ]);
    return {
      data: rows.map((n) => ({
        ...wire(n),
        seen: n.reads.length > 0,
        reads: undefined,
      })),
      total,
      unread,
      page,
      pageSize,
    };
  }
  async markRead(id: string, a: Actor) {
    const n = await this.db.notification.findFirst({
      where: { id, ...this.audience(a) },
    });
    if (!n) throw new NotFoundException();
    await this.db.notificationRead.upsert({
      where: { notificationId_userId: { notificationId: id, userId: a.id } },
      create: { notificationId: id, userId: a.id },
      update: {},
    });
    return { success: true };
  }
  async dueReminder() {
    const last = await this.db.vaultCount.findFirst({
      orderBy: { sequence: 'desc' },
    });
    if (!last || Date.now() - last.countDate.getTime() >= 7 * 86400000)
      await this.writer.create(
        this.db,
        'Vault count due',
        'Please count the vault and compare it with the ledger.',
        '/reconciliation',
        { audience: 'FINANCE_STAFF' },
        `vault-due:${today()}`,
      );
  }
}
