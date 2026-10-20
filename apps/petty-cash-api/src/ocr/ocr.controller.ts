import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import { OcrService } from './ocr.service';
@Controller('ocr')
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class OcrController {
  constructor(private readonly service: OcrService) {}
  @Post('receipts')
  receipt(@CurrentActor() a: Actor, @Body() body: unknown) {
    return this.service.receipt(body, a);
  }
}
