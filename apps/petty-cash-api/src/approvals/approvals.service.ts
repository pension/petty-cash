import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Actor } from '../auth/actor';
import { RequestWorkflowService } from '../common/request-workflow.service';
import { parse } from '../common/validation';
import { AuthorizeSchema } from './dto/authorize.dto';
import { RejectSchema } from './dto/reject.dto';
@Injectable()
export class ApprovalsService {
  constructor(private readonly workflow: RequestWorkflowService) {}
  async authorize(id: string, body: unknown, a: Actor) {
    const d = parse(AuthorizeSchema, body);
    return this.workflow.run(id, 'authorize', d, a, () => {
      const update: Prisma.FloatRequestUpdateInput = {};
      update.status = 'pending_finance';
      const type = 'approved';
      const title = 'Approved by Manager';
      const description = a.name;
      return { update, type, title, description };
    });
  }
  async reject(id: string, body: unknown, a: Actor) {
    const d = parse(RejectSchema, body);
    return this.workflow.run(id, 'reject', d, a, () => {
      const update: Prisma.FloatRequestUpdateInput = {};
      update.status = 'rejected';
      update.rejectionReason = d.reason || 'Rejected by GS.';
      const type = 'rejected';
      const title = 'Request Rejected';
      const description = String(update.rejectionReason);
      return { update, type, title, description };
    });
  }
}
