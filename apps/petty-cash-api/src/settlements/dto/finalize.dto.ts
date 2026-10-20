import { z } from 'zod';
import { denominations } from '../../common/money';
import { revision } from '../../common/validation';
export const FinalizeSchema = z.object({
  denominations: denominations.optional(),
  dynamicsReference: z.string().trim().max(100).optional(),
  ...revision,
});
export type FinalizeDto = z.infer<typeof FinalizeSchema>;
