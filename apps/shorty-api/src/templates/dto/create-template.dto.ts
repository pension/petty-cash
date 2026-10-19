import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { QR_LOGO_IDS } from '@petty-cash/qr-render';
import { cssColorSchema } from '../../common/zod.util';

export const CreateTemplateSchema = z.object({
  name: z.string().min(1),
  desc: z.string().nullish(),
  style: z.string().optional(),
  corner: z.string().optional(),
  fgColor: cssColorSchema.optional(),
  bgColor: cssColorSchema.optional(),
  overlayType: z.enum(['none', 'logo', 'text']).optional(),
  // Templates apply their overlayText straight onto a QRCode's own
  // overlayText (see LinksService.create()), which is @db.VarChar(4) — cap
  // it here too so a template can't silently hold a value that gets
  // truncated (or worse) whenever it's actually applied.
  overlayText: z.string().max(4).nullish(),
  // Which mark to apply when overlayType is 'logo' — copied straight onto
  // the QRCode's own logo the same way overlayType/overlayText are (see
  // LinksService.create()).
  logo: z.enum(QR_LOGO_IDS as [string, ...string[]]).nullish(),
});

export class CreateTemplateDto extends createZodDto(CreateTemplateSchema) {}
