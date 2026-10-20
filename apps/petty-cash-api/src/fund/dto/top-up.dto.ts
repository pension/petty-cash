import { z } from 'zod';
import { amount, text } from '../../common/validation';
export const TopUpSchema = z.object({
  amount,
  reference: text,
  notes: z.string().max(2000).optional(),
});
export type TopUpDto = z.infer<typeof TopUpSchema>;
