import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { FRAME_TYPE_WIRE_VALUES } from '../../common/frame-type.util';

export const CreateFrameSchema = z.object({
  name: z.string().min(1),
  desc: z.string().nullish(),
  frameType: z.enum(FRAME_TYPE_WIRE_VALUES).optional(),
  frameColor: z.string().optional(),
  textColor: z.string().optional(),
  borderColor: z.string().optional(),
  qrPosition: z.enum(['center', 'top', 'bottom']).optional(),
  qrSizePercent: z.number().min(50).max(95).optional(),
  ctaText: z.string().optional(),
  customImageUrl: z.string().nullish(),
});

export class CreateFrameDto extends createZodDto(CreateFrameSchema) {}
