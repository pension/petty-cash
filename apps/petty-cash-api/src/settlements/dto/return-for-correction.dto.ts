import { z } from 'zod';
import { revision, text } from '../../common/validation';
export const ReturnForCorrectionSchema = z.object({ note: text, ...revision });
export type ReturnForCorrectionDto = z.infer<typeof ReturnForCorrectionSchema>;
