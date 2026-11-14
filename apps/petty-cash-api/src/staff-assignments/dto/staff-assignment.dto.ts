import { z } from 'zod';
export const assignmentType = z.enum(['requester', 'approver']);
export const lookupSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
});
export const addAssignmentSchema = lookupSchema.extend({
  type: assignmentType,
  employeeId: z.number().int().positive(),
});
export type LookupDto = z.infer<typeof lookupSchema>;
export type AddAssignmentDto = z.infer<typeof addAssignmentSchema>;
