import { z } from 'zod';
export const ReceiptExtractionSchema = z.union([
  z.object({ fileId: z.string().uuid() }).strict(),
  z
    .object({
      fileIds: z
        .array(z.string().uuid())
        .min(1)
        .max(20)
        .refine((ids) => new Set(ids).size === ids.length, 'File IDs must be unique'),
    })
    .strict(),
]);
