# Shieldmaiden HQ

One app for running Shieldmaiden Braidin' at pop-up events: staff, waitlist, tickets, time,
sales tax, and payouts. It works with no signal and syncs when the connection comes back.

- **Plan and business rules:** [`docs/PLAN.md`](docs/PLAN.md)
- **Code conventions:** [`CLAUDE.md`](CLAUDE.md)

## Where it runs

| Site                                | What it's for             | Who can get in                                       | How it updates                         |
| ----------------------------------- | ------------------------- | ---------------------------------------------------- | -------------------------------------- |
| [app.shieldmaiden.hair][app]        | The real business         | Emails on the "Shieldmaiden HQ staff" Access policy  | By hand: Actions → Deploy → production |
| [demo.shieldmaiden.hair][demo]      | Training and sales demos  | Anyone; pick a sample person. Data resets nightly    | By hand: Actions → Deploy → demo       |
| [dev.shieldmaiden.hair][dev]        | Trying new work           | Emails on the "Shieldmaiden HQ admins" Access policy | Automatically when `main` changes      |
| [square-lab.shieldmaiden.hair][lab] | Testing Square on devices | Admins policy                                        | By hand (see `labs/square/README.md`)  |

[app]: https://app.shieldmaiden.hair
[demo]: https://demo.shieldmaiden.hair
[dev]: https://dev.shieldmaiden.hair
[lab]: https://square-lab.shieldmaiden.hair

Each site has its own database, so test and demo data never mix with real money.

## Day to day

**Adding a staff member.** Staff → **Add someone**, with the email they'll sign in with.
That's it: the server adds their email to the site's Cloudflare sign-in list (and removes it
when they're turned off). The **Sign-in list** panel on the Staff screen shows whether the
list is up to date. Owner emails in `wrangler.jsonc` are always on the list.

This needs a Worker secret `ACCESS_ADMIN_TOKEN` on `shieldmaiden-hq-dev` and
`shieldmaiden-hq`: a Cloudflare API token with only **Account → Access: Apps and Policies →
Edit**. The server only ever edits the one policy named in `ACCESS_STAFF_POLICY_ID`
("Shieldmaiden HQ dev staff" on dev, "Shieldmaiden HQ staff" on production).

**Signing out / switching people on a shared device.** Tap **Sign out** in the top bar. The
device forgets its local data, and the next person signs in with their own email code.
Sign-ins last a week.

**Turning someone off.** Staff → **Turn off**. They're blocked immediately, even if they're
still signed in. Nobody can turn off their own account or change their own role.

## How changes go live

```
branch → pull request (CI checks) → merge to main ──auto──▶ dev
                                                   └─ Run workflow ─▶ demo / production
```

1. Work happens on a branch and goes through a pull request. CI runs typecheck, lint, unit
   and API tests, and browser tests.
2. Merging to `main` deploys **dev** automatically.
3. After checking dev: GitHub → **Actions → Deploy → Run workflow** → pick **demo** or
   **production**.
4. Every production deploy creates a dated tag and a GitHub Release (`v2026.11.08`, then
   `v2026.11.08.2` for a second that day), listing what changed. The latest release is
   what's live.

Database changes run before the new code, and are always additive, so a deploy never breaks
the version that's running.

## Running it on a computer

Requires Node 22+ and pnpm.

```bash
pnpm install
pnpm db:migrate:local
pnpm dev
```

Open the printed address and pick who to act as. Before pushing, run `pnpm check` (what CI
runs, minus browser tests) and `pnpm test:e2e` (browser tests).

## Cloudflare setup (already done)

For reference, in case anything needs rebuilding:

- **Account:** `76433d69bd581192e62cf8fa2c58ec37`. **Zone:** `shieldmaiden.hair`.
- **Workers:** `shieldmaiden-hq-dev`, `shieldmaiden-hq-demo`, `shieldmaiden-hq` (production),
  `shieldmaiden-square-lab`. Each is reachable only on its subdomain (no `workers.dev`).
- **D1 databases:** `shieldmaiden-dev`, `shieldmaiden-demo`, `shieldmaiden-prod`,
  `shieldmaiden-square-lab`. IDs are in `wrangler.jsonc`.
- **Access** (team `calebdillenbeck.cloudflareaccess.com`): apps "Shieldmaiden HQ",
  "Shieldmaiden HQ (dev)", "Shieldmaiden Square Lab"; policies "Shieldmaiden HQ staff"
  (production), "Shieldmaiden HQ dev staff" (dev), and "Shieldmaiden HQ admins (dev + Square
  Lab)" (Square Lab only). Each app's AUD tag is in `wrangler.jsonc`, and
  the server checks every request's sign-in against it.
- **GitHub secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- **Owners** are set by `OWNER_EMAILS` in `wrangler.jsonc`: the first sign-in from one of
  those emails creates an owner account. Everyone else is added on the Staff screen.

Your other Cloudflare Workers (`smb-waitlist`, `crew-time-clock`, `autumn-hill-f659`) are
separate and untouched by this project.
