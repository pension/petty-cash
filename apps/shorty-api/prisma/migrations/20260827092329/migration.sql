/*
  Warnings:

  - You are about to drop the column `frame_id` on the `qr_template` table. All the data in the column will be lost.
  - You are about to drop the column `qr_frame` on the `qr_template` table. All the data in the column will be lost.
  - You are about to drop the column `qr_frame_text` on the `qr_template` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[link_id]` on the table `qr_code` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `qr_code` DROP FOREIGN KEY `qr_code_link_id_fkey`;

-- DropForeignKey
ALTER TABLE `qr_template` DROP FOREIGN KEY `qr_template_frame_id_fkey`;

-- DropIndex
DROP INDEX `qr_template_frame_id_fkey` ON `qr_template`;

-- AlterTable
ALTER TABLE `qr_template` DROP COLUMN `frame_id`,
    DROP COLUMN `qr_frame`,
    DROP COLUMN `qr_frame_text`;

-- CreateIndex
CREATE UNIQUE INDEX `qr_code_link_id_key` ON `qr_code`(`link_id`);

-- AddForeignKey
ALTER TABLE `qr_code` ADD CONSTRAINT `qr_code_link_id_fkey` FOREIGN KEY (`link_id`) REFERENCES `short_link`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
