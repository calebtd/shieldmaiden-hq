# Square Lab findings

What Square actually does on our iPad and reader, recorded from the Lab's log
(D1 `shieldmaiden-square-lab`). Raw payloads stay in the log; this file is the summary
Phase 5 builds on. Times are America/Chicago.

## Setup status

| Step                                                  | Status                                     |
| ----------------------------------------------------- | ------------------------------------------ |
| Lab deployed behind Cloudflare sign-in                | Done                                       |
| Production Application ID                             | Done                                       |
| `SQUARE_ACCESS_TOKEN` Worker secret                   | Done                                       |
| Point of Sale web callback URL registered in Square   | Done (confirmed by test 2)                 |
| Sign-in bypass for `/webhook` only (owner OK needed)  | Done (OK given in chat, 2026-11-10)        |
| Webhook subscription + `SQUARE_WEBHOOK_SIGNATURE_KEY` | Done (3 test events, all signatures valid) |

## Decisions so far

- Customers add tips on **Square's own tip screen**, so we read the tip back through
  Square's API (needs `SQUARE_ACCESS_TOKEN`).
- The Square app doesn't need to bring the iPad back to HQ automatically. What matters is that
  each payment carries our reference for matching later. The Lab sends it as `state` (returned
  in the callback) and in the payment **note** (to see whether it survives into Square's
  records and exports, including offline payments).
- Square is for **cards only**. Cash and Venmo are recorded in HQ, so the Lab only offers
  card in Square.
- Square still requires a registered callback URL for the payment link to open at all.

## Results

One row per checklist test. "Confirmed" means seen in the log, not taken from Square's docs.
Tests so far ran on an iPhone (Square's records show "Caleb's iPhone"), not yet the booth iPad.

| #   | Test                         | Result                   | Notes                                               |
| --- | ---------------------------- | ------------------------ | --------------------------------------------------- |
| 1   | Card, no tip                 | Covered by test 2        | Same flow; only the tip differs                     |
| 2   | Card with tip                | ✅ Works (2026-11-10)    | $1 + $1 tip. Tip only via API or webhook, see below |
| 3   | Cancel in Square             | ✅ Works (4 times)       | `payment_canceled`, our reference comes back        |
| 4   | Offline card, then reconnect | ❌ Not possible via link | Square needs internet to accept the link; see below |
| 5   | Android                      |                          |                                                     |
| 6   | Refunds done                 |                          |                                                     |

## Callback fields (iOS) — confirmed

Square sends the browser to `/callback?data=<JSON>`. Seen on a successful payment:

```json
{
  "status": "ok",
  "state": "lab-mwb02b38",
  "transaction_id": "t4kYWX21DBg6cuR60wEDV33lL4KZY",
  "client_transaction_id": "FE8192B0-D727-491F-AF55-E7D674011ED6"
}
```

- `state` is our reference, returned unchanged. This is how HQ matches the callback to a ticket.
- `transaction_id` is the **Orders API order ID** (the webhook's `order_id` is the same value).
- **No amount, no tip, no payment ID** in the callback. The tip has to come from Square's API or
  a webhook.
- On cancel: `{"status": "error", "error_code": "payment_canceled", "state": "…"}`, no IDs.
- The same callback can arrive **twice**: the identical success callback was logged again 3½
  minutes later (the page was reopened). HQ must treat a repeated `transaction_id` as already
  recorded.

## Tips and our reference via the Orders API — confirmed

`GET /v2/orders/{transaction_id}` for the $1 + $1 tip test:

- `total_money` 200, `total_tip_money` 100.
- One tender: `type: CARD`, `amount_money` 200 (includes the tip), `tip_money` 100,
  `payment_id` = the tender ID = the webhook's payment ID, card `CAPTURED`.
- Our note ("Square Lab test · lab-…") is on **`line_items[0].note`**, not `order.note`, and not
  on the payment. `reference_id` is empty. So a payment can be traced back to our reference
  through its order, even without the callback.

## Webhooks — confirmed

The $1 + $1 tip payment sent **five** webhooks, each with its own `event_id`:

| Square time (UTC) | Lab got it | Event             | Status / card        | Tip  |
| ----------------- | ---------- | ----------------- | -------------------- | ---- |
| 18:04:57.8        | 18:04:59   | `payment.created` | APPROVED, AUTHORIZED | none |
| 18:05:07.8        | 18:05:11   | `payment.updated` | APPROVED, AUTHORIZED | $1   |
| 18:05:11.0        | 18:05:13   | `payment.updated` | COMPLETED, CAPTURED  | $1   |
| 18:05:11.3        | 18:05:13   | `payment.updated` | COMPLETED, CAPTURED  | $1   |
| 18:05:16.8        | 18:05:20   | `payment.updated` | COMPLETED, CAPTURED  | $1   |

- They arrive within 1–4 seconds while online. The callback reached the Lab at 18:05:11,
  about when the payment completed.
- `payment.created` comes **before** the tip is chosen, so its total is the pre-tip amount.
  Only trust amounts once `status` is `COMPLETED`.
- Every webhook carries `order_id` (= callback `transaction_id`), `amount_money`, `tip_money`,
  `total_money`, `status`, and the device name. No note and no reference: to find our ticket,
  match on `order_id`, or look up the order's line item note.
- Handle them as "latest state of payment X" (keyed by payment ID, newest `updated_at` wins),
  and skip repeated `event_id`s (Square's test event, sent twice, repeated its `event_id`).
- Square's "Send test event" is canned 2020 sample data; ignore it for timing.

## Offline — confirmed: the payment link needs internet

- With no internet, Square refuses the link: _"Point of Sale must be connected to the Internet
  to validate your settings before taking payments."_ This happens even when the phone shows
  Wi-Fi but the Wi-Fi has no internet. With internet, the same link works. **Square can't take
  an offline payment started from HQ.**
- After that error Square didn't come back to the Lab: no callback was logged for those tries.
- Square's own app can still take offline payments when you ring them up in Square directly.
  Those payments reach us later through webhooks or the after-event import, not the callback.
- Lab side: the page now opens offline and saves what happened, and sends it when signal returns.
  In the Wi-Fi-without-internet case the page thought it was online and waited on the
  network before opening Square, so the button seemed to do nothing. The Lab now opens Square
  immediately and sends its log in the background. HQ must do the same: never make
  "Charge card" wait on the network.
- Still to learn (test 4b): a card taken **directly in Square** while offline, with the ticket
  number typed in Square's note. When signal returns, how long until webhooks arrive, and does
  the note come through?
