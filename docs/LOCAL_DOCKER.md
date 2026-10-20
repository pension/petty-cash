# Local Docker development

The services are registered in `/Users/naif/Code/Web/docker-env/docker-compose.yml`:

- UI: `http://petty.pension.test` → `petty-ui:3000`
- API: `http://petty-api.pension.test` → `petty-api:4000`
- Bifrost: browser uses `http://identity.pension.test`; API uses `http://bifrost:3001`.
- MySQL: existing `mysql` container; provision the separate `petty_cash` database before starting the API.
- Redis: existing `redis` container, Bifrost's database 4 and empty key prefix.
- MPAO: entity ID 1, verified against the local Bifrost database.

The Mac already has wildcard `.test` DNS pointing at localhost; no hosts-file edit is required. Nginx configuration is in `docker-env/nginx/sites/petty.pension.conf` and `petty-api.pension.conf`.

## Configuration

Docker-specific examples are in each application's `.env.docker.example`. Copy to that application's `.env` and supply its credentials. The API requires `DATABASE_URL`, a confidential Bifrost `CLIENT_ID`/`CLIENT_SECRET`, and the UI requires its public PKCE `CLIENT_ID`. Do not put a client secret in the UI.

Register the UI callback as `http://petty.pension.test/auth/callback` with `read:users` scope. The API's confidential client must exist in the same local Bifrost instance. Configure Petty Cash permissions for the intended MPAO users through Bifrost; client registration does not grant business roles.

Verification on 20 October 2026: both existing Dockerfiles built successfully with `target: development`, Compose and Nginx validation passed, and the restarted UI returned HTTP 200 at `petty.pension.test` using `petty-cash-ui-development:local`. Cloud Build YAML was validated; cloud production builds were not run. The API environment was subsequently configured locally. Recreating `petty-api` loaded those values, applied migrations successfully, compiled with zero errors and started Nest. An unauthenticated request to `/access` through Nginx returned 403. Authenticated business flows still require separate verification; startup alone does not verify them. On 20 October 2026 the local fund was initialized with the user-provided opening balance MVR 0.00, effective 2026-10-20, custodian Team; the opening ledger entry was verified.

## Start

Run from `docker-env` with `GH_PAT` available for private package installation:

```sh
docker compose start mysql redis bifrost nginx
docker compose build petty-api petty-ui
docker compose up -d --no-deps petty-api petty-ui
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
docker compose logs -f petty-api petty-ui
```

`petty-api` applies migrations to its configured database before starting Nest in watch mode. `petty-ui` runs Nuxt with HMR through Nginx. Source is bind-mounted; named Docker volumes isolate Linux dependencies from the Mac's node_modules. Uploaded receipts persist in `petty_receipts` and are never publicly mounted. Nginx disables request/response buffering for the API and permits multipart overhead above the API's 10 MiB file limit.

Compose selects the `development` stage in `Dockerfile.api` and `Dockerfile.ui`, producing separate API and UI images. There is no separate development Dockerfile. These stages use a BuildKit secret for the registry token; the token is not stored in development image layers. Production continues to use the final `runner` stages. Cloud Build explicitly enables BuildKit so production builds skip the independent development stage. Development stages copy only dependency manifests, the UI postinstall script, shared denominations and the Prisma schema; application environment files are supplied at runtime. After changing dependencies, rebuild and refresh only the three `petty_*node_modules` volumes; never remove MySQL or receipt volumes.

## Reload environment changes

Compose injects the API environment when the container is created. Editing `.env` and running `docker compose restart` leaves the old values in the container; they also take precedence over dotenv loading the mounted file. After changing API environment values, run from `docker-env`:

```sh
docker compose up -d --no-deps --force-recreate petty-api
```

## After schema changes

Generating Prisma Client updates code bindings; it does not create or rename database tables. After pulling schema changes and their migrations, run:

```sh
docker compose exec petty-api yarn db:deploy
docker compose exec petty-api yarn db:generate
docker compose exec petty-api yarn db:seed
docker compose restart petty-api
```

The plural-table migration renames the existing tables in place and updates indexes, foreign keys and append-only ledger triggers. Existing migration history is retained; no reset or `db push` is needed.

## Initial seed

After migrations, run from `docker-env`:

```sh
docker compose exec petty-api yarn db:seed
```

This seeds the approved initial values: **MVR 0.00**, effective **2026-10-20**, custodian **Team**. The date is deliberately fixed, so later reruns do not change the opening date. Existing matching funds and later ledger activity are retained. Conflicting opening details stop the seed. No sample transactions, users or roles are seeded.

## Opening balance

No opening balance is invented automatically. After the database is ready, provide Finance's agreed values explicitly:

```sh
docker compose exec \
  -e FUND_OPENING_BALANCE='<amount>' \
  -e FUND_EFFECTIVE_DATE='<YYYY-MM-DD>' \
  -e FUND_CUSTODIAN='<custodian>' \
  petty-api yarn fund:bootstrap
```

Matching repeats are safe. Do not point this setup at the original Shorty database or run integration tests against this development fund.

## Stop only this application

```sh
docker compose stop petty-api petty-ui
```

Avoid `docker compose down -v`: this shared Compose project contains other applications and persistent databases.
