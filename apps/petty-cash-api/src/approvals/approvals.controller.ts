import { Body, Controller, Get, Query, Param, Post, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import type { ListQuery } from '../common/pagination';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import { ApprovalsService } from './approvals.service';
import { type AuthorizeDto } from './dto/authorize.dto';
import { type RejectDto } from './dto/reject.dto';
@Controller()
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}
  @Get('approvals')
  list(@CurrentActor() a: Actor, @Query() q: ListQuery) {
    return this.service.list(q, a);
  }
  @Post('requests/:id/authorize')
  authorize(@CurrentActor() a: Actor, @Param('id') id: string, @Body() b: AuthorizeDto) {
    return this.service.authorize(id, b, a);
  }
  @Post('requests/:id/reject')
  reject(@CurrentActor() a: Actor, @Param('id') id: string, @Body() b: RejectDto) {
    return this.service.reject(id, b, a);
  }
}
