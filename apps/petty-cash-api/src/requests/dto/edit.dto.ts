import { z } from 'zod';
import { neededBy, requestAmount, revision, text } from '../../common/validation';
export const EditSchema = z.object({
  purpose: text.optional(),
  requestedAmount: requestAmount.optional(),
  neededBy: neededBy.optional(),
  ...revision,
});
export type EditDto = z.infer<typeof EditSchema>;
