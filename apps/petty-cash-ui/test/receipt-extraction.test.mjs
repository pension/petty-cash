import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import * as vue from 'vue';
import { parse, compileScript } from '@vue/compiler-sfc';
import ts from 'typescript';
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helper = {};
runInNewContext(transpile(readFileSync(new URL('../utils/receiptExtraction.ts', import.meta.url), 'utf8')), { exports: helper });
const { descriptor } = parse(readFileSync(new URL('../components/float/ReceiptScanModal.vue', import.meta.url), 'utf8'));
const compiled = transpile(compileScript(descriptor, { id: 'receipt-test' }).content);
const result = { documentType: 'invoice', supplierName: 'AI Shop', amount: 50.5, expenseDate: '2026-01-01', invoiceNumber: 'INV-1', description: 'Paper, Pens' };
function setup(extractReceipt) {
  const saved = [];
  const store = { busy: false, extractReceipt, uploadReceipt: async () => ({ fileId: 'saved-file' }), addExpense: async (_id, value) => saved.push(value) };
  const exports = {};
  runInNewContext(compiled, {
    exports, URL,
    require: (name) => {
      if (name === 'vue') return vue;
      if (name === '~/utils/receiptExtraction') return helper;
      if (name === '~/stores/useFloatStore') return { useFloatStore: () => store };
      if (name === '@pension/ui-kit') return { useToastify: () => ({ showToast() {} }) };
      if (name.startsWith('@heroicons/')) return {};
      throw new Error(name);
    },
  });
  const scope = vue.effectScope();
  const state = scope.run(() => exports.default.setup(vue.reactive({ show: true, requestId: 'request' }), { expose() {}, emit() {} }));
  const upload = () => state.onFileChosen({ target: { files: [new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' })], value: '' } });
  return { state, saved, upload, dispose: () => scope.stop() };
}
test('AI fills multiple items and editable fields after a persistent upload', async () => {
  const t = setup(async () => result);
  try {
    await t.upload();
    await new Promise(setImmediate);
    await vue.nextTick();
    assert.equal(t.state.fileId.value, 'saved-file');
    assert.equal(t.state.form.description, 'Paper, Pens');
    assert.equal(t.state.form.amount, '50.5');
    t.state.form.description = 'Corrected items';
    await t.state.handleSave();
    assert.equal(t.saved[0].description, 'Corrected items');
    assert.equal(t.saved[0].fileId, 'saved-file');
  } finally { t.dispose(); }
});
test('AI failure preserves the uploaded attachment and permits manual saving', async () => {
  const t = setup(async () => { throw new Error('Unavailable'); });
  try {
    await t.upload();
    await new Promise(setImmediate);
    await vue.nextTick();
    assert.equal(t.state.aiState.value, 'failed');
    assert.equal(t.state.step.value, 'edit');
    Object.assign(t.state.form, { supplierName: 'Manual vendor', description: 'Manual items', amount: '10' });
    await t.state.handleSave();
    assert.equal(t.saved[0].fileId, 'saved-file');
    assert.equal(t.saved[0].amount, 10);
  } finally { t.dispose(); }
});
test('manual edits made while AI runs are never overwritten', async () => {
  let resolve;
  const t = setup(() => new Promise((r) => { resolve = r; }));
  try {
    await t.upload();
    t.state.form.supplierName = 'My vendor';
    t.state.form.description = 'My items';
    resolve(result);
    await new Promise(setImmediate);
    await vue.nextTick();
    assert.equal(t.state.form.supplierName, 'My vendor');
    assert.equal(t.state.form.description, 'My items');
    assert.equal(t.state.form.invoiceNumber, 'INV-1');
  } finally { t.dispose(); }
});
test('extraction shows progress and prevents saving until the editable form opens', async () => {
  let resolve;
  const t = setup(() => new Promise((r) => { resolve = r; }));
  try {
    await t.upload();
    assert.equal(t.state.step.value, 'extracting');
    assert.equal(t.state.aiState.value, 'loading');
    Object.assign(t.state.form, { supplierName: 'Manual', description: 'Supplies', amount: '10' });
    await t.state.handleSave();
    assert.equal(t.saved.length, 0);
    resolve(result);
    await new Promise(setImmediate);
    assert.equal(t.state.step.value, 'edit');
    await t.state.handleSave();
    assert.equal(t.saved.length, 1);
  } finally { t.dispose(); }
});
test('a closed or replaced receipt ignores stale AI results', async () => {
  let resolve;
  const t = setup(() => new Promise((r) => { resolve = r; }));
  try {
    await t.upload();
    t.state.reset();
    resolve(result);
    await new Promise(setImmediate);
    await vue.nextTick();
    assert.equal(t.state.fileId.value, '');
    assert.equal(t.state.form.supplierName, '');
  } finally { t.dispose(); }
});

for (const documentType of ['other', 'unknown']) {
  test(`${documentType} document shows a message and allows manual entry with its attachment`, async () => {
    const t = setup(async () => ({ ...result, documentType }));
    try {
      await t.upload();
      await new Promise(setImmediate);
      assert.equal(t.state.step.value, 'edit');
      assert.equal(t.state.aiState.value, 'failed');
      assert.match(t.state.aiMessage.value, /bill, receipt or invoice/);
      assert.equal(t.state.form.description, '');
      assert.equal(t.state.form.supplierName, '');
      Object.assign(t.state.form, { supplierName: 'Manual vendor', description: 'Manual items', amount: '20' });
      await t.state.handleSave();
      assert.equal(t.saved[0].fileId, 'saved-file');
    } finally { t.dispose(); }
  });
}
test('replacing a receipt clears old AI suggestions before classifying the new document', async () => {
  let calls = 0;
  const t = setup(async () => ++calls === 1 ? result : { ...result, documentType: 'other' });
  try {
    await t.upload();
    await new Promise(setImmediate);
    assert.equal(t.state.form.description, 'Paper, Pens');
    t.state.back();
    await t.upload();
    await new Promise(setImmediate);
    assert.equal(t.state.form.description, '');
    assert.equal(t.state.step.value, 'edit');
  } finally { t.dispose(); }
});
