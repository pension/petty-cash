import { Controller, Header, Post, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import { EntityGuard } from '../auth/entity.guard';
import { IdempotencyService } from './idempotency.service';

@Controller('idempotency-keys')
@UseGuards(IdentityGuard, EntityGuard, PermissionGuard)
export class IdempotencyController {
  constructor(private readonly service: IdempotencyService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  create() {
    return this.service.create();
  }
}
