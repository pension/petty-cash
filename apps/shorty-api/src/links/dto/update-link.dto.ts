import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { dateStringSchema, httpUrlSchema } from '../../common/zod.util';

// Deliberately no customBackHalf — petty-cash-ui disables that field after
// creation in both edit forms ("Modifying the backhalf is not allowed after
// creation"), so the backend never accepts changing it either.
export const UpdateLinkSchema = z.object({
  // No .min(1) — petty-cash-ui's edit forms don't stop a user from clearing
  // Title before saving.
  title: z.string().max(120).optional(),
  longUrl: httpUrlSchema.optional(),
  tags: z.array(z.string()).optional(),
  expiresAt: dateStringSchema.nullish(),
  status: z.enum(['active', 'archived']).optional(),
});

export class UpdateLinkDto extends createZodDto(UpdateLinkSchema) {}
