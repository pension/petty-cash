import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import type { ListQuery } from '../common/pagination';
import { ReportsService } from './reports.service';
@Controller('reports')
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}
  @Get('reconciliation')
  reconciliation(@CurrentActor() a: Actor, @Query() q: ListQuery) {
    return this.service.report(q, a);
  }
}
