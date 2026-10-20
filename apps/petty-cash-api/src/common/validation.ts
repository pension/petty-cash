import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { today } from './dates';
import { money } from './money';
export const amount = z
  .number()
  .finite()
  .positive()
  .max(999999999999.99)
  .refine((n) => money(n).decimalPlaces() <= 2, 'Use at most two decimal places');
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
    'Invalid date',
  );
export const neededBy = date.refine((s) => s >= today(), 'Needed by must be today or later');
export const text = z.string().trim().min(1).max(2000);
export function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BadRequestException({
      message: result.error.issues
        .map((issue) => `${issue.path.join('.') || 'Request'}: ${issue.message}`)
        .join('; '),
      errors: result.error.flatten().fieldErrors,
      statusCode: 400,
    });
  return result.data as z.infer<T>;
}
export const revision = { expectedVersion: z.number().int().positive() };
