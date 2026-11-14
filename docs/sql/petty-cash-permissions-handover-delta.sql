-- Adds the cash custody hand-over permissions and assigns them to the existing
-- Petty Cash Request Role. Run against Bifrost MySQL, NOT the Petty Cash database.
-- Use this instead of re-running petty-cash-permissions.sql if that script was already
-- executed before these permissions existed in auth/permissions.ts.
-- Safe to re-run: upserts permission definitions and only (re)links missing/removed role links.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET @mpao_organisation_id = 1; -- verify this matches MPAO in the target Bifrost instance
SET @petty_app = 'petty-cash';

START TRANSACTION;

INSERT INTO permissions (uuid, subject, action, app, `key`, description, organisation_id, created_at, updated_at)
VALUES
  (UUID(), 'disbursements', 'handover', @petty_app, CONCAT(@petty_app, '.disbursements.handover'),
   'Petty Cash: disbursements / handover', NULL, NOW(3), NOW(3)),
  (UUID(), 'disbursements', 'accepthandover', @petty_app, CONCAT(@petty_app, '.disbursements.accepthandover'),
   'Petty Cash: disbursements / accepthandover', NULL, NOW(3), NOW(3)),
  (UUID(), 'disbursements', 'cancelhandover', @petty_app, CONCAT(@petty_app, '.disbursements.cancelhandover'),
   'Petty Cash: disbursements / cancelhandover', NULL, NOW(3), NOW(3)),
  (UUID(), 'disbursements', 'declinehandover', @petty_app, CONCAT(@petty_app, '.disbursements.declinehandover'),
   'Petty Cash: disbursements / declinehandover', NULL, NOW(3), NOW(3)),
  (UUID(), 'disbursements', 'handovercandidates', @petty_app, CONCAT(@petty_app, '.disbursements.handovercandidates'),
   'Petty Cash: disbursements / handovercandidates', NULL, NOW(3), NOW(3))
-- Bifrost's case-insensitive key index reuses an existing definition instead of erroring.
ON DUPLICATE KEY UPDATE subject = VALUES(subject), action = VALUES(action),
  app = VALUES(app), `key` = VALUES(`key`), description = VALUES(description),
  deleted_at = NULL, updated_at = NOW(3);

-- Bifrost role keys are not unique; reuse the first matching organisation role.
SET @request_role_id = (SELECT id FROM roles WHERE `key` = 'petty-cash.request'
  AND organisation_id = @mpao_organisation_id ORDER BY (deleted_at IS NULL) DESC, id LIMIT 1);

-- Create the link only where it doesn't already exist.
INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
SELECT @request_role_id, p.id, NOW(3), NOW(3)
FROM permissions p
WHERE p.`key` IN (
  CONCAT(@petty_app, '.disbursements.handover'),
  CONCAT(@petty_app, '.disbursements.accepthandover'),
  CONCAT(@petty_app, '.disbursements.cancelhandover'),
  CONCAT(@petty_app, '.disbursements.declinehandover'),
  CONCAT(@petty_app, '.disbursements.handovercandidates')
)
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role_id = @request_role_id AND rp.permission_id = p.id
);

-- If a link already exists but was previously soft-deleted, reactivate it.
UPDATE role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
SET rp.deleted_at = NULL, rp.updated_at = NOW(3)
WHERE rp.role_id = @request_role_id
  AND p.`key` IN (
    CONCAT(@petty_app, '.disbursements.handover'),
    CONCAT(@petty_app, '.disbursements.accepthandover'),
    CONCAT(@petty_app, '.disbursements.cancelhandover'),
    CONCAT(@petty_app, '.disbursements.declinehandover'),
    CONCAT(@petty_app, '.disbursements.handovercandidates')
  )
  AND rp.deleted_at IS NOT NULL;

COMMIT;

SELECT r.uuid, r.name, COUNT(rp.id) AS permission_count
FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id AND rp.deleted_at IS NULL
WHERE r.id = @request_role_id
GROUP BY r.id, r.uuid, r.name;
