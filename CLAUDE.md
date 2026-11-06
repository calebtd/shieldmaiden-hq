# Shieldmaiden HQ: working conventions

The full product plan is in `docs/PLAN.md`. Read it before starting a phase.

## Commands

- `pnpm dev`: run locally (Vite + Worker + local D1). Run `pnpm db:migrate:local` first.
- `pnpm check`: typecheck + lint + format check + unit/API tests. Must pass before committing.
- `pnpm test:e2e`: Playwright against the built app.
- `pnpm db:generate --name <change>`: create a migration after editing `src/server/db/schema.ts`.

## Layers (enforced by ESLint)

- `src/domain/`: pure business rules (money, tax, pay, splits). No imports from other layers,
  no I/O. Every rule gets unit tests, including rounding edge cases.
- `src/shared/`: Zod schemas, mutation definitions, sync protocol. Imports `domain` only.
- `src/server/`: Hono API on Cloudflare Workers, Drizzle + D1. Never imports `client`.
- `src/client/`: React app. Features live in `src/client/features/<feature>/`. Never imports `server`.

## Rules

- Money is integer cents (`Cents`); rates are basis points (`Bps`). Never use floats for money.
  Split amounts with `allocate()` so parts add up to the exact cent.
- All data changes are **mutations**. To add one:
  1. Define args + allowed roles in `src/shared/mutations.ts`.
  2. Server handler in `src/server/mutations/` (validate, then return statements; stamp
     `version: nextVersion` on every row written). Register it in `mutations/index.ts`.
  3. Client applier in `src/client/mutations/appliers.ts` (must be safe to re-run).
  4. Tests: API test in `src/server/*.test.ts`; domain tests for any business rule.
- A new synced table needs: Drizzle table with `version` + index, a field in
  `pullResponseSchema`, filtering by role in `src/server/sync/pull.ts`, a Dexie table in
  `src/client/db/local.ts` (bump the Dexie version), and an entry in `SYNCED_TABLES`.
- Money and time records are append-only: correct by voiding and adding, never editing in place.
- Snapshot names and prices onto tickets/payouts when they're created.
- Migrations must be backward compatible (add columns/tables; don't rename or drop in the
  same deploy) because the database is migrated before the new code goes live.
- Errors the person can fix are `DomainError` with a plain-language message.
- Keep files under ~300 lines; split by responsibility when they grow.
- UI copy is plain language for people at a busy booth: short, specific, no jargon.

## Environments

`local` (persona picker), `dev`/`production` (Cloudflare Access), `demo` (persona picker,
nightly reset). Each has its own D1 database. Config lives in `wrangler.jsonc` and is validated
by `src/server/config.ts`.
