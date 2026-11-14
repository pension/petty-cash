import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { PDFDocument, PDFName, degrees } from 'pdf-lib';

const require = createRequire(import.meta.url);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTWQAAAAASUVORK5CYII=', 'base64');
const source = ts.transpileModule(readFileSync(new URL('../utils/receiptPdf.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function setup() {
  const exports = {};
  const revoked = [];
  runInNewContext(source, {
    exports, Blob, ArrayBuffer, Uint8Array,
    require: (name) => name === 'heic2any'
      ? { default: async () => [new Blob([png]), new Blob([png])] }
      : require(name),
    URL: { createObjectURL: () => 'blob:receipt', revokeObjectURL: (url) => revoked.push(url) },
    Image: class { naturalWidth = 400; naturalHeight = 1200; async decode() {} },
    document: { createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob: (done) => done(new Blob([png])) }) },
  });
  return { append: exports.appendReceiptPdfs, revoked };
}
async function pdfBlob(sizes) {
  const pdf = await PDFDocument.create();
  sizes.forEach((size) => pdf.addPage(size));
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}
const attachment = (fileId, receiptContentType) => ({ fileId, receiptContentType, receiptFileName: `${fileId}.receipt` });

test('no attachments keeps the original voucher and does not fetch files', async () => {
  const { append } = setup();
  const voucher = await pdfBlob([[595, 842]]);
  assert.equal(await append(voucher, [{}], () => assert.fail('Unexpected file fetch')), voucher);
});

test('all PDF pages follow the voucher in receipt order, retaining page size and rotation', async () => {
  const { append } = setup();
  const receipt = await PDFDocument.create();
  receipt.addPage([300, 500]).setRotation(degrees(90));
  receipt.addPage([600, 400]);
  const files = { first: new Blob([await receipt.save()]), last: await pdfBlob([[200, 700]]) };
  const calls = [];
  const result = await append(await pdfBlob([[595, 842]]), [attachment('first', 'application/pdf'), {}, attachment('last', 'application/pdf')], async (id) => {
    calls.push(id);
    return files[id];
  });
  const pdf = await PDFDocument.load(await result.arrayBuffer());
  assert.deepEqual(calls, ['first', 'last']);
  assert.deepEqual(pdf.getPages().map((page) => [page.getWidth(), page.getHeight()]), [[595, 842], [300, 500], [600, 400], [200, 700]]);
  assert.equal(pdf.getPage(1).getRotation().angle, 90);
});

test('mixed image formats, every HEIC frame and PDFs produce visible pages in one PDF', async () => {
  const { append, revoked } = setup();
  const types = ['image/jpeg', 'image/png', 'application/pdf', 'image/webp', 'image/heic'];
  const result = await append(await pdfBlob([[595, 842]]), types.map((type, i) => attachment(String(i), type)), async (id) =>
    types[Number(id)] === 'application/pdf' ? pdfBlob([[300, 500], [300, 500]]) : new Blob([png]));
  const pdf = await PDFDocument.load(await result.arrayBuffer());
  assert.equal(pdf.getPageCount(), 8);
  for (const index of [1, 2, 5, 6, 7]) {
    const images = pdf.getPage(index).node.Resources().lookup(PDFName.of('XObject'));
    assert.ok(images.keys().length, `Page ${index + 1} must contain an image`);
  }
  assert.equal(revoked.length, 5);
});

test('filled PDF forms are preserved as visible page content', async () => {
  const { append } = setup();
  const receipt = await PDFDocument.create();
  const field = receipt.getForm().createTextField('invoice');
  field.setText('INV-2026');
  field.addToPage(receipt.addPage(), { x: 20, y: 20, width: 150, height: 30 });
  const result = await append(await pdfBlob([[595, 842]]), [attachment('form', 'application/pdf')], async () => new Blob([await receipt.save()]));
  const pdf = await PDFDocument.load(await result.arrayBuffer());
  assert.equal(pdf.getPageCount(), 2);
  assert.equal(pdf.getPage(1).node.Annots()?.size() ?? 0, 0);
  assert.ok(pdf.getPage(1).node.Resources().lookup(PDFName.of('XObject')).keys().length);
});

for (const mode of ['fetch failure', 'corrupt PDF', 'unsupported format']) {
  test(`${mode} rejects the complete export with the receipt name`, async () => {
    const { append } = setup();
    await assert.rejects(append(await pdfBlob([[595, 842]]), [attachment('broken', mode === 'unsupported format' ? 'text/plain' : 'application/pdf')], async () => {
      if (mode === 'fetch failure') throw new Error('Access denied');
      return new Blob(['invalid']);
    }), /Could not include receipt "broken.receipt" in the Petty Cash PDF/);
  });
}
