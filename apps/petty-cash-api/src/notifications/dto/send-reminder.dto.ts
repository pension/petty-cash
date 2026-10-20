import { z } from 'zod';
import { revision } from '../../common/validation';
export const SendReminderSchema = z.object(revision);
export type SendReminderDto = z.infer<typeof SendReminderSchema>;
