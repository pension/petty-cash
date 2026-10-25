import { z } from 'zod';
import { neededBy, requestAmount, text } from '../../common/validation';
export const CreateSchema = z.object({ purpose: text, requestedAmount: requestAmount, neededBy });
export type CreateDto = z.infer<typeof CreateSchema>;
