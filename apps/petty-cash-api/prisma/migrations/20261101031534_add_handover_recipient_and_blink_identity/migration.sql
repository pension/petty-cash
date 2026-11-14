-- AlterTable
ALTER TABLE `notifications` ADD COLUMN `recipient_entity_id` INTEGER UNSIGNED NULL;

-- CreateTable
CREATE TABLE `blink_identities` (
    `email` VARCHAR(254) NOT NULL,
    `blink_id` VARCHAR(100) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `notifications_recipient_entity_id_created_at_idx` ON `notifications`(`recipient_entity_id`, `created_at`);
