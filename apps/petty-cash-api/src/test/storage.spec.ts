import { Storage } from '@google-cloud/storage';
import { Test } from '@nestjs/testing';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StorageModule } from '../storage/storage.module';
import { StorageService } from '../storage/storage.service';

jest.mock('@google-cloud/storage', () => ({ Storage: jest.fn() }));
const mockStorage = Storage as unknown as jest.Mock;
const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
  jest.clearAllMocks();
});

function cloud() {
  process.env.FILE_STORAGE = 'gcs';
  process.env.STORAGE_PROJECT_ID = 'project-test';
  process.env.STORAGE_KEY_FILE = './secrets/dev-bucket.json';
  process.env.STORAGE_MEDIA_BUCKET = 'bucket-test';
  const object = {
    createWriteStream: jest.fn(() => new PassThrough()),
    createReadStream: jest.fn(() => Readable.from(['receipt'])),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const file = jest.fn(() => object);
  const bucket = jest.fn(() => ({ file }));
  mockStorage.mockImplementation(() => ({ bucket }));
  return { object, file, bucket };
}

test('StorageModule provides storage with the shared project, key and bucket configuration', async () => {
  const { bucket } = cloud();
  const module = await Test.createTestingModule({ imports: [StorageModule] }).compile();
  try {
    const service = module.get(StorageService);
    expect(mockStorage).toHaveBeenCalledWith({
      projectId: 'project-test',
      keyFilename: resolve('./secrets/dev-bucket.json'),
    });
    await service.delete('petty-cash/test');
    expect(bucket).toHaveBeenCalledWith('bucket-test');
  } finally {
    await module.close();
  }
});

test('new uploads use unique petty-cash object names and preserve create-only private streaming', async () => {
  const { object, file } = cloud();
  const service = new StorageService();
  const key = service.createKey();
  expect(key).toMatch(/^petty-cash\/[0-9a-f-]{36}$/);
  expect(service.createKey()).not.toBe(key);
  const stream = await service.createWriteStream(key);
  expect(file).toHaveBeenCalledWith(key);
  expect(object.createWriteStream).toHaveBeenCalledWith(
    expect.objectContaining({
      validation: 'crc32c',
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: 'application/octet-stream', cacheControl: 'private, no-store' },
    }),
  );
  stream.destroy();
});

test.each(['legacy-root-uuid', 'petty-cash/new-uuid'])(
  'reads and deletes the persisted key unchanged: %s',
  async (key) => {
    const { object, file } = cloud();
    const service = new StorageService();
    let body = '';
    for await (const chunk of service.createReadStream(key)) body += chunk;
    expect(body).toBe('receipt');
    await service.delete(key);
    expect(file.mock.calls).toEqual([[key], [key]]);
    expect(object.delete).toHaveBeenCalledWith({ ignoreNotFound: true });
  },
);

test('local storage streams new nested files and still reads and removes legacy files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'petty-storage-test-'));
  process.env.FILE_STORAGE = 'local';
  process.env.FILE_STORAGE_PATH = directory;
  try {
    const service = new StorageService();
    const key = service.createKey();
    await pipeline(Readable.from(['receipt']), await service.createWriteStream(key));
    expect(await readFile(join(directory, key), 'utf8')).toBe('receipt');
    await writeFile(join(directory, 'legacy-uuid'), 'old receipt');
    let body = '';
    for await (const chunk of service.createReadStream('legacy-uuid')) body += chunk;
    expect(body).toBe('old receipt');
    await service.delete('legacy-uuid');
    await service.delete(key);
    await expect(readFile(join(directory, key))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(directory, 'legacy-uuid'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
