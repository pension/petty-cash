@AGENTS.md

## Extra notes for Claude

- Read `AUTH.md` before touching Bifrost/Midgard wiring, guards, permissions or auth env vars. It is not auto-loaded because its second half is a fresh-project setup guide.
- More commands:
  - UI tests: `yarn workspace petty-cash-ui test` (node:test, `apps/petty-cash-ui/test/*.test.mjs`)
  - One API test: `yarn workspace petty-cash-api test <pattern> --runInBand`
  - Format API code: `yarn workspace petty-cash-api format`
  - Prisma schema changes: `yarn workspace petty-cash-api db:migrate`, then `db:generate`
- `apps/shorty-ui/` is leftover from the source template (one `QRCodePreview.vue`, no package.json). It is out of scope per Exclusions; do not build on it.
- `apps/petty-cash-api/dist/` is build output; don't edit or search it.
