import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import * as pinia from 'pinia';
import * as vue from 'vue';
import ts from 'typescript';
const eligibilityModule = {};
runInNewContext(ts.transpileModule(readFileSync(new URL('../utils/staffEligibility.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: eligibilityModule, Set });


const code = ts.transpileModule(readFileSync(new URL('../stores/useFloatStore.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const allCapabilities = Object.fromEntries(['viewRequests', 'viewRequest', 'viewApprovals', 'viewFinance', 'viewHistory',
  'viewReconciliation', 'viewLedger', 'viewFund', 'viewStatistics', 'viewNotifications'].map(k => [k, true]));
const ok = data => ({ success: true, data });
const page = { data: [], total: 0, page: 1, pageSize: 10 };
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function setup({ capabilities = allCapabilities, handler } = {}) {
  const calls = [];
  let now = 100000;
  const exports = {};
  const user = { uuid: 'owner', name: 'Test', email: 'test@example.test', transacting_as: 1 };
  runInNewContext(code, {
    exports, require: name => name === '~/utils/staffEligibility' ? eligibilityModule : ({ pinia, vue })[name], URL, URLSearchParams, Error,
    Date: class extends Date { static now() { return now; } },
    useIdentity: () => ({ user: { value: user } }),
    useRuntimeConfig: () => ({ public: { apiBase: 'https://api.example.test' } }),
    useHttp: async (url, options) => {
      const parsed = new URL(url);
      const path = parsed.pathname;
      calls.push({ path, query: parsed.search, ...options });
      const supplied = await handler?.(path, options, parsed);
      if (supplied !== undefined) return supplied;
      if (path === '/access') return ok({ roles: [], capabilities, staffEligibility: { requester: true, approver: true } });
      if (path === '/idempotency-keys') return ok({ key: 'server-key' });
      if (path === '/fund') return ok({ currentExpectedBalance: 100 });
      if (path === '/stats') return ok({ pendingApproval: 1 });
      return ok(page);
    },
  });
  return { store: exports.useFloatStore(pinia.createPinia()), calls, advance: ms => { now += ms; }, user };
}

test('overlapping initial loads share access, notifications, stats and list requests', async () => {
  const { store, calls } = setup();
  await Promise.all([store.initialize('/approvals'), store.initialize('/approvals')]);
  assert.deepEqual(calls.map(c => c.path).sort(), ['/access', '/approvals', '/notifications', '/stats']);
  assert.equal(store.error, '');
  assert.equal(store.loading, false);
});

test('navigation loads only page data, reusing shared reads within their freshness windows', async () => {
  const { store, calls } = setup();
  await store.initialize('/finance');
  await store.initialize('/reconciliation');
  await store.initialize('/fund');
  assert.deepEqual(calls.map(c => c.path).sort(), ['/access', '/finance', '/fund', '/fund/transactions', '/notifications', '/stats', '/vault-counts']);
  assert.equal(store.error, '');
});

test('page readiness hides shared data on navigation and retains content during same-page refresh', async () => {
  const pending = defer();
  let delayFinance = false;
  const { store } = setup({ handler: path => path === '/finance' && delayFinance ? pending.promise : undefined });
  await store.initialize('/approvals');
  assert.equal(store.isPageReady('/approvals'), true);
  delayFinance = true;
  const navigation = store.initialize('/finance');
  await new Promise(r => setImmediate(r));
  assert.equal(store.loading, true);
  assert.equal(store.isPageReady('/approvals'), false);
  assert.equal(store.isPageReady('/finance'), false);
  pending.resolve(ok(page));
  await navigation;
  assert.equal(store.isPageReady('/finance'), true);
  const refresh = store.initialize('/finance');
  assert.equal(store.loading, true);
  assert.equal(store.isPageReady('/finance'), true);
  await refresh;
  store.reset();
  assert.equal(store.isPageReady('/finance'), false);
});

test('shared data expires; notifications refresh only once even with an overlapping poll', async () => {
  const { store, calls, advance } = setup();
  await store.initialize('/approvals');
  advance(31000);
  await store.initialize('/finance');
  assert.equal(calls.filter(c => c.path === '/stats').length, 2);
  assert.equal(calls.filter(c => c.path === '/notifications').length, 1);
  advance(31000);
  await Promise.all([store.initialize('/approvals'), store.fetchNotifications(1, 60000)]);
  assert.equal(calls.filter(c => c.path === '/notifications').length, 2);
});

test('unauthorized direct navigation loads no business APIs and finance has a valid landing page', async () => {
  const { store, calls } = setup({ capabilities: { viewFinance: true } });
  await store.initialize('/approvals');
  assert.equal(store.pageDenied, true);
  assert.equal(store.canViewPage('/approvals'), false);
  assert.equal(store.isPageReady('/approvals'), false);
  assert.equal(store.canViewPage('/finance'), true);
  assert.equal(store.firstAllowedPage, '/finance');
  assert.deepEqual(calls.map(c => c.path), ['/access']);
  await store.initialize('/finance');
  assert.equal(store.pageDenied, false);
  assert.deepEqual(calls.map(c => c.path), ['/access', '/finance']);
});

test('late list responses from a previous page cannot replace the active page', async () => {
  const old = defer();
  const { store } = setup({ handler: path => path === '/approvals' ? old.promise : undefined });
  const first = store.initialize('/approvals');
  await new Promise(r => setImmediate(r));
  await store.initialize('/finance');
  old.resolve(ok({ ...page, data: [{ id: 'stale' }] }));
  await first;
  assert.equal(store.requests.length, 0);
  assert.equal(store.isPageReady('/finance'), true);
  assert.equal(store.isPageReady('/approvals'), false);
  assert.equal(store.error, '');
});

test('identity changes clear cached and pending reads and prevent old data returning', async () => {
  const old = defer();
  let delayed = true;
  const { store, calls } = setup({ handler: path => path === '/approvals' && delayed ? old.promise : undefined });
  const first = store.initialize('/approvals');
  await new Promise(r => setImmediate(r));
  store.reset();
  delayed = false;
  await store.initialize('/finance');
  old.resolve(ok({ ...page, data: [{ id: 'old-identity' }] }));
  await first;
  assert.equal(store.requests.length, 0);
  assert.equal(store.error, '');
  assert.equal(calls.filter(c => c.path === '/access').length, 2);
  assert.equal(calls.filter(c => c.path === '/stats').length, 2);
});

test('successful writes invalidate shared data and refresh the current ledger', async () => {
  let balance = 100;
  const { store, calls } = setup({ handler: (path, options) => {
    if (path === '/fund') return ok({ currentExpectedBalance: balance });
    if (path === '/fund/top-ups' && options.method === 'POST') { balance += options.body.amount; return ok({}); }
  } });
  await store.initialize('/fund');
  await store.addFundTopUp({ amount: 10, reference: 'top-up' });
  assert.equal(store.fund.currentExpectedBalance, 110);
  for (const path of ['/fund', '/fund/transactions', '/stats', '/notifications'])
    assert.equal(calls.filter(c => c.path === path).length, 2);
  assert.equal(store.error, '');
});

test('history pagination uses its own view permission endpoint', async () => {
  const { store, calls } = setup({ capabilities: { viewHistory: true } });
  await store.initialize('/requests');
  await store.nextPage(2);
  assert.equal(calls.filter(c => c.path === '/requests/history').length, 2);
  assert.equal(calls.some(c => c.path === '/requests'), false);
  assert.match(calls.at(-1).query, /page=2/);
});

test('failed reads are not cached and can be retried', async () => {
  let failures = 0;
  const { store } = setup({ handler: path => path === '/stats' && failures++ === 0
    ? { success: false, status: 503, error: { message: 'Service unavailable' } } : undefined });
  await store.initialize('/approvals');
  assert.equal(store.error, 'Service unavailable');
  assert.equal(store.isPageReady('/approvals'), false);
  await store.initialize('/approvals');
  assert.equal(store.error, '');
  assert.equal(store.isPageReady('/approvals'), true);
});

test('request and approval controls require the relevant active assignment as well as API allowed actions', async () => {
  let eligibility = { requester: false, approver: false };
  const { store } = setup({ handler: path => {
    if (path === '/access') return ok({ roles: [], capabilities: { viewRequests: true, createRequest: true }, staffEligibility: eligibility });
    if (path === '/requests') return ok({ ...page, data: [{ id: 'PC-1', allowedActions: ['edit', 'authorize', 'reject', 'finalize'] }] });
  } });
  await store.initialize('/');
  assert.equal(store.currentUser.capabilities.createRequest, false);
  assert.deepEqual(Array.from(store.requests[0].allowedActions), ['finalize']);
  eligibility = { requester: true, approver: false };
  await store.refreshAccess(true);
  assert.equal(store.currentUser.capabilities.createRequest, true);
  assert.deepEqual(Array.from(store.requests[0].allowedActions), ['edit', 'finalize']);
  eligibility = { requester: false, approver: true };
  await store.refreshAccess(true);
  assert.deepEqual(Array.from(store.requests[0].allowedActions), ['authorize', 'reject', 'finalize']);
});

test('assignment alone grants neither create permission nor an action absent from server allowedActions', async () => {
  const { store } = setup({ handler: path => {
    if (path === '/access') return ok({ roles: [], capabilities: { viewRequests: true }, staffEligibility: { requester: true, approver: true } });
    if (path === '/requests') return ok({ ...page, data: [{ id: 'PC-1', allowedActions: [] }] });
  } });
  await store.initialize('/');
  assert.equal(store.currentUser.capabilities.createRequest, false);
  assert.equal(store.requests[0].allowedActions.length, 0);
});

test('an externally removed assignment is rechecked before submission and no write is sent', async () => {
  let active = true;
  const { store, calls } = setup({ handler: path => {
    if (path === '/access') return ok({ roles: [], capabilities: { viewRequests: true, createRequest: true }, staffEligibility: { requester: active, approver: active } });
    if (path === '/requests') return ok({ ...page, data: [{ id: 'PC-1', allowedActions: ['edit', 'authorize'] }] });
  } });
  await store.initialize('/');
  active = false;
  await assert.rejects(store.approveRequestByManager('PC-1'), /no longer eligible/);
  await assert.rejects(store.createRequest({ purpose: 'Test', requestedAmount: 1, estimatedClosingDate: '2026-10-21' }), /active requester/);
  assert.equal(calls.some(call => call.method === 'POST'), false);
  assert.equal(store.busy, false);
  await store.initialize('/');
  assert.equal(store.currentUser.capabilities.createRequest, false);
});

test('failed access refresh clears eligibility, and Settings has a dedicated view capability', async () => {
  let fail = false;
  const { store, calls } = setup({ capabilities: { viewSettings: true }, handler: path => {
    if (path === '/access' && fail) return { success: false, status: 503, error: { message: 'Unavailable' } };
    if (path === '/staff-assignments') return ok([]);
  } });
  await store.initialize('/settings');
  assert.equal(store.pageDenied, false);
  assert.equal(store.canViewPage('/'), false);
  assert.deepEqual(calls.map(call => call.path), ['/access', '/staff-assignments']);
  fail = true;
  await assert.rejects(store.refreshAccess(true), /Unavailable/);
  assert.equal(store.staffEligibility.requester, false);
  assert.equal(store.staffEligibility.approver, false);
});

for (const [name, fetch, rows, total, current, loading, endpoint, size] of [
  ['requests', 'nextPage', 'requests', 'listTotal', 'listPage', 'listLoading', '/requests/history', 10],
  ['ledger', 'fetchTransactions', 'transactions', 'transactionTotal', 'transactionPage', 'transactionLoading', '/fund/transactions', 5],
  ['counts', 'fetchCounts', 'reconciliations', 'countTotal', 'countPage', 'countLoading', '/vault-counts', 10],
  ['notifications', 'fetchNotifications', 'notifications', 'notificationTotal', 'notificationPage', 'notificationLoading', '/notifications', 20],
]) {
  test(`${name}: late page responses and failures cannot replace the newest page`, async () => {
    const old = defer();
    let fail = false;
    const { store } = setup({ handler: (path, _options, url) => {
      if (path !== endpoint) return;
      if (url.searchParams.get('page') === '2') return old.promise;
      if (fail) return { success: false, status: 503, error: { message: 'Try again' } };
      return ok({ data: [{ id: 'current', allowedActions: [] }], page: 3, pageSize: size, total: size * 3 });
    } });
    if (name === 'requests') await store.initialize('/requests');
    const first = store[fetch](2);
    const latest = store[fetch](3);
    assert.equal(store[loading], true);
    await latest;
    old.resolve({ success: false, status: 503, error: { message: 'Stale error' } });
    await first;
    assert.equal(store[current], 3);
    assert.equal(store[rows][0].id, 'current');
    assert.equal(store[loading], false);
    fail = true;
    await assert.rejects(store[fetch](1), /Try again/);
    assert.equal(store[current], 3);
    assert.equal(store[total], size * 3);
    assert.equal(store[rows][0].id, 'current');
    assert.equal(store[loading], false);
  });

  test(`${name}: an emptied final page falls back to the last available page`, async () => {
    const { store, calls } = setup({ handler: (path, _options, url) => {
      if (path !== endpoint) return;
      const requested = Number(url.searchParams.get('page') || 1);
      return ok({ data: requested === 3 ? [] : [{ id: 'remaining', allowedActions: [] }], page: requested, pageSize: size, total: size + 1 });
    } });
    if (name === 'requests') await store.initialize('/requests');
    await store[fetch](3);
    assert.equal(store[current], 2);
    assert.equal(store[rows][0].id, 'remaining');
    assert.equal(new URLSearchParams(calls.at(-1).query).get('page'), '2');
    store.reset();
    assert.equal(store[current], 1);
    assert.equal(store[total], 0);
  });
}

test('History search stays on its permission endpoint and preserves query/sort across pages and refresh', async () => {
  const { store, calls } = setup({ capabilities: { viewHistory: true }, handler: (path, _options, url) => {
    if (path === '/requests/history') return ok({ ...page, page: Number(url.searchParams.get('page') || 1), total: 35 });
  } });
  await store.initialize('/requests');
  await store.fetchRequests({ q: 'Paper & pens', page: 1, sort: 'closedAt', order: 'desc' }, '/requests/history');
  await store.nextPage(2);
  await store.initialize('/requests');
  for (const call of calls.slice(-2)) {
    const query = new URLSearchParams(call.query);
    assert.equal(call.path, '/requests/history');
    assert.equal(query.get('q'), 'Paper & pens');
    assert.equal(query.get('sort'), 'closedAt');
    assert.equal(query.get('page'), '2');
  }
  await store.fetchRequests({ q: '', page: 1 }, '/requests/history');
  assert.equal(new URLSearchParams(calls.at(-1).query).has('q'), false);
  assert.equal(store.listPage, 1);
});

test('Finance filters reset to page one, paginate within the tab, and survive refresh', async () => {
  const { store, calls } = setup({ capabilities: { viewFinance: true }, handler: (path, _options, url) => {
    if (path === '/finance') return ok({ ...page, total: 32, page: Number(url.searchParams.get('page') || 1) });
  } });
  await store.initialize('/finance');
  await store.nextPage(3);
  await store.fetchRequests({ status: 'cash_issued,returned_for_correction', page: 1 }, '/finance');
  assert.equal(store.listPage, 1);
  await store.nextPage(2);
  await store.initialize('/finance');
  const query = new URLSearchParams(calls.at(-1).query);
  assert.equal(query.get('status'), 'cash_issued,returned_for_correction');
  assert.equal(query.get('page'), '2');
});

test('retrying a failed route change does not inherit the previous page filters', async () => {
  let fail = true;
  const { store, calls } = setup({ handler: path => path === '/finance' && fail ? { success: false, status: 503, error: { message: 'Unavailable' } } : undefined });
  await store.initialize('/requests');
  await store.fetchRequests({ status: 'closed', q: 'History only' }, '/requests/history');
  await store.initialize('/finance');
  fail = false;
  await store.initialize('/finance');
  assert.equal(store.error, '');
  const query = new URLSearchParams(calls.at(-1).query);
  assert.equal(query.get('status'), 'pending_finance,ready_for_collection');
  assert.equal(query.has('q'), false);
});

test('notification polling and marking read keep the selected notification page', async () => {
  const { store, calls } = setup({ handler: (path, _options, url) => path === '/notifications'
    ? ok({ ...page, total: 60, pageSize: 20, page: Number(url.searchParams.get('page')) }) : undefined });
  await store.initialize('/notifications');
  await store.fetchNotifications(2);
  await store.fetchNotifications(undefined, 60000);
  await store.markRead('notice');
  assert.equal(store.notificationPage, 2);
  assert.equal(new URLSearchParams(calls.at(-1).query).get('page'), '2');
});

test('a ledger write refreshes the selected page and resets pagination only on navigation', async () => {
  const { store } = setup({ handler: (path, _options, url) => path === '/fund/transactions'
    ? ok({ ...page, total: 20, pageSize: 5, page: Number(url.searchParams.get('page')) }) : undefined });
  await store.initialize('/fund');
  await store.fetchTransactions(3);
  await store.addFundTopUp({ amount: 10, reference: 'test' });
  assert.equal(store.transactionPage, 3);
  await store.initialize('/approvals');
  await store.initialize('/fund');
  assert.equal(store.transactionPage, 1);
});

test('retrying request details still reloads them when preserving same-page list state', async () => {
  let fail = true;
  const { store, calls } = setup({ handler: path => path === '/requests/PC-1'
    ? fail ? { success: false, status: 503, error: { message: 'Try again' } } : ok({ id: 'PC-1', allowedActions: [] }) : undefined });
  await store.initialize('/requests/PC-1');
  assert.equal(store.error, 'Try again');
  fail = false;
  await store.initialize('/requests/PC-1');
  assert.equal(store.getRequestById('PC-1').id, 'PC-1');
  assert.equal(calls.filter(call => call.path === '/requests/PC-1').length, 2);
});
