import { Controller, Get, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import { StatisticsService } from './statistics.service';
@Controller('stats')
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class StatisticsController {
  constructor(private readonly service: StatisticsService) {}
  @Get('')
  get(@CurrentActor() a: Actor) {
    void a;
    return this.service.stats();
  }
}
