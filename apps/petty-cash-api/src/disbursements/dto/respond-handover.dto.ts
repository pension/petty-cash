import { z } from 'zod';
import { revision } from '../../common/validation';
export const AcceptHandoverSchema = z.object(revision);
export type AcceptHandoverDto = z.infer<typeof AcceptHandoverSchema>;
export const CancelHandoverSchema = z.object(revision);
export type CancelHandoverDto = z.infer<typeof CancelHandoverSchema>;
export const DeclineHandoverSchema = z.object(revision);
export type DeclineHandoverDto = z.infer<typeof DeclineHandoverSchema>;
