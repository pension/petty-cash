import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
@Injectable()
export class NotificationWriterService {
  async create(
    tx: Prisma.TransactionClient,
    title: string,
    text: string,
    url: string,
    target: { recipientId?: string; audience?: string },
    key: string = randomUUID(),
  ) {
    await tx.notification.upsert({
      where: { dedupeKey: key },
      create: { title, text, url, ...target, dedupeKey: key },
      update: {},
    });
  }
}
