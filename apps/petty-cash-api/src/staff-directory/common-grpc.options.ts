import { type ClientProvider, Transport } from '@nestjs/microservices';
import { credentials } from '@grpc/grpc-js';
import { GoogleAuth } from 'google-auth-library';

/** Match employment-api's transport and Google token audience conventions. */
export async function createCommonGrpcOptions(): Promise<ClientProvider> {
  const target = process.env.COMMON_GRPC_URL;
  if (!target) throw new Error('COMMON_GRPC_URL is required for the Petty Cash staff directory.');
  const production = process.env.APP_ENV === 'production';
  const idTokenClient = production ? await new GoogleAuth().getIdTokenClient(target) : undefined;

  return {
    transport: Transport.GRPC,
    options: {
      package: 'common',
      protoPath: require.resolve('@pension/proto/dist/common/common.proto'),
      url: target,
      // Preserve empty protobuf fields so optional display values can be validated.
      loader: { keepCase: true, defaults: true },
      credentials: idTokenClient
        ? credentials.combineChannelCredentials(
            credentials.createSsl(),
            credentials.createFromGoogleCredential(idTokenClient),
          )
        : credentials.createInsecure(),
    },
  };
}
