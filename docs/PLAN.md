# Shieldmaiden HQ — Plan

One app for running Shieldmaiden Braidin' at pop-up events: waitlist and texts,
tickets and payments, staff time, sales tax, reconciliation, and payouts.
Square stays the card processor; everything else lives here.

Status: **draft for review**. Decisions marked ✅ are settled; ❓ are open.

---

## 1. Goals

1. **No more payout math.** After each event the app says exactly what each person
   is owed, shows how it got there, and records when it was paid.
2. **Every dollar is attributed.** Card, cash, and Venmo payments and tips are tied to
   a ticket and to the people who did the work.
3. **Works through signal dropouts** at faires; syncs when the hotspot comes back.
4. **Reconciles against reality:** Square and Venmo exports, and the cash count.
5. **Maintainable:** clear boundaries, tested money logic, boring technology.

Non-goals (for now): online booking by customers, inventory counts, payroll tax
filing, multi-business support.

---

## 2. Business rules

### Pay ✅

- Each person has a **pay profile**: hourly rate, commission %, tip share %.
  - Braider example: $5/hr, 20%, 100% tips
  - Checkout: hourly only
  - Family: $0/hr, 0%, 100% tips
- Profiles can be **overridden per event** (training days, slow faires).
- **Adjustments** per person per event: bonuses, corrections, with a required reason.
- When an event is locked, the rates used are **snapshotted** into the payout, so
  changing a rate later never rewrites history.
- Card fees, refunds, and redos are business cost; they never reduce pay.

### Commission base ✅

- Commission = rate × **pre-tax** price of braid + add-ons on that ticket.
- Retail (trinkets, hair supplies) earns no commission and is reported separately.

### Shared tickets ✅

- A ticket can have several workers with shares that total 100% (default: equal split).
- Commission and tips on that ticket are split by those shares.
- Each worker's own tip-share % then applies (e.g. checkout at 0% → that portion stays
  with the business).

### Sales tax ✅

- Prices are **tax-inclusive**.
- Each event has its city's **tax rate**, entered when the event is created.
- Pre-tax amount = gross ÷ (1 + rate). Tips are never taxed.
- The event report shows taxable sales and **tax owed** (braids + add-ons + retail).

### Tips ✅

- Entered after the charge, each with its own payment method.
- Cash tips go in the cash box and are **paid out at the end** (no pocketing).
- Card tips added on Square's tip screen are pulled in automatically (see §6).

### Payout ✅

- Payout happens **per event**, after close-out.
  `hours × hourly + commission + tips + adjustments = owed`
- **Pay in Venmo** button opens Venmo prefilled with person + amount → **Mark paid**.
- Staff see their own earnings only after the event is locked (owner toggle).

### Waitlist and assignment ✅

- Staff enter customers; they're added directly or to the waitlist.
- Hybrid assignment:
  - Braids that only certain braiders can do are **assigned at intake**.
  - Simple braids can stay **unassigned** (pooled) until someone is free.
  - Optional per-event **"keep the flow"** mode auto-assigns pooled customers to the
    braider who'll be free soonest.
- **Wait times** are estimated from each braider's current ticket, their queue, and
  braid time estimates.

### Discounts ✅

- Discount types are set up by the owner (Friends & Family, Referral, Promo, Comp, …),
  each with a % or $ amount and a **"reduces commission"** switch, **off by default**.
- Default: commission is paid on the **pre-tax list price**, so braiders aren't
  penalized for business-building discounts. The business absorbs the difference.
- Sales tax is always calculated on what the customer actually paid.
- Every discount is reported per event (count and total) so its cost is visible.

### Actual payouts ✅

- The app calculates **owed**; the owner records **actually paid** (amount, date,
  method, note). Paying more (e.g. rounding up on a slow day) is recorded as
  "extra paid" on that payout and shows in reports. It doesn't need a separate adjustment.
- No minimum pay per event.

### Tips ✅

- Every tip goes to the braider(s) on the ticket. Checkout staff get no tip share by
  default (still a profile setting).

---

## 3. Architecture

```
 iPad / phones (installable web app)                 Cloudflare
 ┌────────────────────────────────┐      ┌──────────────────────────────────┐
 │ React UI                       │      │ Worker (Hono)                     │
 │   ↕ reads/writes               │      │   /api/sync  /api/import  /webhooks│
 │ Local DB (IndexedDB via Dexie) │ ───▶ │   domain logic (same code as UI)  │
 │ Outbox of pending changes      │ ◀─── │ D1 database (Drizzle + migrations)│
 │ Service worker (offline shell) │      │ Cron: nightly backup → R2         │
 └────────────────────────────────┘      └──────────────────────────────────┘
        │ opens Square app with amount             ▲ Square API (tips, orders)
        ▼                                          │ Twilio (texts, later)
   Square Point of Sale app + Bluetooth reader ────┘
```

### Stack ✅ (all boring, well-supported choices)

| Concern    | Choice                                                            | Why                                                   |
| ---------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| Language   | TypeScript, `strict`                                              | One language front to back; types catch money bugs    |
| UI         | React + Vite                                                      | Most common, easiest to maintain and find help for    |
| Offline    | Service worker (vite-plugin-pwa) + IndexedDB (Dexie)              | App opens and works with no signal                    |
| Server     | Cloudflare Worker + Hono                                          | Same host as today; tiny, fast router                 |
| Database   | D1 + Drizzle ORM, versioned migrations                            | Typed queries; no hand-run `ALTER TABLE`              |
| Validation | Zod schemas shared by client and server                           | One definition of every input                         |
| Auth       | Cloudflare Access (email one-time code)                           | Real security, no passwords to build; free ≤ 50 users |
| Tests      | Vitest (unit + Workers pool), Playwright (a few end-to-end)       |                                                       |
| CI/CD      | GitHub Actions → `wrangler deploy` to dev, then demo + production |                                                       |

### Environments ✅

Each is a separate Worker with its **own D1 database**, so test or demo data can never
mix with real money.

| Host                     | Purpose                  | Data                                    | Square     | Texts                                   |
| ------------------------ | ------------------------ | --------------------------------------- | ---------- | --------------------------------------- |
| `app.shieldmaiden.hair`  | Real business            | Real                                    | Production | Real                                    |
| `demo.shieldmaiden.hair` | Training and sales demos | Realistic fake data, **resets nightly** | Sandbox    | Simulated (shown on screen, never sent) |
| `dev.shieldmaiden.hair`  | Testing new work         | Throwaway                               | Sandbox    | Simulated                               |

- Every merge to `main` deploys to **dev** automatically. Promoting to **demo** and
  **app** is one manual approval step in GitHub Actions.
- Demo has a "Sign in as…" picker (Owner / Checkout / Braider) so trainees and
  prospects can try each role without real accounts.
- Requires `shieldmaiden.hair` DNS to be on Cloudflare (the main website can stay
  where it is; only the three subdomains point at Workers).

### Code layout and boundaries

```
src/
  domain/   Pure business logic: money, tax, pay, splits, wait times, matching.
            No I/O, no framework. Imports nothing outside itself. Heavily tested.
  shared/   Zod schemas, API contracts, sync mutation definitions, shared types.
            May import domain only.
  server/   Hono routes, auth, Drizzle schema + queries, sync, imports,
            integrations/ (square, sms). Imports domain + shared.
  client/   React app, organized by feature:
            features/{events,staff,menu,waitlist,tickets,timeclock,closeout,payouts,reconcile}
            plus sync/ and db/. Imports domain + shared.
migrations/ tests/e2e/ docs/
```

Rules (enforced by ESLint, checked in CI):

- `domain` never imports anything else; `client` and `server` never import each other.
- Money is **integer cents** (branded `Cents` type); rates are **basis points**
  (20% = 2000). No floats anywhere near money.
- Splits use largest-remainder rounding so shares always add up to the exact cent.
- Every write goes through one named **mutation** (schema + handler in one file).
- No `any`; no file over ~300 lines without a reason.

### Offline and sync ✅

- Every record gets a client-generated ID (UUIDv7), so devices can create data offline.
- The UI reads from the **local DB** only. Writes apply locally and go into an **outbox**.
- When online, the outbox is pushed to `/api/sync/push`. The server runs the _same_
  domain validation and records each mutation ID, so retries are harmless.
- `/api/sync/pull?since=<cursor>` returns everything changed since the last pull, filtered
  by the user's role. Polls every few seconds while online.
- **Money and time records are append-only**: a mistake is voided and replaced, never
  edited in place, so there's always an audit trail and offline edits can't silently
  overwrite each other. Simple records (waitlist status, names) use last-write-wins.
- A **locked** event rejects all writes except owner adjustments.
- A visible sync indicator shows "All saved" or "3 changes waiting for signal."

### Roles

| Role     | Can                                                                                    |
| -------- | -------------------------------------------------------------------------------------- |
| Owner    | Everything: setup, rates, close-out, payouts, imports                                  |
| Checkout | Waitlist, tickets, payments, cash count for the current event                          |
| Braider  | Own clock in/out, breaks, and edits; own tickets; own earnings after lock (if enabled) |

The iPad can sign in as a shared **Checkout** device.

---

## 4. Data model (first pass)

| Table                     | Key fields                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| `staff`                   | name, email, phone, role, active                                                               |
| `pay_profiles`            | staff, hourly_cents, commission_bps, tip_share_bps (one per person; locked events snapshot)    |
| `events`                  | name, city, dates, tax_rate_bps, assignment_mode, status (planning → live → closing → locked)  |
| `event_staff`             | event, staff, optional rate overrides                                                          |
| `menu_items`              | kind (braid / add-on / retail), name, price_cents, open_price, minutes, skill_ids, active      |
| `skills`                  | name; `staff_skills` (staff, skill, has); braids list the skills they need                     |
| `event_menu`              | event, menu item, price override (null = usual), offered                                       |
| `waitlist_entries`        | event, customer name + phone, status, requested items, assigned staff, timestamps              |
| `tickets`                 | event, waitlist entry, status, opened/closed times                                             |
| `ticket_lines`            | ticket, menu item, **name + price snapshot**, qty                                              |
| `ticket_workers`          | ticket, staff, share_bps (sum = 10000)                                                         |
| `payments`                | ticket, method (card / cash / venmo), amount_cents, tip_cents, square ids, venmo id, voided_at |
| `time_entries`            | event, staff, kind (work / break), start, end, voided_at                                       |
| `adjustments`             | event, staff, amount_cents, reason                                                             |
| `cash_counts`             | event, expected_cents, counted_cents, notes                                                    |
| `discount_types`          | name, kind (% / $), amount, reduces_commission (default false), active                         |
| `ticket_discounts`        | ticket, discount type, **amount snapshot**, note                                               |
| `payouts`                 | event, staff, owed_cents, breakdown (snapshot), paid_cents, paid_at, method, note              |
| `imports` / `import_rows` | source (square / venmo), file hash, raw row, matched payment                                   |
| `message_templates`       | key, text (`{name}` placeholders)                                                              |
| `mutations_applied`       | mutation id (idempotency)                                                                      |
| `audit_log`               | who, what, when, before/after                                                                  |

"Paid by card, cash tip" = one card payment (tip 0) plus one cash payment (amount 0, tip X).
Every payment combination uses the same shape.

---

## 5. Key screens

- **Live event** (iPad): waitlist with wait estimates, per-braider queues, open tickets,
  Charge / Add payment, sync status.
- **Ticket:** braid + add-ons, workers and split, payments and tips.
- **My shift** (phone): clock in/out, start/end break, my hours, fix an entry.
- **Close-out:** cash count, unmatched imports, hours review, tax summary, Lock.
- **Payouts:** per person: owed, breakdown, Pay in Venmo, Mark paid.
- **Setup:** staff and rates, skills, menu, events, message templates.

---

## 6. Integrations

### Square: card payments ✅

1. **Charge:** the app opens Square's Point of Sale app with the amount and a reference
   to our ticket (Square's Point of Sale API web flow on iOS).
2. **Callback:** Square returns to our app with the transaction ID (or only a client ID
   if Square took the payment offline). We record a pending card payment.
3. **Tip sync:** once online, the server looks the payment up through Square's API and
   fills in the actual amount and any tip from Square's tip screen. A Square webhook
   catches payments that settle later (e.g. taken offline).
4. **Import/reconcile:** after the event, pull Square's records for the event dates (API, or
   upload a CSV export) and show anything unmatched for manual assignment.

Spike first in Phase 5 to confirm the exact callback fields and lookup endpoint on the
current Square API before building on it.

### Venmo: reconcile ✅

- Upload Venmo's CSV statement for the event dates.
- Rows are auto-matched to recorded Venmo payments by amount, time window, and name/note;
  the rest go to a review list (match, mark as not business, or create a payment).

### Texts (later)

- Keep today's Messages-app buttons (they also work offline).
- Add automated sending via a toll-free number (Twilio or similar, ~$50–100/yr at current
  volume) after toll-free verification; Messages buttons remain as fallback.

---

## 7. Phases

Each phase ships something usable and leaves the codebase clean.

| Phase                       | Delivers                                                                                                                                                                        | Done when                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **0. Foundation**           | Repo, tooling, CI, dev / demo / app Workers and D1s on their subdomains, Cloudflare Access, roles, sync engine with one sample record, backups                                  | A change merged to main deploys to dev by itself; an offline edit syncs on reconnect |
| **1. Setup data**           | Staff, pay profiles + event overrides, skills, menu, events with tax rate                                                                                                       | You can set up next year's first event                                               |
| **2. Timeclock**            | Clock in/out and breaks on phones, self-edits with audit log                                                                                                                    | Staff can track a full event offline                                                 |
| **3. Tickets → payouts** ⭐ | Tickets, workers/splits, discounts, manual card/cash/Venmo payments and tips, retail, cash count, tax report, close-out, lock, payouts with Venmo link and actual-paid tracking | **The payout math is gone.**                                                         |
| **4. Waitlist**             | Port the current waitlist into the event; menu-based intake; hybrid assignment; wait estimates; flow mode                                                                       | The old waitlist app can be retired                                                  |
| **5. Square + Venmo**       | Point of Sale handoff, tip sync, webhook, Square and Venmo imports, reconciliation screen                                                                                       | Card payments need no retyping; imports match                                        |
| **6. Automated texts**      | Toll-free number, send from the app, delivery status                                                                                                                            | Waitlist texts send themselves                                                       |

The current waitlist app keeps running until Phase 4, so nothing breaks in the meantime.

### Testing bar

- `domain/`: unit tests for every pay, tax, split, and wait-time rule, including rounding
  edge cases and real tickets from past events as fixtures.
- Server: integration tests for every mutation and sync push/pull.
- End-to-end: one test per phase, e.g. "go offline, take three tickets, reconnect, payouts correct."

---

### Phase 0 status

Built and tested: tooling and CI, layer boundaries, money/tax/split helpers, sync engine
(offline queue, retries, rejections, data resets), Cloudflare Access + demo sign-in, staff
screen as the first synced record, installable offline app shell, deploy workflow.
Waiting on Cloudflare setup: D1 databases, API token, Access applications, first deploy.
Backups: D1 Time Travel (point-in-time restore) covers this to start; a nightly export to R2
can be added later.

## 8. Running costs (estimate)

- Cloudflare Workers Paid ($5/mo) recommended for D1 headroom and backups; free tier may suffice.
- Cloudflare Access: free up to 50 users.
- Square: existing card fees only.
- Texts (Phase 6): roughly $50–100/yr.

---

## 9. Next steps

1. Review this plan; settle the ❓ items.
2. Create a GitHub repo (e.g. `shieldmaiden-hq`) for the code and this plan.
3. Start Phase 0.
