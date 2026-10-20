# Petty Cash implementation and release checklist

Implemented 19 October 2026. The user-approved MPAO-only GS–Finance workflow supersedes conflicting suggestions in the archived PRDs. `AGENTS.md` is the current engineering guide; `AUTH.md` contains authentication setup.

## Implemented

- [x] Renamed standalone Nuxt/Pinia and NestJS applications; removed Shorty routes, modules, schema, migrations, QR workspace references, pages, assets and direct dependencies.
- [x] Imported the seven Petty Cash screens, components, styling and PDF layouts from ui-lab, using UI-kit 1.0.39. Added a UI-kit notification inbox, loading/access/error states and server pagination.
- [x] Unversioned feature routes without an application prefix, verified Bifrost identity boundary, exact active MPAO entity ID, four departmental permissions, ownership/state checks, and server-calculated actions.
- [x] Central lifecycle including rejection and settlement correction. Required request revisions prevent stale writes. Preparing Finance officer and acknowledging GS requester are separate audit actors.
- [x] MySQL Decimal(14,2), snake_case mappings, transactional annual vouchers, fund-row locking, append-only ledger triggers, idempotent financial actions and rollback on insufficient funds.
- [x] Collection debits once. Settlement records GS's declared cash handover from the confirmed receipt totals. Finalization atomically records counted cash/reimbursement, audit, notification and closure. Removed receipt evidence remains attached.
- [x] Explicit opening-balance command; top-ups; physical counts; supervisor discrepancy resolution preserving later ledger movements and rejecting stale adjustments.
- [x] Shared denomination definitions across the API, UI and reports, including laari. Blank forms cannot be submitted as zero counts; an explicit zero is allowed. Maldives business dates and display dates.
- [x] Busboy multipart streams through bounded prefix/size validation into private GCS, or local development storage. One file, 10 MiB maximum, JPEG/PNG/HEIC/WebP/PDF. No complete-file application buffering or production disk staging.
- [x] Protected streamed receipt retrieval, upload completion before attachment, partial-object cleanup, and repeatable maintenance for unattached files older than 24 hours. Database transactions do not span network uploads.
- [x] Persistent requester/department notifications and per-user read state; 24-hour settlement-reminder limit; daily deduplicated overdue-count reminders.
- [x] Optional Google AI receipt extraction with editable suggestions and manual fallback; clients cannot assert OCR verification.
- [x] Complete report queries, server financial totals, escaped PDF content, environment examples, separate Docker builds and opt-in private bucket / maintenance job / scheduler Terraform.

## Verification evidence

Initial implementation checks passed: **54 tests across three suites**, both application builds, Nuxt type checking, both ESLint checks, Prisma schema validation, `yarn install --frozen-lockfile`, and `git diff --check`. Terraform files were formatted; provider validation and deployment were not performed.

Automated suites live in `apps/petty-cash-api/src/test/*.spec.ts`. The financial suite uses real MySQL 8.4 in a dedicated `float_test` database; no original application database was reset. Coverage includes:

- Happy path, overspend, exact spend, cash discrepancies, ownership, roles, self-actions, stale writes, corrections and reminder limits.
- Concurrent finalization, idempotent replay/conflicting replay, insufficient-fund rollback, immutable ledger SQL triggers, subsequent ledger movements and stale count resolution.
- Every controller route rejects another active organisation before accessing business data. Unauthenticated access is denied; missing controller/action permissions are denied in production; removed and versioned routes return 404.
- Bytes reaching storage before the HTTP upload ends, concurrent slow sinks with bounded stream queues, prefix preservation, MIME mismatch, oversize multipart, truncation, disconnect and storage failure.
- Orphan cleanup while retaining the files attached to soft-removed receipts.

Browser QA used an explicitly isolated identity harness (`apps/petty-cash-api/test/visual-server.cjs`), local-only ports and the test database. It never runs in production or enters Docker images. The GS request → manager approval → Finance preparation → GS collection → streamed receipt → settlement → Finance closure flow was exercised with MVR 100 issued, MVR 60.25 spent and MVR 39.75 returned. The attachment was retrieved after a reload. The application access boundary remained active; only the external Bifrost verification boundary used synthetic identities.

Screenshot pairs in `docs/qa` cover all seven screens at 1280×900 and 390×844. Layout, typography, spacing, tables/cards and source composition were compared. No horizontal overflow was found at 390 px. Data and action visibility differ according to the authenticated role. Unrelated ui-lab search/help/feedback controls were omitted from the application shell. The design detector's remaining application finding concerns the original PDF font; the source font was deliberately preserved.

Both browser PDF renderers are wired to authoritative data and preserve the source HTML layout. Voucher rendering completed in the in-app browser, but that browser did not expose its Blob download to automation. **Downloaded PDF file inspection remains a release check in a normal supported browser.** Do not confuse successful HTML-to-canvas rendering with a verified saved PDF.

## Deployment inputs and checks still required

- [ ] Supply and verify the real numeric MPAO entity ID (`MPAO_ENTITY_ID`); register exact permissions and test actual Bifrost users for all four roles, including organisation switching.
- [ ] Supply a fresh database, run migrations, and bootstrap Finance's actual opening balance/date/custodian. Never run test commands against that database.
- [ ] Supply the private GCS bucket and service-account access. Exercise an upload/download through deployed GCS and verify proxy buffering, limits and slow-mobile timeouts.
- [ ] Configure and run the daily maintenance job. Existing service accounts also require the appropriate Secret Manager and Cloud SQL permissions. Terraform is opt-in and has not been applied.
- [ ] Confirm voucher and reconciliation PDF file downloads and inspect page layout in supported desktop/mobile browsers.
- [ ] Run staging smoke tests and record the production release decision. No deployment or real financial bootstrap was performed during implementation.

Excluded: other organisations, API versioning, multi-fund UI, email, Dynamics integration, additional cash, drafts, cancellation, date extensions and per-receipt verification.

## Feature-module refactor

The API is separated into feature modules with explicit routes and individual input DTOs. `FloatController`, `FloatService`, `FloatGuard` and the generic action dispatcher were removed. Identity stays in Bifrost `/me`; `/access` exposes only application authorization information. `EntityGuard` follows verification-api's active numeric entity check using `MPAO_ENTITY_ID`. UI configuration and receipt paths use the unprefixed routes. Maintenance/bootstrap use Nest dependency injection without an HTTP server or Bifrost connection. No schema change was required.

The expanded HTTP regression suite exercises the real module graph through request creation, approval, preparation, collection, receipt upload/download, settlement correction and finalization. Every feature route is tested against both a foreign entity and missing application permissions. External Bifrost verification is mocked; the installed Midgard permission evaluator and guard run in production-mode tests, with additional development-bypass checks.

Refactor verification passed: **83 tests across three suites**, both application builds, UI type checking, both lint checks and `git diff --check`. The dedicated maintenance command ran successfully against the isolated test database. Bootstrap accepted the same opening details twice and rejected different details without changing the fund. The obsolete redirect-HTML build asset configuration was also removed.

Browser verification repeated the complete workflow with synthetic Bifrost identities through the new feature routes: GS requested MVR 10, GS Manager approved, Finance prepared, GS collected and recorded MVR 10 in expenses, and Finance closed the request. Reload confirmed persistence. The result is captured in `docs/qa/refactor-closed-request.jpg`. These tests do not replace the real Bifrost/GCS/deployment checks above.

## Controller/action permissions — 20 October 2026

Replaced custom role-permission keys with the standard Midgard controller/action permissions, following contribution-api/contribution-ui. All 28 business handlers are discoverable through permission sync. ActorPipe uses the same evaluator for service capabilities and request actions; development bypasses permission checks, while MPAO, identity, ownership and financial constraints remain enforced. Bifrost manages role assignments.

Verified all 89 tests against isolated MySQL, including production denials and development bypass. API build, UI typecheck and both lint checks passed. The bulk SQL was executed twice against isolated copies of the actual Bifrost table definitions: 28 permissions, one role, 28 links, no duplicates. No real Bifrost permissions or user grants were changed. See PERMISSIONS.md and sql/petty-cash-permissions.sql.

## Plural database tables — 20 October 2026

Added migration `20261020000000_plural_table_names` for the user-updated table mappings. It renames all 13 existing tables, their indexes and constraints, and replaces ledger triggers without removing append-only protection. Raw SQL locking and idempotency queries use the new table names. Existing applied migrations are unchanged.

Validated migration against 3,204 existing test rows using identical ordered data hashes across all 13 tables; Prisma reported no schema drift. All 91 MySQL/authorization/streaming tests passed. Fresh migrations and repeated seeding also passed, along with API lint and type checks. Applied locally and reran the MVR 0 initial seed.

## API-generated UUIDs — 20 October 2026

Removed frontend UUID generation. Financial submissions obtain a server-generated key from `POST /idempotency-keys` and reuse it on uncertain retries. Other submissions do not request a key. Failed key acquisition releases the busy state and never submits the financial operation. The new feature uses the standard three guards; `petty-cash.idempotency.create` is included in the manifest, permission inventory and bulk role SQL (29 permissions total). Production GS Staff and Finance roles need this permission; local development retains the existing bypass.

Verified 81 API tests and four frontend regression tests, both type checks and both lint checks. The 13 MySQL integration scenarios were skipped in this run; financial transaction code and schema were unchanged. The running local Docker API discovers all 29 permissions. Frontend tests execute without a browser crypto API and cover retry-key reuse, failed key acquisition, ordinary saves and identity changes during acquisition.

## Permission-based approvals — 20 October 2026

Per the user's decision, pending requests can be authorized or rejected by their requester when they have the corresponding approval permission. The shared policy drives both API enforcement and UI button visibility. Development retains its permission bypass. Updated guidance and regression tests; all 96 API tests passed with isolated MySQL, including approval and rejection of own requests, missing permissions, and invalid workflow states. API lint and type checks passed.

## Permission-based finalization — 20 October 2026

Extended the user's permission-based rule to finalization: a requester with settlements.finalize may close their own request once it reaches pending_closure. The shared policy controls the Finance Desk and request-detail buttons and API authorization. Cash counting, transaction atomicity, idempotency and revision checks remain enforced. All 98 API tests passed against isolated MySQL, including permitted own-request closure and missing-permission rejection. API lint and type checks passed.

## Optional Google AI receipt extraction — 20 October 2026

Implemented server-side Gemini extraction from persisted, owned receipt files using streaming resumable uploads. The existing receipt modal opens immediately after upload and remains editable/savable while AI runs. Suggestions include supplier, date, MVR amount, invoice number, category and comma-separated purchased items. Manual edits take precedence; stale responses after close/reset/save are ignored. Missing configuration, permission errors, quota/provider errors, malformed responses and timeouts do not prevent manual receipt entry or settlement.

Verified the existing 98 API tests with isolated MySQL, nine additional provider/ownership/fallback tests, and nine frontend tests (including the receipt modal itself). Both applications pass lint and type checks. The configured key successfully extracted a synthetic PDF twice, including MVR 50.50 and “A4 paper, Blue pens”; the final run also extracted category. No real user receipt was sent during verification. The running Docker API reads the key and rejects unauthenticated extraction. See RECEIPT_AI.md for configuration, permissions, timeout and temporary-file cleanup behavior.

## Receipt classification and extraction feedback — 20 October 2026

Updated the receipt flow per user feedback: upload is followed by a dedicated extraction progress state, with form fields and Save hidden until extraction completes or fails. Bills, receipts and invoices open editable extracted details. Other/unknown documents show a clear message and open manual entry; no AI values from unrelated files are applied. AI failures also open manual entry. Replacing an attachment clears old AI suggestions while preserving manual edits.

The prompt now preserves exact item-description wording and pack/size notation, distinguishes description columns from unit conversion notes and payment tables, and uses invoice dates rather than generated timestamps. Verified the user-supplied invoice live as both PDF and PNG: documentType invoice, description “Onion 1X25Kg”, amount MVR 175. A synthetic agenda image returned documentType other and null receipt fields. Provider temporary files were deleted after verification; the user document was not copied into the repository.

100 API tests and 12 frontend tests passed, along with both lint/type checks and diff validation. The 13 unchanged MySQL financial integration scenarios were skipped in this run. Tests cover exact item text, document classification, progress state, hidden-form saving protection, manual fallback, stale responses and replacing attachments. This supersedes the earlier behavior allowing form entry while extraction ran.

## Bulk receipts (2026-10-20)

Implemented the Bulk Receipts button beside Add receipt, streaming selection of up to 20 attachments, two concurrent upload workers with per-file feedback and one shared AI extraction request, and an editable/removable UI-kit review table. AI failures/non-receipts retain their attachments for manual entry. Confirmation attaches the full batch in one idempotent transaction. Receipt add permission also permits removing receipts while the request is editable; settlement locks both actions and removal preserves evidence.

Verification: 116 API tests passed against the isolated MySQL test database, including a forced second-insert failure proving complete batch rollback, idempotent replay, duplicate/foreign attachments, stale revisions, permission discovery and settlement locking. All 21 UI tests passed, including concurrency/progress, failed upload retry, AI/manual fallback, cancellation, retained edits and server-key retry. Both type checks, repository lint, UI production build and API TypeScript compilation passed. Desktop (1440×1000) and mobile (390×844) checks used the real modal/UI-kit with synthetic provider/store responses; editing, removing a row and confirmation passed. Screenshots are in `docs/qa/bulk-receipts-{desktop,mobile}.png`. These browser checks did not submit real receipts or call Google AI.

Bulk extraction now sends all successful uploads together in one Gemini generation using one shared prompt. File-index validation prevents cross-file result swaps; partial upload failures are excluded and remain retryable. Batch AI failure falls back to manual entry without individual inference retries. Verified 22 OCR tests (mocked Google transport, including streaming, reordered results, malformed mapping, cleanup and truncation), all 24 UI tests, API/UI type checks and repository lint. No new route, permission or migration is required.

The bulk picker now uses the existing dashed upload-card pattern with click-to-browse and drag-and-drop. Selection and processing use the compact modal width; review expands for the editable table. Receipt details now expose stored attachment MIME type, and the sidebar chooses a PDF viewer or image preview instead of trying to render PDFs as images. Protected retrieval and the external-open fallback are retained. UI/API type checks, lint and the UI production build passed; desktop/mobile checks cover selection, drop, modal resizing and both preview types using synthetic files.

Media storage configuration now accepts the shared STORAGE_PROJECT_ID / STORAGE_KEY_FILE / STORAGE_MEDIA_BUCKET variables, with the supplied staging project and bucket recorded in the local environment and example. Service-account JSON is excluded from Git and Docker builds; deployment credentials are runtime-mounted or use ADC. The current local adapter remains active because `apps/petty-cash-api/secrets/stag-bucket.json` is absent and existing local receipts have not been migrated. No cloud bucket, IAM policy, or stored receipt was changed; live GCS access is not yet verified.
