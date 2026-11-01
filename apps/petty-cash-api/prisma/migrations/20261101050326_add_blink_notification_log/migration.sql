-- CreateTable
CREATE TABLE `blink_notification_logs` (
    `id` VARCHAR(40) NOT NULL,
    `request_id` VARCHAR(40) NULL,
    `email` VARCHAR(254) NOT NULL,
    `body` TEXT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `error` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `blink_notification_logs_status_created_at_idx`(`status`, `created_at`),
    INDEX `blink_notification_logs_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
