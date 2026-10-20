import { z } from 'zod';
import { text } from '../../common/validation';
export const ResolveSchema = z.object({ resolutionNotes: text, adjustLedger: z.boolean() });
export type ResolveDto = z.infer<typeof ResolveSchema>;
