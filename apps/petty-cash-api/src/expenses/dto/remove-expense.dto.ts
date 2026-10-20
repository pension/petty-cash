import { z } from 'zod';
import { revision } from '../../common/validation';
export const RemoveExpenseSchema = z.object(revision);
export type RemoveExpenseDto = z.infer<typeof RemoveExpenseSchema>;
