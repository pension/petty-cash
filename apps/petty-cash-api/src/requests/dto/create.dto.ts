import { z } from 'zod';
import { amount, neededBy, text } from '../../common/validation';
export const CreateSchema = z.object({ purpose: text, requestedAmount: amount, neededBy });
export type CreateDto = z.infer<typeof CreateSchema>;
