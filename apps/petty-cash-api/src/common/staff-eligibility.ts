import type { PrismaService } from '../prisma/prisma.service';
export async function isActiveRequester(db: PrismaService, entityId?: number) {
  if (!Number.isSafeInteger(entityId) || entityId! <= 0) return false;
  return !!(await db.staffAssignment.findFirst({
    where: { type: 'requester', employeeId: entityId, removedAt: null },
    select: { type: true },
  }));
}
