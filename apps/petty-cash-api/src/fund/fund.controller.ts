import { Body, Controller, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import type { ListQuery } from '../common/pagination';
import { type TopUpDto } from './dto/top-up.dto';
import { FundService } from './fund.service';
@Controller('fund')
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class FundController {
  constructor(private readonly service: FundService) {}
  @Get('')
  get(@CurrentActor() a: Actor) {
    void a;
    return this.service.fund();
  }
  @Get('transactions')
  transactions(@CurrentActor() a: Actor, @Query() q: ListQuery) {
    void a;
    return this.service.transactions(q);
  }
  @Post('top-ups')
  topUp(@CurrentActor() a: Actor, @Body() b: TopUpDto, @Headers('idempotency-key') key?: string) {
    return this.service.topUp(b, a, key);
  }
}
