-- CreateTable
CREATE TABLE `float_fund` (
    `id` VARCHAR(40) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'MVR',
    `opening_balance` DECIMAL(14, 2) NOT NULL,
    `effective_date` DATE NOT NULL,
    `current_expected_balance` DECIMAL(14, 2) NOT NULL,
    `custodian` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `float_request` (
    `id` VARCHAR(40) NOT NULL,
    `fund_id` VARCHAR(40) NOT NULL,
    `purpose` TEXT NOT NULL,
    `department` VARCHAR(191) NOT NULL DEFAULT 'General Services',
    `requester_id` VARCHAR(100) NOT NULL,
    `requester` JSON NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'pending_approval',
    `requested_amount` DECIMAL(14, 2) NOT NULL,
    `approved_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total_cash_issued` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `estimated_closing_date` DATE NOT NULL,
    `effective_closing_date` DATE NOT NULL,
    `prepared_by` VARCHAR(191) NULL,
    `prepared_by_id` VARCHAR(191) NULL,
    `dynamics_reference` VARCHAR(191) NULL,
    `rejection_reason` TEXT NULL,
    `correction_note` TEXT NULL,
    `closed_by` VARCHAR(191) NULL,
    `closed_at` DATETIME(3) NULL,
    `last_reminder_at` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `float_request_requester_id_status_idx`(`requester_id`, `status`),
    INDEX `float_request_status_created_at_idx`(`status`, `created_at`),
    INDEX `float_request_closed_at_idx`(`closed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `float_expense` (
    `id` VARCHAR(40) NOT NULL,
    `request_id` VARCHAR(40) NOT NULL,
    `supplier_name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `invoice_number` VARCHAR(191) NOT NULL,
    `expense_date` DATE NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `description` TEXT NOT NULL,
    `file_id` VARCHAR(40) NULL,
    `ocr_extracted` BOOLEAN NOT NULL DEFAULT false,
    `ocr_confidence` INTEGER NULL,
    `verification_status` VARCHAR(191) NOT NULL DEFAULT 'submitted',
    `removed_at` DATETIME(3) NULL,
    `removed_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `float_expense_file_id_key`(`file_id`),
    INDEX `float_expense_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `float_receipt_file` (
    `id` VARCHAR(40) NOT NULL,
    `owner_id` VARCHAR(100) NOT NULL,
    `storage_key` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `content_type` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `state` VARCHAR(191) NOT NULL DEFAULT 'uploading',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `float_receipt_file_storage_key_key`(`storage_key`),
    INDEX `float_receipt_file_state_created_at_idx`(`state`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `float_cash_issuance` (
    `id` VARCHAR(40) NOT NULL,
    `request_id` VARCHAR(40) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `issued_by` VARCHAR(191) NOT NULL,
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acknowledged_by` VARCHAR(191) NOT NULL,
    `acknowledged_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `is_additional` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `float_cash_issuance_request_id_key`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `float_cash_return` (
    `id` VARCHAR(40) NOT NULL,
    `request_id` VARCHAR(40) NOT NULL,
    `expected_amount` DECIMAL(14, 2) NOT NULL,
    `actual_amount` DECIMAL(14, 2) NOT NULL,
    `difference` DECIMAL(14, 2) NOT NULL,
    `denominations` JSON NOT NULL,
    `received_by` VARCHAR(191) NOT NULL,
    `returned_by` VARCHAR(191) NOT NULL,
    `return_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acknowledged` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `float_cash_return_request_id_key`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `float_fund_transaction` (
    `sequence` INTEGER NOT NULL AUTO_INCREMENT,
    `id` VARCHAR(40) NOT NULL,
    `fund_id` VARCHAR(40) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `running_balance` DECIMAL(14, 2) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `request_id` VARCHAR(40) NULL,
    `reference` VARCHAR(191) NOT NULL,
    `recorded_by` VARCHAR(191) NOT NULL,
    `actor_id` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `operation_key` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `float_fund_transaction_id_key`(`id`),
    UNIQUE INDEX `float_fund_transaction_operation_key_key`(`operation_key`),
    INDEX `float_fund_transaction_fund_id_date_idx`(`fund_id`, `date`),
    PRIMARY KEY (`sequence`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `float_vault_count` (
    `sequence` INTEGER NOT NULL AUTO_INCREMENT,
    `id` VARCHAR(40) NOT NULL,
    `fund_id` VARCHAR(40) NOT NULL,
    `count_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expected_balance` DECIMAL(14, 2) NOT NULL,
    `actual_cash_count` DECIMAL(14, 2) NOT NULL,
    `difference` DECIMAL(14, 2) NOT NULL,
    `denominations` JSON NOT NULL,
    `counted_by` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `status` VARCHAR(191) NOT NULL,
    `resolved_by` VARCHAR(191) NULL,
    `resolved_at` DATETIME(3) NULL,
    `resolution_notes` TEXT NULL,
    `ledger_sequence` INTEGER NOT NULL,

    UNIQUE INDEX `float_vault_count_id_key`(`id`),
    PRIMARY KEY (`sequence`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `float_timeline_event` (
    `sequence` INTEGER NOT NULL AUTO_INCREMENT,
    `id` VARCHAR(40) NOT NULL,
    `request_id` VARCHAR(40) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `actor_id` VARCHAR(191) NOT NULL,
    `actor_name` VARCHAR(191) NOT NULL,
    `actor_role` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `float_timeline_event_id_key`(`id`),
    PRIMARY KEY (`sequence`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `float_voucher_counter` (
    `year` INTEGER NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `float_idempotency` (
    `id` VARCHAR(64) NOT NULL,
    `fingerprint` VARCHAR(64) NOT NULL,
    `result` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `float_notification` (
    `id` VARCHAR(40) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `recipient_id` VARCHAR(100) NULL,
    `audience` VARCHAR(191) NULL,
    `url` VARCHAR(191) NOT NULL,
    `dedupe_key` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `float_notification_dedupe_key_key`(`dedupe_key`),
    INDEX `float_notification_recipient_id_created_at_idx`(`recipient_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `float_notification_read` (
    `notification_id` VARCHAR(40) NOT NULL,
    `user_id` VARCHAR(100) NOT NULL,
    `read_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`notification_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `float_request` ADD CONSTRAINT `float_request_fund_id_fkey` FOREIGN KEY (`fund_id`) REFERENCES `float_fund`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `float_expense` ADD CONSTRAINT `float_expense_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `float_request`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `float_expense` ADD CONSTRAINT `float_expense_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `float_receipt_file`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `float_cash_issuance` ADD CONSTRAINT `float_cash_issuance_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `float_request`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `float_cash_return` ADD CONSTRAINT `float_cash_return_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `float_request`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `float_fund_transaction` ADD CONSTRAINT `float_fund_transaction_fund_id_fkey` FOREIGN KEY (`fund_id`) REFERENCES `float_fund`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `float_fund_transaction` ADD CONSTRAINT `float_fund_transaction_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `float_request`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `float_vault_count` ADD CONSTRAINT `float_vault_count_fund_id_fkey` FOREIGN KEY (`fund_id`) REFERENCES `float_fund`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `float_timeline_event` ADD CONSTRAINT `float_timeline_event_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `float_request`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `float_notification_read` ADD CONSTRAINT `float_notification_read_notification_id_fkey` FOREIGN KEY (`notification_id`) REFERENCES `float_notification`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Cash history is immutable, including for the application database account.
CREATE TRIGGER float_ledger_no_update BEFORE UPDATE ON float_fund_transaction FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Float ledger is append-only';
CREATE TRIGGER float_ledger_no_delete BEFORE DELETE ON float_fund_transaction FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Float ledger is append-only';
