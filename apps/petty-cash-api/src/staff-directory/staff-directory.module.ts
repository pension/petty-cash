import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { COMMON_SERVICE_NAME } from '@pension/proto/dist/common/common.pb';
import { createCommonGrpcOptions } from './common-grpc.options';
import { StaffDirectoryService } from './staff-directory.service';

@Module({
  imports: [
    ClientsModule.registerAsync({
      clients: [{ name: COMMON_SERVICE_NAME, useFactory: createCommonGrpcOptions }],
    }),
  ],
  providers: [StaffDirectoryService],
  exports: [StaffDirectoryService],
})
export class StaffDirectoryModule {}
