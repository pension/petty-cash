# Petty Cash permissions

The API uses Midgard IdentityGuard + PermissionGuard, with EntityGuard restricting the active organisation to MPAO. Keys are lowercase `petty-cash.<controller>.<handler>`. Authorization checks individual permissions, not role names. Bifrost owns role assignments.

`GET /access` and `POST /idempotency-keys` are explicit exceptions: use only `IdentityGuard` and `EntityGuard`, with no separate action permissions. Access reports the caller’s capabilities (all false when none are granted); retry keys grant no business authority.

`APP_ENV=development` bypasses permissions through the installed Midgard evaluator, including server capabilities and sidebar visibility. Every menu remains available locally. Staging and production must use a non-development APP_ENV. Identity, MPAO, ownership, request state and financial checks always apply.

## Role setup

Run [petty-cash-permissions.sql](sql/petty-cash-permissions.sql) against **Bifrost MySQL**, not the Petty Cash database. Verify `@mpao_organisation_id` first; `1` is the local MPAO entity, not a portable production default. Use a client that stops on errors, without `--force`.

The script upserts all 34 permission definitions and two roles:

| Role | Pages | Workflow actions |
| --- | --- | --- |
| Petty Cash Request Role | Requests, GS Approvals, History | Create/edit own requests, confirm own cash collection, add/remove receipts (including bulk and optional AI), settle, authorize/reject requests, view history and request details |
| Petty Cash Finance Role | Finance Desk, Reconciliation, Ledger, Settings | Manage requester/approver staff, prepare/notify collection, send reminders, return settlement for correction, finalize/close, record vault counts, resolve discrepancies with or without adjustment, top-ups, ledger and reconciliation reports |

Both include `requests.get`, `files.download`, `notifications.list`, `notifications.markread` and `statistics.get`. These support details, attachments, notifications and dashboard statistics. The Request role has 18 permissions; Finance has 21. A user assigned both receives the union.

The source templates are `ROLE_PERMISSION_GROUPS` in `apps/petty-cash-api/src/auth/permissions.ts`; tests compare them with SQL memberships. `permissions.json` remains the Bifrost permission-import manifest.

The script reuses each role by organisation and key (`petty-cash.request` / `petty-cash.finance`), generates a UUID in MySQL when missing, reactivates deleted definitions/links and reconciles catalog permissions on those two roles. Sequential reruns do not duplicate roles or links. The script also soft-deletes the obsolete `petty-cash.access.get` and `petty-cash.idempotency.create` definitions and their role links. Other permissions on unrelated roles and user assignments remain untouched. In particular, **the old all-permissions role remains broad**: replace its user assignments with these new roles through Bifrost to enforce the split. Refresh the affected Bifrost sessions/cache afterward. The script itself does not assign users.

Alternatively sync definitions through `/midgard/permissions/sync` or the library alias `/api/v1/midgard/permissions/sync`, then create/assign the roles using the templates. Syncing definitions does not assign permissions to roles or users.

## View permissions

The sidebar and direct page entry require the following permissions, all prefixed `petty-cash.`:

| Page | View permission | Read endpoint |
| --- | --- | --- |
| Requests | `requests.list` | `GET /requests` |
| GS Approvals | `approvals.list` | `GET /approvals` |
| Finance Desk | `disbursements.list` | `GET /finance` |
| History | `requests.history` | `GET /requests/history` |
| Reconciliation | `vaultcounts.list` | `GET /vault-counts` |
| Ledger | `fund.transactions` | `GET /fund/transactions` |

The three new permissions are `approvals.list`, `disbursements.list`, and `requests.history`. Deploy the updated catalog and role memberships alongside the API/UI changes. Existing action-only permissions do not reveal pages. Request details use `requests.get`; viewing does not grant mutations. Finance users landing on `/` are sent to their first available page, normally Finance Desk. Denied direct links show an access message without loading business data.

Approvals reads always filter pending approval; History always filters closed requests. Finance reads accept only the four desk tabs' statuses. Existing mutation URLs are unchanged. API guards enforce view and mutation permissions independently of the UI.

## Receipt permissions

`expenses.addexpense` also permits removal of an owned receipt while editable; `expenses.removeexpense` remains independently valid. The narrow ExpensesPermissionGuard subclass implements this implication. Settlement submission locks both actions until Finance returns it for correction. `files.upload` and `ocr.receipt` support receipt upload and optional AI. Atomic bulk confirmation uses `expenses.addexpense` and a server-issued retry key; obtaining the key requires identity and MPAO selection only. AI failure never blocks manual entry.

## Settings staff lists

`staffassignments.list` controls the Settings sidebar and direct route. `staffassignments.lookup`, `staffassignments.add` and `staffassignments.remove` control the corresponding operations. All four use the `petty-cash.` prefix and standard identity/entity/permission guards. The provisioning SQL grants all four to the Finance role; the Request role receives none. The role counts are 18 for Request and 21 for Finance.

`GET /access` reports only the caller’s active requester/approver eligibility alongside roles and capabilities. The frontend intersects this with permission/state/ownership-based allowed actions. Removing an assignment removes frontend action eligibility; it does not change Bifrost permissions or backend business authorization. See [staff settings](STAFF_SETTINGS.md) for rollout and setup.
