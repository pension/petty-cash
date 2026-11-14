import { Injectable } from '@nestjs/common';
import type { Actor } from '../auth/actor';
import { capabilities } from '../common/request-policy';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class AccessService {
  constructor(private readonly db: PrismaService) {}
  async get(a: Actor) {
    const approver =
      Number.isSafeInteger(a.entityId) && a.entityId! > 0
        ? await this.db.staffAssignment.findFirst({
            where: { type: 'approver', employeeId: a.entityId, removedAt: null },
            select: { type: true },
          })
        : null;
    return {
      roles: a.roles,
      capabilities: capabilities(a),
      staffEligibility: {
        requester: a.activeRequester,
        approver: !!approver,
      },
    };
  }
}
