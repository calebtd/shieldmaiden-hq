# Square Lab findings

What Square actually does on our iPad and reader, recorded from the Lab's log
(D1 `shieldmaiden-square-lab`). Raw payloads stay in the log; this file is the summary
Phase 5 builds on. Times are America/Chicago.

## Setup status

| Step                                                  | Status                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Lab deployed behind Cloudflare sign-in                | Done                                                                                 |
| Production Application ID                             | Done                                                                                 |
| `SQUARE_ACCESS_TOKEN` Worker secret                   | Not yet                                                                              |
| Point of Sale web callback URL registered in Square   | Unconfirmed                                                                          |
| Sign-in bypass for `/webhook` only (owner OK needed)  | Done (OK given in chat, 2026-11-10)                                                  |
| Webhook subscription + `SQUARE_WEBHOOK_SIGNATURE_KEY` | Working (test event 2026-11-10, signature valid); key needs re-adding as type Secret |

## Decisions so far

- Customers add tips on **Square's own tip screen**, so we read the tip back through
  Square's API (needs `SQUARE_ACCESS_TOKEN`).
- The Square app doesn't need to bring the iPad back to HQ automatically. What matters is that
  each payment carries our reference for matching later. The Lab sends it as `state` (returned
  in the callback) and in the payment **note** (to see whether it survives into Square's
  records and exports, including offline payments).
- Square still requires a registered callback URL for the payment link to open at all.

## Results

One row per checklist test. "Confirmed" means seen in the log, not taken from Square's docs.

| #   | Test                         | Result | Notes |
| --- | ---------------------------- | ------ | ----- |
| 1   | Card, no tip                 |        |       |
| 2   | Card with tip                |        |       |
| 3   | Cancel in Square             |        |       |
| 4   | Cash                         |        |       |
| 5   | Offline card, then reconnect |        |       |
| 6   | Android                      |        |       |
| 7   | Refunds done                 |        |       |

## Callback fields (iOS)

_To fill in from test 1._

## Tips via the Orders API

_To fill in from test 2._

## Webhook timing

- 2026-11-10: Square's "Send test event" reached `/webhook` through the sign-in bypass and
  passed the signature check. The test event is canned sample data (2020 dates, a test
  merchant), so it tells us nothing about timing; real timing comes from test 5.
- The payment object in `payment.created` carries `order_id`, `amount_money`,
  `total_money`, `status`, `receipt_number` and `location_id`, so a webhook alone can link
  a payment to its order.

_Timing: to fill in from test 5._
