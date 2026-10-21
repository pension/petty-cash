import { Storage } from '@google-cloud/storage';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Writable } from 'node:stream';

@Injectable()
export class StorageService {
  private readonly local = process.env.FILE_STORAGE === 'local';
  private readonly directory = resolve(process.env.FILE_STORAGE_PATH || 'var/receipts');
  private readonly storage = new Storage({
    projectId: process.env.STORAGE_PROJECT_ID?.trim() || undefined,
    keyFilename: process.env.STORAGE_KEY_FILE?.trim()
      ? resolve(process.env.STORAGE_KEY_FILE.trim())
      : undefined,
  });
  private readonly bucket =
    process.env.STORAGE_MEDIA_BUCKET?.trim() || process.env.GCS_RECEIPT_BUCKET!;

  createKey() {
    return `petty-cash/${randomUUID()}`;
  }

  async createWriteStream(key: string): Promise<Writable> {
    if (this.local) {
      const path = join(this.directory, key);
      await mkdir(dirname(path), { recursive: true });
      return createWriteStream(path, { flags: 'wx', highWaterMark: 64 * 1024 });
    }
    return this.storage
      .bucket(this.bucket)
      .file(key)
      .createWriteStream({
        resumable: false,
        validation: 'crc32c',
        metadata: { contentType: 'application/octet-stream', cacheControl: 'private, no-store' },
        preconditionOpts: { ifGenerationMatch: 0 },
      });
  }

  // Use persisted keys verbatim: older receipts may live outside petty-cash/.
  createReadStream(key: string) {
    return this.local
      ? createReadStream(join(this.directory, key))
      : this.storage.bucket(this.bucket).file(key).createReadStream();
  }

  async delete(key: string) {
    if (this.local) await rm(join(this.directory, key), { force: true });
    else await this.storage.bucket(this.bucket).file(key).delete({ ignoreNotFound: true });
  }
}
