import { Body, Controller, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import { DisbursementsService } from './disbursements.service';
import { type ConfirmReceiptDto } from './dto/confirm-receipt.dto';
import { type NotifyCollectionDto } from './dto/notify-collection.dto';
@Controller('requests')
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class DisbursementsController {
  constructor(private readonly service: DisbursementsService) {}
  @Post(':id/notify-collection')
  notifyCollection(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: NotifyCollectionDto,
  ) {
    return this.service.notifyCollection(id, b, a);
  }
  @Post(':id/confirm-receipt')
  confirmReceipt(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: ConfirmReceiptDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.confirmReceipt(id, b, a, key);
  }
}
