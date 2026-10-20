-- Rename existing tables in place; preserve all records and migration history.
-- Apply with prisma migrate deploy. Do not reset or drop the database.
RENAME TABLE
  `float_fund` TO `funds`,
  `float_request` TO `requests`,
  `float_expense` TO `expenses`,
  `float_receipt_file` TO `receipt_files`,
  `float_cash_issuance` TO `cash_issuances`,
  `float_cash_return` TO `cash_returns`,
  `float_fund_transaction` TO `fund_transactions`,
  `float_vault_count` TO `vault_counts`,
  `float_timeline_event` TO `timeline_events`,
  `float_voucher_counter` TO `voucher_counters`,
  `float_idempotency` TO `idempotencies`,
  `float_notification` TO `notifications`,
  `float_notification_read` TO `notification_reads`;

-- Rename indexes to match Prisma defaults for the new table names.
ALTER TABLE `requests` RENAME INDEX `float_request_requester_id_status_idx` TO `requests_requester_id_status_idx`;
ALTER TABLE `requests` RENAME INDEX `float_request_status_created_at_idx` TO `requests_status_created_at_idx`;
ALTER TABLE `requests` RENAME INDEX `float_request_closed_at_idx` TO `requests_closed_at_idx`;
ALTER TABLE `expenses` RENAME INDEX `float_expense_file_id_key` TO `expenses_file_id_key`;
ALTER TABLE `expenses` RENAME INDEX `float_expense_request_id_idx` TO `expenses_request_id_idx`;
ALTER TABLE `receipt_files` RENAME INDEX `float_receipt_file_storage_key_key` TO `receipt_files_storage_key_key`;
ALTER TABLE `receipt_files` RENAME INDEX `float_receipt_file_state_created_at_idx` TO `receipt_files_state_created_at_idx`;
ALTER TABLE `cash_issuances` RENAME INDEX `float_cash_issuance_request_id_key` TO `cash_issuances_request_id_key`;
ALTER TABLE `cash_returns` RENAME INDEX `float_cash_return_request_id_key` TO `cash_returns_request_id_key`;
ALTER TABLE `fund_transactions` RENAME INDEX `float_fund_transaction_id_key` TO `fund_transactions_id_key`;
ALTER TABLE `fund_transactions` RENAME INDEX `float_fund_transaction_operation_key_key` TO `fund_transactions_operation_key_key`;
ALTER TABLE `fund_transactions` RENAME INDEX `float_fund_transaction_fund_id_date_idx` TO `fund_transactions_fund_id_date_idx`;
ALTER TABLE `vault_counts` RENAME INDEX `float_vault_count_id_key` TO `vault_counts_id_key`;
ALTER TABLE `timeline_events` RENAME INDEX `float_timeline_event_id_key` TO `timeline_events_id_key`;
ALTER TABLE `notifications` RENAME INDEX `float_notification_dedupe_key_key` TO `notifications_dedupe_key_key`;
ALTER TABLE `notifications` RENAME INDEX `float_notification_recipient_id_created_at_idx` TO `notifications_recipient_id_created_at_idx`;
ALTER TABLE `requests` RENAME INDEX `float_request_fund_id_fkey` TO `requests_fund_id_fkey`;
ALTER TABLE `fund_transactions` RENAME INDEX `float_fund_transaction_request_id_fkey` TO `fund_transactions_request_id_fkey`;
ALTER TABLE `timeline_events` RENAME INDEX `float_timeline_event_request_id_fkey` TO `timeline_events_request_id_fkey`;
ALTER TABLE `vault_counts` RENAME INDEX `float_vault_count_fund_id_fkey` TO `vault_counts_fund_id_fkey`;

-- MySQL updates referenced tables during RENAME TABLE. Refresh constraint names in place.
ALTER TABLE `requests` DROP FOREIGN KEY `float_request_fund_id_fkey`,
  ADD CONSTRAINT `requests_fund_id_fkey` FOREIGN KEY (`fund_id`) REFERENCES `funds`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `expenses` DROP FOREIGN KEY `float_expense_request_id_fkey`,
  ADD CONSTRAINT `expenses_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `expenses` DROP FOREIGN KEY `float_expense_file_id_fkey`,
  ADD CONSTRAINT `expenses_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `receipt_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `cash_issuances` DROP FOREIGN KEY `float_cash_issuance_request_id_fkey`,
  ADD CONSTRAINT `cash_issuances_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `cash_returns` DROP FOREIGN KEY `float_cash_return_request_id_fkey`,
  ADD CONSTRAINT `cash_returns_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fund_transactions` DROP FOREIGN KEY `float_fund_transaction_fund_id_fkey`,
  ADD CONSTRAINT `fund_transactions_fund_id_fkey` FOREIGN KEY (`fund_id`) REFERENCES `funds`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fund_transactions` DROP FOREIGN KEY `float_fund_transaction_request_id_fkey`,
  ADD CONSTRAINT `fund_transactions_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vault_counts` DROP FOREIGN KEY `float_vault_count_fund_id_fkey`,
  ADD CONSTRAINT `vault_counts_fund_id_fkey` FOREIGN KEY (`fund_id`) REFERENCES `funds`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `timeline_events` DROP FOREIGN KEY `float_timeline_event_request_id_fkey`,
  ADD CONSTRAINT `timeline_events_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `notification_reads` DROP FOREIGN KEY `float_notification_read_notification_id_fkey`,
  ADD CONSTRAINT `notification_reads_notification_id_fkey` FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- The old triggers follow the renamed ledger table. Install replacements first,
-- so append-only protection remains active throughout the migration.
CREATE TRIGGER fund_transactions_no_update BEFORE UPDATE ON fund_transactions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Petty Cash ledger is append-only';
CREATE TRIGGER fund_transactions_no_delete BEFORE DELETE ON fund_transactions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Petty Cash ledger is append-only';
DROP TRIGGER float_ledger_no_update;
DROP TRIGGER float_ledger_no_delete;
