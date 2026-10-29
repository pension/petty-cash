import {
  Injectable,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { CommonServiceClient, COMMON_SERVICE_NAME } from '@pension/proto/dist/common/common.pb';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';
import { z } from 'zod';

const employeeSchema = z.object({
  entity_id: z.number().int().positive(),
  rcn: z.string().max(100),
  identifier: z.string().max(100),
  name: z.string().trim().min(1).max(191),
  email: z.string().trim().email().max(254),
  designation: z.string().max(191),
  department: z.string().max(191),
  blink_id: z.string().max(100),
});

@Injectable()
export class StaffDirectoryService {
  private readonly logger = new Logger(StaffDirectoryService.name);
  constructor(@Inject(COMMON_SERVICE_NAME) private readonly commonGrpcClient: ClientGrpc) {}

  async findByEmail(email: string) {
    let stage: 'connection' | 'rpc' | 'response' = 'connection';
    let reason: string | undefined;
    try {
      const service = this.commonGrpcClient.getService<CommonServiceClient>(COMMON_SERVICE_NAME);
      stage = 'rpc';
      if (typeof service.findStaffByEmail !== 'function') {
        reason = 'CLIENT_RPC_MISSING';
        throw new ServiceUnavailableException(
          'Petty Cash could not reach the employee directory. Please try again.',
        );
      }
      const response = await firstValueFrom(
        service.findStaffByEmail({ email }).pipe(timeout(10000)),
      );
      stage = 'response';
      const result = employeeSchema.parse(response);
      if (result.email.toLowerCase() !== email.toLowerCase()) {
        reason = 'EMAIL_MISMATCH';
        throw new ServiceUnavailableException(
          'Employee lookup returned a different email. Try again.',
        );
      }
      return {
        employeeId: result.entity_id,
        rcn: result.rcn || null,
        identifier: result.identifier || null,
        name: result.name,
        email: result.email.toLowerCase(),
        designation: result.designation,
        department: result.department,
        blinkId: result.blink_id || null,
      };
    } catch (error) {
      const code = (error as { code?: number })?.code;
      if (code === status.NOT_FOUND)
        throw new NotFoundException('No active employee found for this work email.');
      if (code === status.FAILED_PRECONDITION)
        throw new ConflictException(
          'More than one employee uses this email. Ask HR to correct the directory.',
        );
      // Do not log the email, response, metadata, or raw upstream error: these may
      // contain personal data or credentials. Retain diagnostic codes and stage.
      const grpcStatus = typeof code === 'number' ? status[code] : undefined;
      const upstreamHttpStatus = (error as { response?: { status?: number } })?.response?.status;
      this.logger.error({
        event: 'staff_directory_lookup_failed',
        rpc: 'common.CommonService/FindStaffByEmail',
        stage,
        reason:
          reason ||
          (error instanceof z.ZodError
            ? 'INVALID_RESPONSE'
            : error instanceof TimeoutError
              ? 'TIMEOUT'
              : grpcStatus ||
                (stage === 'connection'
                  ? process.env.COMMON_GRPC_URL
                    ? 'CLIENT_INITIALIZATION_FAILED'
                    : 'DIRECTORY_NOT_CONFIGURED'
                  : 'UNEXPECTED_ERROR')),
        grpcCode: grpcStatus ? code : undefined,
        upstreamHttpStatus: typeof upstreamHttpStatus === 'number' ? upstreamHttpStatus : undefined,
        transport: process.env.APP_ENV === 'production' ? 'tls_with_google_id_token' : 'insecure',
        invalidFields:
          error instanceof z.ZodError
            ? error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code }))
            : undefined,
      });
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'Petty Cash could not reach the employee directory. Please try again.',
      );
    }
  }
}
