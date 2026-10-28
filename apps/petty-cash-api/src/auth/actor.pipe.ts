import { Injectable, PipeTransform } from '@nestjs/common';
import { IdentityService, type AuthUser } from '@pension/midgard';
import { isActiveRequester } from '../common/staff-eligibility';
import { PrismaService } from '../prisma/prisma.service';
import { actorFrom } from './actor';
import { PERMISSIONS } from './permissions';

/** Use the same Midgard evaluator (including development bypass) as PermissionGuard. */
@Injectable()
export class ActorPipe implements PipeTransform {
  constructor(
    private readonly identity: IdentityService,
    private readonly prisma: PrismaService,
  ) {}
  async transform(user: AuthUser) {
    const permissions = PERMISSIONS.filter((permission) =>
      this.identity.hasPermission(user, `${process.env.APP_NAME}.${permission}`),
    );
    const activeRequester = await isActiveRequester(this.prisma, user?.entity_id);
    return actorFrom(user, permissions, activeRequester);
  }
}
