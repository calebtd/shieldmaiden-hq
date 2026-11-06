# Shieldmaiden HQ

Waitlist, tickets, time tracking, sales tax, and payouts for Shieldmaiden Braidin' pop-up events.
Works offline and syncs when there's signal. See [`docs/PLAN.md`](docs/PLAN.md) for the plan and
[`CLAUDE.md`](CLAUDE.md) for code conventions.

| Environment | Address                | Sign-in                            |
| ----------- | ---------------------- | ---------------------------------- |
| Production  | app.shieldmaiden.hair  | Cloudflare Access (email code)     |
| Demo        | demo.shieldmaiden.hair | Pick a person; data resets nightly |
| Dev         | dev.shieldmaiden.hair  | Cloudflare Access                  |

## Run it locally

Requires Node 22+ and pnpm.

```bash
pnpm install
pnpm db:migrate:local
pnpm dev
```

Open the printed URL and pick who to sign in as. `pnpm check` runs every check CI runs except
the browser tests (`pnpm test:e2e`).

## Deploying

- Merging to `main` deploys to **dev** after CI passes.
- To deploy **demo** or **production**: GitHub → Actions → Deploy → Run workflow → pick a target.

### One-time Cloudflare setup

1. Create three D1 databases (`shieldmaiden-dev`, `shieldmaiden-demo`, `shieldmaiden-prod`) and
   put their IDs in `wrangler.jsonc`.
2. Create a Cloudflare API token (Workers Scripts edit, D1 edit, Workers Routes edit, zone
   `shieldmaiden.hair`) and add GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
3. Zero Trust → Access: add self-hosted applications for `app.shieldmaiden.hair` and
   `dev.shieldmaiden.hair` with an email one-time-PIN policy. Put the team domain
   (`<team>.cloudflareaccess.com`) and each application's AUD tag into `wrangler.jsonc`.
4. Add staff emails in the app (Staff screen); add them to the Access policy too.
