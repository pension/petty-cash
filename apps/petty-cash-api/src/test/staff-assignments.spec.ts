import { ConflictException, NotFoundException } from '@nestjs/common';
import type { StaffAssignment } from '@prisma/client';
import type { Actor } from '../auth/actor';
import { PrismaService } from '../prisma/prisma.service';
import { StaffDirectoryService } from '../staff-directory/staff-directory.service';
import { StaffAssignmentsService } from '../staff-assignments/staff-assignments.service';
import { AccessService } from '../access/access.service';

const actor: Actor = {
  id: 'admin',
  entityId: 42,
  name: 'Settings admin',
  email: 'admin@example.test',
  permissions: [],
  roles: [],
};
const employee = {
  employeeId: 42,
  rcn: 'EMP-42',
  identifier: 'TEST-42',
  name: 'Directory name',
  email: 'staff@example.test',
  designation: 'Officer',
  department: 'General Services',
};
function setup() {
  const rows: StaffAssignment[] = [];
  const lock = jest
    .fn<Promise<{ type: string }[]>, [TemplateStringsArray, string]>()
    .mockResolvedValue([{ type: 'requester' }]);
  const table = {
    findMany: jest.fn(({ where }: { where: { employeeId?: number } }) =>
      Promise.resolve(
        rows.filter(
          (row) =>
            row.removedAt === null && (!where.employeeId || row.employeeId === where.employeeId),
        ),
      ),
    ),
    findFirst: jest.fn(({ where }: { where: { type: string; activeEmployeeId: number } }) =>
      Promise.resolve(
        rows.find(
          (row) => row.type === where.type && row.activeEmployeeId === where.activeEmployeeId,
        ) || null,
      ),
    ),
    findUnique: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(rows.find((row) => row.id === where.id) || null),
    ),
    count: jest.fn(({ where }: { where: { type: string } }) =>
      Promise.resolve(rows.filter((row) => row.type === where.type && !row.removedAt).length),
    ),
    create: jest.fn(({ data }: { data: StaffAssignment }) => {
      const row = {
        ...data,
        addedAt: new Date(),
        removedAt: null,
        removedBy: null,
        removedByName: null,
      };
      rows.push(row);
      return Promise.resolve(row);
    }),
    update: jest.fn(
      ({ where, data }: { where: { id: string }; data: Partial<StaffAssignment> }) => {
        const row = rows.find((row) => row.id === where.id)!;
        Object.assign(row, data);
        return Promise.resolve(row);
      },
    ),
  };
  const tx = { staffAssignment: table, $queryRaw: lock };
  const db = {
    ...tx,
    $transaction: (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
  } as unknown as PrismaService;
  const lookup = jest.fn().mockResolvedValue(employee);
  const service = new StaffAssignmentsService(db, {
    findByEmail: lookup,
  } as unknown as StaffDirectoryService);
  return { rows, lookup, service, db, lock };
}
const input = { type: 'requester', email: 'staff@example.test', employeeId: 42 };

test('lookup validates and normalizes email without persisting staff', async () => {
  const { service, lookup, rows } = setup();
  await expect(service.lookup({ email: ' STAFF@EXAMPLE.TEST ' })).resolves.toEqual(employee);
  expect(lookup).toHaveBeenCalledWith('staff@example.test');
  expect(rows).toHaveLength(0);
  expect(() => service.lookup({ email: 'invalid' })).toThrow();
});
test('confirmation refetches authoritative details, rejects identity changes and writes no staff on directory failure', async () => {
  const { service, lookup, rows } = setup();
  await expect(service.add({ ...input, employeeId: 99 }, actor)).rejects.toThrow(ConflictException);
  lookup.mockRejectedValueOnce(new NotFoundException());
  await expect(service.add(input, actor)).rejects.toThrow(NotFoundException);
  expect(rows).toHaveLength(0);
  const added = await service.add({ ...input, name: 'Forged name' }, actor);
  expect(added.name).toBe('Directory name');
});
test('duplicate prevention is per type and every mutation locks the permanent type row', async () => {
  const { service, lock, rows } = setup();
  await service.add(input, actor);
  await expect(service.add(input, actor)).rejects.toThrow(ConflictException);
  await service.add({ ...input, type: 'approver' }, actor);
  expect(rows).toHaveLength(2);
  expect(lock).toHaveBeenCalledTimes(3);
  expect(lock.mock.calls[0][0].join('?')).toContain('FOR UPDATE');
});
test.each(['requester', 'approver'])(
  'last %s cannot be removed; removed staff can be re-added with retained history',
  async (type) => {
    const { service, lookup, rows } = setup();
    const first = await service.add({ ...input, type }, actor);
    await expect(service.remove(first.id, actor)).rejects.toThrow(/At least one/);
    lookup.mockResolvedValueOnce({ ...employee, employeeId: 43 });
    await service.add({ ...input, type, employeeId: 43 }, actor);
    await service.remove(first.id, actor);
    expect(first.removedBy).toBe(actor.id);
    expect(first.removedAt).toBeInstanceOf(Date);
    expect(first.activeEmployeeId).toBeNull();
    const restored = await service.add({ ...input, type }, actor);
    expect(restored.id).not.toBe(first.id);
    expect(restored.removedAt).toBeNull();
    expect(rows).toHaveLength(3);
    await expect(service.remove(first.id, actor)).rejects.toThrow(/already been removed/);
  },
);
test('access reports only the verified person’s active assignments and leaves business permissions unchanged', async () => {
  const { service, db } = setup();
  await service.add(input, actor);
  const access = new AccessService(db);
  const result = await access.get(actor);
  expect(result.staffEligibility).toEqual({ requester: true, approver: false });
  expect(result.capabilities.createRequest).toBe(false);
  const unlisted = await access.get({ ...actor, entityId: 99, permissions: ['requests.create'] });
  expect(unlisted.staffEligibility.requester).toBe(false);
  expect(unlisted.capabilities.createRequest).toBe(true);
  expect((await access.get({ ...actor, entityId: undefined })).staffEligibility.requester).toBe(
    false,
  );
});
