# Square Lab

A small, separate page for checking how Square behaves on our real iPad and reader before the
main app depends on it. It lives at `square-lab.shieldmaiden.hair`, has its own database, and
shares nothing with the main app.

It starts a charge in the Square app, records exactly what Square sends back, can look the
payment up through Square's API (tips, tenders), and logs Square webhooks (for payments taken
offline that settle later). Everything lands on the **Log** page, unedited.

## Setup (once)

1. **Square Developer Dashboard** (developer.squareup.com → your app, _production_ mode):
   - Copy the **Application ID** into `SQUARE_APP_ID` in `labs/square/wrangler.jsonc`.
   - Point of Sale API → add web callback URL `https://square-lab.shieldmaiden.hair/callback`.
   - Webhooks → add a subscription to `https://square-lab.shieldmaiden.hair/webhook` for
     `payment.created` and `payment.updated`. Keep its **signature key**.
   - Copy the production **access token**.
2. **Cloudflare**: create a D1 database named `shieldmaiden-square-lab`, put its ID in
   `labs/square/wrangler.jsonc`, and put an Access application in front of
   `square-lab.shieldmaiden.hair` (owner only).
3. Secrets:
   ```bash
   pnpm wrangler secret put SQUARE_ACCESS_TOKEN --config labs/square/wrangler.jsonc
   pnpm wrangler secret put SQUARE_WEBHOOK_SIGNATURE_KEY --config labs/square/wrangler.jsonc
   ```
4. Deploy: `pnpm lab:square:deploy`

The Point of Sale API takes real payments (Square's test sandbox doesn't cover it), so use $1
charges and refund them in Square afterward. The page's checklist lists the cases to try.

Local run (no real Square): `pnpm lab:square:dev`
