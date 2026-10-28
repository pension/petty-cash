import { z } from 'zod';
import { revision } from '../../common/validation';
export const HandOverSchema = z.object({
  toEmployeeId: z.number().int().positive(),
  note: z.string().trim().max(200).optional(),
  ...revision,
});
export type HandOverDto = z.infer<typeof HandOverSchema>;
