import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import type { AddAssignmentDto, LookupDto } from './dto/staff-assignment.dto';
import { StaffAssignmentsService } from './staff-assignments.service';
@Controller('staff-assignments')
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class StaffAssignmentsController {
  constructor(private readonly service: StaffAssignmentsService) {}
  @Get()
  list(@CurrentActor() actor: Actor) {
    void actor;
    return this.service.list();
  }
  @Post('lookup')
  lookup(@CurrentActor() actor: Actor, @Body() body: LookupDto) {
    void actor;
    return this.service.lookup(body);
  }
  @Post()
  add(@CurrentActor() actor: Actor, @Body() body: AddAssignmentDto) {
    return this.service.add(body, actor);
  }
  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.service.remove(id, actor);
  }
}
