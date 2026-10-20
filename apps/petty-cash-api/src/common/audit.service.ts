import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Actor } from '../auth/actor';
@Injectable()
export class AuditService {
  async record(
    tx: Prisma.TransactionClient,
    id: string,
    a: Actor,
    type: string,
    title: string,
    description: string,
  ) {
    await tx.timelineEvent.create({
      data: {
        requestId: id,
        actorId: a.id,
        actorName: a.name,
        actorRole: a.roles.join(', '),
        type,
        title,
        description,
      },
    });
  }
}
