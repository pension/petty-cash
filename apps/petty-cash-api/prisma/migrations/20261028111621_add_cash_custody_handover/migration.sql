-- DropForeignKey
ALTER TABLE `staff_assignments` DROP FOREIGN KEY `staff_assignments_type_fk`;

-- AlterTable
ALTER TABLE `requests` ADD COLUMN `custodian_employee_id` INTEGER UNSIGNED NULL,
    ADD COLUMN `custodian_name` VARCHAR(191) NULL,
    ADD COLUMN `pending_custodian_employee_id` INTEGER UNSIGNED NULL,
    ADD COLUMN `pending_custodian_name` VARCHAR(191) NULL,
    ADD COLUMN `pending_handover_note` TEXT NULL;

-- CreateTable
CREATE TABLE `cash_handovers` (
    `id` VARCHAR(40) NOT NULL,
    `request_id` VARCHAR(40) NOT NULL,
    `from_employee_id` INTEGER UNSIGNED NOT NULL,
    `from_name` VARCHAR(191) NOT NULL,
    `to_employee_id` INTEGER UNSIGNED NOT NULL,
    `to_name` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `accepted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cash_handovers_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cash_handovers` ADD CONSTRAINT `cash_handovers_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_assignments` ADD CONSTRAINT `staff_assignments_type_fk` FOREIGN KEY (`type`) REFERENCES `staff_assignment_types`(`type`) ON DELETE RESTRICT ON UPDATE RESTRICT;
