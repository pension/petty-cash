import { z } from 'zod';
import { revision } from '../../common/validation';
export const ConfirmReceiptSchema = z.object(revision);
export type ConfirmReceiptDto = z.infer<typeof ConfirmReceiptSchema>;
