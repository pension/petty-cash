import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { dateStringSchema, httpUrlSchema } from '../../common/zod.util';

export const CreateLinkSchema = z.object({
  // petty-cash-ui's create form doesn't validate Title before submit (only
  // longUrl is required client-side), so this must accept an empty string
  // rather than reject it.
  title: z.string().max(120),
  longUrl: httpUrlSchema,
  customBackHalf: z
    .string()
    .regex(
      /^[a-zA-Z0-9-_]+$/,
      'Custom slug must only contain letters, numbers, dashes, and underscores',
    )
    .max(30)
    .optional(),
  tags: z.array(z.string()).optional(),
  expiresAt: dateStringSchema.nullish(),
  // Optional QRTemplate to style the auto-generated QRCode from. Omitted or
  // pointing at a deleted template both fall back to QRCode's own column
  // defaults — see LinksService.create().
  templateId: z.string().nullish(),
  // Optional QRFrame, chosen independently of templateId — frame is a
  // separate step from theme, not part of a template (see AGENTS.md).
  frameId: z.string().nullish(),
});

export class CreateLinkDto extends createZodDto(CreateLinkSchema) {}
