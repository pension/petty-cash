import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import type { ListQuery } from '../common/pagination';
import { type CreateDto } from './dto/create.dto';
import { type EditDto } from './dto/edit.dto';
import { RequestsService } from './requests.service';
@Controller('requests')
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class RequestsController {
  constructor(private readonly service: RequestsService) {}
  @Get('')
  list(@CurrentActor() a: Actor, @Query() q: ListQuery) {
    return this.service.list(q, a);
  }
  @Get(':id')
  get(@CurrentActor() a: Actor, @Param('id') id: string) {
    return this.service.get(id, a);
  }
  @Post('')
  create(@CurrentActor() a: Actor, @Body() b: CreateDto) {
    return this.service.create(b, a);
  }
  @Patch(':id')
  edit(@CurrentActor() a: Actor, @Param('id') id: string, @Body() b: EditDto) {
    return this.service.edit(id, b, a);
  }
}
