import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
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
import type {
  EmployeeDetails,
  FindStaffByEmailRequest,
} from '@pension/proto/dist/common/common.pb';
import { StaffDirectoryService } from '../staff-directory/staff-directory.service';

// Exercise the real Petty Cash gRPC client and generated wire contract against a local directory stub.
// No Common database, Bifrost, or employee records are read or changed.
describe('staff directory gRPC client', () => {
  const server = new Server();
  const service = new StaffDirectoryService();
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
        });
      },
    });
    const port = await new Promise<number>((resolve, reject) => {
      server.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (error, port) =>
        error ? reject(error) : resolve(port),
      );
    });
    process.env.APP_ENV = 'development';
    process.env.COMMON_GRPC_URL = `127.0.0.1:${port}`;
  });
  afterAll(async () => {
    service.onModuleDestroy();
    await new Promise<void>((resolve, reject) =>
      server.tryShutdown((error) => (error ? reject(error) : resolve())),
    );
    if (originalEnvironment === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = originalEnvironment;
    if (originalTarget === undefined) delete process.env.COMMON_GRPC_URL;
    else process.env.COMMON_GRPC_URL = originalTarget;
  });
  test('maps real protobuf responses including empty display fields', async () => {
    await expect(service.findByEmail('staff@example.test')).resolves.toEqual({
      employeeId: 42,
      rcn: null,
      identifier: 'TEST-42',
      name: 'Test Employee',
      email: 'staff@example.test',
      designation: 'Officer',
      department: '',
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
  });
});
