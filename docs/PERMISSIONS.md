# Petty Cash permissions

The API follows contribution-api's IdentityGuard + PermissionGuard pattern, with EntityGuard restricting active organisation to MPAO. Keys are fully lowercase: `petty-cash.<controller>.<handler>`, for example `petty-cash.disbursements.notifycollection`. TypeScript class and handler names remain unchanged. Midgard discovery exposes their original casing as metadata; lowercase that metadata when comparing it with stored keys. The installed guard accepts lowercase keys through its case-insensitive comparison.

The installed library bypasses permissions when API `.env` has `APP_ENV=development`. ActorPipe uses that same evaluator, so server capabilities and UI actions also bypass permission checks locally, matching contribution-ui's development behavior. Identity, MPAO, ownership, state and financial checks remain active. Production uses Bifrost permissions. Midgard's current evaluator uses case-insensitive prefix matching; this project uses the library unchanged.

The root [permissions.json](../permissions.json) is the Bifrost import manifest, using the same app slug and controller/action keys as API discovery and SQL. Tests keep all four representations aligned.

## Bulk creation

Run [petty-cash-permissions.sql](sql/petty-cash-permissions.sql) against the **Bifrost MySQL database**, not the application's database. Verify `@mpao_organisation_id` at the top first; 1 is the verified local MPAO organisation ID, not a portable production default.

The script creates/reuses all 29 controller/action permissions, creates/reuses **Petty Cash — All Permissions**, and links all 29 permissions to it in one transaction. Rerunning the script sequentially does not duplicate permissions, the role or links. Its fixed role UUID identifies the role across reruns; it does not merge an unrelated role merely because its name matches. Soft-deleted matching definitions/links are reactivated. On the standard Bifrost case-insensitive key index, existing mixed-case definitions are normalized in place, preserving IDs and role links. No user/client assignments or credentials are created. Run with a MySQL client that stops on errors (do not use `--force`).

Assign the created role to intended MPAO users through Bifrost. Then refresh their Bifrost session/cache through the normal identity administration flow. The all-permissions role permits every API action, including approval, rejection and finalization of its holder's own requests in the appropriate state, but cannot collect another requester's cash.

Alternatively, Bifrost's client permission sync reads `/api/v1/midgard/permissions/sync`; `/midgard/permissions/sync` returns the same catalog. This is a library endpoint; business routes remain unversioned. Sync creates definitions, not role memberships.

## Department role grouping

All operational roles should receive the common read/navigation permissions: `access.get`, `requests.list`, `requests.get`, `fund.get`, `fund.transactions`, `vaultcounts.list`, `files.download`, `notifications.list`, `notifications.markread`, `statistics.get` and `reports.reconciliation`. Include `idempotency.create` for GS Staff and Finance roles so the UI can obtain server-generated financial retry keys. This permission does not authorize a cash movement; the financial endpoint still checks its own permission. Add the action permissions below (all prefixed with `petty-cash.`):

| Role | Additional permissions |
|---|---|
| GS Staff | `requests.create`, `requests.edit`, `disbursements.confirmreceipt`, `expenses.addexpense`, `expenses.removeexpense`, `settlements.settle`, `files.upload`, `ocr.receipt` |
| GS Manager | `approvals.authorize`, `approvals.reject` |
| Finance Staff | `disbursements.notifycollection`, `settlements.returnforcorrection`, `settlements.finalize`, `fund.topup`, `vaultcounts.recordcount`, `notifications.sendreminder` |
| Finance Supervisor | Finance Staff permissions plus `vaultcounts.resolve` |

Receipt extraction uses server-side GEMINI_API_KEY and requires ocr.receipt. Missing configuration (501) or provider failures (503) leave the attachment available and manual entry enabled. Changing a controller class or handler name changes the permission contract; update the catalog, SQL and Bifrost definitions together. Tests compare the live discovery catalog with the SQL and internal action inventory.

Receipt removal also accepts `petty-cash.expenses.addexpense`, so anyone eligible to add a receipt can remove one on the same request. ExpensesPermissionGuard extends Midgard's standard guard only for this implication; the existing `expenses.removeexpense` remains valid. Ownership and editable request state still apply. Bulk receipts reuse `expenses.addexpense` and the existing server-key permission, with no new catalog entry.
