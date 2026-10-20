import { ExecutionContext, Injectable } from '@nestjs/common';
import { IdentityService, PermissionGuard as MidgardPermissionGuard } from '@pension/midgard';

/** Adding receipts includes removing them; all other actions use Midgard unchanged. */
@Injectable()
// Midgard discovers guarded routes by the constructor name PermissionGuard.
// Retain that name so its permission sync includes both expense handlers.
class PermissionGuard extends MidgardPermissionGuard {
  constructor(private readonly identity: IdentityService) {
    super(identity);
  }
  canActivate(context: ExecutionContext) {
    if (super.canActivate(context)) return true;
    if (
      context.getClass().name !== 'ExpensesController' ||
      context.getHandler().name !== 'removeExpense'
    )
      return false;
    const { user } = context
      .switchToHttp()
      .getRequest<{ user: Parameters<IdentityService['hasPermission']>[0] }>();
    return this.identity.hasPermission(user, `${process.env.APP_NAME}.expenses.addexpense`);
  }
}
export { PermissionGuard as ExpensesPermissionGuard };
