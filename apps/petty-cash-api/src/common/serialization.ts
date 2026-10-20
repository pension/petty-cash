import { Prisma } from '@prisma/client';
export type Wire<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Wire<U>[]
      : T extends object
        ? { [K in keyof T]: Wire<T[K]> }
        : T;
export function wire<T>(value: T): Wire<T> {
  if (value instanceof Prisma.Decimal) return value.toNumber() as Wire<T>;
  if (value instanceof Date) return value.toISOString() as Wire<T>;
  if (Array.isArray(value)) return value.map((v: unknown) => wire(v)) as Wire<T>;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]: [string, unknown]) => [k, wire(v)]),
    ) as Wire<T>;
  return value as Wire<T>;
}
