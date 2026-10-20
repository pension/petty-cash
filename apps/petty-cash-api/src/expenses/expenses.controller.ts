import { Body, Controller, Delete, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { IdentityGuard } from '@pension/midgard';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import { type CreateExpensesDto } from './dto/add-expense.dto';
import { type RemoveExpenseDto } from './dto/remove-expense.dto';
import { ExpensesPermissionGuard } from './expenses-permission.guard';
import { ExpensesService } from './expenses.service';
@Controller('requests/:id/expenses')
@UseGuards(IdentityGuard, EntityGuard, ExpensesPermissionGuard)
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}
  @Post('')
  addExpense(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: CreateExpensesDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.addExpense(id, b, a, key);
  }
  @Delete(':expenseId')
  removeExpense(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Param('expenseId') expenseId: string,
    @Body() b: RemoveExpenseDto,
  ) {
    return this.service.removeExpense(id, b, a, expenseId);
  }
}
