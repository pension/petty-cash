import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import type { ListQuery } from '../common/pagination';
import { type CountDto } from './dto/count.dto';
import { type ResolveDto } from './dto/resolve.dto';
import { VaultCountsService } from './vault-counts.service';
@Controller('vault-counts')
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class VaultCountsController {
  constructor(private readonly service: VaultCountsService) {}
  @Get('')
  list(@CurrentActor() a: Actor, @Query() q: ListQuery) {
    void a;
    return this.service.counts(q);
  }
  @Post('')
  recordCount(@CurrentActor() a: Actor, @Body() b: CountDto) {
    return this.service.recordCount(b, a);
  }
  @Post(':id/resolve')
  resolve(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: ResolveDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.resolve(id, b, a, key);
  }
}
