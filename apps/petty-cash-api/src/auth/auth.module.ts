import { Module } from '@nestjs/common';
import { ActorPipe } from './actor.pipe';
import { EntityGuard } from './entity.guard';
@Module({ providers: [EntityGuard, ActorPipe], exports: [EntityGuard, ActorPipe] })
export class AuthModule {}
