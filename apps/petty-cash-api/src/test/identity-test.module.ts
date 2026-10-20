import { Global, Module } from '@nestjs/common';
import { IdentityService, type AuthUser } from '@pension/midgard';

/** Exercise the installed evaluator without connecting to Bifrost/Redis in tests. */
@Global()
@Module({
  providers: [
    {
      provide: IdentityService,
      useValue: {
        hasPermission: (user: AuthUser, permission: string) =>
          IdentityService.prototype.hasPermission(user, permission),
      },
    },
  ],
  exports: [IdentityService],
})
export class IdentityTestModule {}
