import { credentials } from '@grpc/grpc-js';
import { type GrpcOptions, Transport } from '@nestjs/microservices';
import { GoogleAuth, IdTokenClient } from 'google-auth-library';
import { createCommonGrpcOptions } from '../staff-directory/common-grpc.options';

describe('employment-api compatible common-grpc configuration', () => {
  const originalEnvironment = process.env.APP_ENV;
  const originalTarget = process.env.COMMON_GRPC_URL;
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalEnvironment === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = originalEnvironment;
    if (originalTarget === undefined) delete process.env.COMMON_GRPC_URL;
    else process.env.COMMON_GRPC_URL = originalTarget;
  });

  test.each(['development', 'staging', 'test', undefined])(
    '%s uses insecure transport without obtaining a Google token client',
    async (environment) => {
      if (environment === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = environment;
      process.env.COMMON_GRPC_URL = 'common-grpc:4400';
      const google = jest.spyOn(GoogleAuth.prototype, 'getIdTokenClient');
      const insecure = jest.spyOn(credentials, 'createInsecure');
      const tls = jest.spyOn(credentials, 'createSsl');
      const result = (await createCommonGrpcOptions()) as GrpcOptions;
      expect(result.transport).toBe(Transport.GRPC);
      expect(result.options?.url).toBe('common-grpc:4400');
      expect(result.options?.credentials).toBe(insecure.mock.results[0].value);
      expect(google).not.toHaveBeenCalled();
      expect(tls).not.toHaveBeenCalled();
    },
  );

  test('production uses the exact target as audience and combines TLS with Google credentials', async () => {
    process.env.APP_ENV = 'production';
    const target = 'common-grpc.example.test:443';
    process.env.COMMON_GRPC_URL = target;
    const client = new IdTokenClient({
      targetAudience: target,
      idTokenProvider: { fetchIdToken: jest.fn() },
    });
    const google = jest.spyOn(GoogleAuth.prototype, 'getIdTokenClient').mockResolvedValue(client);
    const tls = jest.spyOn(credentials, 'createSsl');
    const call = jest.spyOn(credentials, 'createFromGoogleCredential');
    const combined = jest.spyOn(credentials, 'combineChannelCredentials');
    const insecure = jest.spyOn(credentials, 'createInsecure');
    const result = (await createCommonGrpcOptions()) as GrpcOptions;
    expect(google).toHaveBeenCalledWith(target);
    expect(result.options?.url).toBe(target);
    expect(call).toHaveBeenCalledWith(client);
    expect(combined).toHaveBeenCalledWith(tls.mock.results[0].value, call.mock.results[0].value);
    expect(result.options?.credentials).toBe(combined.mock.results[0].value);
    expect(insecure).not.toHaveBeenCalled();
  });

  test('missing directory configuration fails registration with an actionable message', async () => {
    delete process.env.COMMON_GRPC_URL;
    await expect(createCommonGrpcOptions()).rejects.toThrow('COMMON_GRPC_URL is required');
  });
});
