import { z } from 'zod';
import { revision } from '../../common/validation';
export const AuthorizeSchema = z.object(revision);
export type AuthorizeDto = z.infer<typeof AuthorizeSchema>;
