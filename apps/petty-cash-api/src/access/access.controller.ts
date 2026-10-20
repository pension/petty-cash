import { Controller, Get, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import { AccessService } from './access.service';
@Controller('access')
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class AccessController {
  constructor(private readonly service: AccessService) {}
  @Get('')
  get(@CurrentActor() a: Actor) {
    return this.service.get(a);
  }
}
