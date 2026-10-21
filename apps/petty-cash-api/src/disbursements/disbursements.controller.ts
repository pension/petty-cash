import { Body, Controller, Get, Query, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import type { ListQuery } from '../common/pagination';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import { DisbursementsService } from './disbursements.service';
import { type ConfirmReceiptDto } from './dto/confirm-receipt.dto';
import { type NotifyCollectionDto } from './dto/notify-collection.dto';
@Controller()
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class DisbursementsController {
  constructor(private readonly service: DisbursementsService) {}
  @Get('finance')
  list(@CurrentActor() a: Actor, @Query() q: ListQuery) {
    return this.service.list(q, a);
  }
  @Post('requests/:id/notify-collection')
  notifyCollection(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: NotifyCollectionDto,
  ) {
    return this.service.notifyCollection(id, b, a);
  }
  @Post('requests/:id/confirm-receipt')
  confirmReceipt(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: ConfirmReceiptDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.confirmReceipt(id, b, a, key);
  }
}
