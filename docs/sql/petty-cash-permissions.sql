-- Run against the Bifrost MySQL database, NOT the Petty Cash database.
-- Verify this organisation ID in the target Bifrost instance before running.
-- Local Bifrost: organisation 1 is MPAO. No user/client assignments are created.
-- Repeat-safe: reuses permission keys, the role UUID and existing role links.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET @mpao_organisation_id = 1;
SET @petty_app = 'petty-cash';
-- Existing roles/assignments are preserved except for the two retired helper permissions.
-- Assign these roles through Bifrost; remove obsolete broad role assignments there.
DROP TEMPORARY TABLE IF EXISTS petty_permission_catalog;
CREATE TEMPORARY TABLE petty_permission_catalog (
  subject VARCHAR(255) NOT NULL,
  action VARCHAR(255) NOT NULL,
  suffix VARCHAR(255) PRIMARY KEY,
  request_role BOOLEAN NOT NULL,
  finance_role BOOLEAN NOT NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO petty_permission_catalog (subject, action, suffix, request_role, finance_role) VALUES
  ('staffassignments', 'list', 'staffassignments.list', 0, 1),
  ('staffassignments', 'lookup', 'staffassignments.lookup', 0, 1),
  ('staffassignments', 'add', 'staffassignments.add', 0, 1),
  ('staffassignments', 'remove', 'staffassignments.remove', 0, 1),
  ('requests', 'list', 'requests.list', 1, 0),
  ('requests', 'get', 'requests.get', 1, 1),
  ('requests', 'create', 'requests.create', 1, 0),
  ('requests', 'edit', 'requests.edit', 1, 0),
  ('approvals', 'authorize', 'approvals.authorize', 1, 0),
  ('approvals', 'reject', 'approvals.reject', 1, 0),
  ('disbursements', 'notifycollection', 'disbursements.notifycollection', 0, 1),
  ('disbursements', 'confirmreceipt', 'disbursements.confirmreceipt', 1, 0),
  ('expenses', 'addexpense', 'expenses.addexpense', 1, 0),
  ('expenses', 'removeexpense', 'expenses.removeexpense', 1, 0),
  ('settlements', 'settle', 'settlements.settle', 1, 0),
  ('settlements', 'returnforcorrection', 'settlements.returnforcorrection', 0, 1),
  ('settlements', 'finalize', 'settlements.finalize', 0, 1),
  ('fund', 'get', 'fund.get', 0, 1),
  ('fund', 'transactions', 'fund.transactions', 0, 1),
  ('fund', 'topup', 'fund.topup', 0, 1),
  ('vaultcounts', 'list', 'vaultcounts.list', 0, 1),
  ('vaultcounts', 'recordcount', 'vaultcounts.recordcount', 0, 1),
  ('vaultcounts', 'resolve', 'vaultcounts.resolve', 0, 1),
  ('files', 'upload', 'files.upload', 1, 0),
  ('files', 'download', 'files.download', 1, 1),
  ('notifications', 'list', 'notifications.list', 1, 1),
  ('notifications', 'markread', 'notifications.markread', 1, 1),
  ('notifications', 'sendreminder', 'notifications.sendreminder', 0, 1),
  ('statistics', 'get', 'statistics.get', 1, 1),
  ('reports', 'reconciliation', 'reports.reconciliation', 0, 1),
  ('ocr', 'receipt', 'ocr.receipt', 1, 0),
  ('requests', 'history', 'requests.history', 1, 1),
  ('approvals', 'list', 'approvals.list', 1, 0),
  ('disbursements', 'list', 'disbursements.list', 0, 1);

START TRANSACTION;

-- These helper endpoints require identity and MPAO selection, not action permissions.
-- Retire previously provisioned definitions and their links without deleting history.
UPDATE role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
SET rp.deleted_at = NOW(3), rp.updated_at = NOW(3)
WHERE p.`key` IN ('petty-cash.access.get', 'petty-cash.idempotency.create')
  AND rp.deleted_at IS NULL;
UPDATE permissions
SET deleted_at = NOW(3), updated_at = NOW(3)
WHERE `key` IN ('petty-cash.access.get', 'petty-cash.idempotency.create')
  AND deleted_at IS NULL;

INSERT INTO permissions (uuid, subject, action, app, `key`, description, organisation_id, created_at, updated_at)
SELECT UUID(), subject, action, @petty_app, CONCAT(@petty_app, '.', suffix),
       CONCAT('Petty Cash: ', subject, ' / ', action), NULL, NOW(3), NOW(3)
FROM petty_permission_catalog
WHERE TRUE
-- Bifrost's case-insensitive key index reuses existing mixed-case definitions and links.
ON DUPLICATE KEY UPDATE subject = VALUES(subject), action = VALUES(action),
  app = VALUES(app), `key` = VALUES(`key`), description = VALUES(description),
  deleted_at = NULL, updated_at = NOW(3);

-- Bifrost role keys are not unique. Reuse the first matching organisation role,
-- including a previously deleted role; generate UUIDs in MySQL only when absent.
SET @request_role_uuid = COALESCE((SELECT uuid FROM roles WHERE `key` = 'petty-cash.request'
  AND organisation_id = @mpao_organisation_id ORDER BY (deleted_at IS NULL) DESC, id LIMIT 1), UUID());
SET @finance_role_uuid = COALESCE((SELECT uuid FROM roles WHERE `key` = 'petty-cash.finance'
  AND organisation_id = @mpao_organisation_id ORDER BY (deleted_at IS NULL) DESC, id LIMIT 1), UUID());

INSERT INTO roles (uuid, name, `key`, description, organisation_id, created_at, updated_at)
VALUES
  (@request_role_uuid, 'Petty Cash Request Role', 'petty-cash.request',
   'Requests, collection, receipts, settlement, GS authorization and history.', @mpao_organisation_id, NOW(3), NOW(3)),
  (@finance_role_uuid, 'Petty Cash Finance Role', 'petty-cash.finance',
   'Finance Desk, vault counts, discrepancy resolution, ledger and reports.', @mpao_organisation_id, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description),
  deleted_at = NULL, updated_at = NOW(3);

-- Resolve the reused or newly generated UUIDs.
SET @request_role_id = (SELECT id FROM roles WHERE uuid = @request_role_uuid);
SET @finance_role_id = (SELECT id FROM roles WHERE uuid = @finance_role_uuid);

-- Reconcile only this application's catalog links on these two managed roles.
UPDATE role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
JOIN petty_permission_catalog c ON p.`key` = CONCAT(@petty_app, '.', c.suffix)
SET rp.deleted_at = CASE
      WHEN (rp.role_id = @request_role_id AND c.request_role) OR (rp.role_id = @finance_role_id AND c.finance_role)
      THEN NULL ELSE NOW(3) END,
    rp.updated_at = NOW(3)
WHERE rp.role_id IN (@request_role_id, @finance_role_id);

INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
SELECT roles_to_link.role_id, p.id, NOW(3), NOW(3)
FROM (
  SELECT @request_role_id AS role_id, 'request' AS role_kind
  UNION ALL SELECT @finance_role_id, 'finance'
) roles_to_link
JOIN petty_permission_catalog c ON (roles_to_link.role_kind = 'request' AND c.request_role)
  OR (roles_to_link.role_kind = 'finance' AND c.finance_role)
JOIN permissions p ON p.`key` = CONCAT(@petty_app, '.', c.suffix)
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles_to_link.role_id AND rp.permission_id = p.id
);

COMMIT;

SELECT r.uuid, r.name, r.organisation_id, COUNT(rp.id) AS permission_count
FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id AND rp.deleted_at IS NULL
WHERE r.id IN (@request_role_id, @finance_role_id)
GROUP BY r.id, r.uuid, r.name, r.organisation_id;

DROP TEMPORARY TABLE petty_permission_catalog;
