import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QueryAnalyticsSchema = z.object({
  range: z.enum(['7d', '30d', 'all']).optional().default('7d'),
});

export class QueryAnalyticsDto extends createZodDto(QueryAnalyticsSchema) {}
