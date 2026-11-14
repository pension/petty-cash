CREATE TABLE `staff_assignment_types` (
  `type` VARCHAR(20) NOT NULL,
  PRIMARY KEY (`type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO `staff_assignment_types` (`type`) VALUES ('requester'), ('approver');

CREATE TABLE `staff_assignments` (
  `id` VARCHAR(40) NOT NULL,
  `type` VARCHAR(20) NOT NULL,
  `employee_id` INTEGER UNSIGNED NOT NULL,
  `active_employee_id` INTEGER UNSIGNED NULL,
  `rcn` VARCHAR(100) NULL,
  `identifier` VARCHAR(100) NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `designation` VARCHAR(191) NOT NULL,
  `department` VARCHAR(191) NOT NULL,
  `added_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `added_by` VARCHAR(100) NOT NULL,
  `added_by_name` VARCHAR(191) NOT NULL,
  `removed_at` DATETIME(3) NULL,
  `removed_by` VARCHAR(100) NULL,
  `removed_by_name` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `staff_assignments_type_active_employee_id_key` (`type`, `active_employee_id`),
  INDEX `staff_assignments_employee_id_removed_at_idx` (`employee_id`, `removed_at`),
  INDEX `staff_assignments_type_removed_at_added_at_idx` (`type`, `removed_at`, `added_at`),
  CONSTRAINT `staff_assignments_type_fk` FOREIGN KEY (`type`) REFERENCES `staff_assignment_types` (`type`),
  CONSTRAINT `staff_assignments_active_check` CHECK (
    (`removed_at` IS NULL AND `active_employee_id` IS NOT NULL AND `active_employee_id` = `employee_id`)
    OR (`removed_at` IS NOT NULL AND `active_employee_id` IS NULL)
  )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
