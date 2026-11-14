import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffDirectoryModule } from '../staff-directory/staff-directory.module';
import { StaffAssignmentsController } from './staff-assignments.controller';
import { StaffAssignmentsService } from './staff-assignments.service';
@Module({
  imports: [AuthModule, PrismaModule, StaffDirectoryModule],
  controllers: [StaffAssignmentsController],
  providers: [StaffAssignmentsService],
})
export class StaffAssignmentsModule {}
