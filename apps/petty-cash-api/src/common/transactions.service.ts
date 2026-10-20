import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { Actor } from '../auth/actor';
import { PrismaService } from '../prisma/prisma.service';
import { wire, type Wire } from './serialization';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
@Injectable()
export class TransactionsService {
  constructor(private readonly db: PrismaService) {}
  async run<T>(
    a: Actor,
    scope: string,
    key: string | undefined,
    body: unknown,
    fn: (tx: Prisma.TransactionClient, operationKey: string) => Promise<T>,
  ) {
    if (!key || key.length > 150)
      throw new BadRequestException('A valid Idempotency-Key header is required.');
    const id = hash(`${a.id}:${scope}:${key}`),
      fingerprint = hash(JSON.stringify(body));
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`INSERT IGNORE INTO idempotencies (id,fingerprint,created_at) VALUES (${id},${fingerprint},NOW())`;
        await tx.$queryRaw`SELECT id FROM idempotencies WHERE id = ${id} FOR UPDATE`;
        const saved = await tx.idempotencyRecord.findUniqueOrThrow({
          where: { id },
        });
        if (saved.fingerprint !== fingerprint)
          throw new ConflictException('Idempotency key was already used with different details.');
        if (saved.result) return saved.result as Wire<T>;
        const result = wire(await fn(tx, id));
        await tx.idempotencyRecord.update({
          where: { id },
          data: { result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue },
        });
        return result;
      },
      { timeout: 15000 },
    );
  }
}
