import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import busboy from 'busboy';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Transform, TransformCallback, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Actor } from '../auth/actor';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export function detectType(b: Buffer): string | undefined {
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (b.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  if (
    b.toString('ascii', 4, 8) === 'ftyp' &&
    ['heic', 'heix', 'hevc', 'hevx'].some((s) => b.subarray(8).includes(Buffer.from(s)))
  )
    return 'image/heic';
}
/** Buffers only the first 64 bytes; all subsequent bytes flow under backpressure. */
export class UploadValidator extends Transform {
  private prefix = Buffer.alloc(0);
  private checked = false;
  size = 0;
  contentType = '';
  constructor(private readonly declared: string) {
    super({ highWaterMark: 64 * 1024 });
  }
  _transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback) {
    this.size += chunk.length;
    if (this.size > MAX_UPLOAD_BYTES)
      return done(new PayloadTooLargeException('Maximum receipt size is 10 MB.'));
    if (this.checked) {
      done(null, chunk);
      return;
    }
    const needed = Math.min(64 - this.prefix.length, chunk.length);
    this.prefix = Buffer.concat([this.prefix, chunk.subarray(0, needed)]);
    if (this.prefix.length < 64) {
      done();
      return;
    }
    try {
      this.check();
      this.push(this.prefix);
      this.prefix = Buffer.alloc(0);
      done(null, chunk.subarray(needed));
    } catch (e) {
      done(e as Error);
    }
  }
  private check() {
    const type = detectType(this.prefix);
    const compatible =
      this.declared === type || (type === 'image/heic' && this.declared === 'image/heif');
    if (!type || !compatible)
      throw new UnsupportedMediaTypeException(
        'Upload a valid JPEG, PNG, HEIC, WebP image or PDF matching its file type.',
      );
    this.contentType = type;
    this.checked = true;
  }
  _flush(done: TransformCallback) {
    try {
      if (!this.checked) {
        this.check();
        this.push(this.prefix);
      }
      done();
    } catch (e) {
      done(e as Error);
    }
  }
}
@Injectable()
export class FilesService {
  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService,
  ) {}
  async upload(req: Request, a: Actor) {
    const id = randomUUID(),
      storageKey = this.storage.createKey();
    let fileSeen = false;
    let validator: UploadValidator | undefined;
    let write: Writable | undefined;
    let task: Promise<void> | undefined;
    const abort = new AbortController();
    let failure: Error | undefined;
    const fail = (err: Error) => {
      if (failure) return;
      failure = err;
      // Busboy is still updating its active part inside limit callbacks. Destroying
      // it synchronously there corrupts that internal state (and can crash Node).
      queueMicrotask(() => {
        abort.abort();
        parser?.destroy(err);
      });
    };
    let parser: ReturnType<typeof busboy>;
    try {
      parser = busboy({
        headers: req.headers,
        limits: {
          files: 1,
          fileSize: MAX_UPLOAD_BYTES + 1,
          fields: 0,
          parts: 2,
          headerPairs: 100,
        },
        highWaterMark: 64 * 1024,
        fileHwm: 64 * 1024,
      });
    } catch {
      throw new BadRequestException('Expected multipart/form-data with one file.');
    }
    const onAborted = () => fail(new BadRequestException('Upload disconnected.'));
    req.once('aborted', onAborted);
    try {
      parser.on('filesLimit', () => fail(new BadRequestException('Upload one file at a time.')));
      parser.on('fieldsLimit', () => fail(new BadRequestException('Unexpected multipart field.')));
      parser.on('partsLimit', () => fail(new BadRequestException('Upload one file at a time.')));
      parser.on('file', (field, stream, info) => {
        fileSeen = true;
        stream.on('error', fail);
        stream.once('limit', () =>
          fail(new PayloadTooLargeException('Maximum receipt size is 10 MB.')),
        );
        if (field !== 'file') {
          stream.resume();
          fail(new BadRequestException('Use the file field.'));
          return;
        }
        validator = new UploadValidator(info.mimeType);
        task = (async () => {
          await this.db.receiptFile.create({
            data: {
              id,
              storageKey,
              ownerId: a.id,
              fileName: (info.filename || 'receipt').replace(/[\r\n]/g, '').slice(0, 255),
              contentType: info.mimeType,
              size: 0,
            },
          });
          write = await this.storage.createWriteStream(storageKey);
          await pipeline(stream, validator, write, { signal: abort.signal });
          if (stream.truncated) throw new PayloadTooLargeException('Upload was truncated.');
        })();
        void task.catch((e: unknown) =>
          fail(e instanceof Error ? e : new Error('Storage write failed')),
        );
      });
      try {
        await new Promise<void>((resolve, reject) => {
          parser.once('close', resolve);
          parser.once('error', reject);
          req.pipe(parser);
        });
      } catch (e) {
        failure ??= e as Error;
      }
      req.unpipe(parser);
      if (failure && !req.destroyed) req.resume();
      if (task)
        try {
          await task;
        } catch (e) {
          failure ??= e as Error;
        }
      if (failure) throw failure;
      if (!fileSeen || !validator || validator.size === 0)
        throw new BadRequestException('Choose a receipt file.');
      const file = await this.db.receiptFile.update({
        where: { id },
        data: {
          state: 'ready',
          size: validator.size,
          contentType: validator.contentType,
        },
      });
      return {
        fileId: file.id,
        fileName: file.fileName,
        contentType: file.contentType,
        size: file.size,
        url: `/files/${file.id}`,
      };
    } catch (error) {
      write?.destroy();
      await this.storage.delete(storageKey).catch(() => undefined);
      // Leave an uploading row for maintenance if storage deletion failed; never expose it.
      throw error;
    } finally {
      req.off('aborted', onAborted);
    }
  }
  async download(id: string, a: Actor, res: Response) {
    const file = await this.db.receiptFile.findUnique({
      where: { id },
      include: { expense: true },
    });
    if (!file || file.state !== 'ready' || (!file.expense && file.ownerId !== a.id))
      throw new NotFoundException('Receipt not found.');
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', file.size);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    await pipeline(this.storage.createReadStream(file.storageKey), res);
  }
  async forExtraction(id: string, a: Actor) {
    const file = await this.db.receiptFile.findUnique({ where: { id } });
    if (!file || file.state !== 'ready' || file.ownerId !== a.id)
      throw new NotFoundException('Receipt not found.');
    return {
      contentType: file.contentType,
      size: file.size,
      open: () => this.storage.createReadStream(file.storageKey),
    };
  }
  async cleanup() {
    const files = await this.db.receiptFile.findMany({
      where: {
        createdAt: { lt: new Date(Date.now() - 86400000) },
        expense: null,
      },
    });
    for (const f of files) {
      // Serialize against attachment creation; claim first, then delete outside the transaction.
      const claimed = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM receipt_files WHERE id = ${f.id} FOR UPDATE`;
        const row = await tx.receiptFile.findUnique({
          where: { id: f.id },
          include: { expense: true },
        });
        if (!row || row.expense) return false;
        await tx.receiptFile.update({
          where: { id: f.id },
          data: { state: 'deleting' },
        });
        return true;
      });
      if (claimed) {
        await this.storage.delete(f.storageKey);
        await this.db.receiptFile.delete({ where: { id: f.id } });
      }
    }
  }
}
