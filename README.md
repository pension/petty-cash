# MPAO Petty Cash

An internal MPAO application for GS requests, Finance disbursement and settlement, receipts, the vault ledger and reconciliation. UI: Nuxt 3 / Pinia. API: NestJS 10 / Prisma / MySQL. Authentication: Bifrost. API: unversioned feature routes (`/requests`, `/fund`, `/files`, etc.), consumed directly.

## Local setup

For the existing `docker-env` stack and `petty.pension.test`, follow [local Docker setup](docs/LOCAL_DOCKER.md). The steps below are for running directly on the host.

1. Use Node 22+ and Yarn 1.22.22. Export your package-registry `GH_PAT` without committing it.
2. `yarn install`
3. Copy each app's `.env.example` to `.env` and supply Bifrost credentials, the **verified numeric MPAO entity ID (`MPAO_ENTITY_ID`)**, and a **fresh** MySQL database. Follow [AUTH.md](AUTH.md), including the shared Redis keyspace requirements. Do not use the old Shorty database.
4. `yarn workspace petty-cash-api db:generate`
5. `yarn workspace petty-cash-api db:deploy`
6. Seed the approved initial fund (MVR 0, effective 2026-10-20, custodian Team):

```sh
yarn workspace petty-cash-api db:seed
```

The seed creates the fund and its opening ledger entry atomically. Matching reruns leave balances and transactions unchanged; different existing opening details are rejected. It creates no sample requests, users or permission assignments. For a different approved opening setup, use the explicit `fund:bootstrap` command with `FUND_OPENING_BALANCE`, `FUND_EFFECTIVE_DATE` and `FUND_CUSTODIAN` instead.

7. Register [permissions.json](permissions.json) in Bifrost and assign the appropriate MPAO roles, or use the [bulk permission and role SQL](docs/sql/petty-cash-permissions.sql). Production checks controller/action permissions; `APP_ENV=development` bypasses permissions while retaining identity, MPAO, ownership and workflow checks.
8. `yarn dev` (UI 3000, API 4000).

## Verification

```sh
yarn workspace petty-cash-ui typecheck
yarn build
yarn lint
yarn workspace petty-cash-api test --runInBand
```

Set `FLOAT_TEST_DATABASE_URL=mysql://.../float_test` for database integration tests. Use a dedicated test database; tests append activity and must never target production. Apply the same migrations to it first. Tests cover cash paths, audit immutability, concurrency, idempotency, every endpoint’s MPAO boundary, streamed bytes, bounded buffering, upload failure cleanup and retention of receipt evidence.

## Media storage

The API accepts the shared storage variables used by contribution-api:

```dotenv
FILE_STORAGE=gcs
STORAGE_PROJECT_ID=mpao-1327
STORAGE_KEY_FILE=secrets/stag-bucket.json
STORAGE_MEDIA_BUCKET=staging.mpao-1327.appspot.com
```

The key path is relative to the API process working directory. For local Docker, place it at `apps/petty-cash-api/secrets/stag-bucket.json`; the existing source mount exposes it at `/workspace/apps/petty-cash-api/secrets/stag-bucket.json`. Service-account JSON is ignored by Git and excluded from image builds. Mount credentials at runtime for deployments, or omit `STORAGE_KEY_FILE` to use the runtime service account (Application Default Credentials). `GCS_RECEIPT_BUCKET` remains a compatibility fallback; `STORAGE_MEDIA_BUCKET` takes precedence.

The current local environment retains `FILE_STORAGE=local` because the storage key has not been installed. Before switching, copy existing receipt objects from the local volume into the configured bucket using their unchanged database `storageKey` values; switching adapters does not migrate files. The bucket must keep receipts private; retrieval remains through the guarded API. The Terraform bucket resource is for provisioning a new dedicated bucket and must not be applied to recreate this existing shared media bucket.

## Deployment and maintenance

Use the separate API/UI Dockerfiles and existing Cloud Build patterns. Supply the required MPAO entity ID, Bifrost configuration, Cloud SQL connection and a private GCS bucket via environment/secret configuration. API startup fails if required access/storage configuration is absent. Configure the app service account for its receipt bucket; never make the bucket public. Use least-privilege database credentials in production.

Run `yarn workspace petty-cash-api maintenance` daily at 09:00 Indian/Maldives, or run `node dist/src/cli.js maintenance` from the API image as a scheduled Cloud Run Job. It removes unattached uploads older than 24 hours and writes one overdue vault-count notification per business day. Attached receipts are retained. See `iac/staging/maintenance.tf` for opt-in deployment resources.

Verify proxy/load-balancer request buffering is disabled for multipart traffic and upload timeouts permit a 10 MiB mobile upload. The API streams directly to GCS. Receipt retrieval is authenticated and streamed through `/files/:id`. No public download URLs.

Set server-side `GEMINI_API_KEY` to enable Google AI receipt extraction; optional `GEMINI_RECEIPT_MODEL` defaults to `gemini-3.5-flash-lite`. After upload, a progress state appears while AI checks the document and extracts vendor/date/total/invoice/item details; the editable form opens afterwards. Multiple items fill “What was bought” separated by commas. Non-bill documents or AI failures show a message and open manual entry; they never block subsequent processing. See [receipt extraction](docs/RECEIPT_AI.md). Dynamics references are entered manually. Email delivery is not enabled.

See [AGENTS.md](AGENTS.md), [backend PRD](docs/FLOAT_BACKEND_PRD.md), and [implementation checklist](docs/IMPLEMENTATION.md).

## API structure and configuration changes

Each feature has its own Nest module, controller, service and input DTOs; see [API structure](docs/API_STRUCTURE.md). Identity comes from Bifrost `/me`; the local `/access` endpoint returns roles/capabilities only. `IdentityGuard` verifies authentication and `EntityGuard` checks the active MPAO entity.

For existing configuration, replace `MPAO_ORGANISATION_UUID` with the verified numeric `MPAO_ENTITY_ID`, and set `NUXT_PUBLIC_API_BASE` to the API origin (for example `http://localhost:4000`) without `/api/float`. No database migration is required for this structural refactor. The old prefixed routes and local `/me` endpoint are intentionally unavailable.

Permission setup and bulk SQL: [PERMISSIONS.md](docs/PERMISSIONS.md). Use `APP_NAME=petty-cash`; development skips permissions through Midgard while retaining authentication, MPAO and workflow checks.

## Staff Settings

Settings manages requester and approver staff assignments using an email lookup through common-grpc. Frontend request/approval actions require active staff assignments in addition to existing permissions; backend business authorization is unchanged. See [staff settings and rollout](docs/STAFF_SETTINGS.md) for the shared proto release, gRPC configuration, additive database migration, Bifrost permissions and first-time setup. No real staff are seeded.
