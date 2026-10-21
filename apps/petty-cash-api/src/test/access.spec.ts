import { PrismaService } from '../prisma/prisma.service';
import { StaffAssignmentsController } from '../staff-assignments/staff-assignments.controller';
import { StaffAssignmentsService } from '../staff-assignments/staff-assignments.service';
jest.mock('@pension/midgard/dist/env', () => ({ APP_ENV: 'production', APP_NAME: 'petty-cash' }));
import { DiscoveryModule } from '@nestjs/core';
import { IdentityController } from '@pension/midgard/dist/nest-client/identity.controller';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IdentityTestModule } from './identity-test.module';
import { ExecutionContext, INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AccessController } from '../access/access.controller';
import { AccessService } from '../access/access.service';
import { ApprovalsController } from '../approvals/approvals.controller';
import { ApprovalsService } from '../approvals/approvals.service';
import { DisbursementsController } from '../disbursements/disbursements.controller';
import { DisbursementsService } from '../disbursements/disbursements.service';
import { ExpensesController } from '../expenses/expenses.controller';
import { ExpensesService } from '../expenses/expenses.service';
import { FilesController } from '../files/files.controller';
import { FilesService } from '../files/files.service';
import { FundController } from '../fund/fund.controller';
import { FundService } from '../fund/fund.service';
import { NotificationsController } from '../notifications/notifications.controller';
import { NotificationsService } from '../notifications/notifications.service';
import { OcrController } from '../ocr/ocr.controller';
import { OcrService } from '../ocr/ocr.service';
import { ReportsController } from '../reports/reports.controller';
import { ReportsService } from '../reports/reports.service';
import { RequestsController } from '../requests/requests.controller';
import { RequestsService } from '../requests/requests.service';
import { SettlementsController } from '../settlements/settlements.controller';
import { SettlementsService } from '../settlements/settlements.service';
import { StatisticsController } from '../statistics/statistics.controller';
import { StatisticsService } from '../statistics/statistics.service';
import { VaultCountsController } from '../vault-counts/vault-counts.controller';
import { VaultCountsService } from '../vault-counts/vault-counts.service';

import { PERMISSIONS, ROLE_PERMISSION_GROUPS } from '../auth/permissions';
import { AuthModule } from '../auth/auth.module';
import { IdempotencyController } from '../idempotency/idempotency.controller';
import { IdempotencyService } from '../idempotency/idempotency.service';

// Bifrost verification is an external boundary. Supply verified test identities here;
// the real EntityGuard and every production controller decorator still run.
jest.mock('@pension/midgard', () => ({
  ...jest.requireActual<typeof import('@pension/midgard')>('@pension/midgard'),
  IdentityGuard: class {
    canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest<{
        headers: Record<string, string>;
        user: object;
      }>();
      if (!req.headers.authorization) throw new UnauthorizedException();
      req.user = {
        uuid: 'test-user',
        name: 'Test',
        email: 'test@example.test',
        permissions:
          req.headers['x-test-permissions']?.split(',') ??
          (req.headers['x-test-role'] === 'none' ? [] : PERMISSIONS.map((p) => `petty-cash.${p}`)),
        transacting_as: Number(req.headers['x-test-org']),
      };
      return true;
    }
  },
}));
const helperRoutes: [string, string][] = [
  ['GET', 'access'],
  ['POST', 'idempotency-keys'],
];
const routes: [string, string][] = [
  ['GET', 'staff-assignments'],
  ['POST', 'staff-assignments/lookup'],
  ['POST', 'staff-assignments'],
  ['DELETE', 'staff-assignments/test'],
  ['GET', 'stats'],
  ['GET', 'requests'],
  ['GET', 'requests/history'],
  ['GET', 'approvals'],
  ['GET', 'finance'],
  ['POST', 'requests'],
  ['GET', 'requests/PC-test'],
  ['PATCH', 'requests/PC-test'],
  ...[
    'authorize',
    'reject',
    'notify-collection',
    'confirm-receipt',
    'expenses',
    'settle',
    'reminders',
    'return-for-correction',
    'finalize',
  ].map((action) => ['POST', `requests/PC-test/${action}`] as [string, string]),
  ['DELETE', 'requests/PC-test/expenses/test'],
  ['GET', 'fund'],
  ['GET', 'fund/transactions'],
  ['POST', 'fund/top-ups'],
  ['GET', 'vault-counts'],
  ['POST', 'vault-counts'],
  ['POST', 'vault-counts/test/resolve'],
  ['POST', 'files'],
  ['GET', 'files/test'],
  ['POST', 'ocr/receipts'],
  ['GET', 'reports/reconciliation'],
  ['GET', 'notifications'],
  ['POST', 'notifications/test/read'],
];
describe('MPAO boundary on all HTTP routes', () => {
  let app: INestApplication;
  const touched = jest.fn(() => ({}));
  beforeAll(async () => {
    process.env.MPAO_ENTITY_ID = '1';
    process.env.APP_NAME = 'petty-cash';
    const module = await Test.createTestingModule({
      imports: [IdentityTestModule, AuthModule, DiscoveryModule],
      controllers: [
        IdentityController,
        AccessController,
        StaffAssignmentsController,
        IdempotencyController,
        RequestsController,
        ApprovalsController,
        DisbursementsController,
        ExpensesController,
        SettlementsController,
        FundController,
        VaultCountsController,
        FilesController,
        NotificationsController,
        StatisticsController,
        ReportsController,
        OcrController,
      ],
      providers: [
        IdempotencyService,
        AccessService,
        {
          provide: PrismaService,
          useValue: { staffAssignment: { findMany: jest.fn().mockResolvedValue([]) } },
        },
        {
          provide: StaffAssignmentsService,
          useValue: { list: touched, lookup: touched, add: touched, remove: touched },
        },
        {
          provide: RequestsService,
          useValue: new Proxy(
            {},
            { get: (_target, property) => (property === 'then' ? undefined : touched) },
          ),
        },
        {
          provide: ApprovalsService,
          useValue: new Proxy(
            {},
            { get: (_target, property) => (property === 'then' ? undefined : touched) },
          ),
        },
        {
          provide: DisbursementsService,
          useValue: new Proxy(
            {},
            { get: (_target, property) => (property === 'then' ? undefined : touched) },
          ),
        },
        {
          provide: ExpensesService,
          useValue: new Proxy(
            {},
            { get: (_target, property) => (property === 'then' ? undefined : touched) },
          ),
        },
        {
          provide: SettlementsService,
          useValue: new Proxy(
            {},
            { get: (_target, property) => (property === 'then' ? undefined : touched) },
          ),
        },
        {
          provide: FundService,
          useValue: new Proxy(
            {},
            { get: (_target, property) => (property === 'then' ? undefined : touched) },
          ),
        },
        {
          provide: VaultCountsService,
          useValue: new Proxy(
            {},
            { get: (_target, property) => (property === 'then' ? undefined : touched) },
          ),
        },
        {
          provide: FilesService,
          useValue: new Proxy(
            {},
            { get: (_target, property) => (property === 'then' ? undefined : touched) },
          ),
        },
        {
          provide: NotificationsService,
          useValue: new Proxy(
            {},
            { get: (_target, property) => (property === 'then' ? undefined : touched) },
          ),
        },
        {
          provide: StatisticsService,
          useValue: new Proxy(
            {},
            { get: (_target, property) => (property === 'then' ? undefined : touched) },
          ),
        },
        {
          provide: ReportsService,
          useValue: new Proxy(
            {},
            { get: (_target, property) => (property === 'then' ? undefined : touched) },
          ),
        },
        {
          provide: OcrService,
          useValue: new Proxy(
            {},
            { get: (_target, property) => (property === 'then' ? undefined : touched) },
          ),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  test('issues distinct server UUIDs for an MPAO identity without action permissions', async () => {
    await request(app.getHttpServer() as Server)
      .post('/idempotency-keys')
      .expect(401);
    const issue = () =>
      request(app.getHttpServer() as Server)
        .post('/idempotency-keys')
        .set('Authorization', 'Bearer test')
        .set('x-test-org', '1')
        .set('x-test-role', 'none')
        .expect('Cache-Control', 'no-store')
        .expect(201);
    const first = await issue();
    const second = await issue();
    expect((first.body as { key: string }).key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect((second.body as { key: string }).key).not.toBe((first.body as { key: string }).key);
  });
  test.each([...routes, ...helperRoutes])(
    '%s /%s rejects foreign org before touching business data',
    async (method, path) => {
      touched.mockClear();
      await request(app.getHttpServer() as Server)
        [method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'](`/${path}`)
        .set('Authorization', 'Bearer test')
        .set('x-test-org', '2')
        .expect(403);
      expect(touched).not.toHaveBeenCalled();
    },
  );
  test.each(routes)('%s /%s rejects missing application permission', async (method, path) => {
    touched.mockClear();
    await request(app.getHttpServer() as Server)
      [method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'](`/${path}`)
      .set('Authorization', 'Bearer test')
      .set('x-test-org', '1')
      .set('x-test-role', 'none')
      .expect(403);
    expect(touched).not.toHaveBeenCalled();
  });
  test('returns no capabilities for an MPAO identity without action permissions', async () => {
    await request(app.getHttpServer() as Server)
      .get('/access')
      .expect(401);
    const response = await request(app.getHttpServer() as Server)
      .get('/access')
      .set('Authorization', 'Bearer test')
      .set('x-test-org', '1')
      .set('x-test-role', 'none')
      .expect(200);
    const body = response.body as Awaited<ReturnType<AccessService['get']>>;
    expect(body.roles).toEqual([]);
    expect(Object.values(body.capabilities).every((value) => value === false)).toBe(true);
    await request(app.getHttpServer() as Server)
      .get('/access')
      .set('Authorization', 'Bearer test')
      .set('x-test-org', '1')
      .expect(200);
  });
  test('add receipt permission includes removal but removal alone does not grant adding', async () => {
    await request(app.getHttpServer() as Server)
      .delete('/requests/PC-test/expenses/test')
      .set('Authorization', 'Bearer test')
      .set('x-test-org', '1')
      .set('x-test-permissions', 'petty-cash.expenses.addexpense')
      .expect(200);
    touched.mockClear();
    await request(app.getHttpServer() as Server)
      .post('/requests/PC-test/expenses')
      .set('Authorization', 'Bearer test')
      .set('x-test-org', '1')
      .set('x-test-permissions', 'petty-cash.expenses.removeexpense')
      .expect(403);
    expect(touched).not.toHaveBeenCalled();
  });
  test('discovers every permission and matches the JSON and SQL catalogs', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/midgard/permissions/sync')
      .expect(200);
    const body = response.body as {
      app: string;
      routes: { controller: string; methodName: string }[];
    };
    expect(body.app).toBe('petty-cash');
    const discovered = body.routes
      .map((r: { controller: string; methodName: string }) =>
        `${r.controller}.${r.methodName}`.toLowerCase(),
      )
      .sort();
    expect(discovered).toEqual([...PERMISSIONS].sort());
    const sql = readFileSync(
      join(__dirname, '../../../../docs/sql/petty-cash-permissions.sql'),
      'utf8',
    );
    const catalog = [...sql.matchAll(/'([a-z]+\.[a-z]+)'/g)].map((match) => match[1]).sort();
    expect(catalog).toEqual(discovered);
    const manifest = JSON.parse(
      readFileSync(join(__dirname, '../../../../permissions.json'), 'utf8'),
    ) as {
      app: string;
      permissions: { subject: string; action: string; organisation: string; description: string }[];
    };
    expect(manifest.app).toBe(body.app);
    expect(
      manifest.permissions.every(
        (p) => p.subject === p.subject.toLowerCase() && p.action === p.action.toLowerCase(),
      ),
    ).toBe(true);
    expect(manifest.permissions.map((p) => `${p.subject}.${p.action}`).sort()).toEqual(discovered);
    expect(
      manifest.permissions.every(
        (p) =>
          p.organisation === 'Maldives Pension Administration Office' &&
          p.description.trim().length > 0,
      ),
    ).toBe(true);
  });
  test.each([
    ['request', '/approvals', 200],
    ['request', '/requests/history', 200],
    ['request', '/finance', 403],
    ['request', '/fund/transactions', 403],
    ['request', '/vault-counts', 403],
    ['finance', '/finance', 200],
    ['finance', '/fund/transactions', 200],
    ['finance', '/vault-counts', 200],
    ['finance', '/approvals', 403],
    ['finance', '/requests/history', 403],
    ['finance', '/requests', 403],
  ] as const)('%s role: %s returns %s', async (role, path, status) => {
    await request(app.getHttpServer() as Server)
      .get(path)
      .set('Authorization', 'Bearer test')
      .set('x-test-org', '1')
      .set(
        'x-test-permissions',
        ROLE_PERMISSION_GROUPS[role].map((p) => `petty-cash.${p}`).join(','),
      )
      .expect(status);
  });
  test('SQL role memberships match the role templates exactly', () => {
    const sql = readFileSync(
      join(__dirname, '../../../../docs/sql/petty-cash-permissions.sql'),
      'utf8',
    );
    const rows = [...sql.matchAll(/'([a-z]+\.[a-z]+)', ([01]), ([01])\)/g)];
    expect(rows.length).toBe(PERMISSIONS.length);
    expect(
      rows
        .filter((r) => r[2] === '1')
        .map((r) => r[1])
        .sort(),
    ).toEqual([...ROLE_PERMISSION_GROUPS.request].sort());
    expect(
      rows
        .filter((r) => r[3] === '1')
        .map((r) => r[1])
        .sort(),
    ).toEqual([...ROLE_PERMISSION_GROUPS.finance].sort());
  });
  test('production permission for create does not authorize edit', async () => {
    await request(app.getHttpServer() as Server)
      .post('/requests')
      .set('Authorization', 'Bearer test')
      .set('x-test-org', '1')
      .set('x-test-permissions', 'petty-cash.requests.create')
      .expect(201);
    touched.mockClear();
    await request(app.getHttpServer() as Server)
      .patch('/requests/PC-test')
      .set('Authorization', 'Bearer test')
      .set('x-test-org', '1')
      .set('x-test-permissions', 'petty-cash.requests.create')
      .expect(403);
    expect(touched).not.toHaveBeenCalled();
  });
  test('production accepts fully lowercase permissions for camelCase handlers', async () => {
    await request(app.getHttpServer() as Server)
      .post('/requests/PC-test/notify-collection')
      .set('Authorization', 'Bearer test')
      .set('x-test-org', '1')
      .set('x-test-permissions', 'petty-cash.disbursements.notifycollection')
      .expect(201);
    touched.mockClear();
    await request(app.getHttpServer() as Server)
      .post('/requests/PC-test/confirm-receipt')
      .set('Authorization', 'Bearer test')
      .set('x-test-org', '1')
      .set('x-test-permissions', 'petty-cash.disbursements.notifycollection')
      .expect(403);
    expect(touched).not.toHaveBeenCalled();
  });
  test('development bypasses permissions but still requires identity and MPAO', async () => {
    const env = jest.requireMock<{ APP_ENV: string }>('@pension/midgard/dist/env');
    env.APP_ENV = 'development';
    try {
      await request(app.getHttpServer() as Server)
        .get('/access')
        .set('Authorization', 'Bearer test')
        .set('x-test-org', '1')
        .set('x-test-role', 'none')
        .expect(200);
      await request(app.getHttpServer() as Server)
        .post('/requests')
        .set('Authorization', 'Bearer test')
        .set('x-test-org', '1')
        .set('x-test-role', 'none')
        .expect(201);
      await request(app.getHttpServer() as Server)
        .get('/access')
        .set('Authorization', 'Bearer test')
        .set('x-test-org', '2')
        .set('x-test-role', 'none')
        .expect(403);
      await request(app.getHttpServer() as Server)
        .get('/access')
        .expect(401);
    } finally {
      env.APP_ENV = 'production';
    }
  });
  test('removed Shorty and versioned routes do not exist', async () => {
    for (const path of [
      '/api/v1/shorturl/links',
      '/api/v1/float/me',
      '/api/float/requests',
      '/me',
      '/r/example',
      '/example',
    ])
      await request(app.getHttpServer() as Server)
        .get(path)
        .expect(404);
  });
});
