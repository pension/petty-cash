import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { Actor } from '../auth/actor';
import { parse } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import { StaffDirectoryService } from '../staff-directory/staff-directory.service';
import { addAssignmentSchema, lookupSchema } from './dto/staff-assignment.dto';

@Injectable()
export class StaffAssignmentsService {
  constructor(
    private readonly db: PrismaService,
    private readonly directory: StaffDirectoryService,
  ) {}

  list() {
    return this.db.staffAssignment.findMany({
      where: { removedAt: null },
      orderBy: [{ type: 'asc' }, { addedAt: 'desc' }],
    });
  }

  lookup(body: unknown) {
    return this.directory.findByEmail(parse(lookupSchema, body).email);
  }

  private async lock(tx: Prisma.TransactionClient, type: string) {
    const rows = await tx.$queryRaw<
      { type: string }[]
    >`SELECT type FROM staff_assignment_types WHERE type = ${type} FOR UPDATE`;
    if (!rows.length)
      throw new ServiceUnavailableException('Petty Cash staff settings have not been initialized.');
  }

  async add(body: unknown, actor: Actor) {
    const data = parse(addAssignmentSchema, body);
    // Directory calls happen before the transaction; never trust browser-supplied staff details.
    const employee = await this.directory.findByEmail(data.email);
    if (employee.employeeId !== data.employeeId)
      throw new ConflictException(
        'Employee details changed. Fetch the employee again before confirming.',
      );
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, data.type);
      const existing = await tx.staffAssignment.findFirst({
        where: { type: data.type, activeEmployeeId: employee.employeeId },
      });
      if (existing)
        throw new ConflictException(`This staff member is already an active ${data.type}.`);
      return tx.staffAssignment.create({
        data: {
          id: randomUUID(),
          type: data.type,
          ...employee,
          activeEmployeeId: employee.employeeId,
          addedBy: actor.id,
          addedByName: actor.name,
        },
      });
    });
  }

  async remove(id: string, actor: Actor) {
    const assignment = await this.db.staffAssignment.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException('Petty Cash staff assignment not found.');
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, assignment.type);
      const current = await tx.staffAssignment.findUnique({ where: { id } });
      if (!current || current.removedAt)
        throw new ConflictException('This staff assignment has already been removed.');
      const remaining = await tx.staffAssignment.count({
        where: { type: current.type, removedAt: null },
      });
      if (remaining <= 1)
        throw new ConflictException(
          `At least one ${current.type} must remain. Add another staff member first.`,
        );
      return tx.staffAssignment.update({
        where: { id },
        data: {
          removedAt: new Date(),
          removedBy: actor.id,
          removedByName: actor.name,
          activeEmployeeId: null,
        },
      });
    });
  }
}
