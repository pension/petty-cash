import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffDirectoryService } from '../staff-directory/staff-directory.service';
import { StaffAssignmentsController } from './staff-assignments.controller';
import { StaffAssignmentsService } from './staff-assignments.service';
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [StaffAssignmentsController],
  providers: [StaffDirectoryService, StaffAssignmentsService],
})
export class StaffAssignmentsModule {}
