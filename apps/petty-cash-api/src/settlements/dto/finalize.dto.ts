import { z } from 'zod';
import { money } from '../../common/money';
import { revision } from '../../common/validation';
// Zero is a valid, explicit return amount (GS brought back no cash at all); don't reuse
// the stricter `amount` helper, which rejects exactly 0.
const returnedAmount = z
  .number()
  .finite()
  .min(0)
  .max(999999999999.99)
  .refine((n) => money(n).decimalPlaces() <= 2, 'Use at most two decimal places');
export const FinalizeSchema = z.object({
  returnedAmount: returnedAmount.optional(),
  dynamicsReference: z.string().trim().max(100).optional(),
  ...revision,
});
export type FinalizeDto = z.infer<typeof FinalizeSchema>;
