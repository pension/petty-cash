import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import * as vue from 'vue';
import ts from 'typescript';
const exports = {};
runInNewContext(ts.transpileModule(readFileSync(new URL('../composables/useBulkReceipts.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, Error, require: () => vue });
const file = (name) => new File(['receipt'], `${name}.pdf`, { type: 'application/pdf' });
const extracted = { documentType: 'invoice', supplierName: 'Vendor', description: 'Paper, Pens', amount: 10.25, expenseDate: '2026-01-01' };
function setup(overrides = {}) {
  const saved = [];
  const state = exports.useBulkReceipts({ uploadReceipt: async (f) => ({ fileId: f.name }), extractReceipts: async (ids) => ({ receipts: ids.map(fileId => ({ fileId, ...extracted })) }),
    addExpenses: async (id, receipts) => saved.push({ id, receipts }), ...overrides });
  return { state, saved };
}
test('uploads at most two at a time and exposes progress before the review table', async () => {
  let active = 0, peak = 0;
  const pending = [];
  const { state, saved } = setup({ uploadReceipt: (f) => { peak = Math.max(peak, ++active); return new Promise((resolve) => pending.push(() => { active--; resolve({ fileId: f.name }); })); } });
  state.select([file('one'), file('two'), file('three')]);
  const processing = state.process();
  assert.equal(state.stage.value, 'processing');
  assert.equal(state.canConfirm.value, false);
  assert.equal(pending.length, 2);
  pending.shift()();
  await new Promise(setImmediate);
  assert.equal(state.completed.value, 0);
  assert.equal(state.rows.value[0].status, 'uploaded');
  assert.equal(pending.length, 2);
  pending.splice(0).forEach((resolve) => resolve());
  await processing;
  assert.equal(peak, 2);
  assert.equal(state.stage.value, 'review');
  assert.equal(saved.length, 0);
  state.rows.value[0].form.description = 'Edited items';
  state.remove(state.rows.value[1].id);
  assert.equal(state.total.value, 20.5);
  assert.equal(await state.confirm('request'), true);
  assert.equal(saved[0].receipts.length, 2);
  assert.equal(saved[0].receipts[0].description, 'Edited items');
});
for (const outcome of ['other', 'unknown', 'failure']) {
  test(`${outcome} extraction preserves the attachment for manual review`, async () => {
    const { state, saved } = setup({ extractReceipts: async (ids) => { if (outcome === 'failure') throw new Error('AI unavailable'); return { receipts: ids.map(fileId => ({ fileId, ...extracted, documentType: outcome })) }; } });
    state.select([file('one')]); await state.process();
    const row = state.rows.value[0];
    assert.equal(row.status, 'manual');
    assert.equal(row.fileId, 'one.pdf');
    assert.equal(row.form.description, '');
    assert.equal(state.canConfirm.value, false);
    Object.assign(row.form, { supplierName: 'Manual vendor', description: 'Supplies', amount: '20.25' });
    assert.equal(await state.confirm('request'), true);
    assert.equal(saved[0].receipts[0].amount, 20.25);
  });
}
test('failed uploads block confirmation until retry, without rerunning successful files', async () => {
  let calls = 0;
  const { state } = setup({ uploadReceipt: async () => { if (++calls === 1) throw new Error('Disconnected'); return { fileId: 'uploaded' }; } });
  state.select([file('one')]); await state.process();
  assert.equal(state.rows.value[0].status, 'upload_failed');
  assert.equal(state.canConfirm.value, false);
  await state.process();
  assert.equal(calls, 2);
  assert.equal(state.canConfirm.value, true);
  await state.process();
  assert.equal(calls, 2);
});
test('failed confirmation preserves edits and blocks simultaneous saves', async () => {
  let reject;
  const { state } = setup({ addExpenses: () => new Promise((_resolve, r) => { reject = r; }) });
  state.select([file('one')]); await state.process();
  state.rows.value[0].form.description = 'Corrected';
  const saving = state.confirm('request');
  assert.equal(await state.confirm('request'), false);
  state.remove(state.rows.value[0].id);
  assert.equal(state.rows.value.length, 1);
  reject(new Error('Conflict. Refresh and retry.'));
  assert.equal(await saving, false);
  assert.match(state.error.value, /Conflict/);
  assert.equal(state.rows.value[0].form.description, 'Corrected');
  assert.equal(state.saving.value, false);
});
test('cancel ignores a late extraction result and does not start queued uploads', async () => {
  let resolve;
  const { state } = setup({ extractReceipts: () => new Promise((r) => { resolve = r; }) });
  state.select([file('one')]); const processing = state.process();
  await new Promise(setImmediate);
  state.cancel(); resolve({ receipts: [{ fileId: 'one.pdf', ...extracted }] }); await processing;
  assert.equal(state.rows.value.length, 0);
  assert.equal(state.stage.value, 'select');
});
test('selection limits and review validation prevent unsupported submissions', async () => {
  const { state } = setup();
  state.select([new File(['x'], 'unsafe.exe'), new File([], 'empty.pdf')]);
  assert.equal(state.rows.value.length, 0);
  state.select(Array.from({ length: 21 }, (_, i) => file(String(i))));
  assert.equal(state.rows.value.length, 20);
  assert.match(state.error.value, /20/);
  await state.process();
  state.rows.value[0].form.amount = '1.001';
  assert.equal(state.canConfirm.value, false);
  state.rows.value[0].form.amount = '1.00';
  state.rows.value[0].form.expenseDate = '2026-02-30';
  assert.equal(state.canConfirm.value, false);
});

test('one extraction request covers all successful uploads and maps reordered results by file ID', async () => {
  const calls = [];
  const { state } = setup({
    uploadReceipt: async (f) => { if (f.name === 'failed.pdf') throw new Error('Upload failed'); return { fileId: f.name }; },
    extractReceipts: async (ids) => { calls.push([...ids]); return { receipts: [...ids].reverse().map(fileId => ({ ...extracted, fileId, supplierName: fileId })) }; },
  });
  state.select([file('first'), file('second'), file('failed')]); await state.process();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['first.pdf', 'second.pdf']);
  assert.equal(state.rows.value[0].form.supplierName, 'first.pdf');
  assert.equal(state.rows.value[1].form.supplierName, 'second.pdf');
  assert.equal(state.rows.value[2].status, 'upload_failed');
});
test('a failed batch falls back to manual entry without individual AI retries', async () => {
  let calls = 0;
  const { state } = setup({ extractReceipts: async () => { calls++; throw new Error('Batch unavailable'); } });
  state.select([file('first'), file('second')]); await state.process();
  assert.equal(calls, 1);
  assert.equal(state.rows.value.every(row => row.status === 'manual' && row.fileId), true);
});
