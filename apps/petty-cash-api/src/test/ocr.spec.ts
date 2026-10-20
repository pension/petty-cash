import { Readable } from 'node:stream';
import { NotFoundException } from '@nestjs/common';
import { GeminiReceiptService } from '../ocr/gemini-receipt.service';
import { OcrService } from '../ocr/ocr.service';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';
import type { Actor } from '../auth/actor';

const actor = { id: 'owner' } as Actor;
const fileId = '88888888-8888-4888-8888-888888888888';
const file = { contentType: 'application/pdf', size: 100, open: () => Readable.from(['receipt']) };
const realFetch = global.fetch;
const originalKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_RECEIPT_MODEL;
let fetchMock: jest.Mock<Promise<Response>, [string, RequestInit]>;
beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-secret';
  delete process.env.GEMINI_RECEIPT_MODEL;
  fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
  global.fetch = fetchMock;
});
afterEach(() => {
  global.fetch = realFetch;
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.GEMINI_RECEIPT_MODEL;
  else process.env.GEMINI_RECEIPT_MODEL = originalModel;
  jest.restoreAllMocks();
});
const reply = (body: object, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const remote = {
  name: 'files/test',
  uri: 'https://generativelanguage.googleapis.com/v1beta/files/test',
  state: 'ACTIVE',
};
const values = {
  documentType: 'invoice',
  supplierName: 'Shop',
  expenseDate: '2026-01-01',
  amount: 75.25,
  invoiceNumber: 'INV-1',
  items: ['A4 paper', 'Pens'],
};
function happyResponses(data: object = values) {
  fetchMock.mockResolvedValueOnce(
    reply({}, 200, {
      'x-goog-upload-url': 'https://generativelanguage.googleapis.com/upload/session',
    }),
  );
  fetchMock.mockResolvedValueOnce(reply({ file: remote }));
  fetchMock.mockResolvedValueOnce(
    reply({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(data) }] } }],
    }),
  );
  fetchMock.mockResolvedValueOnce(reply({}));
}

test('streams file bytes to Google, validates structured fields, joins items and deletes temporary file', async () => {
  happyResponses();
  const stream = Readable.from(['first', 'second']);
  const result = await new GeminiReceiptService().extract({ ...file, open: () => stream });
  expect(result).toEqual({
    documentType: 'invoice',
    category: null,
    supplierName: 'Shop',
    expenseDate: '2026-01-01',
    amount: 75.25,
    invoiceNumber: 'INV-1',
    description: 'A4 paper, Pens',
  });
  const upload = fetchMock.mock.calls[1][1] as RequestInit & { duplex: string };
  expect(upload.body).toBe(stream);
  expect(upload.duplex).toBe('half');
  expect(fetchMock.mock.calls[3][1]).toMatchObject({ method: 'DELETE' });
  expect(stream.destroyed).toBe(true);
});
test('invalid dates and amounts are not suggested while readable fields survive', async () => {
  happyResponses({ ...values, expenseDate: '2026-02-30', amount: -10 });
  expect(await new GeminiReceiptService().extract(file)).toMatchObject({
    expenseDate: null,
    amount: null,
    description: 'A4 paper, Pens',
  });
});
test('cleans the provider file after generation failure', async () => {
  happyResponses();
  fetchMock.mockReset();
  fetchMock
    .mockResolvedValueOnce(
      reply({}, 200, {
        'x-goog-upload-url': 'https://generativelanguage.googleapis.com/upload/session',
      }),
    )
    .mockResolvedValueOnce(reply({ file: remote }))
    .mockResolvedValueOnce(reply({ error: 'provider failure' }, 429))
    .mockResolvedValueOnce(reply({}));
  await expect(new GeminiReceiptService().extract(file)).rejects.toThrow();
  expect(fetchMock.mock.calls[3][1]).toMatchObject({ method: 'DELETE' });
});
test('malformed AI JSON fails safely and deletes the temporary file', async () => {
  happyResponses();
  fetchMock.mockReset();
  fetchMock
    .mockResolvedValueOnce(
      reply({}, 200, {
        'x-goog-upload-url': 'https://generativelanguage.googleapis.com/upload/session',
      }),
    )
    .mockResolvedValueOnce(reply({ file: remote }))
    .mockResolvedValueOnce(
      reply({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not JSON' }] } }] }),
    )
    .mockResolvedValueOnce(reply({}));
  await expect(new GeminiReceiptService().extract(file)).rejects.toThrow();
  expect(fetchMock.mock.calls[3][1]).toMatchObject({ method: 'DELETE' });
});
test('does not send receipt bytes to an unexpected upload host', async () => {
  fetchMock.mockResolvedValueOnce(
    reply({}, 200, { 'x-goog-upload-url': 'https://other.example/upload' }),
  );
  const open = jest.fn(file.open);
  await expect(new GeminiReceiptService().extract({ ...file, open })).rejects.toThrow(
    'Unexpected upload host',
  );
  expect(open).not.toHaveBeenCalled();
});
test('timeout releases the receipt stream', async () => {
  const controller = new AbortController();
  jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
  fetchMock
    .mockResolvedValueOnce(
      reply({}, 200, {
        'x-goog-upload-url': 'https://generativelanguage.googleapis.com/upload/session',
      }),
    )
    .mockImplementationOnce((_url: string, options: RequestInit) => {
      controller.abort();
      options.signal?.throwIfAborted();
      return Promise.resolve(reply({}));
    });
  const stream = Readable.from(['data']);
  await expect(
    new GeminiReceiptService().extract({ ...file, open: () => stream }),
  ).rejects.toThrow();
  expect(stream.destroyed).toBe(true);
});

test('only the owner can extract a completed file, even when another user can read an attached receipt', async () => {
  const findUnique = jest.fn();
  const service = new FilesService({ receiptFile: { findUnique } } as unknown as PrismaService);
  for (const record of [
    null,
    { state: 'uploading', ownerId: actor.id },
    { state: 'ready', ownerId: 'someone-else' },
  ]) {
    findUnique.mockResolvedValueOnce(record);
    await expect(service.forExtraction(fileId, actor)).rejects.toBeInstanceOf(NotFoundException);
  }
  findUnique.mockResolvedValueOnce({
    state: 'ready',
    ownerId: actor.id,
    contentType: file.contentType,
    size: 100,
  });
  expect(await service.forExtraction(fileId, actor)).toMatchObject({
    contentType: file.contentType,
    size: 100,
  });
  expect(fetchMock).not.toHaveBeenCalled();
});
test('missing key and provider failure do not modify stored receipt or expose provider errors', async () => {
  const forExtraction = jest.fn().mockResolvedValue(file);
  const extract = jest.fn().mockRejectedValue(new Error('test-secret provider details'));
  const service = new OcrService(
    { forExtraction } as unknown as FilesService,
    { extract } as unknown as GeminiReceiptService,
  );
  delete process.env.GEMINI_API_KEY;
  await expect(service.receipt({ fileId }, actor)).rejects.toMatchObject({ status: 501 });
  expect(extract).not.toHaveBeenCalled();
  process.env.GEMINI_API_KEY = 'test-secret';
  await expect(service.receipt({ fileId }, actor)).rejects.toMatchObject({
    status: 503,
    message: 'AI could not read this receipt. Enter the details manually or retry.',
  });
});
test('invalid IDs and unreadable files never call the provider', async () => {
  const forExtraction = jest.fn().mockRejectedValue(new NotFoundException());
  const extract = jest.fn();
  const service = new OcrService(
    { forExtraction } as unknown as FilesService,
    { extract } as unknown as GeminiReceiptService,
  );
  await expect(service.receipt({ fileId: 'invalid' }, actor)).rejects.toMatchObject({
    status: 400,
  });
  expect(forExtraction).not.toHaveBeenCalled();
  await expect(service.receipt({ fileId }, actor)).rejects.toMatchObject({ status: 404 });
  expect(extract).not.toHaveBeenCalled();
});

test.each(['bill', 'receipt', 'invoice'])(
  'preserves exact printed item description for %s',
  async (documentType) => {
    happyResponses({ ...values, documentType, items: ['Onion 1X25Kg'] });
    expect(await new GeminiReceiptService().extract(file)).toMatchObject({
      documentType,
      description: 'Onion 1X25Kg',
    });
  },
);
test.each(['other', 'unknown'])(
  'unrelated or unreadable document %s returns no invented fields',
  async (documentType) => {
    happyResponses({ ...values, documentType });
    expect(await new GeminiReceiptService().extract(file)).toEqual({
      documentType,
      category: null,
      supplierName: null,
      expenseDate: null,
      amount: null,
      invoiceNumber: null,
      description: null,
    });
    expect(fetchMock.mock.calls[3][1]).toMatchObject({ method: 'DELETE' });
  },
);
test('missing document classification falls back to manual entry rather than assuming a receipt', async () => {
  happyResponses({ ...values, documentType: undefined });
  await expect(new GeminiReceiptService().extract(file)).rejects.toThrow();
  expect(fetchMock.mock.calls[3][1]).toMatchObject({ method: 'DELETE' });
});

function batchResponses(receipts: object[], failUpload = false, finishReason = 'STOP') {
  let sequence = 0;
  fetchMock.mockImplementation(async (url, options) => {
    if (options.method === 'DELETE') return reply({});
    if (url.endsWith('/upload/v1beta/files'))
      return reply({}, 200, {
        'x-goog-upload-url': `https://generativelanguage.googleapis.com/upload/session${sequence++}`,
      });
    if (url.includes('/upload/session')) {
      for await (const chunk of options.body as unknown as Readable) expect(chunk).toBeDefined();
      if (failUpload && url.endsWith('1')) return reply({}, 500);
      const index = url.slice(-1);
      return reply({
        file: { ...remote, name: `files/test${index}`, uri: `${remote.uri}${index}` },
      });
    }
    if (url.includes(':generateContent'))
      return reply({
        candidates: [
          { finishReason, content: { parts: [{ text: JSON.stringify({ receipts }) }] } },
        ],
      });
    throw new Error('Unexpected request');
  });
}
test('bulk uses one prompt with multiple streamed files and maps reordered results', async () => {
  batchResponses([
    { ...values, documentIndex: 1, supplierName: 'Second' },
    { ...values, documentIndex: 0, supplierName: 'First' },
  ]);
  const streams = [Readable.from(['PDF']), Readable.from(['PNG'])];
  const result = await new GeminiReceiptService().extractMany([
    { ...file, open: () => streams[0] },
    { ...file, contentType: 'image/png', open: () => streams[1] },
  ]);
  expect(result.map((r) => r.supplierName)).toEqual(['First', 'Second']);
  const generations = fetchMock.mock.calls.filter(([url]) => url.includes(':generateContent'));
  expect(generations).toHaveLength(1);
  const payload = JSON.parse(generations[0][1].body as string) as {
    systemInstruction: { parts: unknown[] };
    contents: { parts: { fileData?: { mimeType: string } }[] }[];
  };
  expect(payload.systemInstruction.parts).toHaveLength(1);
  expect(
    payload.contents[0].parts.filter((p) => p.fileData).map((p) => p.fileData!.mimeType),
  ).toEqual(['application/pdf', 'image/png']);
  expect(
    fetchMock.mock.calls
      .filter(([url]) => url.includes('/upload/session'))
      .map(([, options]) => options.body),
  ).toEqual(streams);
  expect(streams.every((stream) => stream.destroyed)).toBe(true);
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'DELETE')).toHaveLength(2);
});
test.each([
  [
    { ...values, documentIndex: 0 },
    { ...values, documentIndex: 0 },
  ],
  [{ ...values, documentIndex: 0 }],
  [
    { ...values, documentIndex: 0 },
    { ...values, documentIndex: 2 },
  ],
])(
  'rejects missing, duplicate or foreign document indices without guessing file associations',
  async (...receipts) => {
    batchResponses(receipts);
    await expect(new GeminiReceiptService().extractMany([file, file])).rejects.toThrow();
    expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'DELETE')).toHaveLength(
      2,
    );
  },
);
test('a bulk upload failure cleans completed provider files and never generates a partial prompt', async () => {
  batchResponses([], true);
  await expect(new GeminiReceiptService().extractMany([file, file])).rejects.toThrow();
  expect(fetchMock.mock.calls.filter(([url]) => url.includes(':generateContent'))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'DELETE')).toHaveLength(1);
});
test('truncated bulk output fails safely and all temporary files are deleted', async () => {
  batchResponses([], false, 'MAX_TOKENS');
  await expect(new GeminiReceiptService().extractMany([file, file])).rejects.toThrow(
    'Incomplete receipt extraction',
  );
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'DELETE')).toHaveLength(2);
});
test('batch authorizes every file before provider access and preserves the single-file contract', async () => {
  const secondId = '99999999-9999-4999-8999-999999999999';
  const forExtraction = jest.fn().mockResolvedValue(file);
  const extractMany = jest
    .fn()
    .mockResolvedValue([{ supplierName: 'First' }, { supplierName: 'Second' }]);
  const service = new OcrService(
    { forExtraction } as unknown as FilesService,
    { extractMany } as unknown as GeminiReceiptService,
  );
  expect(await service.receipt({ fileIds: [fileId, secondId] }, actor)).toEqual({
    receipts: [
      { fileId, supplierName: 'First' },
      { fileId: secondId, supplierName: 'Second' },
    ],
  });
  expect(extractMany).toHaveBeenCalledTimes(1);
  extractMany.mockClear();
  forExtraction.mockRejectedValueOnce(new NotFoundException());
  await expect(service.receipt({ fileIds: [fileId, secondId] }, actor)).rejects.toMatchObject({
    status: 404,
  });
  expect(extractMany).not.toHaveBeenCalled();
  for (const fileIds of [[], [fileId, fileId], Array(21).fill(fileId), ['invalid']]) {
    await expect(service.receipt({ fileIds }, actor)).rejects.toMatchObject({ status: 400 });
  }
});
