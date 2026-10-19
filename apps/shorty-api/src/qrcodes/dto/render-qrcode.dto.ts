import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { QR_LOGO_IDS } from '@petty-cash/qr-render';
import { FRAME_TYPE_WIRE_VALUES } from '../../common/frame-type.util';
import { cssColorSchema } from '../../common/zod.util';

// Mirrors QRFrame's renderable fields, passed inline rather than looked up
// by ID — matches this endpoint's stateless "render exactly what's on
// screen" design (fgColor/style/etc. are already inline, not looked up).
const RenderFrameSchema = z.object({
  frameType: z.enum(FRAME_TYPE_WIRE_VALUES),
  frameColor: cssColorSchema.optional(),
  textColor: cssColorSchema.optional(),
  borderColor: cssColorSchema.optional(),
  qrPosition: z.enum(['center', 'top', 'bottom']).optional(),
  qrSizePercent: z.number().min(50).max(95).optional(),
  ctaText: z.string().max(60).optional(),
  customImageUrl: z.string().nullish(),
});

export const RenderQRCodeSchema = z.object({
  value: z.string().min(1).max(2048),
  fgColor: cssColorSchema.optional(),
  bgColor: cssColorSchema.optional(),
  style: z.string().optional(),
  corner: z.string().optional(),
  overlayType: z.enum(['none', 'logo', 'text']).optional(),
  overlayText: z.string().max(4).optional(),
  logo: z.enum(QR_LOGO_IDS as [string, ...string[]]).nullish(),
  frame: RenderFrameSchema.optional(),
});

export class RenderQRCodeDto extends createZodDto(RenderQRCodeSchema) {}
