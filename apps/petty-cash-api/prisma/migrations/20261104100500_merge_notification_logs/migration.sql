-- Consolidate per-channel notification logging into one multi-channel
-- notification_logs table, identified by a `type` enum. Rename in place to
-- preserve Blink's existing log history; no email channel has shipped yet.
RENAME TABLE `blink_notification_logs` TO `notification_logs`;

ALTER TABLE `notification_logs`
  ADD COLUMN `type` ENUM('blink', 'email') NOT NULL DEFAULT 'blink' AFTER `id`,
  ADD COLUMN `subject` VARCHAR(255) NULL AFTER `email`,
  ADD COLUMN `reply_to` VARCHAR(254) NULL AFTER `body`;

ALTER TABLE `notification_logs` ALTER COLUMN `type` DROP DEFAULT;

-- Rename/recreate indexes to match Prisma's defaults for the new table/columns.
ALTER TABLE `notification_logs` DROP INDEX `blink_notification_logs_status_created_at_idx`;
ALTER TABLE `notification_logs` ADD INDEX `notification_logs_type_status_created_at_idx` (`type`, `status`, `created_at`);
ALTER TABLE `notification_logs` RENAME INDEX `blink_notification_logs_request_id_idx` TO `notification_logs_request_id_idx`;
