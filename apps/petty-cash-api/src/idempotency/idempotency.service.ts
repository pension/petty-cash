import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

@Injectable()
export class IdempotencyService {
  create() {
    return { key: randomUUID() };
  }
}
