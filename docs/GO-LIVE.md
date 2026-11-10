# Production go-live checklist

For opening **app.shieldmaiden.hair** for real business. Do the steps in order; each one
says who does it. Nothing here is done automatically by a Claude session: production is only
ever deployed by the owner from GitHub.

Checked on 2026-11-10: `app.shieldmaiden.hair` has no DNS record in the way, the
"Shieldmaiden HQ" sign-in app already protects it, and the `shieldmaiden-prod` database
exists and is empty.

## 1. Before you start

- [ ] **dev** has the version you want, and you've clicked through it on the iPad.
- [ ] **demo** is deployed and works (Actions → Deploy → Run workflow → `demo`).
- [ ] The `shieldmaiden-backups` storage bucket exists and is connected to production
      (see README → "Backups"). Without it the site works, but there are no nightly copies.
      The Home screen's **System health** panel says "not connected on this site yet" until then.

## 2. First deploy (owner, about 5 minutes)

- [ ] GitHub → **Actions** → **Deploy** → **Run workflow** → branch `main`, target
      **production** → **Run workflow**.
- [ ] Wait for the green check. This creates the `shieldmaiden-hq` Worker, connects
      `app.shieldmaiden.hair`, and sets up the empty database.
- [ ] GitHub → **Releases**: there is now a release named for today (e.g. `v2026.11.12`).
      That is the **first release tag**; every later production deploy adds one, so the
      latest release is always what's live. If it's missing, the deploy step failed after
      going live; tell the developer.

## 3. First sign-in and staff (owner)

- [ ] Open **app.shieldmaiden.hair** and sign in as `smbraidin@gmail.com`. The first
      sign-in from that email creates the owner account.
- [ ] **Staff → Add someone** for each person, with the email they sign in with. **Do this
      before step 4.** At minimum:
  - [ ] Caleb, `calebdillenbeck@gmail.com` (choose the role you want him to have).
  - [ ] Makayla, `makayla.dilly@gmail.com`, braider.

  Why first: Caleb and Makayla are on the production sign-in list today because they were
  added by hand. Once step 4 is done, the list is made to match the Staff screen exactly,
  so anyone not on the Staff screen would be signed out for good.

- [ ] Add Becca, Malia, Savanah and Amren whenever you have their emails (now or later).

## 4. Turn on the sign-in list (owner, in Cloudflare)

The Worker only exists after step 2, so this can't be done earlier.

- [ ] Make the token: Cloudflare → **My Profile → API Tokens → Create Token → Custom
      token**. Name it `Shieldmaiden HQ sign-in list (production)`. Permission:
      **Account → Access: Apps and Policies → Edit**, on your account only. Nothing else.
- [ ] Cloudflare → **Workers & Pages** → `shieldmaiden-hq` → **Settings → Variables and
      Secrets → Add** → type **Secret**, name `ACCESS_ADMIN_TOKEN`, paste the token → **Deploy**.
      (You can reuse dev's token if you'd rather keep one; it needs the same permission.)
- [ ] In the app: **Staff → Sign-in list → Update now**. It should say **Up to date** with
      the number of people who have emails.

No other secrets are needed today. When Square checkout is built into the main app, its
`SQUARE_ACCESS_TOKEN` goes on this Worker the same way.

## 5. Check it's healthy (owner)

- [ ] **Home → System health** says **all good**.
- [ ] Tap **Back up now** once. It should say "Backed up just now". After that it runs
      every night around 3am and keeps 30 days.
- [ ] Sign in on the checkout iPad (it uses `smbraidin@gmail.com`).

## 6. Day to day after go-live

- New versions: check dev, then **Actions → Deploy → production**. Each one gets a release.
- If something looks wrong, see README → "When something goes wrong".
- To undo a bad version: GitHub → **Actions → Deploy**, find the last good run, and
  **Re-run all jobs** (database changes only ever add, so the older code still works).
