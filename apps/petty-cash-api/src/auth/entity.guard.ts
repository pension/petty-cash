import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthUser } from '@pension/midgard';

/** Same entity boundary as verification-api: validate Bifrost's active entity, not memberships. */
@Injectable()
export class EntityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const allowedEntityId = Number(process.env.MPAO_ENTITY_ID);
    if (
      !Number.isSafeInteger(allowedEntityId) ||
      allowedEntityId <= 0 ||
      request.user?.transacting_as !== allowedEntityId
    ) {
      throw new ForbiddenException({
        message: 'Access denied: Invalid entity. Select MPAO.',
        code: 'MPAO_ENTITY_REQUIRED',
      });
    }
    return true;
  }
}
