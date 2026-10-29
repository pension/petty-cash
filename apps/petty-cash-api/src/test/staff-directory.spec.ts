import {
  ConflictException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  loadPackageDefinition,
  Server,
  ServerCredentials,
  status,
  type ServiceDefinition,
  type ServerUnaryCall,
  type sendUnaryData,
} from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  EmployeeDetails,
  FindStaffByEmailRequest,
} from '@pension/proto/dist/common/common.pb';
import { StaffDirectoryService } from '../staff-directory/staff-directory.service';
import { StaffDirectoryModule } from '../staff-directory/staff-directory.module';

// Exercise the real Petty Cash gRPC client and generated wire contract against a local directory stub.
// No Common database, Bifrost, or employee records are read or changed.
describe('staff directory gRPC client', () => {
  const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  const server = new Server();
  let module: TestingModule;
  let service: StaffDirectoryService;
  const originalEnvironment = process.env.APP_ENV;
  const originalTarget = process.env.COMMON_GRPC_URL;
  beforeAll(async () => {
    const definition = loadPackageDefinition(
      loadSync(require.resolve('@pension/proto/dist/common/common.proto'), { keepCase: true }),
    ) as unknown as {
      common: { CommonService: { service: ServiceDefinition } };
    };
    server.addService(definition.common.CommonService.service, {
      findStaffByEmail(
        call: ServerUnaryCall<FindStaffByEmailRequest, EmployeeDetails>,
        callback: sendUnaryData<EmployeeDetails>,
      ) {
        if (call.request.email === 'unimplemented@example.test') {
          callback({ code: status.UNIMPLEMENTED, details: 'Method not found' });
          return;
        }
        if (call.request.email === 'unavailable@example.test') {
          callback({ code: status.UNAVAILABLE, details: `Failed for ${call.request.email}` });
          return;
        }
        if (call.request.email === 'missing@example.test') {
          callback({ code: status.NOT_FOUND, details: 'Not found' });
          return;
        }
        if (call.request.email === 'duplicate@example.test') {
          callback({ code: status.FAILED_PRECONDITION, details: 'Ambiguous' });
          return;
        }
        callback(null, {
          entity_id: call.request.email === 'invalid@example.test' ? 0 : 42,
          rcn: '',
          identifier: 'TEST-42',
          name: 'Test Employee',
          email: call.request.email,
          designation: 'Officer',
          department: '',
          blink_id: call.request.email === 'no-blink@example.test' ? '' : 'u-c-test-blink-id',
        });
      },
    });
    const port = await new Promise<number>((resolve, reject) => {
      server.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (error, port) =>
        error ? reject(error) : resolve(port),
      );
    });
    // Like employment-api, staging must use insecure transport without Google auth.
    process.env.APP_ENV = 'staging';
    process.env.COMMON_GRPC_URL = `127.0.0.1:${port}`;
    module = await Test.createTestingModule({ imports: [StaffDirectoryModule] }).compile();
    await module.init();
    service = module.get(StaffDirectoryService);
  });
  afterAll(async () => {
    logError.mockRestore();
    await module?.close();
    await new Promise<void>((resolve, reject) =>
      server.tryShutdown((error) => (error ? reject(error) : resolve())),
    );
    if (originalEnvironment === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = originalEnvironment;
    if (originalTarget === undefined) delete process.env.COMMON_GRPC_URL;
    else process.env.COMMON_GRPC_URL = originalTarget;
  });
  beforeEach(() => logError.mockClear());
  test('maps real protobuf responses including empty display fields', async () => {
    await expect(service.findByEmail('staff@example.test')).resolves.toEqual({
      employeeId: 42,
      rcn: null,
      identifier: 'TEST-42',
      name: 'Test Employee',
      email: 'staff@example.test',
      designation: 'Officer',
      department: '',
      blinkId: 'u-c-test-blink-id',
    });
  });
  test('treats an empty blink_id as unset rather than a literal empty string', async () => {
    await expect(service.findByEmail('no-blink@example.test')).resolves.toMatchObject({
      blinkId: null,
    });
  });
  test('returns useful not-found and ambiguous-email errors', async () => {
    await expect(service.findByEmail('missing@example.test')).rejects.toThrow(NotFoundException);
    await expect(service.findByEmail('duplicate@example.test')).rejects.toThrow(ConflictException);
  });
  test('rejects invalid directory identity instead of persisting it', async () => {
    await expect(service.findByEmail('invalid@example.test')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'staff_directory_lookup_failed',
        stage: 'response',
        reason: 'INVALID_RESPONSE',
        invalidFields: [{ path: 'entity_id', code: 'too_small' }],
      }),
    );
  });
  test('identifies a missing deployed RPC without changing the public error', async () => {
    await expect(service.findByEmail('unimplemented@example.test')).rejects.toThrow(
      'Petty Cash could not reach the employee directory. Please try again.',
    );
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'rpc', reason: 'UNIMPLEMENTED', grpcCode: 12 }),
    );
  });
  test('logs unavailable status without copying personal data from upstream errors', async () => {
    await expect(service.findByEmail('unavailable@example.test')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'UNAVAILABLE', grpcCode: 14, transport: 'insecure' }),
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain('unavailable@example.test');
  });
});
