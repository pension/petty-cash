import { Injectable } from '@nestjs/common';
import type { Actor } from '../auth/actor';
import { capabilities } from '../common/request-policy';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class AccessService {
  constructor(private readonly db: PrismaService) {}
  async get(a: Actor) {
    const assignments =
      Number.isSafeInteger(a.entityId) && a.entityId! > 0
        ? await this.db.staffAssignment.findMany({
            where: { employeeId: a.entityId, removedAt: null },
            select: { type: true },
          })
        : [];
    return {
      roles: a.roles,
      capabilities: capabilities(a),
      staffEligibility: {
        requester: assignments.some((row) => row.type === 'requester'),
        approver: assignments.some((row) => row.type === 'approver'),
      },
    };
  }
}
