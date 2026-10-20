import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesPermissionGuard } from './expenses-permission.guard';
import { ExpensesService } from './expenses.service';
@Module({
  imports: [AuthModule, CommonModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpensesPermissionGuard],
  exports: [ExpensesService],
})
export class ExpensesModule {}
