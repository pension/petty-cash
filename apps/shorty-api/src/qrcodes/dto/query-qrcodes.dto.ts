import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QueryQRCodesSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export class QueryQRCodesDto extends createZodDto(QueryQRCodesSchema) {}
