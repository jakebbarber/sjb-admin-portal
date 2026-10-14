# SJB Admin Portal — start here

This folder is the complete code for the SJB Portal (Adviser portal + Admin portal), as of 14 October 2026. It is the branch `claude/dion-angove-handover-5cxnw6` of the repo `jakebbarber/sjb-admin-portal`. Nothing is deployed; the Cloudflare account is still being set up. The sandbox runs entirely on your own machine, with Claude mocked, so you can demo and test it with no accounts at all.

Read `HANDOVER.md` for the full brief (what the system is for, what has been decided, what exists, what to do next). `CLAUDE.md` holds the standing rules. This file is only the quickest route to a running sandbox.

## Run the sandbox on a Windows machine (about 10 minutes)

1. Install Node.js (LTS, 22 or later) from nodejs.org if it is not already there. Everything else downloads itself.
2. Unzip this folder somewhere with a **short path**, for example `C:\sjb` (a long path makes the local database fail with "internal error").
3. Open a command prompt in `C:\sjb\rwl-review` and run:
   ```
   npm install
   npm test
   ```
   You should see five lines ending "0 failed" (12 + 11 + 18 + 8 + 16 checks: the Word engine, the mail-merge safety, the CashCalc reconciliation, the Claude fallback, the automatic checks).
4. Double-click `C:\sjb\sjb-portal\start-sandbox.cmd`. It copies the built worker to `%LOCALAPPDATA%\sjb-admin-sandbox`, keeps the database beside it, and starts the local server. The first run downloads wrangler (a minute or two). Leave the window open; Ctrl+C stops it.
5. In a browser: **http://127.0.0.1:8787/setup** — create the first login with the setup code `sandbox` (any email, a password of 10+ characters).
6. Then **http://127.0.0.1:8787/** — choose **Admin portal**, sign in. The four tools are on the Home screen: RWL Review, RWL Templates, Sales Manual, Insights.

Claude is mocked in the sandbox (`MOCK_AI=1` in `%LOCALAPPDATA%\sjb-admin-sandbox\.dev.vars`): the checks and redlines run end to end with fixed, plausible answers, so no key and no cost. To use the real model, put `ANTHROPIC_API_KEY=sk-ant-...` in that `.dev.vars` and delete the `MOCK_AI` line, then restart the sandbox.

## Test files (all fictional; never use a real client document in the sandbox)

In `sjb-portal\`:

- `fixture-rwl.docx` — a Reason Why Letter for "Dana Hale". Use it in **RWL Review → New review**. Run the check: it scores 40/100 with three "must" findings; approval is refused until they are fixed or overridden (four-eyes, so the approver must be a different login, or an admin). Paste any three-point compliance email mentioning "cashflow", "better performance" and "reduced fee", click **Work out the changes**, then **Write the redlined Word file**, download it and open it in Word with Track Changes showing.
- `fixture-cashcalc.docx` — a CashCalc-style cashflow report that deliberately disagrees with the letter (income 85,000 not 90,000; a shortfall the letter does not mention). Attach it in the "1b · The CashCalc report" card on the case, run the check again: the score drops to 15 and the mismatches are listed.
- `fixture-template.docx` — a mail-merge template with 20 merge fields. Use it in **RWL Templates**: upload, **Check the template**, **Write the aligned template**, download. The screen must say "Mail merge safe. All 20 merge fields in the template are still there".

The Sales Manual tool accepts the BT manual as a PDF (read in the browser, only the text is stored). The Insights tool fills as cases go through.

## If something does not work

- "internal error" from the database: the path is too long; move the folder to `C:\sjb`.
- The server reloads in a loop: a database or log file has ended up inside the worker folder; the cmd file keeps them apart, so run it rather than `wrangler dev` by hand.
- The server hangs on start: the Workers AI binding is on; the sandbox config (`wrangler.sandbox.toml`) has it off, so again use the cmd file.
- Port 8787 in use: edit the port in `start-sandbox.cmd`.
- Rebuilding after a code change: on Windows run `build_server.ps1` then `build_worker.ps1` from `sjb-portal\` (PowerShell), or on any machine `node build.js` in `sjb-portal\`; then `node checkregex.js`; then restart the sandbox.

## What is in the folder

- `sjb-portal/` — the portal: `ff/*.html` parts (the Admin portal shell is `wadm.html`; the tools are `wrwl.html`, `wtpl.html`, `wman.html`, `wins.html`), `server/rwl_server.js` (the checklist R1–R21, the automatic checks C1–C12, the Word engine, the Claude calls with the backup model, the routes), `worker.js` (the built worker the sandbox runs), `build.js` / `build_*.ps1`, `start-sandbox.cmd`, `wrangler.sandbox.toml` (local), `wrangler.demo.toml` (the demo Worker for the firm's Cloudflare account, not yet used), the three fixtures.
- `rwl-review/` — the original standalone prototype, kept for its engine tests, plus `tools/` (the scripts that aligned the RWL templates with the Sales Manual and tested the mail merge).
- `.github/workflows/deploy-demo.yml` — deploys the demo Worker from GitHub once the four repo secrets exist (see HANDOVER). It refuses to run without them.
- `HANDOVER.md`, `session-summary.md`, `Session with Jake - questions.md`, `notes/` — the brief and the history.

## A prompt to give your AI

> Read START-HERE.md, then HANDOVER.md in full (section 0 is the status) and CLAUDE.md. Treat the decisions in HANDOVER section 2 as settled and the rules in CLAUDE.md as standing instructions: fictional data only, no real client documents, no credentials in source, nothing deployed, no Cloudflare or Anthropic account connected until I give you the details. Then get the sandbox running on this machine: `npm install` and `npm test` in rwl-review (all green), start `sjb-portal\start-sandbox.cmd`, create the first login at /setup with the code "sandbox", sign in choosing Admin portal, and run fixture-rwl.docx (with fixture-cashcalc.docx attached) through RWL Review and fixture-template.docx through RWL Templates. Tell me what you saw, and stop there until I say what to do next.

## Not in this folder, on purpose

The firm's RWL templates, the BT Sales Manual, the MADS workbook and any compliance emails. They are firm documents and one of them carried client details; they were handled outside the repo and handed back as a separate zip (the aligned templates with tracked changes and the mail-merge test report). Keep them out of the repo.
