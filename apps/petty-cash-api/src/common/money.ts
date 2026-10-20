import denominationsList from '@petty-cash/denominations';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
export const money = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);
export const DENOMINATIONS: Record<string, string> = Object.fromEntries(
  denominationsList.map((d) => [d.key, money(d.minorUnits).div(100).toString()]),
);
export const denominations = z
  .record(z.number().int().min(0).max(1000000))
  .refine(
    (v) => Object.keys(v).length > 0,
    'Enter a denomination count, including zero for an empty vault',
  )
  .refine((v) => Object.keys(v).every((k) => k in DENOMINATIONS), 'Unknown denomination');
export const countTotal = (counts: Record<string, number>) =>
  Object.entries(counts).reduce(
    (sum, [key, n]) => sum.add(money(DENOMINATIONS[key]).mul(n)),
    money(0),
  );
