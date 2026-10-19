-- CreateTable
CREATE TABLE `short_link` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `long_url` TEXT NOT NULL,
    `short_code` VARCHAR(191) NOT NULL,
    `short_url` VARCHAR(191) NOT NULL,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `tags` JSON NOT NULL,
    `expires_at` DATETIME(3) NULL,
    `status` ENUM('active', 'archived') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `short_link_short_code_key`(`short_code`),
    INDEX `short_link_status_idx`(`status`),
    INDEX `short_link_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `link_history_event` (
    `id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `by` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `link_id` VARCHAR(191) NOT NULL,

    INDEX `link_history_event_link_id_created_at_idx`(`link_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `link_destination_history` (
    `id` VARCHAR(191) NOT NULL,
    `destination_url` TEXT NOT NULL,
    `changed_by` VARCHAR(191) NOT NULL,
    `is_current` BOOLEAN NOT NULL DEFAULT true,
    `effective_from` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `link_id` VARCHAR(191) NOT NULL,

    INDEX `link_destination_history_link_id_effective_from_idx`(`link_id`, `effective_from`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qr_code` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `long_url` TEXT NOT NULL,
    `scans` INTEGER NOT NULL DEFAULT 0,
    `color` VARCHAR(191) NOT NULL DEFAULT '#000000',
    `bg_color` VARCHAR(191) NOT NULL DEFAULT '#ffffff',
    `style` VARCHAR(191) NOT NULL DEFAULT 'soft-pixel',
    `corner` VARCHAR(191) NOT NULL DEFAULT 'classic-square',
    `overlay_type` ENUM('none', 'logo', 'text') NOT NULL DEFAULT 'none',
    `overlay_text` VARCHAR(4) NULL,
    `logo` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `link_id` VARCHAR(191) NULL,
    `template_id` VARCHAR(191) NULL,
    `frame_id` VARCHAR(191) NULL,

    INDEX `qr_code_link_id_idx`(`link_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qr_template` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `desc` VARCHAR(191) NULL,
    `style` VARCHAR(191) NOT NULL DEFAULT 'soft-pixel',
    `corner` VARCHAR(191) NOT NULL DEFAULT 'classic-square',
    `fg_color` VARCHAR(191) NOT NULL DEFAULT '#000000',
    `bg_color` VARCHAR(191) NOT NULL DEFAULT '#ffffff',
    `overlay_type` ENUM('none', 'logo', 'text') NOT NULL DEFAULT 'none',
    `overlay_text` VARCHAR(191) NULL,
    `qr_frame` ENUM('bottom-label', 'top-header', 'border', 'card-box', 'custom-upload') NOT NULL DEFAULT 'bottom-label',
    `qr_frame_text` VARCHAR(191) NULL,
    `is_custom` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `frame_id` VARCHAR(191) NULL,

    INDEX `qr_template_is_custom_idx`(`is_custom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qr_frame` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `desc` VARCHAR(191) NULL,
    `frame_type` ENUM('bottom-label', 'top-header', 'border', 'card-box', 'custom-upload') NOT NULL DEFAULT 'bottom-label',
    `frame_color` VARCHAR(191) NOT NULL DEFAULT '#0f172a',
    `text_color` VARCHAR(191) NOT NULL DEFAULT '#ffffff',
    `border_color` VARCHAR(191) NOT NULL DEFAULT '#e2e8f0',
    `qr_position` ENUM('center', 'top', 'bottom') NOT NULL DEFAULT 'center',
    `qr_size_percent` INTEGER NOT NULL DEFAULT 85,
    `cta_text` VARCHAR(191) NOT NULL DEFAULT 'SCAN ME',
    `custom_image_url` TEXT NULL,
    `is_custom` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `qr_frame_is_custom_idx`(`is_custom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `engagement_event` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('click', 'scan') NOT NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` TEXT NULL,
    `referrer` TEXT NULL,
    `country_code` VARCHAR(3) NULL,
    `country_name` VARCHAR(191) NULL,
    `city_name` VARCHAR(191) NULL,
    `device_type` VARCHAR(191) NULL,
    `browser` VARCHAR(191) NULL,
    `os` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `link_id` VARCHAR(191) NULL,
    `qr_code_id` VARCHAR(191) NULL,

    INDEX `engagement_event_type_idx`(`type`),
    INDEX `engagement_event_link_id_created_at_idx`(`link_id`, `created_at`),
    INDEX `engagement_event_qr_code_id_created_at_idx`(`qr_code_id`, `created_at`),
    INDEX `engagement_event_country_code_idx`(`country_code`),
    INDEX `engagement_event_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `link_history_event` ADD CONSTRAINT `link_history_event_link_id_fkey` FOREIGN KEY (`link_id`) REFERENCES `short_link`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `link_destination_history` ADD CONSTRAINT `link_destination_history_link_id_fkey` FOREIGN KEY (`link_id`) REFERENCES `short_link`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qr_code` ADD CONSTRAINT `qr_code_link_id_fkey` FOREIGN KEY (`link_id`) REFERENCES `short_link`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qr_code` ADD CONSTRAINT `qr_code_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `qr_template`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qr_code` ADD CONSTRAINT `qr_code_frame_id_fkey` FOREIGN KEY (`frame_id`) REFERENCES `qr_frame`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qr_template` ADD CONSTRAINT `qr_template_frame_id_fkey` FOREIGN KEY (`frame_id`) REFERENCES `qr_frame`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `engagement_event` ADD CONSTRAINT `engagement_event_link_id_fkey` FOREIGN KEY (`link_id`) REFERENCES `short_link`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `engagement_event` ADD CONSTRAINT `engagement_event_qr_code_id_fkey` FOREIGN KEY (`qr_code_id`) REFERENCES `qr_code`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
