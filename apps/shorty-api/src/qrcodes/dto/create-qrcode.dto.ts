import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { QR_LOGO_IDS } from '@petty-cash/qr-render';
import { cssColorSchema, httpUrlSchema } from '../../common/zod.util';

export const CreateQRCodeSchema = z.object({
  // No .min(1) — petty-cash-ui's create form doesn't validate Title before
  // submit (only longUrl is required client-side).
  title: z.string().max(120),
  longUrl: httpUrlSchema,
  color: cssColorSchema.optional(),
  bgColor: cssColorSchema.optional(),
  style: z.string().optional(),
  corner: z.string().optional(),
  overlayType: z.enum(['none', 'logo', 'text']).optional(),
  overlayText: z.string().max(4).optional(),
  // Which embedded mark to render when overlayType is 'logo' — see
  // @petty-cash/qr-render's logos.ts. buildQrSvg defaults to 'pension' (the
  // official mark) if this is missing/unrecognized, so it's optional here.
  logo: z.enum(QR_LOGO_IDS as [string, ...string[]]).nullish(),
  linkId: z.string().nullish(),
  templateId: z.string().nullish(),
  frameId: z.string().nullish(),
});

export class CreateQRCodeDto extends createZodDto(CreateQRCodeSchema) {}
