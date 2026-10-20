jest.mock('@pension/midgard/dist/env', () => ({ APP_ENV: 'production', APP_NAME: 'petty-cash' }));
import { IdentityService, type AuthUser } from '@pension/midgard';
import { Test } from '@nestjs/testing';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { FundBootstrapService } from '../fund/fund-bootstrap.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActorPipe } from '../auth/actor.pipe';
import { PERMISSIONS } from '../auth/permissions';
import { allowedActions, capabilities } from '../common/request-policy';

const identity = {
  hasPermission: (user: AuthUser, permission: string) =>
    IdentityService.prototype.hasPermission(user, permission),
} as IdentityService;
const pipe = new ActorPipe(identity);
const user = (permissions: string[]) =>
  ({ uuid: 'owner', name: 'Test', email: 'test@example.test', permissions }) as AuthUser;
beforeEach(() => {
  process.env.APP_NAME = 'petty-cash';
});

test('capabilities and request actions follow individual permissions', () => {
  const actor = pipe.transform(user(['petty-cash.approvals.authorize']));
  expect(allowedActions({ status: 'pending_approval', requesterId: 'other' }, actor)).toEqual([
    'authorize',
  ]);
  expect(capabilities(actor).createRequest).toBe(false);
  expect(allowedActions({ status: 'pending_approval', requesterId: 'owner' }, actor)).toEqual([
    'authorize',
  ]);
});
test('resolve permission does not implicitly grant top-up or other finance actions', () => {
  expect(capabilities(pipe.transform(user(['petty-cash.vaultcounts.resolve'])))).toEqual({
    createRequest: false,
    topUp: false,
    recordCount: false,
    resolveCount: true,
  });
});
test('development produces all capabilities while preserving request ownership restrictions', () => {
  const env = jest.requireMock<{ APP_ENV: string }>('@pension/midgard/dist/env');
  env.APP_ENV = 'development';
  try {
    const actor = pipe.transform(user([]));
    expect(actor.permissions).toEqual([...PERMISSIONS]);
    expect(Object.values(capabilities(actor)).every(Boolean)).toBe(true);
    expect(allowedActions({ status: 'pending_approval', requesterId: 'owner' }, actor)).toEqual([
      'edit',
      'authorize',
      'reject',
    ]);
    expect(allowedActions({ status: 'ready_for_collection', requesterId: 'other' }, actor)).toEqual(
      [],
    );
    expect(allowedActions({ status: 'pending_closure', requesterId: 'owner' }, actor)).toContain(
      'finalize',
    );
  } finally {
    env.APP_ENV = 'production';
  }
});
test('production does not accept the former custom role permission', () => {
  expect(pipe.transform(user(['petty-cash-api.pettyCash.gsRequester'])).permissions).toEqual([]);
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
  (requesterId) => {
    const pending = { status: 'pending_approval', requesterId };
    expect(allowedActions(pending, pipe.transform(user([])))).toEqual([]);
    expect(allowedActions(pending, pipe.transform(user(['petty-cash.approvals.reject'])))).toEqual([
      'reject',
    ]);
    expect(
      allowedActions(
        { ...pending, status: 'pending_finance' },
        pipe.transform(user(['petty-cash.approvals.authorize', 'petty-cash.approvals.reject'])),
      ),
    ).toEqual([]);
  },
);

test.each(['owner', 'other'])(
  'finalization depends on permission and pending closure for requester %s',
  (requesterId) => {
    const pending = { status: 'pending_closure', requesterId };
    expect(allowedActions(pending, pipe.transform(user([])))).not.toContain('finalize');
    const finance = pipe.transform(user(['petty-cash.settlements.finalize']));
    expect(allowedActions(pending, finance)).toEqual(['finalize']);
    for (const status of ['pending_approval', 'cash_issued', 'closed']) {
      expect(allowedActions({ ...pending, status }, finance)).not.toContain('finalize');
    }
  },
);

test('adding receipts also permits removing them only while editable and owned', () => {
  const actor = pipe.transform(user(['petty-cash.expenses.addexpense']));
  for (const status of ['cash_issued', 'returned_for_correction']) {
    expect(allowedActions({ status, requesterId: 'owner' }, actor)).toEqual([
      'addExpense',
      'removeExpense',
    ]);
    expect(allowedActions({ status, requesterId: 'other' }, actor)).toEqual([]);
  }
  for (const status of ['pending_approval', 'pending_closure', 'closed']) {
    expect(allowedActions({ status, requesterId: 'owner' }, actor)).toEqual([]);
  }
});
