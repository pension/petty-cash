import { z } from 'zod';
import { amount, revision } from '../../common/validation';
export const NotifyCollectionSchema = z.object({
  amount,
  reason: z.string().trim().max(2000).optional(),
  ...revision,
});
export type NotifyCollectionDto = z.infer<typeof NotifyCollectionSchema>;
