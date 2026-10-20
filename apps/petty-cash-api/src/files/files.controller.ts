import { Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import type { Request, Response } from 'express';
import type { Actor } from '../auth/actor';
import { CurrentActor } from '../auth/current-actor.decorator';
import { EntityGuard } from '../auth/entity.guard';
import { FilesService } from './files.service';
@Controller('files')
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class FilesController {
  constructor(private readonly service: FilesService) {}
  @Post('')
  upload(@CurrentActor() a: Actor, @Req() req: Request) {
    return this.service.upload(req, a);
  }
  @Get(':id')
  download(@CurrentActor() a: Actor, @Param('id') id: string, @Res() res: Response) {
    return this.service.download(id, a, res);
  }
}
