import { StorageService } from '../storage/storage.service';
jest.mock('@pension/midgard/dist/env', () => ({ APP_ENV: 'production', APP_NAME: 'petty-cash' }));
import { IdentityTestModule } from './identity-test.module';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { IdentityGuard } from '@pension/midgard';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { AuthUser } from '@pension/midgard';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AccessService } from '../access/access.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { EntityGuard } from '../auth/entity.guard';
import { BUSINESS_MODULES } from '../business.modules';
import { DisbursementsService } from '../disbursements/disbursements.service';
import { ExpensesService } from '../expenses/expenses.service';
import { FilesService } from '../files/files.service';
import { FundService } from '../fund/fund.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { RequestsService } from '../requests/requests.service';
import { SettlementsService } from '../settlements/settlements.service';
import { StatisticsService } from '../statistics/statistics.service';
import { VaultCountsService } from '../vault-counts/vault-counts.service';
jest.mock('@pension/midgard', () => ({
  ...jest.requireActual<typeof import('@pension/midgard')>('@pension/midgard'),
  IdentityGuard: class {
    canActivate() {
      return true;
    }
  },
}));

import { randomUUID } from 'node:crypto';
import { actorFrom, type Actor } from '../auth/actor';
import { ROLE_PERMISSIONS } from './permission-fixtures';
import { FUND_ID } from '../common/constants';
import { today } from '../common/dates';
import { countTotal } from '../common/money';
import { allowedActions } from '../common/request-policy';
const integration = process.env.PETTY_CASH_TEST_DATABASE_URL ? describe : describe.skip;
integration('Petty Cash MySQL financial workflow', () => {
  const db = new PrismaService({
    datasourceUrl: process.env.PETTY_CASH_TEST_DATABASE_URL,
  });
  let module: TestingModule;
  let app: INestApplication;
  let uploadDirectory: string;
  let requests: RequestsService;
  let approvals: ApprovalsService;
  let disbursements: DisbursementsService;
  let expenses: ExpensesService;
  let settlements: SettlementsService;
  let fund: FundService;
  let counts: VaultCountsService;
  let notifications: NotificationsService;
  let reports: ReportsService;
  let statistics: StatisticsService;
  let access: AccessService;
  const gs: Actor = {
    id: 'test-gs',
    entityId: 101,
    name: 'GS Staff',
    email: 'gs@example.test',
    roles: ['GS_REQUESTER'],
    permissions: ROLE_PERMISSIONS.GS_REQUESTER,
    activeRequester: true,
  };
  const gs2: Actor = {
    id: 'test-gs-2',
    entityId: 105,
    name: 'GS Staff Two',
    email: 'gs2@example.test',
    roles: ['GS_REQUESTER'],
    permissions: ROLE_PERMISSIONS.GS_REQUESTER,
    activeRequester: true,
  };
  const manager: Actor = {
    id: 'test-manager',
    entityId: 102,
    name: 'GS Manager',
    email: 'manager@example.test',
    roles: ['GS_MANAGER'],
    permissions: ROLE_PERMISSIONS.GS_MANAGER,
    activeRequester: false,
  };
  const finance: Actor = {
    id: 'test-finance',
    entityId: 103,
    name: 'Finance',
    email: 'finance@example.test',
    roles: ['FINANCE_STAFF'],
    permissions: ROLE_PERMISSIONS.FINANCE_STAFF,
    activeRequester: false,
  };
  const supervisor: Actor = {
    ...finance,
    id: 'test-supervisor',
    entityId: 104,
    roles: ['FINANCE_SUPERVISOR'],
    permissions: ROLE_PERMISSIONS.FINANCE_SUPERVISOR,
  };
  const replayVersions = new Map<string, number>();
  async function transition(
    id: string,
    action: string,
    body: object,
    actor: Actor,
    key?: string,
    expenseId?: string,
  ) {
    const current = await requests.get(id, actor);
    if (key && !replayVersions.has(key)) replayVersions.set(key, current.version);
    const data = { expectedVersion: key ? replayVersions.get(key) : current.version, ...body };
    switch (action) {
      case 'edit':
        return requests.edit(id, data, actor);
      case 'authorize':
        return approvals.authorize(id, data, actor);
      case 'reject':
        return approvals.reject(id, data, actor);
      case 'notifyCollection':
        return disbursements.notifyCollection(id, data, actor);
      case 'confirmReceipt':
        return disbursements.confirmReceipt(id, data, actor, key);
      case 'addExpense':
        return expenses.addExpense(id, data, actor);
      case 'removeExpense':
        return expenses.removeExpense(id, data, actor, expenseId!);
      case 'settle':
        return settlements.settle(id, data, actor);
      case 'handOver':
        return disbursements.handOver(id, data, actor);
      case 'acceptHandover':
        return disbursements.acceptHandover(id, data, actor);
      case 'cancelHandover':
        return disbursements.cancelHandover(id, data, actor);
      case 'declineHandover':
        return disbursements.declineHandover(id, data, actor);
      case 'returnForCorrection':
        return settlements.returnForCorrection(id, data, actor);
      case 'finalize':
        return settlements.finalize(id, data, actor, key);
      case 'sendReminder':
        return notifications.sendReminder(id, data, actor);
      default:
        throw new Error(`Unknown test action: ${action}`);
    }
  }
  beforeAll(async () => {
    if (!process.env.PETTY_CASH_TEST_DATABASE_URL?.includes('/petty_cash_test'))
      throw new Error('Integration tests require the isolated petty_cash_test database.');
    process.env.MPAO_ENTITY_ID = '1';
    process.env.APP_NAME = 'petty-cash';
    process.env.FILE_STORAGE = 'local';
    uploadDirectory = await mkdtemp(join(tmpdir(), 'petty-cash-http-'));
    process.env.FILE_STORAGE_PATH = uploadDirectory;
    module = await Test.createTestingModule({ imports: [IdentityTestModule, ...BUSINESS_MODULES] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideGuard(IdentityGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context
            .switchToHttp()
            .getRequest<{ headers: Record<string, string>; user?: object }>();
          const actor = [gs, manager, finance, supervisor].find(
            (a) => req.headers.authorization === `Bearer ${a.id}`,
          );
          if (!actor) return false;
          req.user = {
            uuid: actor.id,
            entity_id: actor.entityId,
            name: actor.name,
            email: actor.email,
            transacting_as: 1,
            permissions: actor.permissions.map((p) => `petty-cash.${p}`),
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
    requests = module.get(RequestsService);
    approvals = module.get(ApprovalsService);
    disbursements = module.get(DisbursementsService);
    expenses = module.get(ExpensesService);
    settlements = module.get(SettlementsService);
    fund = module.get(FundService);
    counts = module.get(VaultCountsService);
    notifications = module.get(NotificationsService);
    reports = module.get(ReportsService);
    statistics = module.get(StatisticsService);
    access = module.get(AccessService);
    await db.$connect();
    const existing = await db.fund.findUnique({ where: { id: FUND_ID } });
    if (existing) await fund.topUp({ amount: 25000, reference: 'TEST-RUN' }, finance, randomUUID());
    await db.$transaction(async (tx) => {
      if (await tx.fund.findUnique({ where: { id: FUND_ID } })) return;
      await tx.fund.create({
        data: {
          id: FUND_ID,
          name: 'Test fund',
          openingBalance: 25000,
          currentExpectedBalance: 25000,
          effectiveDate: new Date(today()),
          custodian: 'Test Finance',
        },
      });
      await tx.fundTransaction.create({
        data: {
          fundId: FUND_ID,
          type: 'opening_balance',
          amount: 25000,
          runningBalance: 25000,
          reference: 'TEST-OPENING',
          recordedBy: 'Test',
          actorId: 'test',
          operationKey: 'opening',
        },
      });
    });
    // The real ActorPipe (only IdentityGuard is mocked) looks up staff_assignments by entityId
    // to compute `activeRequester`, which confirmReceipt now requires for the HTTP-driven test.
    for (const person of [gs, gs2])
      if (
        !(await db.staffAssignment.findFirst({
          where: { type: 'requester', employeeId: person.entityId, removedAt: null },
        }))
      )
        await db.staffAssignment.create({
          data: {
            id: randomUUID(),
            type: 'requester',
            employeeId: person.entityId!,
            activeEmployeeId: person.entityId!,
            name: person.name,
            email: person.email,
            designation: 'Officer',
            department: 'General Services',
            addedBy: 'test-setup',
            addedByName: 'Test Setup',
          },
        });
  });
  afterAll(async () => {
    await app?.close();
    await db.$disconnect();
    if (uploadDirectory) await rm(uploadDirectory, { recursive: true, force: true });
  });
  const create = (amount = 850) =>
    requests.create(
      {
        purpose: `Integration ${randomUUID()}`,
        requestedAmount: amount,
        neededBy: today(),
      },
      gs,
    );
  async function issue(amount = 850) {
    const r = await create(amount);
    await transition(r.id, 'authorize', {}, manager);
    await transition(r.id, 'notifyCollection', { amount }, finance);
    await transition(r.id, 'confirmReceipt', {}, gs, randomUUID());
    return requests.get(r.id, gs);
  }
  const expense = (id: string, amount: number) =>
    transition(
      id,
      'addExpense',
      {
        supplierName: 'Vendor',
        description: 'Supplies',
        expenseDate: today(),
        amount,
      },
      gs,
    );
  test('HTTP feature routes complete collection, upload, correction and finalization without a prefix', async () => {
    const server = app.getHttpServer() as Server;
    const auth = (actor: Actor) => `Bearer ${actor.id}`;
    const before = (await fund.fund()).currentExpectedBalance;
    const accessResponse = await request(server)
      .get('/access')
      .set('Authorization', auth(gs))
      .expect(200);
    expect(accessResponse.body).toEqual(await access.get(gs));
    expect(accessResponse.body).not.toHaveProperty('name');
    await request(server).get('/me').set('Authorization', auth(gs)).expect(404);
    await request(server).get('/api/float/requests').set('Authorization', auth(gs)).expect(404);
    let row = (
      await request(server)
        .post('/requests')
        .set('Authorization', auth(gs))
        .send({ purpose: 'HTTP module workflow', requestedAmount: 100, neededBy: today() })
        .expect(201)
    ).body as {
      id: string;
      version: number;
      status: string;
      expenseTotal: number;
      declaredCashReturn: number;
      expenses: { fileId: string; receiptUrl: string }[];
    };
    const post = async (action: string, actor: Actor, body: object = {}) => {
      const response = await request(server)
        .post(`/requests/${row.id}/${action}`)
        .set('Authorization', auth(actor))
        .set('Idempotency-Key', randomUUID())
        .send({ expectedVersion: row.version, ...body })
        .expect(201);
      row = response.body as typeof row;
    };
    await request(server)
      .post(`/requests/${row.id}/unknown-action`)
      .set('Authorization', auth(gs))
      .expect(404);
    await post('authorize', manager);
    await post('notify-collection', finance, { amount: 100 });
    expect((await fund.fund()).currentExpectedBalance).toBe(before);
    await post('confirm-receipt', gs);
    const receipt = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      Buffer.alloc(100),
    ]);
    const uploaded = await request(server)
      .post('/files')
      .set('Authorization', auth(gs))
      .attach('file', receipt, { filename: 'receipt.png', contentType: 'image/png' })
      .expect(201);
    const file = uploaded.body as { fileId: string; url: string };
    expect(file.url).toBe(`/files/${file.fileId}`);
    await post('expenses', gs, {
      supplierName: 'HTTP Vendor',
      expenseDate: today(),
      amount: 60.25,
      description: 'Supplies',
      fileId: file.fileId,
    });
    const loaded = await request(server)
      .get(`/requests/${row.id}`)
      .set('Authorization', auth(gs))
      .expect(200);
    expect((loaded.body as typeof row).expenses[0].receiptUrl).toBe(file.url);
    const download = await request(server)
      .get(file.url)
      .set('Authorization', auth(finance))
      .expect(200);
    expect(download.body).toEqual(receipt);
    await post('settle', gs);
    await post('return-for-correction', finance, { note: 'Confirm the invoice details' });
    await post('settle', gs);
    expect(row.declaredCashReturn).toBe(39.75);
    await post('finalize', finance, { returnedAmount: 39.75 });
    expect(row.status).toBe('closed');
    expect(row.expenseTotal).toBe(60.25);
    expect((await fund.fund()).currentExpectedBalance).toBeCloseTo(before - 60.25, 2);
    await request(server)
      .get('/reports/reconciliation')
      .set('Authorization', auth(finance))
      .expect(200);
    await request(server).post('/ocr/receipts').set('Authorization', auth(gs)).expect(400);
  });
  test('bulk receipts commit once, roll back together, and lock after settlement', async () => {
    const row = await issue(100);
    const makeFile = (ownerId = gs.id) =>
      db.receiptFile.create({
        data: {
          ownerId,
          storageKey: randomUUID(),
          fileName: 'bulk.pdf',
          contentType: 'application/pdf',
          size: 8,
          state: 'ready',
        },
      });
    const files = await Promise.all([makeFile(), makeFile(), makeFile('foreign')]);
    const receipts = files.map((f) => ({
      fileId: f.id,
      supplierName: 'Bulk vendor',
      expenseDate: today(),
      amount: 10.25,
      description: 'Paper, Pens',
    }));
    const body = { expectedVersion: row.version, receipts: receipts.slice(0, 2) };
    await expect(expenses.addExpense(row.id, body, gs)).rejects.toMatchObject({ status: 400 });
    await expect(
      expenses.addExpense(
        row.id,
        { ...body, receipts: [receipts[0], receipts[0]] },
        gs,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      expenses.addExpense(
        row.id,
        { ...body, receipts: [receipts[0], receipts[2]] },
        gs,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db.expense.count({ where: { requestId: row.id } })).toBe(0);
    expect((await requests.get(row.id, gs)).version).toBe(row.version);
    // Failure on a later INSERT must undo the earlier receipt and its file attachment.
    const createExpense = jest.spyOn(
      expenses as unknown as { createExpense: (...args: unknown[]) => Promise<void> },
      'createExpense',
    );
    const original = createExpense.getMockImplementation()!;
    createExpense
      .mockImplementationOnce(original)
      .mockRejectedValueOnce(new Error('Simulated second insert failure'));
    await expect(expenses.addExpense(row.id, body, gs, randomUUID())).rejects.toThrow(
      'Simulated second insert failure',
    );
    createExpense.mockRestore();
    expect(await db.expense.count({ where: { requestId: row.id } })).toBe(0);
    const key = randomUUID();
    const saved = await expenses.addExpense(row.id, body, gs, key);
    expect(saved.expenses).toHaveLength(2);
    expect(saved.expenseTotal).toBe(20.5);
    await expenses.addExpense(row.id, body, gs, key);
    expect(await db.expense.count({ where: { requestId: row.id } })).toBe(2);
    await expect(expenses.addExpense(row.id, body, gs, randomUUID())).rejects.toMatchObject({
      status: 409,
    });
    const adder = { ...gs, permissions: ['expenses.addexpense'] as Actor['permissions'] };
    const removed = await expenses.removeExpense(
      row.id,
      { expectedVersion: saved.version },
      adder,
      saved.expenses![0].id,
    );
    expect(removed.expenses).toHaveLength(1);
    expect(
      (await db.expense.findUniqueOrThrow({ where: { id: saved.expenses![0].id } })).fileId,
    ).toBe(saved.expenses![0].fileId);
    await transition(row.id, 'settle', {}, gs);
    const settled = await requests.get(row.id, gs);
    await expect(
      expenses.removeExpense(
        row.id,
        { expectedVersion: settled.version },
        adder,
        saved.expenses![1].id,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      expenses.addExpense(row.id, { ...body, expectedVersion: settled.version }, gs, randomUUID()),
    ).rejects.toMatchObject({ status: 409 });
  });
  test('happy path, no debit at preparation, change returned, and immutable ledger', async () => {
    const before = (await fund.fund()).currentExpectedBalance,
      r = await create();
    await transition(r.id, 'authorize', {}, manager);
    await transition(r.id, 'notifyCollection', { amount: 850 }, finance);
    expect((await fund.fund()).currentExpectedBalance).toBe(before);
    const key = randomUUID();
    await transition(r.id, 'confirmReceipt', {}, gs, key);
    await transition(r.id, 'confirmReceipt', {}, gs, key);
    expect((await fund.fund()).currentExpectedBalance).toBe(before - 850);
    await expense(r.id, 630);
    await transition(r.id, 'settle', {}, gs);
    const closed = await transition(
      r.id,
      'finalize',
      {
        returnedAmount: 220,
        dynamicsReference: 'TEST-DYN',
      },
      finance,
      randomUUID(),
    );
    expect(closed.status).toBe('closed');
    expect(closed.returns![0].difference).toBe(0);
    expect((await fund.fund()).currentExpectedBalance).toBe(before - 630);
    const row = await db.fundTransaction.findFirstOrThrow({
      where: { requestId: r.id },
    });
    await expect(
      db.fundTransaction.update({ where: { id: row.id }, data: { amount: 1 } }),
    ).rejects.toThrow();
    await expect(db.fundTransaction.delete({ where: { id: row.id } })).rejects.toThrow();
  });
  test.each([
    { spent: 900, returnedAmount: undefined, change: -50 },
    { spent: 850, returnedAmount: undefined, change: 0 },
    { spent: 630, returnedAmount: 200, change: 200 },
  ])('finalizes spent=$spent', async ({ spent, returnedAmount, change }) => {
    const r = await issue();
    await expense(r.id, spent);
    await transition(r.id, 'settle', {}, gs);
    const before = (await fund.fund()).currentExpectedBalance;
    const result = await transition(
      r.id,
      'finalize',
      { ...(returnedAmount !== undefined ? { returnedAmount } : {}) },
      finance,
      randomUUID(),
    );
    expect((await fund.fund()).currentExpectedBalance).toBe(before + change);
    expect(result.status).toBe('closed');
    if (returnedAmount !== undefined) expect(result.returns![0].difference).toBe(-20);
  });
  test('amount changes need a reason; editing and ownership enforced', async () => {
    const r = await create(5000);
    await expect(
      transition(r.id, 'edit', { purpose: 'No' }, { ...gs, id: 'other' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(transition(r.id, 'edit', { neededBy: '2000-01-01' }, gs)).rejects.toMatchObject({
      status: 400,
    });
    await transition(r.id, 'edit', { requestedAmount: 4500, expectedVersion: r.version }, gs);
    await expect(
      transition(r.id, 'edit', { purpose: 'stale', expectedVersion: r.version }, gs),
    ).rejects.toMatchObject({ status: 409 });
    await transition(r.id, 'authorize', {}, manager);
    await expect(transition(r.id, 'edit', { purpose: 'late' }, gs)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      transition(r.id, 'notifyCollection', { amount: 4000 }, finance),
    ).rejects.toMatchObject({ status: 400 });
    await transition(r.id, 'notifyCollection', { amount: 4000, reason: 'Revised budget' }, finance);
    expect((await requests.get(r.id, gs)).approvedAmount).toBe(4000);
  });
  test('correction, removed-expense audit, zero receipts, and reminder limit', async () => {
    const r = await issue(100);
    await expense(r.id, 20);
    let updated = await requests.get(r.id, gs);
    const id = updated.expenses![0].id;
    await transition(r.id, 'removeExpense', {}, gs, undefined, id);
    expect((await db.expense.findUniqueOrThrow({ where: { id } })).removedAt).not.toBeNull();
    await transition(r.id, 'sendReminder', {}, finance);
    await expect(transition(r.id, 'sendReminder', {}, finance)).rejects.toMatchObject({
      status: 409,
    });
    await transition(r.id, 'settle', {}, gs);
    await expect(expense(r.id, 10)).rejects.toMatchObject({ status: 409 });
    await transition(r.id, 'returnForCorrection', { note: 'Please check invoices' }, finance);
    await expense(r.id, 10);
    await transition(r.id, 'settle', {}, gs);
    updated = await requests.get(r.id, gs);
    expect(updated.correctionNote).toBeNull();
  });
  test('cash custody hand-over requires acceptance, replaces the custodian, and can be withdrawn or declined', async () => {
    const r = await issue(100);
    const receipt = {
      supplierName: 'Vendor',
      description: 'Supplies',
      expenseDate: today(),
      amount: 5,
    };
    // Before any offer, only the current custodian (gs) can touch receipts/settle.
    await expect(transition(r.id, 'addExpense', receipt, gs2)).rejects.toMatchObject({
      status: 403,
    });

    // Offer, then decline: custody stays with gs.
    await transition(r.id, 'handOver', { toEmployeeId: gs2.entityId, note: 'Going on leave' }, gs);
    await expect(transition(r.id, 'acceptHandover', {}, gs)).rejects.toMatchObject({ status: 403 });
    const declined = await transition(r.id, 'declineHandover', {}, gs2);
    expect(declined.custodianName).toBe(gs.name);
    expect(declined.pendingCustodianName).toBeNull();

    // Offer again, then withdraw: custody still stays with gs.
    await transition(r.id, 'handOver', { toEmployeeId: gs2.entityId }, gs);
    await expect(transition(r.id, 'addExpense', receipt, gs2)).rejects.toMatchObject({
      status: 403,
    });
    const cancelled = await transition(r.id, 'cancelHandover', {}, gs);
    expect(cancelled.pendingCustodianName).toBeNull();

    // Offer again, accept: custody moves to gs2, who can now act, and gs can no longer.
    await transition(r.id, 'handOver', { toEmployeeId: gs2.entityId }, gs);
    const accepted = await transition(r.id, 'acceptHandover', {}, gs2);
    expect(accepted.custodianName).toBe(gs2.name);
    await expect(transition(r.id, 'addExpense', receipt, gs)).rejects.toMatchObject({
      status: 403,
    });
    await transition(r.id, 'addExpense', receipt, gs2);
    await transition(r.id, 'settle', {}, gs2);
    expect(await db.cashHandover.count({ where: { requestId: r.id } })).toBe(1);
  });
  test('permission-based approval and finalization including own requests', async () => {
    const r = await create();
    await expect(transition(r.id, 'authorize', {}, gs)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      transition(
        r.id,
        'authorize',
        {},
        {
          ...gs,
          roles: ['GS_REQUESTER', 'GS_MANAGER'],
          permissions: [...gs.permissions, ...manager.permissions],
        },
      ),
    ).resolves.toMatchObject({ status: 'pending_finance' });
    const rejected = await create();
    await expect(
      transition(
        rejected.id,
        'reject',
        { reason: 'No longer needed' },
        {
          ...gs,
          permissions: [...gs.permissions, ...manager.permissions],
        },
      ),
    ).resolves.toMatchObject({ status: 'rejected' });
    const issued = await issue(10);
    await transition(issued.id, 'settle', {}, gs);
    await expect(
      transition(issued.id, 'finalize', { returnedAmount: 10 }, gs, randomUUID()),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      transition(
        issued.id,
        'finalize',
        { returnedAmount: 10 },
        {
          ...gs,
          roles: ['GS_REQUESTER', 'FINANCE_STAFF'],
          permissions: [...gs.permissions, ...finance.permissions],
        },
        randomUUID(),
      ),
    ).resolves.toMatchObject({ status: 'closed' });
    expect(allowedActions({ status: 'pending_approval', requesterId: gs.id }, manager)).toEqual([
      'authorize',
      'reject',
    ]);
  });
  test('concurrent finalization produces one return and one ledger row', async () => {
    const r = await issue(100);
    await expense(r.id, 50);
    await transition(r.id, 'settle', {}, gs);
    const results = await Promise.allSettled([
      transition(r.id, 'finalize', { returnedAmount: 50 }, finance, randomUUID()),
      transition(r.id, 'finalize', { returnedAmount: 50 }, finance, randomUUID()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.fundTransaction.count({
        where: { requestId: r.id, type: 'cash_returned' },
      }),
    ).toBe(1);
  });
  test('top-up replay, conflicting replay and insufficient cash rollback', async () => {
    const key = randomUUID(),
      before = (await fund.fund()).currentExpectedBalance;
    await fund.topUp({ amount: 5000, reference: 'TEST' }, finance, key);
    await fund.topUp({ amount: 5000, reference: 'TEST' }, finance, key);
    expect((await fund.fund()).currentExpectedBalance).toBe(before + 5000);
    await expect(
      fund.topUp({ amount: 4000, reference: 'TEST' }, finance, key),
    ).rejects.toMatchObject({ status: 409 });
    const r = await create(5000);
    await transition(r.id, 'authorize', {}, manager);
    await transition(
      r.id,
      'notifyCollection',
      { amount: 999999, reason: 'Exceeds vault cash' },
      finance,
    );
    await expect(transition(r.id, 'confirmReceipt', {}, gs, randomUUID())).rejects.toMatchObject({
      status: 409,
    });
    expect(await db.cashIssuance.count({ where: { requestId: r.id } })).toBe(0);
    expect((await requests.get(r.id, gs)).status).toBe('ready_for_collection');
  });
  test('count adjustment, no-adjust resolution, stale and zero counts', async () => {
    const before = (await fund.fund()).currentExpectedBalance;
    const count = await counts.recordCount({ denominations: { note1000: 1 } }, finance);
    await expect(
      counts.resolve(
        count.id,
        { resolutionNotes: 'No', adjustLedger: true },
        finance,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await fund.topUp({ amount: 100, reference: 'AFTER-COUNT' }, finance, randomUUID());
    await counts.resolve(
      count.id,
      { resolutionNotes: 'Confirmed shortfall', adjustLedger: true },
      supervisor,
      randomUUID(),
    );
    expect((await fund.fund()).currentExpectedBalance).toBe(1100);
    const zero = await counts.recordCount({ denominations: { note500: 0 } }, finance);
    expect(zero.actualCashCount).toBe(0);
    await expect(counts.recordCount({ denominations: {} }, finance)).rejects.toMatchObject({
      status: 400,
    });
    const newer = await counts.recordCount({ denominations: { note1000: 1, note100: 1 } }, finance);
    expect(newer.status).toBe('balanced');
    await expect(
      counts.resolve(
        zero.id,
        { resolutionNotes: 'Stale', adjustLedger: true },
        supervisor,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await counts.resolve(
      zero.id,
      { resolutionNotes: 'Superseded by recount', adjustLedger: false },
      supervisor,
      randomUUID(),
    );
    expect((await fund.fund()).currentExpectedBalance).toBe(1100);
    expect(before).toBeGreaterThan(0);
  });
  test('attachments enforce ownership and cleanup retains removed receipt evidence', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'petty-cash-cleanup-test-'));
    process.env.FILE_STORAGE = 'local';
    process.env.FILE_STORAGE_PATH = directory;
    const files = new FilesService(db, new StorageService());
    try {
      const r = await issue(10);
      const makeFile = (ownerId: string) =>
        db.receiptFile.create({
          data: {
            ownerId,
            storageKey: randomUUID(),
            fileName: 'receipt.png',
            contentType: 'image/png',
            size: 8,
            state: 'ready',
            createdAt: new Date(Date.now() - 25 * 3600000),
          },
        });
      const attached = await makeFile(gs.id),
        orphan = await makeFile(gs.id);
      await writeFile(join(directory, attached.storageKey), 'receipt');
      await writeFile(join(directory, orphan.storageKey), 'orphan');
      const body = {
        supplierName: 'Vendor',
        description: 'Evidence',
        expenseDate: today(),
        amount: 1,
        fileId: attached.id,
      };
      await expect(
        transition(r.id, 'addExpense', body, { ...gs, id: 'another-gs', entityId: 999 }),
      ).rejects.toMatchObject({ status: 403 });
      const added = await transition(r.id, 'addExpense', body, gs);
      await transition(r.id, 'removeExpense', {}, gs, undefined, added.expenses![0].id);
      await files.cleanup();
      expect(await db.receiptFile.findUnique({ where: { id: orphan.id } })).toBeNull();
      await expect(stat(join(directory, orphan.storageKey))).rejects.toThrow();
      expect(await db.receiptFile.findUnique({ where: { id: attached.id } })).not.toBeNull();
      expect((await stat(join(directory, attached.storageKey))).size).toBeGreaterThan(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test('history search, report completeness, ledger invariant and role inbox isolation', async () => {
    const history = await requests.list({ status: 'closed', q: 'TEST-DYN', sort: 'closedAt' }, gs);
    expect(history.total).toBeGreaterThan(0);
    expect(history.data.every((r) => r.status === 'closed')).toBe(true);
    const stats = await statistics.stats();
    expect(stats.cashInVault).toBe((await fund.fund()).currentExpectedBalance);
    expect(await access.get(gs)).toMatchObject({
      roles: ['GS_REQUESTER'],
      capabilities: { createRequest: true, topUp: false, recordCount: false, resolveCount: false },
    });
    const report = await reports.report({}, finance);
    const sum = report.transactions.reduce((n, t) => n + t.amount, 0);
    expect(sum).toBeCloseTo(report.fund.currentExpectedBalance, 2);
    expect(report.transactions[0].runningBalance).toBe(report.fund.currentExpectedBalance);
    const gsInbox = await notifications.notifications({}, gs);
    expect(gsInbox.data.every((n) => n.recipientId === gs.id)).toBe(true);
    const managerInbox = await notifications.notifications({}, manager);
    expect(managerInbox.data.some((n) => n.audience === 'GS_MANAGER')).toBe(true);
  });
  test('requests.list and requests.history list every requester’s requests for holders of the permission', async () => {
    const r = await create();
    const seenByManager = await requests.list({}, manager);
    expect(seenByManager.data.some((row) => row.id === r.id)).toBe(true);
    const seenInHistory = await requests.history({ status: 'closed' }, finance);
    expect(seenInHistory.data.every((row) => row.status === 'closed')).toBe(true);
  });
  test('a non-owner holding requests.list, requests.history, approvals.list or disbursements.list can open another requester’s detail', async () => {
    const r = await create();
    await expect(requests.get(r.id, manager)).resolves.toMatchObject({ id: r.id });
    await expect(requests.get(r.id, finance)).resolves.toMatchObject({ id: r.id });
    await expect(
      requests.get(r.id, { ...gs, id: 'no-permission', permissions: [] }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
describe('MPAO boundary and exact money', () => {
  const org = 1;
  const user = {
    uuid: 'user',
    name: 'Name',
    email: 'x@example.test',
    permissions: ['petty-cash.requests.create'],
    transacting_as: org,
  } as AuthUser;
  test('rejects another entity and missing configuration', () => {
    const guard = new EntityGuard();
    const context = (transacting_as: number) =>
      ({
        switchToHttp: () => ({ getRequest: () => ({ user: { ...user, transacting_as } }) }),
      }) as ExecutionContext;
    process.env.MPAO_ENTITY_ID = '1';
    process.env.APP_NAME = 'petty-cash';
    expect(() => guard.canActivate(context(2))).toThrow();
    expect(guard.canActivate(context(1))).toBe(true);
    delete process.env.MPAO_ENTITY_ID;
    expect(() => guard.canActivate(context(1))).toThrow();
  });
  test('requires a verified Bifrost user', () => {
    expect(() => actorFrom({ ...user, uuid: '' }, [])).toThrow();
  });
  test('allows MPAO and keeps laari exact', () => {
    expect(actorFrom(user, ['requests.create']).roles).toEqual(['GS_REQUESTER']);
    expect(countTotal({ coin0_10: 3, coin0_1: 1 }).toFixed(2)).toBe('0.31');
  });
});
