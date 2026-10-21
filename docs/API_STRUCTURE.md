# Petty Cash API feature structure

The API follows the original project's Nest feature-folder pattern. Each folder owns its controller, service, module and input DTOs. Controllers use explicit methods; business logic lives in services. There is no shared application URL prefix or API version.

| Feature | Routes | Responsibility |
| --- | --- | --- |
| idempotency | `POST /idempotency-keys` | Server-generated UUID retry keys; no cash movement |
| access | `GET /access` | Application roles and capabilities only |
| requests | `GET/POST /requests`, `GET /requests/history`, `GET/PATCH /requests/:id` | Requests and details |
| approvals | `GET /approvals`, `POST /requests/:id/authorize`, `/reject` | GS Manager decisions |
| disbursements | `GET /finance`, `POST /requests/:id/notify-collection`, `/confirm-receipt` | Preparation and acknowledged collection |
| expenses | `POST /requests/:id/expenses`, `DELETE /requests/:id/expenses/:expenseId` | Expense evidence |
| settlements | `POST /requests/:id/settle`, `/return-for-correction`, `/finalize` | Settlement and atomic closure |
| fund | `GET /fund`, `GET /fund/transactions`, `POST /fund/top-ups` | Vault fund and ledger queries |
| vault-counts | `GET/POST /vault-counts`, `POST /vault-counts/:id/resolve` | Physical counts and discrepancy resolution |
| files | `POST /files`, `GET /files/:id` | Streaming receipt storage/retrieval |
| notifications | `GET /notifications`, `POST /notifications/:id/read`, `POST /requests/:id/reminders` | Inbox and reminders |
| statistics | `GET /stats` | Authoritative dashboard statistics |
| reports | `GET /reports/reconciliation` | Complete report data |
| ocr | `POST /ocr/receipts` | Optional Google AI suggestions from a saved fileId; 501 if unconfigured, 503 on provider failure |

## Identity and authorization

Bifrost `/me` owns identity. The UI reads the existing Midgard identity state; the API does not duplicate identity or maintain users. `/access` returns no user profile.

Business controllers use `IdentityGuard`, `EntityGuard` and `PermissionGuard`. `GET /access` and `POST /idempotency-keys` are explicit exceptions: use only `IdentityGuard` and `EntityGuard`, with no separate action permissions. Access reports the caller’s capabilities (all false when none are granted); retry keys grant no business authority. EntityGuard follows verification-api's pattern: Bifrost's active numeric `transacting_as` must match `MPAO_ENTITY_ID`. Every handler then resolves `@CurrentActor()`, through ActorPipe using Midgard controller/action permissions. The standard development permission bypass applies to route access, capabilities and allowedActions. Request ownership and state checks remain enforced. See PERMISSIONS.md.

## Dependencies and transaction ownership

HTTP feature modules import `AuthModule` for entity checks and actor resolution, plus `CommonModule` for Prisma, ledger posting, request locking/reading, audit writing, notification writing and idempotency. CommonModule does not import AuthModule: bootstrap and maintenance commands must run without Bifrost HTTP dependencies. Statistics additionally imports FundModule. Feature services do not depend on each other for workflow mutations, so there are no circular imports or `forwardRef` dependencies.

RequestWorkflowService coordinates a transaction and invokes the owning feature's operation callback. It does not dispatch business actions. Collection and finalization retain their idempotency scopes, row-lock ordering, revision checks and single transaction. The same Prisma transaction client reaches ledger, audit and notification writes. Vault-count resolution and top-ups use the shared transaction/idempotency helper directly.

Zod input schemas and inferred DTOs are stored in each feature's `dto/` folder. Shared validation primitives, pagination, decimal arithmetic, Maldives dates and wire serialization remain in `common/`.

## Commands

`src/cli.ts` creates a dedicated Nest application context. FundBootstrapService initializes the opening fund. MaintenanceService runs FilesService cleanup and NotificationsService overdue-count reminders. This context contains no HTTP controllers and does not initialize Bifrost.

## Configuration migration

- Set `MPAO_ENTITY_ID` to the verified numeric MPAO entity ID from Bifrost; the previous UUID configuration is no longer used.
- Set `NUXT_PUBLIC_API_BASE` to the API origin without `/api/float`.
- Update scheduler commands to `node dist/src/cli.js maintenance`.
- No database migration is required. Old prefixed routes and a local `/me` return 404.

### Bulk receipt confirmation

`POST /requests/:id/expenses` accepts either the existing single receipt or `{ receipts: [<receipt with fileId>], expectedVersion }`. Batches require 1–20 unique file IDs and Idempotency-Key. ExpensesService validates and locks the files in stable order, then inserts every expense in the shared request transaction. RequestWorkflowService applies idempotent replay to this batch operation. ExpensesPermissionGuard preserves Midgard checks and additionally allows addexpense permission to remove receipts, subject to the same ownership/state policy.

Bulk OCR reuses `POST /ocr/receipts` and the existing `ocr.receipt` permission. `{fileIds}` validates 1–20 unique owned ready files, then GeminiReceiptService performs one shared-prompt generation with all attachments. `{fileId}` still returns the original single-receipt payload. Bulk results carry server-mapped file IDs.

## Staff settings

StaffAssignmentsModule registers guarded `GET /staff-assignments`, `POST /staff-assignments/lookup`, `POST /staff-assignments` and `DELETE /staff-assignments/:id`. StaffDirectoryService lazily creates a common-grpc client using `COMMON_GRPC_URL` and the shared `@pension/proto` contract. Lookup and confirmation resolve active employees by work email; confirmation accepts type, email and the reviewed employeeId and re-fetches directory data outside the database transaction. Per-type row locks serialize changes and the unique active key protects duplicate assignments. AccessService reads only the verified actor's active assignment types; the CLI has no dependency on this HTTP feature or its gRPC client.
