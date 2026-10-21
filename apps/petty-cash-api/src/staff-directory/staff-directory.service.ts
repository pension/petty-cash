import {
  Injectable,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ClientGrpc, ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { credentials, status } from '@grpc/grpc-js';
import { CommonServiceClient, COMMON_SERVICE_NAME } from '@pension/proto/dist/common/common.pb';
import { GoogleAuth } from 'google-auth-library';
import { firstValueFrom, timeout } from 'rxjs';
import { z } from 'zod';

const employeeSchema = z.object({
  entity_id: z.number().int().positive(),
  rcn: z.string().max(100),
  identifier: z.string().max(100),
  name: z.string().trim().min(1).max(191),
  email: z.string().trim().email().max(254),
  designation: z.string().max(191),
  department: z.string().max(191),
});

@Injectable()
export class StaffDirectoryService implements OnModuleDestroy {
  private client?: ClientProxy & ClientGrpc;
  private connecting?: Promise<CommonServiceClient>;

  private service(): Promise<CommonServiceClient> {
    if (!this.connecting) {
      this.connecting = this.connect().catch((error: unknown) => {
        this.connecting = undefined;
        throw error;
      });
    }
    return this.connecting;
  }

  private async connect(): Promise<CommonServiceClient> {
    const target = process.env.COMMON_GRPC_URL;
    if (!target)
      throw new ServiceUnavailableException('Petty Cash employee lookup is not configured.');
    const production = process.env.APP_ENV !== 'development';
    const channel = production ? credentials.createSsl() : credentials.createInsecure();
    const auth = production
      ? await new GoogleAuth().getIdTokenClient(
          process.env.COMMON_GRPC_AUDIENCE || `https://${target.replace(/:443$/, '')}`,
        )
      : undefined;
    this.client = ClientProxyFactory.create({
      transport: Transport.GRPC,
      options: {
        url: target,
        package: 'common',
        protoPath: require.resolve('@pension/proto/dist/common/common.proto'),
        loader: { keepCase: true, defaults: true },
        credentials: auth
          ? credentials.combineChannelCredentials(
              channel,
              credentials.createFromGoogleCredential(auth),
            )
          : channel,
      },
    });
    return this.client.getService<CommonServiceClient>(COMMON_SERVICE_NAME);
  }

  async findByEmail(email: string) {
    try {
      const service = await this.service();
      const result = employeeSchema.parse(
        await firstValueFrom(service.findStaffByEmail({ email }).pipe(timeout(10000))),
      );
      if (result.email.toLowerCase() !== email.toLowerCase())
        throw new ServiceUnavailableException(
          'Employee lookup returned a different email. Try again.',
        );
      return {
        employeeId: result.entity_id,
        rcn: result.rcn || null,
        identifier: result.identifier || null,
        name: result.name,
        email: result.email.toLowerCase(),
        designation: result.designation,
        department: result.department,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const code = (error as { code?: number })?.code;
      if (code === status.NOT_FOUND)
        throw new NotFoundException('No active employee found for this work email.');
      if (code === status.FAILED_PRECONDITION)
        throw new ConflictException(
          'More than one employee uses this email. Ask HR to correct the directory.',
        );
      throw new ServiceUnavailableException(
        'Petty Cash could not reach the employee directory. Please try again.',
      );
    }
  }

  onModuleDestroy() {
    this.client?.close();
  }
}
