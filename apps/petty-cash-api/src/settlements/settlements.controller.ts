import { Body, Controller, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import { type FinalizeDto } from './dto/finalize.dto';
import { type ReturnForCorrectionDto } from './dto/return-for-correction.dto';
import { type SettleDto } from './dto/settle.dto';
import { SettlementsService } from './settlements.service';
@Controller('requests')
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class SettlementsController {
  constructor(private readonly service: SettlementsService) {}
  @Post(':id/settle')
  settle(@CurrentActor() a: Actor, @Param('id') id: string, @Body() b: SettleDto) {
    return this.service.settle(id, b, a);
  }
  @Post(':id/return-for-correction')
  returnForCorrection(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: ReturnForCorrectionDto,
  ) {
    return this.service.returnForCorrection(id, b, a);
  }
  @Post(':id/finalize')
  finalize(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: FinalizeDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.finalize(id, b, a, key);
  }
}
