import { StorageService } from '../storage/storage.service';
import { HttpException } from '@nestjs/common';
import type { Request } from 'express';
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { createServer, request as httpRequest, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Actor } from '../auth/actor';
import { FilesService, MAX_UPLOAD_BYTES, UploadValidator } from '../files/files.service';
import type { PrismaService } from '../prisma/prisma.service';
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
describe('streaming receipt validation', () => {
  test('forwards bytes before end with only a bounded signature prefix', async () => {
    const input = new PassThrough(),
      validator = new UploadValidator('image/png');
    let received = 0;
    const completion = pipeline(
      input,
      validator,
      new Writable({
        write(chunk: Buffer, _enc, done) {
          received += chunk.length;
          done();
        },
      }),
    );
    input.write(Buffer.concat([png, Buffer.alloc(8192)]));
    await pause(10);
    expect(received).toBe(8200);
    expect(input.writableEnded).toBe(false);
    input.end();
    await completion;
  });
  test('rejects forged MIME, empty files, and bytes beyond the limit', async () => {
    for (const [data, mime] of [
      [png, 'application/pdf'],
      [Buffer.alloc(0), 'image/png'],
    ] as const) {
      const input = new PassThrough();
      const done = pipeline(
        input,
        new UploadValidator(mime),
        new Writable({
          write(_c, _e, cb) {
            cb();
          },
        }),
      );
      input.end(data);
      await expect(done).rejects.toMatchObject({ status: 415 });
    }
    const input = new PassThrough();
    const done = pipeline(
      input,
      new UploadValidator('image/png'),
      new Writable({
        write(_c, _e, cb) {
          cb();
        },
      }),
    );
    input.end(Buffer.concat([png, Buffer.alloc(MAX_UPLOAD_BYTES)]));
    await expect(done).rejects.toMatchObject({ status: 413 });
  });
  test('backpressure bounds buffering with several concurrent slow destinations', async () => {
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        const input = new PassThrough({ highWaterMark: 16384 }),
          validator = new UploadValidator('image/png');
        let peak = 0;
        const done = pipeline(
          input,
          validator,
          new Writable({
            highWaterMark: 16384,
            write(_c, _e, cb) {
              peak = Math.max(peak, input.writableLength + validator.readableLength);
              setTimeout(cb, 1);
            },
          }),
        );
        input.write(Buffer.concat([png, Buffer.alloc(16384 - png.length)]));
        for (let n = 0; n < 128; n++) {
          if (!input.write(Buffer.alloc(16384)))
            await new Promise<void>((r) => input.once('drain', r));
        }
        input.end();
        await done;
        expect(peak).toBeLessThan(256 * 1024);
      }),
    );
  });
});
// Real HTTP + local streamed storage, with a metadata-only stand-in for Prisma.
describe('multipart upload lifecycle', () => {
  let server: Server, port: number, directory: string, files: FilesService, storage: StorageService;
  const rows = new Map<string, { id: string; state?: string; storageKey: string; size: number }>();
  const actor: Actor = {
    id: 'gs',
    name: 'GS',
    email: 'gs@example.test',
    roles: ['GS_REQUESTER'],
    permissions: ['files.upload', 'files.download'],
    activeRequester: false,
  };
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'petty-cash-upload-test-'));
    await mkdir(join(directory, 'petty-cash'));
    process.env.FILE_STORAGE = 'local';
    process.env.FILE_STORAGE_PATH = directory;
    storage = new StorageService();
    files = new FilesService(
      {
        receiptFile: {
          create: ({ data }: { data: { id: string; storageKey: string; size: number } }) => {
            rows.set(data.id, data);
            return Promise.resolve(data);
          },
          update: ({
            where,
            data,
          }: {
            where: { id: string };
            data: { state?: string; size?: number };
          }) => {
            const row = { ...rows.get(where.id)!, ...data };
            rows.set(where.id, row);
            return Promise.resolve(row);
          },
        },
      } as unknown as PrismaService,
      storage,
    );
    server = createServer((req, res) => {
      void files
        .upload(req as Request, actor)
        .then((result) => {
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(result));
        })
        .catch((e: unknown) => {
          if (!res.destroyed) {
            res.statusCode = e instanceof HttpException ? e.getStatus() : 500;
            res.end(JSON.stringify({ message: e instanceof Error ? e.message : 'Upload failed' }));
          }
        });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await rm(directory, { recursive: true, force: true });
  });
  function start(type = 'image/png') {
    let req: ReturnType<typeof httpRequest>;
    const result = new Promise<{ status: number; body: { size: number; fileId: string } }>(
      (resolve, reject) => {
        req = httpRequest(
          {
            host: '127.0.0.1',
            port,
            method: 'POST',
            headers: {
              'Content-Type': 'multipart/form-data; boundary=petty-cash-test',
            },
          },
          (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () =>
              resolve({
                status: res.statusCode!,
                body: JSON.parse(body) as { size: number; fileId: string },
              }),
            );
          },
        );
        req.on('error', reject);
      },
    );
    req!.write(
      `--petty-cash-test\r\nContent-Disposition: form-data; name="file"; filename="receipt.png"\r\nContent-Type: ${type}\r\n\r\n`,
    );
    return { req: req!, result };
  }
  test('writes to storage before the HTTP request ends and returns only completed metadata', async () => {
    const { req, result } = start();
    req.write(Buffer.concat([png, Buffer.alloc(4096)]));
    let written = false;
    for (let i = 0; i < 50; i++) {
      const names = await readdir(join(directory, 'petty-cash'));
      if (names.length && (await stat(join(directory, 'petty-cash', names[0]))).size > 0) {
        written = true;
        break;
      }
      await pause(10);
    }
    expect(written).toBe(true);
    expect([...rows.values()].some((r) => r.state === 'ready')).toBe(false);
    req.end('\r\n--petty-cash-test--\r\n');
    const response = await result;
    expect(response.status).toBe(200);
    expect(response.body.size).toBe(4104);
    const row = rows.get(response.body.fileId)!;
    expect(row.state).toBe('ready');
    expect(row.storageKey).toMatch(/^petty-cash\/[0-9a-f-]{36}$/);
    expect((await readFile(join(directory, row.storageKey))).subarray(0, 8)).toEqual(png);
  });
  test('truncated multipart is rejected and its partial object removed', async () => {
    const before = (await readdir(join(directory, 'petty-cash'))).length;
    const { req, result } = start();
    req.end(Buffer.concat([png, Buffer.alloc(100)]));
    expect((await result).status).not.toBe(200);
    expect((await readdir(join(directory, 'petty-cash'))).length).toBe(before);
  });
  test('forged MIME and oversize multipart leave no partial object', async () => {
    const before = (await readdir(join(directory, 'petty-cash'))).length;
    for (const [type, size, status] of [
      ['application/pdf', 100, 415],
      ['image/png', MAX_UPLOAD_BYTES, 413],
    ] as const) {
      const { req, result } = start(type);
      req.end(Buffer.concat([png, Buffer.alloc(size), Buffer.from('\r\n--petty-cash-test--\r\n')]));
      expect((await result).status).toBe(status);
      expect((await readdir(join(directory, 'petty-cash'))).length).toBe(before);
    }
  });
  test('disconnect removes partial storage without publishing the file', async () => {
    const before = (await readdir(join(directory, 'petty-cash'))).length;
    const { req, result } = start();
    void result.catch(() => undefined);
    req.write(Buffer.concat([png, Buffer.alloc(10000)]));
    await pause(30);
    req.destroy();
    await pause(100);
    expect((await readdir(join(directory, 'petty-cash'))).length).toBe(before);
  });
  test('storage failure is propagated and never publishes ready metadata', async () => {
    const writer = jest.spyOn(storage, 'createWriteStream').mockImplementation(() =>
      Promise.resolve(
        new Writable({
          write(_c, _e, done) {
            done(new Error('Storage unavailable'));
          },
        }),
      ),
    );
    try {
      const { req, result } = start();
      req.end(Buffer.concat([png, Buffer.alloc(100), Buffer.from('\r\n--petty-cash-test--\r\n')]));
      expect((await result).status).toBe(500);
    } finally {
      writer.mockRestore();
    }
  });
});
