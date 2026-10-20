import { z } from 'zod';
import { denominations } from '../../common/money';
export const CountSchema = z.object({ denominations, notes: z.string().max(2000).optional() });
export type CountDto = z.infer<typeof CountSchema>;
