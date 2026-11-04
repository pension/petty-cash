-- Store notification_logs.type as a plain string, matching every other
-- type/status discriminator column in this schema (e.g. requests.status,
-- vault_counts.status). Valid values are owned by application code,
-- see src/common/notification-type.ts.
ALTER TABLE `notification_logs` MODIFY COLUMN `type` VARCHAR(20) NOT NULL;
