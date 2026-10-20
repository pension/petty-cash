import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@pension/midgard';
import { ActorPipe } from './actor.pipe';

const VerifiedUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
export const CurrentActor = () => VerifiedUser(ActorPipe);
