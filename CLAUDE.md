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

## Working agreements (read before doing anything)

Several Claude sessions work on this repo in parallel. Each owns one area (see "Workstreams").

- **Branches and merging:** work on a branch named for your workstream. When `pnpm check`
  and `pnpm test:e2e` pass, merge into `main` yourself (`git merge --no-ff`) and push; CI then
  deploys **dev**. Always `git fetch origin main` and merge it into your branch first; if
  another session's changes conflict, resolve carefully and re-run the checks.
  Never push to `main` with failing checks. Never deploy **demo** or **production**; the
  owner runs those from GitHub Actions.
- **Migrations:** only add (never rename/drop). If two branches both add a migration, the
  second to merge must regenerate its migration so numbers don't collide.
- **Cloudflare:** the session's network proxy injects a Cloudflare API token for
  `api.cloudflare.com` (use `CLOUDFLARE_API_TOKEN=proxy-injected`,
  `CLOUDFLARE_ACCOUNT_ID=76433d69bd581192e62cf8fa2c58ec37`). Rules:
  - Read before writing; only create resources named `shieldmaiden-…` / `Shieldmaiden …` or
    on our subdomains; never modify or delete anything else (the account also has
    `smb-waitlist`, `crew-time-clock`, `autumn-hill-f659` and their D1/Access, which are off limits).
  - Anything that changes **who can sign in** (Access apps/policies) needs the owner's explicit
    OK in chat first.
  - `wrangler deploy` of the main app fails from a session (the proxy replaces Wrangler's
    asset-upload token). Deploy the main app through CI by merging to `main`. Workers without
    static assets (the Square Lab) can be deployed from a session.
  - Never ask for secrets in chat. Worker secrets are added by the owner in the dashboard.
- **Who's who:** owner sign-in `smbraidin@gmail.com` (also the shared checkout iPad);
  developer `calebdillenbeck@gmail.com` (owner on dev); Makayla `makayla.dilly@gmail.com`
  (braider). Other braiders: Becca, Malia, Savanah; Amren is checkout (emails not yet given).
- **Talking to the owner:** plain language, no jargon. They are not a developer by trade.

## Current state (keep this section up to date when you merge)

- Live: `dev.shieldmaiden.hair` (auto from `main`), `square-lab.shieldmaiden.hair`.
  Not yet deployed: demo, production.
- Done: Phase 0 (foundation, sync, Access sign-in, staff screen with edit/turn off, sign out,
  live identity on every sync, company palette), Staff screen mirrors the Cloudflare sign-in
  list (needs the `ACCESS_ADMIN_TOKEN` Worker secret), Square Lab (needs
  `SQUARE_ACCESS_TOKEN` secret and the callback URL registered in Square).
- Phase 1 (done, pending owner review of the imported menu): pay profiles (Staff screen, one per
  person, last change wins), events with tax rate + who's working + per-event pay overrides +
  per-event menu prices/availability (Events screen), discount types (Discounts), menu (Menu:
  braids/add-ons/retail, tax-included prices, "price at checkout" items, minutes, skills needed),
  skills checklist (Skills). Domain rules in `src/domain/{pay,discounts,menu}.ts`. Pay is
  private: non-owners only receive their own pay rows and event pay. The owner's Square
  library, price board and skills sheet (Nov 10) are in
  `src/client/features/menu/starterMenu.ts`, loaded with buttons on Menu and Skills. Left
  for Phase 3: snapshotting rates on lock, bonuses (adjustments), per-ticket price changes.
- Phase 2 (timeclock): `time_entries` (work/break per person per event, append-only:
  fixes void + replace with a reason; only end time is filled in place). "My shift" for
  everyone (big clock buttons, works offline, fix/add/remove own time), owner
  "Timesheets" per event (hours, breaks, hourly pay so far, clock someone in/out, fixes).
  Rules in `src/domain/time.ts` (breaks unpaid, no double counting). Time is private
  like pay. Sign-out now sends waiting changes first and warns if it can't.
- Layout: sidebar (drawer from "☰ Screens" on phones under 768px). Add screens to the
  grouped `NAV` list in `src/client/components/Layout.tsx`.
- Ops (`ops-golive`): nightly D1 → R2 backup job (`src/server/ops/`, cron `41 8 * * *` on every
  site, keeps prod 30 / dev 14 / demo 3 days), owner-only **System health** panel on Home
  (`/api/ops/health`, `/api/ops/backup`; server errors recorded in `server_meta`),
  `docs/GO-LIVE.md`, README "Backups" and "When something goes wrong".
- Waiting on the owner (as of 2026-11-10): `ACCESS_ADMIN_TOKEN` not yet set on
  `shieldmaiden-hq-dev` (dev's sign-in list will not change when it is: same 3 emails);
  demo not deployed (its D1 is migrated, Worker doesn't exist); R2 bucket
  `shieldmaiden-backups` not created (the session token has no R2 permission). Once it
  exists, add the `BACKUPS` r2_buckets entry to each env in `wrangler.jsonc` (only the
  local top level has it now; a binding to a missing bucket fails the deploy).
- Square facts confirmed: the Point of Sale API has no sandbox; tests use small real charges.
  The callback returns an order ID (`transaction_id`) and a device ID; tips come from the
  Orders API.

## Workstreams

1. **Phase 1, setup data** (`docs/PLAN.md` §7): pay profiles + per-event overrides, braid menu
   (base braids with price/time, add-ons, retail), skills, discount types, events with tax rate.
2. **Square Lab & integration**: help the owner run the Lab tests, add the webhook sign-in
   exception (owner approval needed), record findings in `labs/square/FINDINGS.md`.
3. **Ops**: demo/production go-live checklist, nightly D1 backups to R2, monitoring/error
   visibility, keeping README accurate.
