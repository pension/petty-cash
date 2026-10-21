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


const source = readFileSync(new URL('../stores/useFloatStore.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup(handler) {
  const calls = [];
  const exports = {};
  // No browser crypto API: matches the local HTTP site's execution environment.
  runInNewContext(code, {
    exports,
    require: (name) => {
      if (name === 'pinia') return pinia;
      if (name === 'vue') return vue;
      if (name === '~/utils/staffEligibility') return eligibilityModule;
      throw new Error(`Unexpected dependency: ${name}`);
    },
    URL,
    URLSearchParams,
    Error,
    useIdentity: () => ({ user: { value: { uuid: 'owner', name: 'Test', email: 'test@example.test' } } }),
    useRuntimeConfig: () => ({ public: { apiBase: 'http://petty-api.pension.test' } }),
    useHttp: async (url, options) => {
      const path = new URL(url).pathname;
      calls.push({ path, ...options });
      if (path === '/access') return ok({ roles: [], capabilities: { createRequest: true, uploadReceipts: true, extractReceipts: true }, staffEligibility: { requester: true, approver: true } });
      return handler(path, options);
    },
  });
  return { store: exports.useFloatStore(pinia.createPinia()), calls };
}
const ok = (data = {}) => ({ success: true, data });
const failure = (status) => ({ success: false, status, error: { message: 'Temporary failure' } });

test('ordinary saves work without browser UUID generation or key requests', async () => {
  const { store, calls } = setup(() => ok());
  await store.createRequest({
    purpose: 'Office supplies',
    requestedAmount: 100,
    estimatedClosingDate: '2026-10-21',
  });
  assert.equal(calls.some((c) => c.path === '/idempotency-keys'), false);
  assert.equal(calls[0].headers['Idempotency-Key'], undefined);
  assert.equal(store.busy, false);
});

test('financial retries reuse the server key; a subsequent top-up gets a fresh key', async () => {
  let issues = 0;
  let submissions = 0;
  const { store, calls } = setup((path) => {
    if (path === '/idempotency-keys') return ok({ key: `server-key-${++issues}` });
    if (path === '/fund/top-ups' && ++submissions === 1) return failure(503);
    return ok();
  });
  const body = { amount: 100, reference: 'TOP-UP' };
  await assert.rejects(store.addFundTopUp(body), /Temporary failure/);
  assert.equal(store.busy, false);
  await store.addFundTopUp(body);
  await store.addFundTopUp({ amount: 200, reference: 'NEXT' });
  assert.deepEqual(
    calls.filter((c) => c.path === '/fund/top-ups').map((c) => c.headers['Idempotency-Key']),
    ['server-key-1', 'server-key-1', 'server-key-2'],
  );
  assert.equal(issues, 2);
});

test('failed key acquisition releases busy and never submits a cash movement', async () => {
  let issues = 0;
  const { store, calls } = setup((path) => {
    if (path === '/idempotency-keys') {
      return ++issues === 1 ? failure(503) : ok({ key: 'server-key' });
    }
    return ok();
  });
  await assert.rejects(store.addFundTopUp({ amount: 100, reference: 'TOP-UP' }));
  assert.equal(store.busy, false);
  assert.equal(calls.some((c) => c.path === '/fund/top-ups'), false);
  await store.addFundTopUp({ amount: 100, reference: 'TOP-UP' });
  assert.equal(store.busy, false);
});

test('an identity reset during key acquisition prevents submission', async () => {
  let release;
  const { store, calls } = setup(() => new Promise((resolve) => { release = resolve; }));
  const pending = store.addFundTopUp({ amount: 100, reference: 'TOP-UP' });
  store.reset();
  release(ok({ key: 'old-context-key' }));
  await assert.rejects(pending, /context changed/);
  assert.equal(calls.some((c) => c.path === '/fund/top-ups'), false);
  assert.equal(store.busy, false);
});

test('bulk confirmation sends one batch and reuses the server key after a transient failure', async () => {
  let submissions = 0;
  const detail = { id: 'PC-1', version: 4, allowedActions: ['addExpense'] };
  const { store, calls } = setup((path) => {
    if (path === '/idempotency-keys') return ok({ key: 'server-batch-key' });
    if (path === '/requests/PC-1') return ok(detail);
    if (path === '/requests/PC-1/expenses') return ++submissions === 1 ? failure(503) : ok({ ...detail, version: 5 });
    return ok();
  });
  await store.fetchRequest('PC-1');
  const receipts = [{ fileId: 'file-1', supplierName: 'Vendor', expenseDate: '2026-01-01', amount: 10.25, description: 'Paper, Pens' }];
  await assert.rejects(store.addExpenses('PC-1', receipts));
  await store.addExpenses('PC-1', receipts);
  const batches = calls.filter(c => c.path === '/requests/PC-1/expenses');
  assert.equal(batches.length, 2);
  assert.equal(calls.filter(c => c.path === '/idempotency-keys').length, 1);
  for (const call of batches) {
    assert.equal(call.headers['Idempotency-Key'], 'server-batch-key');
    assert.equal(call.method, 'POST');
    assert.equal(call.body.expectedVersion, 4);
    assert.equal(call.body.receipts[0].fileId, 'file-1');
  }
});

test('bulk extraction sends all file IDs in one request using the existing OCR endpoint', async () => {
  const { store, calls } = setup(() => ok({ receipts: [] }));
  await store.extractReceipts(['file-one', 'file-two']);
  const extraction = calls.filter(call => call.path === '/ocr/receipts');
  assert.equal(extraction.length, 1);
  assert.equal(extraction[0].method, 'POST');
  assert.deepEqual(extraction[0].body.fileIds, ['file-one', 'file-two']);
});
