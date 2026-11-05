import type { ExternalNotificationsService as ExternalNotificationsServiceType } from '../common/external-notifications.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StaffDirectoryService } from '../staff-directory/staff-directory.service';

// NOTIFICATIONS_URL is read once at module-load time by env.ts, and this repo's test
// `.env` leaves it unset (not needed by any other suite). Load the service under test
// in an isolated registry with it set, so `send()` reaches the reply-to guard instead
// of failing earlier on "NOTIFICATIONS_URL is not configured."
let ExternalNotificationsService: typeof ExternalNotificationsServiceType;

beforeAll(() => {
  process.env.NOTIFICATIONS_URL = 'https://notifications.example.test';
  jest.resetModules();
  ({ ExternalNotificationsService } = require('../common/external-notifications.service'));
});

describe('ExternalNotificationsService email reply-to guard', () => {
  const makeRequest = jest.fn().mockResolvedValue(undefined);
  const update = jest.fn().mockResolvedValue(undefined);
  const create = jest.fn().mockResolvedValue({ id: 'log-1' });
  const db = { notificationLog: { create, update } } as unknown as PrismaService;
  const directory = {} as StaffDirectoryService;
  const identity = { makeRequest } as unknown as ConstructorParameters<
    typeof ExternalNotificationsServiceType
  >[2];

  beforeEach(() => {
    makeRequest.mockClear();
    update.mockClear();
    create.mockClear();
  });

  test('refuses to send an email notification when the actor has no reply-to email', async () => {
    const service = new ExternalNotificationsService(directory, db, identity);
    service.notifyEmail(
      'requester@example.test',
      'Settlement Reminder',
      'body',
      '',
      'PC-2026-0026',
    );
    await new Promise(process.nextTick);

    expect(makeRequest).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: {
        status: 'error',
        error: 'Actor has no email on file; cannot send email notification (reply-to required).',
      },
    });
  });

  test('sends the email notification when a reply-to email is present', async () => {
    const service = new ExternalNotificationsService(directory, db, identity);
    service.notifyEmail(
      'requester@example.test',
      'Settlement Reminder',
      'body',
      'finance@example.test',
      'PC-2026-0026',
    );
    await new Promise(process.nextTick);

    expect(makeRequest).toHaveBeenCalledWith(
      expect.stringContaining('/api/notifications'),
      'POST',
      {},
      expect.objectContaining({ reply_to: 'finance@example.test' }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: { status: 'success' },
    });
  });
});
