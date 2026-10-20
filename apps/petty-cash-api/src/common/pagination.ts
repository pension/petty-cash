import { z } from 'zod';
export type ListQuery = {
  page?: string;
  pageSize?: string;
  status?: string;
  mine?: string;
  requesterId?: string;
  q?: string;
  sort?: string;
  order?: string;
  type?: string;
  from?: string;
  to?: string;
};
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
