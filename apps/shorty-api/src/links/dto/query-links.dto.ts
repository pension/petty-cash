import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QueryLinksSchema = z.object({
  search: z.string().optional(),
  status: z
    .enum(['all', 'active', 'expired', 'archived'])
    .optional()
    .default('all'),
  tag: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export class QueryLinksDto extends createZodDto(QueryLinksSchema) {}
