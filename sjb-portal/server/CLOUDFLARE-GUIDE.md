# SJB Fact Find on Cloudflare — setup guide

Nothing to install on your PC, nothing to maintain afterwards, and £0. Everything happens in the Cloudflare website. Budget 20 minutes.

You need: the file **`worker.js`** from the package, and a Cloudflare account.

**How it fits together:** Cloudflare runs the software at the edge ("a Worker"), stores the records in its database ("D1"), and gives you a web address with HTTPS. Your portal is at that address; each client gets a link under it.

---

## Part A — Account and address (5 min)

1. Go to **dash.cloudflare.com/sign-up**. Use your SJB email. Verify the email. **No card is needed** for the free plan.
2. Once in, left menu → **Workers & Pages**. The first time, it asks you to choose a **workers.dev subdomain** — type `sjb-global` (or similar). Your portal will live at `https://sjb-factfind.sjb-global.workers.dev`. That address is free and permanent.

> Want `factfind.sjb-global.com` instead? That needs the sjb-global.com domain's DNS to be managed by Cloudflare (also free) — an IT decision for later. The workers.dev address works fine to start, and you can add the branded one any time without changing anything else.

## Part B — The database (3 min)

1. Left menu → **Storage & Databases → D1 SQL Database → Create**.
2. Name: `sjb-factfind`. Location: **Western Europe**. Create.

Nothing else — the software creates its own tables on first use.

## Part C — The Worker (7 min)

1. **Workers & Pages → Create → Create Worker**. Name it `sjb-factfind`. Press **Deploy** (it deploys a placeholder — fine).
2. Press **Edit code**. Select everything in the editor (Ctrl+A), delete it, then open `worker.js` from the package in Notepad, select all, copy, and paste into the editor. It is a large file — give the paste a few seconds. Press **Deploy**.
3. Go back to the Worker's page → **Settings**.
4. **Bindings → Add → D1 database**: variable name `DB`, database `sjb-factfind`. Save.
5. **Variables and Secrets → Add**:
   - Type **Secret**, name `SECRET`, value: a long random string — open **random.org/passwords** or mash the keyboard for 40+ characters. This signs your login sessions.
   - Type **Secret**, name `SETUP_CODE`, value: any word you choose (e.g. `marbella-2026`). You will type it once in the next step. It stops a stranger creating the first login before you do.
   - Save. Cloudflare redeploys automatically.

## Part D — First login (2 min)

1. Open **https://sjb-factfind.sjb-global.workers.dev/setup** (your own address).
2. Enter your email, a password (10+ characters) and the setup code. **Create login.** This page then switches itself off for good.
3. You land on the portal. Sign in. **Settings**: your name, phone, the admin work-request inbox.
4. **Clients → Send to a new client**. Name and email → the client's personal link is created and a draft opens in Outlook. Send it.
5. When they press Submit, the green **"Fact Find returned"** banner appears and the record is already filled. Create the MADS from it as usual.

---

## Good to know

- **Backups:** Export → *Download a full backup* in the portal, as often as you like. Cloudflare also keeps its own point-in-time backups of the database for 30 days (D1 → your database → *Time Travel*).
- **Add a colleague:** there is no command line here. Sign in, go to Settings → (for now) send me their email and I will add a small "invite" screen — or add them through D1's console with a one-line insert I can give you.
- **Email notifications** (optional): returned Fact Finds always show in the portal. For an email too, create a free account at **resend.com**, get an API key, and add it as a Secret named `RESEND_API_KEY` (and a variable `MAIL_FROM` such as `SJB Fact Find <factfind@sjb-global.com>` once you verify the domain there). Without it, nothing is lost — the banner does the job.
- **Updating the software later:** Edit code → paste the new `worker.js` → Deploy. Records live in the database, untouched.
- **Free-plan limits:** 100,000 requests a day and 5 GB of database. A Fact Find is a few dozen requests; you will not get near either.

## Where the data is, for compliance

- Records are stored in Cloudflare D1, region **Western Europe**, encrypted at rest, over HTTPS only.
- Cloudflare, Inc. is a US company acting as a processor; their standard terms include the EU/UK data-processing addendum. Keep a note of that for your compliance file.
- Adviser logins are password-protected; client links are unguessable 24-byte tokens that expire after 45 days.
- No analytics, no third-party scripts, no other services called (except Resend if you choose to enable email).

## Cost

| | |
|---|---|
| Cloudflare Workers + D1 free plan | £0 |
| workers.dev address with HTTPS | £0 |
| The software | £0 |
