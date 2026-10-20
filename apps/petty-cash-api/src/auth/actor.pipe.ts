import { Injectable, PipeTransform } from '@nestjs/common';
import { IdentityService, type AuthUser } from '@pension/midgard';
import { actorFrom } from './actor';
import { PERMISSIONS } from './permissions';

/** Use the same Midgard evaluator (including development bypass) as PermissionGuard. */
@Injectable()
export class ActorPipe implements PipeTransform {
  constructor(private readonly identity: IdentityService) {}
  transform(user: AuthUser) {
    return actorFrom(
      user,
      PERMISSIONS.filter((permission) =>
        this.identity.hasPermission(user, `${process.env.APP_NAME}.${permission}`),
      ),
    );
  }
}
