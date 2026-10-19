# Auth Implementation Guide (Bifrost)

How to wire up authentication against `bifrost` on a **fresh** Nuxt + NestJS project, direct-HTTP (no gateway/BFF like `siraathu`), written from an actual from-scratch implementation on `petty-cash-ui`/`petty-cash-api`. Every gotcha below was hit for real, not theorized — this is the order that avoids them.

App-specific business logic does **not** belong here — see `AGENTS.md` for that. This file is auth only.

## The pieces

- **`bifrost`** — the org's OAuth2 authorization server (NestJS + Prisma/MySQL, custom-built, not a library). Issues and validates tokens for every app in the org.
- **`@pension/midgard`** — the backend auth client (NestJS). Guards that validate bearer tokens against bifrost.
- **`@pension/midgard-nuxt`** — the frontend auth client (Nuxt). Login, token storage, org selection, permission checks.
- **`bifrost-ui`**, **`payouts-ui`/`payouts-api`**, **`pcs-ui`/`pcs-api`** — existing direct-HTTP consumers (no gateway) worth cross-referencing when something here seems off; `payouts-ui`'s `layouts/main.vue` in particular is the template the org-selection section below is copied from.

## How bifrost auth works

- Protocol: OAuth2 **authorization code + PKCE (S256)** for user-facing login, plus **client_credentials** (server-to-server) and **refresh_token** grants. It exposes an OIDC-shaped discovery doc at `.well-known/openid-configuration`, but it's *not* real OIDC — no signed `id_token`; `/me` is a plain REST "who am I" endpoint.
- Key endpoints: `GET /authorize` (consent, session-authenticated), `POST /token` (exchanges `code`/`refresh_token`/`client_credentials` for an access+refresh pair), `GET /me` (user/client + resolved `permissions` + `organisations`), `GET /logout`, `PATCH /token/revoke`.
- Tokens are RS256 JWTs, but **no consumer verifies the signature locally**. Only bifrost holds the private key. Every consumer treats the bearer token as opaque and re-validates by calling `GET /me` (cached in Redis, ~24h, keyed by the token's `sub`). If bifrost is unreachable, auth breaks everywhere downstream — there's no local fallback.
- Clients are registered in bifrost as `PUBLIC` (no secret, PKCE required — use for the frontend) or `CONFIDENTIAL` (secret required, used for server-to-server `client_credentials` — use for the backend). A `redirect_urls[]` allowlist is enforced on the authorization-code exchange.

## Step 0 — before writing any code: verify the client actually exists

Client credentials get copied between apps' `.env` files in this org (a small set of shared local-dev clients gets reused rather than everyone registering their own — see below), and **not every value in a sibling app's `.env` is guaranteed to exist in the bifrost database you're actually pointed at.** Don't assume; confirm with the exact request the library sends before wiring any code:

```bash
# Backend/confidential client check — must match this shape exactly
# (no response_type, unlike some manual examples floating around):
curl -X POST http://bifrost.pension/token \
  -H "Content-Type: application/json" \
  -d '{"client_id":"<id>","client_secret":"<secret>","grant_type":"client_credentials"}'
# Real client, wrong grant type (e.g. it's actually PUBLIC) → a specific 400 error naming the problem.
# Client doesn't exist in this DB at all → {"statusCode":404,"message":{"message":"Invalid Client ID. Client not found!",...}}
```

A `404 Client not found` for a credential pair that "should" work (because another app's `.env` uses it) almost always means that specific bifrost instance's database just doesn't have that client seeded — not a bug in your code. Don't keep guessing credentials from more sibling apps; if two apps show the exact same value in their `.env` and it still 404s, trying a third won't help. Get a real client registered (via `bifrost-ui`'s client management page or `POST /api/v1/clients`) or find someone who knows which DB is live.

**Which shared local-dev clients this org actually uses** (verified working against a local bifrost as of this writing):
- `pcs-client` / `pcs-client-1` — `PUBLIC`, used by `payouts-ui`, `pcs-ui`, and `siraathu` for the frontend login flow. Its `redirect_urls[]` already includes at least `http://localhost:3000/auth/callback` (payouts-ui) and `http://localhost:3006/auth/callback` (pcs-ui). **If your new frontend runs on port 3000 with that exact redirect URL, login works immediately with zero changes to bifrost** — that's the path of least resistance for a new app; picking a different port means someone has to add your callback URL to this client's allowlist first.
- `hcs-client-4321` / `hcs-client-1234` — intended as the shared `CONFIDENTIAL` client for backend `client_credentials`, referenced identically in `payouts-api` and `pcs-api`'s `.env`. **Confirmed NOT present** in at least one local dev bifrost DB during this implementation — verify it with the curl above before trusting it.

## Backend: fresh NestJS project

### 1. Pin NestJS to v10, not v11

`@pension/midgard`'s own `dependencies` pin `@nestjs/common@^10.0.0` (its `peerDependencies` even more loosely say `^8.0.0 || ^9.0.0`). A project scaffolded fresh with `@nestjs/cli` today defaults to **NestJS 11**, which breaks:

```
error TS2322: Type 'DynamicModule' is not assignable to type 'Type<any> | DynamicModule | ...'
  Type '.../node_modules/@pension/midgard/node_modules/@nestjs/common/interfaces/.../dynamic-module.interface').DynamicModule'
  is not assignable to '.../node_modules/@nestjs/common/interfaces/.../dynamic-module.interface').DynamicModule'.
```

Two different `@nestjs/common` copies end up installed (yours at v11, `@pension/midgard`'s nested one at v10), and their `DynamicModule`/`Type` interfaces are nominally incompatible even though structurally identical. Fix: pin your project to v10, matching every other NestJS backend in this org that uses `@pension/midgard` (`payouts-api`, `pcs-api`, `api-template`):

```json
"@nestjs/common": "^10.0.0",
"@nestjs/core": "^10.0.0",
"@nestjs/platform-express": "^10.0.0",
"@nestjs/cli": "^10.0.0",        // devDependency
"@nestjs/schematics": "^10.0.0", // devDependency
"@nestjs/testing": "^10.0.0",    // devDependency
"reflect-metadata": "^0.1.13",   // matches @pension/midgard's own pin — avoids a duplicate nested copy
"@types/express": "^4.17.17"     // Nest 10 + platform-express pairs with express v4 types, not v5
```

### 2. Install and wire the module

```bash
yarn add @pension/midgard
```

```ts
// app.module.ts
import { IdentityModule } from '@pension/midgard';

@Module({
  imports: [
    IdentityModule.forRoot({ <your-app-key>: ['read:user'] }), // declare this app's scopes
  ],
})
export class AppModule {}
```

```ts
// any controller
import { IdentityGuard, PermissionGuard, BifrostUser, AuthUser } from '@pension/midgard';

@UseGuards(IdentityGuard) // add PermissionGuard too only once real permissions are registered — see gotcha below
@Controller('things')
export class ThingsController {
  @Get()
  findAll(@BifrostUser() user: AuthUser) { ... }
}
```

`IdentityGuard` reads the `Authorization` header directly off the HTTP request — no `x-internal-auth`/gRPC forwarding needed, since there's no gateway in a direct-HTTP setup. It resolves the token via the cached `/me` call described above.

### 3. Load `.env` yourself — Nest doesn't do it for you

`@pension/midgard`'s own `env.ts` reads `.env` via `dotenv.parse(fs.readFileSync('.env'))` — but this only populates its **own internal exported constants**, it never touches `process.env`. A bare `nest new` scaffold's `main.ts` does nothing to load `.env` either. Result: any `process.env.X` your own code reads (most commonly `process.env.PORT`) stays `undefined` and silently falls back to whatever hardcoded default is in the code, even though `.env` clearly sets it. This cost real debugging time — the server would boot "successfully" on the wrong port with no error.

Fix — add as the very first line of `main.ts`, before any other import:

```ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
```

And add `dotenv` as an explicit direct dependency (don't rely on it being pulled in transitively by `@pension/midgard`):

```bash
yarn add dotenv
```

This alone is enough to fix the symptom, but the org's actual convention (`payouts-api`, `pcs-api`) goes one step further: a root-level `env.ts` using `znv` for typed, validated env access, so app code never reads raw `process.env.X` directly:

```ts
// env.ts — project root, sibling to src/, NOT inside it
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { parseEnv, port, z } from 'znv';

export const environmentSchema = {
  APP_ENV: z.string().default('development'),
  PORT: port().default(4000),
  // add your own app-level vars here as they're needed
};

export const { APP_ENV, PORT } = parseEnv(
  dotenv.parse(fs.readFileSync('.env')),
  environmentSchema,
);
```

```ts
// main.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { PORT } from 'env'; // bare specifier — resolves via tsconfig's baseUrl: "./"
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(PORT);
}
bootstrap();
```

Needs `yarn add znv zod` — **pin `zod` explicitly to `^3.24.1`** (matching `payouts-api` and what `@pension/midgard` itself depends on). Letting yarn resolve `zod` unpinned pulls the latest v4, which conflicts with `znv@0.4.0`'s peer range (`^3.24.2`) and is a breaking major version apart from what the rest of the auth stack uses.

Two things this changes structurally, both copied from `payouts-api`:
- Because `env.ts` sits at the project root (outside `src/`), TypeScript's inferred build root shifts to include both, so `nest build` outputs `dist/env.js` **and** `dist/src/main.js` (not `dist/main.js`) — update `start:prod` to `node dist/src/main` accordingly.
- If you ever add Jest tests that import from `env`, add a `moduleNameMapper` entry so ts-jest can resolve the bare specifier: `{"^env$": "<rootDir>/../env.ts"}` in the `jest` block of `package.json` (`rootDir` there is `src`, so `../env.ts` reaches the project root).

### 4. Required env vars

`@pension/midgard` requires these to exist in `.env` regardless of whether your own app-level config references them (it parses the file itself, independent of any `@nestjs/config`/`znv` schema you might have):

```bash
# App
PORT=4000

# Auth
APP_NAME=<your-app-name>
APP_ENV=development            # see gotcha below — this disables all permission checks
CLIENT_ID=<confidential client id>
CLIENT_SECRET=<confidential client secret>
GRANT_TYPE=client_credentials
AUTH_ENDPOINT=http://bifrost.pension
REDIRECT_URL=http://localhost:3000/auth/callback   # required by the schema; largely unused on the backend side
JWT_PUB=./secrets/jwtRS256.key.pub
JWT_LOGGING=verbose

# Redis (identity/permission cache — ioredis, separate from any NestJS CacheModule)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=<same REDIS_DB as bifrost's own — see gotcha below>
REDIS_PASSWORD=
REDIS_PREFIX=
```

`JWT_PUB` needs the actual **public** key file (e.g. copy `secrets/jwtRS256.key.pub` from any existing consumer app like `payouts-api`). It's the same org-wide public key everywhere — never copy the matching private key (`jwtRS256.key`); consumer apps don't need it and some `.env` files reference it as leftover cruft from an older pattern.

Redis must actually be running — `IdentityService` opens its own `ioredis` connection directly using these vars; it's not optional infrastructure.

### 4a. Gotcha: `REDIS_DB` must match bifrost's, and `REDIS_PREFIX` must be empty

This is the single biggest time-sink in implementing auth on this project — a real end-to-end login worked (browser login, real bearer token reaching the backend), but every guarded request still failed with a backend crash swallowed into a 401:

```
IdentityService[getUser]: Failed to get user from token; TypeError: Cannot read properties of null (reading 'sub')
```

Root cause, found by reading the **installed** `node_modules/@pension/midgard` source directly (`dist/nest-client/identity.service.js`) rather than the `midgard-node` source repo — the installed version (`0.0.69` as of this writing) has diverged from what's in that repo. Its `getPayloadFromToken()` does this before decoding:

```js
const publicKey = yield this.redis.get('oauth:public_key');
this.jwtService.verify(accessToken, { publicKey });   // throws if publicKey is null/wrong
return this.jwtService.decode(accessToken);
```

It fetches the RS256 public key from **Redis** (not from the `JWT_PUB` file — that's only wired into the `JwtModule.register()` default, which this call overrides) and verifies the token against it before decoding. If `verify()` throws, the whole function is wrapped in a try/catch that swallows the error and returns `null` — and `getUser()` then does `payload.sub` on that `null`, producing the exact `TypeError` above with zero indication of the real cause.

That Redis key is written by **bifrost itself** (`bifrost/src/auth/auth.service.ts`'s `cacheRsKeys()`, called on bifrost startup): `redis.set('oauth:public_key', <PEM>)`. Two things have to line up for a consumer app to actually see it:

1. **`REDIS_DB` must be the exact same database number bifrost uses**, not a "pick an unused one" isolated db like earlier drafts of this doc said. Redis databases are fully separate keyspaces — `SELECT 4` and `SELECT 6` never see each other's keys. Check bifrost's own `.env` for its `REDIS_DB` (`4` in this org's local setup, confirmed by checking `pcs-api`'s `.env`, which also uses `4`) and match it exactly.
2. **`REDIS_PREFIX` must be left empty.** Both bifrost's own redis client and `@pension/midgard`'s `IdentityService` apply `REDIS_PREFIX` as ioredis's `keyPrefix` option — and `keyPrefix` prepends to *every* key on that client, not just the app-specific identity-cache keys (`identity:<sub>`) it was clearly intended for. Set `REDIS_PREFIX=petty-cash` and the lookup becomes `petty-cash:oauth:public_key`, which bifrost never wrote (bifrost writes the bare `oauth:public_key`, no prefix). `payouts-api` and `pcs-api`'s actual `.env` files confirm this — neither sets `REDIS_PREFIX` at all.

Verify directly against Redis before writing any app code, the same way Step 0 verifies the bifrost client:

```bash
docker exec <your-redis-container> redis-cli -n <bifrost's REDIS_DB> GET oauth:public_key
# Should print a "-----BEGIN PUBLIC KEY-----..." PEM block. If empty, either
# you're pointed at the wrong REDIS_DB, or bifrost hasn't started (and thus
# hasn't run cacheRsKeys()) since Redis was last flushed.
```

If `JWT_LOGGING=verbose` doesn't get you far enough (the try/catch above swallows the real error before it's ever logged), read the **installed** `node_modules/@pension/midgard/dist/nest-client/identity.service.js` directly — don't assume the `midgard-node` source repo matches what's actually published and installed.

### 5. Gotcha: `PermissionGuard` is a no-op outside production

```ts
// @pension/midgard's IdentityService.hasPermission()
if (APP_ENV === 'development') return true; // unconditional
```

`PermissionGuard` auto-derives the required permission as `` `${APP_NAME}.${ControllerName without "Controller"}.${methodName}` ``. If you add `PermissionGuard` to a route, that exact permission string needs to be registered in bifrost first (via the client's permission-sync flow — `GET /api/v1/midgard/permissions/sync` on your own app, which bifrost's client admin can scrape), or every request will be denied **in production only** — locally with `APP_ENV=development` it silently passes regardless, so local testing will never catch a missing/misspelled permission. Don't add `PermissionGuard` speculatively before the permission is actually registered.

## Frontend: fresh Nuxt project

### 1. Install and wire the module

```bash
yarn add @pension/midgard-nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false, // see gotcha below — required
  modules: ['@pension/midgard-nuxt', /* ...your other modules */],
  runtimeConfig: {
    public: {
      auth_url: process.env.AUTH_URL,
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET, // only if the client is CONFIDENTIAL — PUBLIC clients don't have one
      redirect_url: process.env.REDIRECT_URL,
      scopes: process.env.SCOPES,
    },
  },
});
```

Required `.env`:

```bash
AUTH_URL=http://bifrost.pension
CLIENT_ID=<public client id>
CLIENT_SECRET=<only if confidential>
REDIRECT_URL=http://localhost:3000/auth/callback
SCOPES=read:users
```

The module auto-registers `/auth/callback` (completes the code exchange) and `/forbidden` — don't create your own pages at those paths. A global client-only plugin runs on every route: if not logged in (checked via `localStorage['user']` presence — not actual token validity, which is discovered lazily on the next 401), it immediately does a full external redirect to `login()`. Every route requires login by default; opt specific routes out via `runtimeConfig.public.identity.whitelist`, not by removing the plugin.

### 2. Gotcha: `ssr: false` is required, not optional

`@pension/ui-kit` (which `@pension/midgard-nuxt` also bundles its own separate copy of internally, for its login/callback UI — this is normal, expected duplication, not a bug to fix) bundles `lottie-web`, which touches the `document` global at **import time**. Rendering any ui-kit shell component (`PoWrap`, `PoSidebarDrawer`, `PoTopBar`, etc.) server-side crashes with:

```
ERROR document is not defined
    at createTag (node_modules/lottie-web/build/player/lottie.js:30:5)
```

This can pass a production **build** and then fail specifically in **dev mode** or on specific routes depending on module load order — it's not reliably caught by `nuxt build` alone. Just set `ssr: false` from the start; every direct-consumer Nuxt app in this org (`bifrost-ui`, `payouts-ui`, `pcs-ui`) already does this for the same reason.

### 3. Gotcha: name your app shell layout `main.vue`, never `default.vue`

Nuxt auto-applies a layout literally named `default.vue` to **every page that doesn't explicitly request a different one** — including the `/auth/callback` page the module injects automatically, and the brief window right after your app mounts but before the "not logged in, redirecting" plugin logic actually fires the redirect. If your app shell (sidebar, top bar, etc.) lives in `default.vue`, both of those moments render your full shell first, producing a visible flash/glitch — the sidebar briefly appears mid-redirect, which looks broken compared to other apps where the redirect appears instant and full-screen.

Fix: name the shell layout `main.vue` instead, and opt every real content page in explicitly:

```ts
// every actual page
definePageMeta({ layout: 'main' });
```

This leaves `/auth/callback` (and the pre-redirect moment) rendering with no layout at all — bare, matching the "should take up the whole screen" expectation. This is the exact convention `bifrost-ui`, `payouts-ui`, `pcs-ui`, and `non-eligibility-ui` all already use; it isn't a petty-cash-specific choice.

### 4. Wiring the top bar with the logged-in user

```vue
<script setup>
const identity = useIdentity(); // auto-imported by the module
</script>

<template>
  <PoTopBar
    :user-object="identity.user?.value"
    :avatar="identity.user?.value?.avatar"
    @logout="identity.logOut()"
    @profile-switcher-click="handleProfileSwitcherClick"
  />
</template>
```

`avatar` is a direct field on the `AuthUser` shape returned by `/me` — no separate avatar-fetching service is needed for a minimal app (some org apps layer one on top, but it's not required).

### 5. Forcing organisation selection ("transacting as")

Copied from `payouts-ui`'s `layouts/main.vue` — there is **no dedicated route/page and no middleware** for this anywhere in the org; it's done entirely inline in the shell layout by swapping the page slot:

```vue
<template>
  <PoTopBar
    :user-object="identity.user?.value"
    @profile-switcher-click="handleProfileSwitcherClick"
  />
  <PoOrgSelector
    v-if="identity.user?.value?.transacting_as == 0"
    :user-object="identity.user?.value"
    @on-profile-click="handleProfileSwitcherClick"
  />
  <slot v-else></slot>
</template>

<script setup>
async function handleProfileSwitcherClick(value) {
  if (value === 'logout') {
    identity.logOut();
    return;
  }
  if (typeof value === 'object' && value) {
    if (value.claimed) {
      identity.switchToDelegation(value.id); // topbar dropdown can also list claimed delegations
    } else if (!value.id) {
      await identity.changeTransactingAs(value.organisation_uuid);
    }
  }
}
</script>
```

- `transacting_as == 0` means no org selected yet. `PoOrgSelector` renders the *entire* `user.organisations` array verbatim — **there is no filtering by org type/name in this component or pattern anywhere in the org's codebase.** If only specific organisations should be usable (e.g. one specific org), enforce that with a bifrost **permission** check on the backend/relevant pages, not by filtering this list — filtering here would just be cosmetic and bypassable.
- `changeTransactingAs(orgUuid)` is **not** a local API call — it does a full external redirect back through bifrost's `/authorize` with `organisation_uuid` appended, re-running the entire OAuth code exchange scoped to that org, landing back on `/auth/callback`. Expect a full page reload every time the org changes.
- The same handler doubles as the top bar's `@profile-switcher-click` (a smaller persistent dropdown, separate from the full-screen forced gate), which is why the `logout`/`claimed`-delegation branches exist — those values only ever come from that dropdown, never from `PoOrgSelector`.

### 6. Calling your backend

`useHttp()` (also auto-imported) attaches the stored bearer token automatically — use it for every call to your own API, since there's no gateway adding the header for you.

## Setup checklist for a fresh project

1. **Verify** your intended bifrost client credentials actually resolve against the target bifrost instance (Step 0) *before* writing any code.
2. **Backend**: scaffold on NestJS 10 (or downgrade immediately if scaffolded on 11). Add `@pension/midgard` + `dotenv`, add `import 'dotenv/config'` as the first line of `main.ts`, add all required env vars, stand up Redis, wire `IdentityModule.forRoot(...)`, guard routes with `IdentityGuard`.
3. **Frontend**: add `@pension/midgard-nuxt`, set `ssr: false`, add required env vars, name your shell layout `main.vue` (not `default.vue`) with `definePageMeta({ layout: 'main' })` on every real page, wire the top bar and (if needed) the forced org-selection gate.
4. Confirm end to end: unauthenticated request to a guarded backend route → `403`. Real token (via a manual `client_credentials` curl, or via the frontend's login flow) → `200` with the expected `AuthUser` payload.
5. Only add `PermissionGuard` to routes once the corresponding permission is actually registered in bifrost — and remember it's silently bypassed under `APP_ENV=development`, so verify it against production-like config, not local dev.

## Source of truth

Everything above was derived directly from source and from actually implementing it, not from existing docs (bifrost and bifrost-ui have none of their own). Re-check against:
- `bifrost/src/auth/*` (`auth.service.ts`, `auth.controller.ts`, `auth.guard.ts`, `pkce.ts`)
- `bifrost/prisma/schema.prisma` (`AccessToken`, `AuthorizationCode`, `Client`, `Permission`/`Role`)
- `midgard-node/src/nest-client/*` (`identity.module.ts`, `identity.guard.ts`, `identity.service.ts`, `permission.guard.ts`, `env.ts`)
- `midgard-nuxt/src/runtime/*` (`composables/useIdentity.ts`, `plugin.ts`)
- `payouts-ui/layouts/main.vue` — the org-selection pattern's original source
- `bifrost-ui/layouts/main.vue`, `pcs-ui/layouts/main.vue` — cross-reference for the same patterns
- `payouts/.agents/references/auth-and-audit.md` — how the *gateway-based* apps use the same packages (siraathu-specific parts don't apply to a direct-HTTP setup, but the Prisma audit-actor pattern is worth a look if a backend adopts that later)
