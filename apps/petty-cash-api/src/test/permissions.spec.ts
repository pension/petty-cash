jest.mock('@pension/midgard/dist/env', () => ({ APP_ENV: 'production', APP_NAME: 'petty-cash' }));
import { IdentityService, type AuthUser } from '@pension/midgard';
import { Test } from '@nestjs/testing';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { FundBootstrapService } from '../fund/fund-bootstrap.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActorPipe } from '../auth/actor.pipe';
import { PERMISSIONS, ROLE_PERMISSION_GROUPS } from '../auth/permissions';
import { allowedActions, capabilities } from '../common/request-policy';

const identity = {
  hasPermission: (user: AuthUser, permission: string) =>
    IdentityService.prototype.hasPermission(user, permission),
} as IdentityService;
function fakeDb(activeRequester: boolean) {
  return {
    staffAssignment: { findFirst: () => (activeRequester ? { type: 'requester' } : null) },
  } as unknown as PrismaService;
}
const pipe = new ActorPipe(identity, fakeDb(true));
const inactivePipe = new ActorPipe(identity, fakeDb(false));
const user = (permissions: string[], entityId = 7) =>
  ({
    uuid: 'owner',
    entity_id: entityId,
    name: 'Test',
    email: 'test@example.test',
    permissions,
  }) as AuthUser;
beforeEach(() => {
  process.env.APP_NAME = 'petty-cash';
});

test('capabilities and request actions follow individual permissions', async () => {
  const actor = await pipe.transform(user(['petty-cash.approvals.authorize']));
  expect(allowedActions({ status: 'pending_approval', requesterId: 'other' }, actor)).toEqual([
    'authorize',
  ]);
  expect(capabilities(actor).createRequest).toBe(false);
  expect(allowedActions({ status: 'pending_approval', requesterId: 'owner' }, actor)).toEqual([
    'authorize',
  ]);
});
test('resolve permission does not implicitly grant top-up or other finance actions', async () => {
  expect(
    capabilities(await pipe.transform(user(['petty-cash.vaultcounts.resolve']))),
  ).toMatchObject({
    createRequest: false,
    topUp: false,
    recordCount: false,
    resolveCount: true,
  });
});
test('development produces all capabilities while preserving request state restrictions', async () => {
  const env = jest.requireMock<{ APP_ENV: string }>('@pension/midgard/dist/env');
  env.APP_ENV = 'development';
  try {
    const actor = await pipe.transform(user([]));
    expect(actor.permissions).toEqual([...PERMISSIONS]);
    expect(Object.values(capabilities(actor)).every(Boolean)).toBe(true);
    expect(allowedActions({ status: 'pending_approval', requesterId: 'owner' }, actor)).toEqual([
      'edit',
      'authorize',
      'reject',
    ]);
    expect(allowedActions({ status: 'ready_for_collection', requesterId: 'other' }, actor)).toEqual(
      ['confirmReceipt'],
    );
    expect(allowedActions({ status: 'pending_closure', requesterId: 'owner' }, actor)).toContain(
      'finalize',
    );
  } finally {
    env.APP_ENV = 'production';
  }
});
test('confirming collection requires an active requester assignment, not ownership', async () => {
  const ready = { status: 'ready_for_collection', requesterId: 'other' };
  expect(
    allowedActions(ready, await pipe.transform(user(['petty-cash.disbursements.confirmreceipt']))),
  ).toEqual(['confirmReceipt']);
  expect(
    allowedActions(
      ready,
      await inactivePipe.transform(user(['petty-cash.disbursements.confirmreceipt'])),
    ),
  ).toEqual([]);
});
test('production does not accept the former custom role permission', async () => {
  expect(
    (await pipe.transform(user(['petty-cash-api.pettyCash.gsRequester']))).permissions,
  ).toEqual([]);
});

test('bootstrap and maintenance compile without the HTTP identity service', async () => {
  const module = await Test.createTestingModule({ imports: [MaintenanceModule] })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();
  try {
    expect(module.get(FundBootstrapService)).toBeInstanceOf(FundBootstrapService);
  } finally {
    await module.close();
  }
});

test.each(['owner', 'other'])(
  'approval and rejection require their own permission for requester %s',
  async (requesterId) => {
    const pending = { status: 'pending_approval', requesterId };
    expect(allowedActions(pending, await pipe.transform(user([])))).toEqual([]);
    expect(
      allowedActions(pending, await pipe.transform(user(['petty-cash.approvals.reject']))),
    ).toEqual(['reject']);
    expect(
      allowedActions(
        { ...pending, status: 'pending_finance' },
        await pipe.transform(
          user(['petty-cash.approvals.authorize', 'petty-cash.approvals.reject']),
        ),
      ),
    ).toEqual([]);
  },
);

test.each(['owner', 'other'])(
  'finalization depends on permission and pending closure for requester %s',
  async (requesterId) => {
    const pending = { status: 'pending_closure', requesterId };
    expect(allowedActions(pending, await pipe.transform(user([])))).not.toContain('finalize');
    const finance = await pipe.transform(user(['petty-cash.settlements.finalize']));
    expect(allowedActions(pending, finance)).toEqual(['finalize']);
    for (const status of ['pending_approval', 'cash_issued', 'closed']) {
      expect(allowedActions({ ...pending, status }, finance)).not.toContain('finalize');
    }
  },
);

test('adding receipts also permits removing them only while editable and the current custodian', async () => {
  const actor = await pipe.transform(user(['petty-cash.expenses.addexpense'], 7));
  for (const status of ['cash_issued', 'returned_for_correction']) {
    expect(allowedActions({ status, requesterId: 'owner', custodianEmployeeId: 7 }, actor)).toEqual(
      ['addExpense', 'removeExpense'],
    );
    expect(
      allowedActions({ status, requesterId: 'owner', custodianEmployeeId: 99 }, actor),
    ).toEqual([]);
  }
  for (const status of ['pending_approval', 'pending_closure', 'closed']) {
    expect(allowedActions({ status, requesterId: 'owner', custodianEmployeeId: 7 }, actor)).toEqual(
      [],
    );
  }
});

test('custody hand-over moves from offer to accepted custodian only once accepted', async () => {
  const handoverPermissions = [
    'petty-cash.disbursements.handover',
    'petty-cash.disbursements.accepthandover',
    'petty-cash.disbursements.cancelhandover',
    'petty-cash.disbursements.declinehandover',
  ];
  const custodian = await pipe.transform(user(handoverPermissions, 7));
  const nominee = await pipe.transform(user(handoverPermissions, 8));
  const offered = {
    status: 'cash_issued',
    requesterId: 'owner',
    custodianEmployeeId: 7,
    pendingCustodianEmployeeId: 8,
  };
  const idle = { status: 'cash_issued', requesterId: 'owner', custodianEmployeeId: 7 };
  expect(allowedActions(idle, custodian)).toContain('handOver');
  expect(allowedActions(offered, custodian)).not.toContain('handOver');
  expect(allowedActions(offered, custodian)).toContain('cancelHandover');
  expect(allowedActions(offered, nominee)).toEqual(['acceptHandover', 'declineHandover']);
  expect(allowedActions({ ...offered, status: 'pending_closure' }, custodian)).not.toContain(
    'cancelHandover',
  );
  expect(allowedActions({ ...offered, status: 'pending_closure' }, nominee)).not.toContain(
    'acceptHandover',
  );
});

test('request and finance role templates have separate pages and actions', async () => {
  const request = await pipe.transform(
    user(ROLE_PERMISSION_GROUPS.request.map((p) => `petty-cash.${p}`)),
  );
  const finance = await pipe.transform(
    user(ROLE_PERMISSION_GROUPS.finance.map((p) => `petty-cash.${p}`)),
  );
  expect(capabilities(request)).toMatchObject({
    viewRequests: true,
    viewApprovals: true,
    viewHistory: true,
    viewFinance: false,
    viewReconciliation: false,
    viewLedger: false,
    viewSettings: false,
    lookupStaff: false,
    addStaff: false,
    removeStaff: false,
    createRequest: true,
  });
  expect(capabilities(finance)).toMatchObject({
    viewRequests: false,
    viewApprovals: false,
    viewHistory: true,
    viewFinance: true,
    viewReconciliation: true,
    viewLedger: true,
    viewSettings: true,
    lookupStaff: true,
    addStaff: true,
    removeStaff: true,
    createRequest: false,
    topUp: true,
    recordCount: true,
    resolveCount: true,
  });
  expect(allowedActions({ status: 'pending_approval', requesterId: 'owner' }, finance)).toEqual([]);
  expect(allowedActions({ status: 'pending_closure', requesterId: 'owner' }, request)).toEqual([]);
});
test('action permissions alone do not reveal page navigation', async () => {
  const actor = await pipe.transform(
    user(['petty-cash.approvals.authorize', 'petty-cash.settlements.finalize']),
  );
  expect(capabilities(actor)).toMatchObject({ viewApprovals: false, viewFinance: false });
});
