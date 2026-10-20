import { z } from 'zod';
import { amount, neededBy, revision, text } from '../../common/validation';
export const EditSchema = z.object({
  purpose: text.optional(),
  requestedAmount: amount.optional(),
  neededBy: neededBy.optional(),
  ...revision,
});
export type EditDto = z.infer<typeof EditSchema>;
