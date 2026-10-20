import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import type { ListQuery } from '../common/pagination';
import { type SendReminderDto } from './dto/send-reminder.dto';
import { NotificationsService } from './notifications.service';
@Controller('')
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get('notifications')
  list(@CurrentActor() a: Actor, @Query() q: ListQuery) {
    return this.service.notifications(q, a);
  }
  @Post('notifications/:id/read')
  markRead(@CurrentActor() a: Actor, @Param('id') id: string) {
    return this.service.markRead(id, a);
  }
  @Post('requests/:id/reminders')
  sendReminder(@CurrentActor() a: Actor, @Param('id') id: string, @Body() b: SendReminderDto) {
    return this.service.sendReminder(id, b, a);
  }
}
