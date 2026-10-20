import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import { ApprovalsService } from './approvals.service';
import { type AuthorizeDto } from './dto/authorize.dto';
import { type RejectDto } from './dto/reject.dto';
@Controller('requests')
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}
  @Post(':id/authorize')
  authorize(@CurrentActor() a: Actor, @Param('id') id: string, @Body() b: AuthorizeDto) {
    return this.service.authorize(id, b, a);
  }
  @Post(':id/reject')
  reject(@CurrentActor() a: Actor, @Param('id') id: string, @Body() b: RejectDto) {
    return this.service.reject(id, b, a);
  }
}
