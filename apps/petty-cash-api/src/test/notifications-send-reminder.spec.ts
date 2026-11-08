import type { Actor } from '../auth/actor';
import type { ExternalNotificationsService } from '../common/external-notifications.service';
import type { NotificationWriterService } from '../common/notification-writer.service';
import type { RequestWorkflowService } from '../common/request-workflow.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService.sendReminder reply-to fallback', () => {
  const finance: Actor = {
    id: 'test-finance',
    entityId: 103,
    name: 'Finance',
    email: null as unknown as string,
    roles: ['FINANCE_STAFF'],
    permissions: [],
    activeRequester: false,
  };
  const lockedRequest = {
    lastReminderAt: null,
    requester: { name: 'GS Staff', email: 'requester@example.test' },
    totalCashIssued: { toString: () => '500.00' },
  };

  function build(notifyEmail: jest.Mock) {
    const workflow = {
      run: jest.fn(async (_id, _action, _data, _actor, change) => change({}, lockedRequest)),
    } as unknown as RequestWorkflowService;
    const external = { notifyEmail } as unknown as ExternalNotificationsService;
    return new NotificationsService(
      {} as PrismaService,
      workflow,
      {} as NotificationWriterService,
      external,
    );
  }

  test('falls back to the requester email when the acting actor has no email on file', async () => {
    const notifyEmail = jest.fn();
    const service = build(notifyEmail);
    await service.sendReminder('PC-2026-0001', { expectedVersion: 1 }, finance);
    expect(notifyEmail).toHaveBeenCalledWith(
      'requester@example.test',
      'Settlement Reminder',
      expect.any(String),
      'requester@example.test',
      'PC-2026-0001',
    );
  });

  test('uses the acting actor email as reply-to when present', async () => {
    const notifyEmail = jest.fn();
    const service = build(notifyEmail);
    await service.sendReminder(
      'PC-2026-0002',
      { expectedVersion: 1 },
      {
        ...finance,
        email: 'finance@example.test',
      },
    );
    expect(notifyEmail).toHaveBeenCalledWith(
      'requester@example.test',
      'Settlement Reminder',
      expect.any(String),
      'finance@example.test',
      'PC-2026-0002',
    );
  });
});
