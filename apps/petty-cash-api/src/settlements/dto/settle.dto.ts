import { z } from 'zod';
import { revision } from '../../common/validation';
export const SettleSchema = z.object(revision);
export type SettleDto = z.infer<typeof SettleSchema>;
