import { Injectable } from '@nestjs/common';
import type { Actor } from '../auth/actor';
import { capabilities } from '../common/request-policy';
@Injectable()
export class AccessService {
  get(a: Actor) {
    return { roles: a.roles, capabilities: capabilities(a) };
  }
}
