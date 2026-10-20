-- Run against the Bifrost MySQL database, NOT the Petty Cash database.
-- Verify this organisation ID in the target Bifrost instance before running.
-- Local Bifrost: organisation 1 is MPAO. No user/client assignments are created.
-- Repeat-safe: reuses permission keys, the role UUID and existing role links.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET @mpao_organisation_id = 1;
SET @petty_app = 'petty-cash';
SET @petty_role_uuid = '455b24a7-3d31-4872-b6be-7faf71ff0872';

DROP TEMPORARY TABLE IF EXISTS petty_permission_catalog;
CREATE TEMPORARY TABLE petty_permission_catalog (
  subject VARCHAR(255) NOT NULL,
  action VARCHAR(255) NOT NULL,
  suffix VARCHAR(255) PRIMARY KEY
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO petty_permission_catalog (subject, action, suffix) VALUES
  ('idempotency', 'create', 'idempotency.create'),
  ('access', 'get', 'access.get'),
  ('requests', 'list', 'requests.list'),
  ('requests', 'get', 'requests.get'),
  ('requests', 'create', 'requests.create'),
  ('requests', 'edit', 'requests.edit'),
  ('approvals', 'authorize', 'approvals.authorize'),
  ('approvals', 'reject', 'approvals.reject'),
  ('disbursements', 'notifycollection', 'disbursements.notifycollection'),
  ('disbursements', 'confirmreceipt', 'disbursements.confirmreceipt'),
  ('expenses', 'addexpense', 'expenses.addexpense'),
  ('expenses', 'removeexpense', 'expenses.removeexpense'),
  ('settlements', 'settle', 'settlements.settle'),
  ('settlements', 'returnforcorrection', 'settlements.returnforcorrection'),
  ('settlements', 'finalize', 'settlements.finalize'),
  ('fund', 'get', 'fund.get'),
  ('fund', 'transactions', 'fund.transactions'),
  ('fund', 'topup', 'fund.topup'),
  ('vaultcounts', 'list', 'vaultcounts.list'),
  ('vaultcounts', 'recordcount', 'vaultcounts.recordcount'),
  ('vaultcounts', 'resolve', 'vaultcounts.resolve'),
  ('files', 'upload', 'files.upload'),
  ('files', 'download', 'files.download'),
  ('notifications', 'list', 'notifications.list'),
  ('notifications', 'markread', 'notifications.markread'),
  ('notifications', 'sendreminder', 'notifications.sendreminder'),
  ('statistics', 'get', 'statistics.get'),
  ('reports', 'reconciliation', 'reports.reconciliation'),
  ('ocr', 'receipt', 'ocr.receipt');

START TRANSACTION;

INSERT INTO permissions (uuid, subject, action, app, `key`, description, organisation_id, created_at, updated_at)
SELECT UUID(), subject, action, @petty_app, CONCAT(@petty_app, '.', suffix),
       CONCAT('Petty Cash: ', subject, ' / ', action), NULL, NOW(3), NOW(3)
FROM petty_permission_catalog
WHERE TRUE
-- Bifrost's case-insensitive key index reuses existing mixed-case definitions and links.
ON DUPLICATE KEY UPDATE subject = VALUES(subject), action = VALUES(action),
  app = VALUES(app), `key` = VALUES(`key`), description = VALUES(description),
  deleted_at = NULL, updated_at = NOW(3);

INSERT INTO roles (uuid, name, `key`, description, organisation_id, created_at, updated_at)
VALUES (@petty_role_uuid, 'Petty Cash — All Permissions', 'petty-cash.all',
        'All Petty Cash controller/action permissions. Ownership and financial controls still apply.',
        @mpao_organisation_id, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE deleted_at = NULL, updated_at = NOW(3);

SET @petty_role_id = (SELECT id FROM roles WHERE uuid = @petty_role_uuid);

-- Reactivate existing links before adding missing links.
UPDATE role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
JOIN petty_permission_catalog c ON p.`key` = CONCAT(@petty_app, '.', c.suffix)
SET rp.deleted_at = NULL, rp.updated_at = NOW(3)
WHERE rp.role_id = @petty_role_id;

INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
SELECT @petty_role_id, p.id, NOW(3), NOW(3)
FROM permissions p
JOIN petty_permission_catalog c ON p.`key` = CONCAT(@petty_app, '.', c.suffix)
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role_id = @petty_role_id AND rp.permission_id = p.id
);

COMMIT;

SELECT r.uuid, r.name, r.organisation_id, COUNT(rp.id) AS permission_count
FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id AND rp.deleted_at IS NULL
WHERE r.id = @petty_role_id
GROUP BY r.id, r.uuid, r.name, r.organisation_id;

DROP TEMPORARY TABLE petty_permission_catalog;
