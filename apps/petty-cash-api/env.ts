import 'dotenv/config';
import { parseEnv, port, z } from 'znv';
export const {
  PORT,
  MPAO_ENTITY_ID,
  FILE_STORAGE,
  STORAGE_PROJECT_ID,
  STORAGE_KEY_FILE,
  STORAGE_MEDIA_BUCKET,
  GCS_RECEIPT_BUCKET,
  NOTIFICATIONS_URL,
} = parseEnv(process.env, {
  PORT: port().default(4000),
  MPAO_ENTITY_ID: z.number().int().positive(),
  FILE_STORAGE: z.enum(['local', 'gcs']).default('gcs'),
  STORAGE_PROJECT_ID: z.string().optional(),
  STORAGE_KEY_FILE: z.string().optional(),
  STORAGE_MEDIA_BUCKET: z.string().optional(),
  GCS_RECEIPT_BUCKET: z.string().optional(),
  // External Notifications API (non-critical side channel), see
  // common/external-notifications.service.ts: Blink push (notification_type_id 7;
  // recipient resolution reuses the gRPC employee directory, StaffDirectoryService,
  // whose EmployeeDetails proto carries blink_id, @pension/proto >= 0.1.15) and
  // reminder email (notification_type_id 2; uses the recipient's own address directly).
  NOTIFICATIONS_URL: z.string().url().optional(),
});
if (FILE_STORAGE === 'gcs' && !STORAGE_MEDIA_BUCKET?.trim() && !GCS_RECEIPT_BUCKET?.trim())
  throw new Error('STORAGE_MEDIA_BUCKET is required.');
if (FILE_STORAGE === 'local' && process.env.APP_ENV !== 'development')
  throw new Error('Local receipt storage is development-only.');
