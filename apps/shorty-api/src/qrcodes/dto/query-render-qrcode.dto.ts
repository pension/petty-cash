import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QueryRenderQRCodeSchema = z.object({
  format: z.enum(['svg', 'png']).optional().default('svg'),
});

export class QueryRenderQRCodeDto extends createZodDto(
  QueryRenderQRCodeSchema,
) {}
