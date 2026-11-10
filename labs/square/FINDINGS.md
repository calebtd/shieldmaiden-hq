# Square Lab findings

What Square actually does on our iPad and reader, recorded from the Lab's log
(D1 `shieldmaiden-square-lab`). Raw payloads stay in the log; this file is the summary
Phase 5 builds on. Times are America/Chicago.

## Setup status

| Step                                                  | Status      |
| ----------------------------------------------------- | ----------- |
| Lab deployed behind Cloudflare sign-in                | Done        |
| Production Application ID                             | Done        |
| `SQUARE_ACCESS_TOKEN` Worker secret                   | Not yet     |
| Point of Sale web callback URL registered in Square   | Unconfirmed |
| Sign-in bypass for `/webhook` only (owner OK needed)  | Not yet     |
| Webhook subscription + `SQUARE_WEBHOOK_SIGNATURE_KEY` | Not yet     |

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

_To fill in from test 5._
