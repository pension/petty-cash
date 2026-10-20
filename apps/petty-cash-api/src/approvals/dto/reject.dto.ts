import { z } from 'zod';
import { revision } from '../../common/validation';
export const RejectSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
  ...revision,
});
export type RejectDto = z.infer<typeof RejectSchema>;
