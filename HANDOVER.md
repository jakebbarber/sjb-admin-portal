# SJB Admin Portal — handover brief

Written 12 and 13 October 2026 across a Claude Code session with Dion Angove (adviser, SJB Global). This folder is meant to let a fresh Claude Code session, in Jake's account, pick up exactly where that one left off. Everything needed is in this folder; nothing depends on the old session.

## 0. Status at handover (13 October 2026)

**What works, in the sandbox, with fictional data only:**

- One sign-in with a choice of **Adviser portal** (the existing Fact Find / LifePlan portal, unchanged) or **Admin portal** (new).
- The Admin portal has four tools, each a card on Home and an entry in the rail: **RWL Review** (check and score a letter against the Blacktower manual, four-eyes approval with a locked version, mark as sent, paste the compliance email when it comes back, tracked-change redline plus a draft reply, audit log CSV), **RWL Templates** (bring a mail-merge template in line with the manual, tracked changes, mail-merge safety proven), **Sales Manual** (upload the current manual, rebuild the checklist from it), **Insights** (scores, bounce-back rate, objections by rule, adviser and template, suggested new rules).
- Claude is called only server-side through the API (`claude-opus-5-5`, structured JSON, cached system prompt with the manual). In the sandbox it is mocked (`MOCK_AI=1`); nothing has been run against the real model yet.
- The live portal on Dion's Cloudflare account is untouched. **Nothing is deployed.**

**How to run it:** `sjb-portal/start-sandbox.cmd`, then http://127.0.0.1:8787/setup (setup code `sandbox`) to create a login, then sign in choosing Admin portal. Test files: `sjb-portal/fixture-rwl.docx` (a letter) and `sjb-portal/fixture-template.docx` (a mail-merge template with 20 fields). Tests: `cd rwl-review && npm install && npm test` (engine tests plus the mail-merge safety tests against the portal engine).

**What to do next, in order:** section 6a (Jake's roadmap: wait for the session transcript before building AO1, AO2, Apps In), then section 5's "still open" list (admin-only gating, real-model test with an API key and a small evaluation set, Fact Find cross-check), then section 3's deploy steps when Jake's Cloudflare and Anthropic accounts exist and Blacktower have approved.

**Read before changing the Word engine:** section 5, "mail-merge safety". The templates are MADS mail-merge documents and must keep working; `rwl-review/test/merge.test.cjs` must stay green.

## 1. The problem being solved

Reason Why Letters (RWLs, suitability reports) go from SJB advisers to Blacktower (BFMCL, the network / principal). Blacktower Compliance runs each letter through Microsoft Copilot, prompted with the **BT Sales Manual**, and sends back a numbered list of objections. The same kinds of objection come back every time. Example of a real compliance email (six points, client details omitted):

1. The cashflow forecast shows the client meets the retirement objective with or without the transfer, yet the letter presents the cashflow as if it drives the recommendation. Say plainly it does not, and say what does.
2. The strongest rationale (client wants a specialist cross-border adviser; is French tax resident; splits time between France and the UK; may retire in Spain, Italy or elsewhere; needs cross-border withdrawal planning; requires Sharia-compliant investing; wants an ongoing advisory relationship) is not the focus of the recommendation.
3. Omission: the client is currently French tax resident, and the letter says nothing about taxation on withdrawal depending on residence at the time, nor the need for local tax advice.
4. The cashflow assumptions (business income of about £156k continuing throughout) need prominence, with what happens if they fail.
5. Remove "Better Performance" as a reason: it cannot be evidenced or guaranteed.
6. Where a reduced fee is agreed, the wording must confirm the full servicing proposition continues.

Jake (CEO, SJB Global) asked for "a process and system where we can add these documents and the email from compliance and have you make the changes to the report". Dion then said: "I don't just want this one doing, I want a whole new system as this will keep happening on a daily basis."

## 2. Decisions already made (do not re-open)

- **Portal, not direct AI use.** Admin staff must never use Claude directly. They upload the Word file, paste the compliance email, press one button, download the redlined letter and a draft reply. Claude runs server-side through the API.
- **Sandbox first, then deploy.** Run locally with `wrangler dev`. Nothing deployed until told.
- **Accounts belong to the firm.** Jake sets up his own Cloudflare account and his own Anthropic Console account (API key). Nothing goes on Dion's accounts.
- **GitHub for all code.** Repos in the firm's GitHub org; deploy from a GitHub Action on push to main.
- **Jake has been sent an email** describing the approach and the reasons (data protection, simplicity, control, consistency, approvals, cost). The email does **not** say a prototype exists. Do not assume Jake knows it is built unless Dion says so.
- **Cost estimate given:** about $0.35 (27p) per letter for both steps on Claude Opus 5.5, so roughly $40 a month at five letters a day, plus $5 a month for Cloudflare Workers Paid.
- **Blacktower approval is required** before any real letter goes through it (Sales Manual s.12: AI tools only where Compliance and IT have formally approved the provider and the solution). A data-processing agreement with Anthropic and Cloudflare is part of that.
- **Latest direction (the next task):** the RWL tool must look and feel like the existing SJB Portal and be **added on to it**, and the combined thing becomes the **SJB Admin Portal**. See section 5.

## 3. What exists in this folder

### `rwl-review/` — the RWL Review prototype (working, sandbox-tested, not deployed)

A standalone Cloudflare Worker. Verified end to end on 12 Oct 2026 with a fictional letter; 12 of 12 engine tests pass; Word confirmed the tracked changes.

| File | What it does |
|---|---|
| `src/worker.js` | Routes, sign-in (passcode in sandbox, Cloudflare Access with Microsoft 365 in production, JWT verified against the team's JWKS), D1 case records and audit log, R2 file storage, nightly purge after `RETENTION_DAYS` |
| `src/ai.js` | The only two Claude calls: `precheck(letter)` and `planEdits(letter, email)`. JSON-schema structured output, `claude-opus-5-5`, effort high, `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`, cached system prompt. `MOCK_AI=1` returns fixed answers so the whole flow runs without a key |
| `src/rubric.js` | 15 review rules distilled from the BT Sales Manual and the recurring objections (R1 objectives-led rationale, R2 cashflow not the reason, R3 assumptions prominent, R4 switching 13.9, R5 cross-border tax residence, R6 tax caveat 13.5, R7 no performance claims, R8 risk, R9 costs, R10 reduced fee keeps servicing, R11 alternatives, R12 scope, R13 consistency, R14 plain language, R15 four-eyes ready) |
| `src/docx.js` | Reads a .docx (fflate), numbers its paragraphs for the reviewer, writes edits back as Word tracked changes (`w:ins`/`w:del`, one author, deleted paragraph marks done correctly). Edits are anchored by paragraph number plus anchor text; an edit that cannot be placed is skipped and reported, never applied to the wrong place. Applies bottom-up so offsets stay valid. Checks tag balance before writing |
| `public/app.html` | The admin page: list of cases; New review (reference, adviser, drop the .docx); step 2 pre-check; step 3 paste email, "Work out the changes"; step 4 tick/untick each proposed change, "Write the redlined Word file"; Done card with download and a copyable reply to Compliance; history |
| `test/make_fixture.cjs` | Builds the fictional letter `test/fixture-rwl.docx` (Dana Hale) with the `docx` npm package |
| `test/engine.test.mjs` | Engine tests (`npm test`) |
| `start-sandbox.cmd` | Double-click to run the sandbox on http://127.0.0.1:8787/ (passcode `sandbox`) |
| `README.md` | Build, sandbox, deploy steps, approvals, cost table |

Edit shape the model returns (and the engine consumes):

```
{ op: 'replace' | 'insert_after' | 'delete', para: <number>, anchor: <first words of that paragraph>,
  lead: <optional bold lead-in>, text: <new text, blank line = new paragraph>, point: <email point no>, reason: <why> }
```

Known sandbox gotcha: local D1 reports "internal error" when the project path is long. Run `npx wrangler dev --persist-to %LOCALAPPDATA%\rwl-review-state` (the cmd file does this).

### `sjb-portal/` — the full source of the live SJB Portal (Fact Find + LifePlan)

Live at https://sjb-factfind.dion-angove.workers.dev on Dion's Cloudflare account (D1 `sjb-factfind`, real client records; do not point a sandbox at it). This is the source the next task builds on.

- `ff/*.html` — the portal is assembled from parts in this order: `w01, w02, w03, w03s, w06_cols.js, w07, w08_cells.js, w09, w10, w04, w05, wp, wc, wr, ws, wl, wa, wrep, wreco, wtx, wfb, w99`. `w01` = stylesheet and tokens (SJB charcoal rail, orange and blue, Manrope), `w02` = schema (sections, field lists), `w03s` = portal store and `api()` helper, `w04` = shell (`S` state object, `railHTML()`, `topHTML()`, screens), `w05` = `render()` and `boot()`, `wc` = cashflow engine, `wr` = client report, `wtx` = transcript module, `wa` = assistant, `wfb` = feedback.
- `server/app.js` — `createApp(deps)` with every `/api/*` route: login, state sync, uploads (chunked base64 into D1 `files`/`filechunks`), AI drafting (`AI_PROMPTS`, Workers AI via `deps.ai`), admin-only user management (`isAdmin`).
- `server/worker_tail.js` — Cloudflare wiring: `D1Store` (one `docs` table of JSON by collection), `/setup` first-login page, `/api/diag`, `runAI` (Workers AI llama models with fallback), routing to `APP_HTML`, `FORM_HTML`, `DOCS_HTML`.
- `build_server.ps1` → `server/public/app.html`, `form.html`, `docs.html`, `shared.js`, then `build_worker.ps1` → `server/worker.js` (everything embedded as JSON strings + the tail). Paths are now relative to the folder. Run `node checkregex.js` after every build (guards against collapsed regex escapes in the built file). `node mkfull.js <harness>` builds a browser test page from `harness/*.html` (the two MADS harnesses need workbook fixtures that are not included).
- `wrangler.toml` — the live config (`no_bundle`, `find_additional_modules=false`, D1 binding `DB`, `[ai]` binding). `worker.js` — the currently deployed build. Both are references; a new account needs its own D1 id and secrets (`SECRET`, `SETUP_CODE`).
- `serve.ps1` — static server on :8123 for the harness pages.

Local real-model testing of the portal was done with `npx wrangler dev --port N` from a **short** path, with `.dev.vars` holding `SECRET` and `SETUP_CODE`, then `/api/setup` and `/api/login`. Do not pass `--local` (it disables the AI binding).

### `notes/` — working notes carried over

`sjb-factfind-tool.md` (what the portal is and how it is built, with the cashflow rewrite, client report and transcript module history), `sjb-brand-tokens.md` (palette, Manrope, logo trick), `sjb-wealth-platform-prototype.md`, `sjb-rwl-review.md`, `patch-script-gotchas.md` (use a function replacement in `String.replace`; insert app code before the IIFE close).

### Not included, on purpose

- Real client documents: the Blacktower compliance email, the rejected RWL, the MADS workbooks, meeting transcripts. The first worked example (the real RWL with the six points applied as 16 tracked changes) is held by Dion as a Word file (16 tracked changes); it must not go into a repo.
- The BT Sales Manual PDF. Its relevant rules are encoded in `rwl-review/src/rubric.js`; get the PDF from Dion or Jake if the rubric needs extending.
- Anything about Dion's other business. The old session covered unrelated matters; they are not part of this work.

## 4. How to run what exists

```
cd rwl-review
npm install
npm test            # builds the fictional letter and runs the engine tests
start-sandbox.cmd   # http://127.0.0.1:8787/, any name, passcode: sandbox
```

Upload `test\fixture-rwl.docx`, paste any three-point "compliance email" (the mock looks for the words cashflow, better performance, reduced fee), work through steps 2 to 4, download the redlined file and open it in Word with Review > Track Changes showing.

To use the real model in the sandbox: put `ANTHROPIC_API_KEY=...` in `.dev.vars` and remove the `MOCK_AI` line.

## 5. Done later on 12 Oct: the Admin Portal, with RWL Review as its first tool

Dion's words, in order: "with the tool, it needs to be like the SJB Portal we built, and add on to that really, and make it the SJB Admin portal"; then "I need it to be separate to the SJB Adviser Portal, and we need on the sign in page, an admin portal option where this tool lives"; then "the idea is we keep building new tools in there, but we need to get this one sorted first." This was built the same afternoon, in the sandbox only, and is what `sjb-portal/` now contains:

- **One sign-in, two portals.** The sign-in card (`ff/wp.html`, wrapped by `ff/wadm.html`) now asks "Which portal?" with two buttons, Adviser portal and Admin portal. The choice is remembered in the browser and shown as `#admin` in the address bar. After sign-in the person lands in the portal they chose. The adviser side is labelled **Adviser Portal** and is unchanged apart from the label; nothing from the Admin portal appears in it. The page title is **SJB Portal**.
- **`ff/wadm.html`** (new): the Admin portal shell. Its own rail (Home, then a **Tools** list, then "Switch to Adviser portal"), its own top bar (Feedback, Sign out), a Home screen that shows one card per tool, and a render wrapper that takes over whenever the admin portal is selected. **Tools register themselves** with `adminTool({id, name, icon, action, screen, desc, count})` from their own part file, so adding a tool is a new part file in the build order after `wadm` and nothing else: it gets a rail entry and a Home card automatically.
- **`ff/wrwl.html`** (new, after `wadm` in the build order): the RWL Review tool. Registers with `adminTool`, and adds its actions to `ACT` (`rwlHome`, `rwlNew`, `rwlOpen`, `rwlUpload`, `rwlPrecheck`, `rwlRevise`, `rwlApply`, `rwlDelete`, `rwlCopy`, `rwlRefresh`). Screens: a list of letters, New review (reference, adviser, drop the .docx), the four numbered steps (check against the manual, paste the compliance email, review the proposed changes with tick boxes, write the redlined Word file), the Done card with the download and a copyable reply, and a history table.
- **`server/rwl_server.js`** (new): rubric, Word engine, the two Claude calls over `fetch` (the Worker is uploaded unbundled, so no SDK), the sandbox mock, storage of the Word files as base64 chunks in the existing store (`rwlcases`, `rwlfiles`, `rwlchunks`), and the routes under `/api/rwl/...`. `server/app.js` loads it the same dual way as `shared.js` and hands `/api/rwl/*` to it after sign-in. `server/worker_tail.js` passes `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `MOCK_AI`, `RWL_AUTHOR` and the `fflate` global through `deps`.
- **`server/fflate.umd.js`**: the zip library, concatenated into the worker by `build_worker.ps1` ahead of `rwl_server.js`.
- **Verified**: built with `build_server.ps1` → `checkregex.js` (clean) → `build_worker.ps1`; the worker passes a syntax check; run with `wrangler dev` from a short path with `MOCK_AI=1`; first login created at `/setup`; the full flow (upload the fictional letter, pre-check, paste email, work out changes, write redline, download) ran through the API and through the page; the sign-in choice, the Admin home, the rail and the switch back to the Adviser portal were checked in the browser. The built `worker.js` in `sjb-portal/` is that build. **Not deployed.** The live worker on Dion's account is untouched.
- **Run it**: `sjb-portal/start-sandbox.cmd` copies the worker and `wrangler.sandbox.toml` (the live config minus the Workers AI binding, so wrangler never has to reach Cloudflare) to `%LOCALAPPDATA%\sjb-admin-sandbox` and keeps the database state in a sibling folder. Then `/setup` with code `sandbox`, sign in choosing Admin portal, open RWL Review, upload `sjb-portal/fixture-rwl.docx`. Two lessons from getting this running: a database or log file inside the folder wrangler watches makes it reload in a loop, and the Workers AI binding makes local dev hang when it cannot reach Cloudflare.

The standalone `rwl-review/` is kept as the reference implementation and for its engine tests, but the portal version is the one to carry forward.

### Added the same evening: templates and the manual itself

Dion: "because we use templates for these RWLs we need a section on the admin portal where we can add these templates and get them in line with the blacktower sales manual, once we do that, then if we have any bounce backs we just use the RWL review tool (which needs refining) then we are good to go" and "we need to be able to upload a new manual if they update it." So the Admin portal now has three tools, all sandbox-tested through the API:

- **RWL Templates** (`ff/wtpl.html`, server `tplHandle` in `rwl_server.js`, routes `/api/rwltpl/...`). Upload a template (.docx, with a name and type of advice), **Check the template** against the manual and checklist (template-aware prompt: merge fields and placeholders are expected; it looks for mandatory content the template does not prompt for and standing wording that would be flagged), tick the changes, **Write the aligned template** as tracked changes, download it, and copy the notes for the team (what changed, what the adviser now fills in per letter). Store: `rwltemplates` plus the same chunked file store.
- **Sales Manual** (`ff/wman.html`, server `manualHandle`, routes `/api/rwlmanual` and `/api/rwlmanual/rubric`). Upload the current manual: a PDF is read in the browser with the portal's own `pdfRead` (from `wreco`) and only the text is sent; a .docx is read on the server. The text is stored in chunks (`rwltext`, meta in `rwlmanual/main`) and **every review, revise and template check now sends it to Claude** as a cached system block after the checklist ("the manual is the authority; where the two differ, follow the manual and say so"). **Rebuild from the manual** asks Claude for an updated checklist (schema-checked, 10 to 30 rules, stored in `rwlrubric/main` with the manual version as its source); **Reset to built-in** drops it. `loadRules(store)` is the single place the rules in force come from.
- **RWL Review** is unchanged in flow and now reads the stored manual and checklist too.

A note on size: a 40-page manual is roughly 120k characters, about 30k tokens, sent on every call. With the cached system block that costs little after the first call in each five-minute window; without caching it would add roughly $0.12 per call at Opus 5.5 rates. `MANUAL_MAX` caps what is sent at 400k characters.

Server routing: `app.js` hands every path starting `/api/rwl` to `rwlHandle`, which dispatches `/api/rwltpl/` and `/api/rwlmanual` itself.

### Added 13 Oct: the gate, evidence, automatic checks, four-eyes workflow, audit export and Insights

Dion asked what would make this the best tool of its kind, then "can you build that then". Built and sandbox-tested the same morning (`ff/wrwl.html` rewritten, `ff/wins.html` new, `rwl_server.js` extended; `patch_gate.js` and `patch_checks3.js` in the scratchpad show the exact edits):

- **Score and gate.** Every pre-check now returns a score (100, minus 15 per "must" finding and 5 per "should"), a readability line, and a merged list of reviewer findings plus automatic checks. The case screen shows a journey strip (Uploaded, Checked, Approved, Sent, Returned, Redlined, Resubmitted, Closed). **Nothing can be marked as sent until it has been checked and approved.**
- **Evidence.** Each finding carries `quote` (the exact words in the letter) and `manual_ref` (the rubric id and the manual section it rests on); the prompt asks for both, the schema requires both, the table shows them under the issue.
- **Automatic checks (code, not AI)** merged in as rules C1 to C7: names agree with the salutation (C1), each fee term has one percentage per sentence across the letter (C2), no future dates and the meeting precedes the letter (C3), more than one currency used (C4), template residue such as `[...]`, TBC, XXX (C5), sentences over 55 words (C6), built from a template that is not aligned (C7). `codeChecks(letter,{template})` in `rwl_server.js`.
- **Four eyes.** `POST /:id/approve` refuses while any "must" finding is open unless each has an override reason of 10+ characters; refuses when the approver is the person who uploaded the letter (admins may self-approve, and the log says so); records approver, time, score, overrides and a SHA-256 of the letter text. `POST /:id/submit` refuses if the letter changed since approval (hash check); `submit` from the redlined state records a resubmission; `close` records Blacktower's outcome; `reopen` undoes a close. `GET /:id/audit` downloads the full audit log as CSV (events, approval record with hash and overrides, submissions).
- **Learning from bounce-backs.** Every point in a compliance email now comes back with `rule` (the checklist rule it matches, or `NEW`) and `new_rule` (a suggested rule when NEW); the case keeps a `returns` history. `GET /api/rwl/insights` aggregates across all cases: letters, average score, bounce-back rate, time from email to redline, top objections by rule with examples, what the pre-check catches most, by adviser, by template, and the suggested new rules. The **Insights** tool (`wins.html`) shows it.
- **Templates on cases.** New review has a "Built from template" dropdown (from RWL Templates); the case records the template and whether it was aligned at the time, which feeds C7 and the by-template table.

### Added 13 Oct: mail-merge safety (the templates are MADS mail-merge documents)

Dion: "we use the MADS for mail merge, so these templates will still need to work the same, so it cannot be broken." The Word engine in `rwl_server.js` is now merge-field aware, and it is proven by tests and by Word itself:

- **Fields are visible to the reviewer** as `«Field_Name»` in the numbered text, and the template prompt says to keep every one exactly, reuse existing fields rather than placeholders, and never invent a field.
- **Rebuilt as real fields.** When inserted or replacement text contains `«Field_Name»`, the engine writes a real complex MERGEFIELD (begin, instrText with the template's own field code and switches, separate, result, end) inside the tracked insertion, so accepting the change gives a working field.
- **A replace that would drop a field is refused** and reported ("would remove the mail-merge field «X»; keep the field in the new wording"). An explicit delete of a paragraph is allowed and deletes the field properly: simple fields are expanded to the complex form first, and field codes go out as `w:delInstrText`, the way Word writes a tracked field deletion. Without that step the field code would have survived the deletion as an orphan.
- **Verified after every redline.** `mergeFields(acceptedView(xml))` recounts the fields as they will be once all changes are accepted; the result carries `merge:{before,after,missing,names}`, the template screen shows "Mail merge safe. All N merge fields are still there" or a red warning naming the missing fields, and the template record stores its field list from upload.
- **Proof.** `rwl-review/test/make_template.cjs` builds a fictional template with 20 real MERGEFIELDs (`fixture-template.docx`); `rwl-review/test/merge.test.cjs` runs 11 checks against the portal engine (all pass); and Word, driven by COM, opened the original (20 mail-merge fields), the redlined copy (4 revisions), accepted all, and reported 21 mail-merge fields with every code intact, the salutation rebuilt as `Dear «Client_Title» «Client_Surname»`, and the performance bullet gone. The same fixture ran through the sandbox's RWL Templates tool end to end.

Known limits: field codes inside headers, footers and text boxes are untouched because the engine only edits `word/document.xml` body paragraphs; nested fields (IF ... MERGEFIELD ...) are preserved verbatim but the reviewer sees only their result text; the mail-merge data-source link in `settings.xml` is never modified.

Still open from the list of improvements: the Fact Find cross-check (objectives, risk, residence and vulnerability flags from the Adviser portal record), Consumer Duty rewrites beyond the sentence-length check, email-in and pack-out, an evaluation set built from real bounce-backs, and the production hardening (Access, roles, retention, DPA).

### Added 13 Oct (Jake's session): the CashCalc reconciliation, and a Node build

Jake: "make sure the cashcalc is checked against the cashcalc summary in the RWL also, to make sure it matches, as that's often one of the problems with the compliance checks." Built and sandbox-tested:

- **The CashCalc report is attached to the case** (card "1b" on the case screen, `POST/DELETE /api/rwl/cases/:id/cashcalc`). A PDF is read in the browser with the portal's own `pdfRead` (as the Sales Manual is) and only the text is sent; a Word export is read on the server. The text is stored in chunks (`rwltext`, key `cc.<caseId>`), and attaching a report resets any earlier check so it must be re-run.
- **C8, in code:** `cashflowCheck(letter, report)` picks the letter's cashflow summary (the paragraphs under a cashflow or forecast heading, plus any paragraph that cites the cashflow), pulls out every figure (money, percentages, ages, years; dates are left to C3) and checks each one appears in the report. A figure that does not is a "must" finding naming it; no report attached when the letter has a cashflow summary is a "should" finding. The card shows "Figures reconcile" or the missing figures.
- **R16, by the reviewer:** a new rubric rule; the report goes to Claude with the letter and the prompt asks for a finding on every difference in assumptions, scenarios and the conclusion (for example a shortfall the letter does not mention). The sandbox mock raises it when the report says "shortfall" and the letter does not.
- **Fixture and tests:** `rwl-review/test/make_cashcalc.cjs` builds `fixture-cashcalc.docx` (fictional; it deliberately disagrees with the fixture letter: income 85,000 not 90,000, and a shortfall from 2049 without the transfer). `cashcalc.test.cjs` runs 18 checks; `npm test` now runs engine, merge and cashcalc tests (12 + 11 + 18, all green). The Word engine is untouched.
- **`sjb-portal/build.js`:** the same build as `build_server.ps1` + `build_worker.ps1` in Node, for Linux (GitHub Actions, cloud Claude Code sessions). Verified byte-identical to the PowerShell output apart from the build stamp. Run `node build.js` then `node checkregex.js`.

Open question for Jake or Dion: what the real CashCalc export looks like (PDF report, which sections). The figure extraction is written for ordinary prose and tables of amounts; a sample export (fictional client) would let the test fixture match it.

### Prepared 13 Oct: the demo deployment (not yet run)

Jake wants to demo the Admin portal from a link, and agreed to set up the firm's Cloudflare account and link it to GitHub. Decided: **one repo, two Workers** on Jake's account, `sjb-admin-demo` (this branch, mocked AI, fictional data, its own empty database) and later `sjb-admin` (live, from `main`, after Blacktower approve). Ready on this branch: `sjb-portal/wrangler.demo.toml` and `.github/workflows/deploy-demo.yml`, which runs the tests, builds the worker with `build.js`, creates the demo database if missing, deploys, and sets the two secrets. It needs four repo secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DEMO_SECRET`, `DEMO_SETUP_CODE`) and refuses to run without them. First visit after deploy: `https://sjb-admin-demo.<subdomain>.workers.dev/setup`.

### Added 13 Oct (Jake): the API key and the backup model

Jake: "link the API key from Claude to be the AI that runs this portal ... then we need a backup AI as well." Decided and built:

- **The key** stays a Worker secret (`ANTHROPIC_API_KEY`), set from a GitHub secret by the demo workflow, which then switches `MOCK_AI` off. Blacktower's provider approval and the Anthropic DPA are still required before real letters.
- **Backup, both within Claude.** Layer 1, already there: `fallbacks:'default'` re-routes a declined request server-side. Layer 2, new in `askClaude`: a rate limit, overload, 5xx or network failure is retried once on the main model, then once on `CLAUDE_FALLBACK_MODEL` (default `claude-sonnet-5-5`); our own 4xx mistakes are not retried. The case history says "backup model" when it answered. `rwl-review/test/fallback.test.cjs` (8 checks, fetch stubbed) covers it.
- **Not a different provider as backup**, by recommendation: it would need its own Blacktower approval and DPA, the prompts and schemas are Claude's, and a silently weaker review is worse than "the reviewer is unavailable, try again shortly". The code checks C1 to C8 keep working without any model and the gate stays closed until a check has run.

### Learned 13 Oct (Jake): a second real bounce-back, turned into rules and checks

Jake shared a compliance email from Tom at Blacktower on a live case (client details, figures and the letter are NOT in this repo and must not be). The pattern, sanitised:

- Tom's own points: the rationale rested on consolidation and receiving advice only; the letter did not say whether the existing plans could receive cross-border advice, nor why not consolidate into one of them if so; capacity for loss was missing.
- Blacktower's AI review added: (1) the ongoing cost (adviser + platform + model fee + fund costs, about 1.3% a year) not justified against retaining, given a modest plan and a wealthy client; (2) the existing schemes already offered flexible drawdown, death benefits, non-UK access and no exit penalty, so what cannot be achieved within them was not explained; (3) the cashflow narrative gave income, expenditure and surplus in sterling while the fact find summary gave different figures in euros; (4) net and gross retirement income targets and the cashflow's retirement expenditure were not related to each other; (5) for a speculative client in a global equity strategy the risk narrative did not state the scale of loss, short-term falls, and why acceptable; (6) a plan shown with a transfer value in one place and a higher fund value (including a protected benefit) in another without the reason beside it; (7) the client's surname spelled two ways.

Built from it, all in `rwl_server.js` with tests in `rwl-review/test/checks.test.cjs` (11 checks):

- **Rules:** R4 and R8 strengthened (what the existing scheme cannot provide; capacity for loss as its own statement, scale of loss for adventurous strategies). New **R17** why not the existing plan (cross-border advice, consolidation into it), **R18** total ongoing cost summed and justified against retaining, **R19** retirement income figures reconciled and income/expenditure/surplus the same or explicitly converted everywhere.
- **Automatic checks:** **C1** now also catches the same surname spelled two ways (edit distance from the salutation surname). **C9** the same quantity (income, expenditure, surplus, assets, retirement income target) with different figures in different places: "must" in the same currency, "should" across currencies; a sentence that states the conversion is left alone; amounts are attributed to their own clause so "income of X and expenditure of Y" is read correctly. **C10** a plan valued two ways (transfer value against fund value) with no reason stated nearby.

A third email the same day (Tom, on a different case; no client data in it): (a) the letter closed a structured note with no word on the impact (maturity, return if held, price if sold now, bonuses lost); (b) "saving costs" was given as a client objective with the products unchanged, but the current fund costs and adviser charges were not shown beside the new ones. Built: **R20** impact of closing an existing holding, **R21** cost saving shown side by side with the saving stated; **C11** a holding is closed or encashed and the letter never mentions maturity, surrender value, penalty, bonus or guarantee; **C12** a cost saving is claimed and no existing charge appears with a percentage. Tests in the same file (16 checks now).

Every real bounce-back should go through this same step: sanitise, map each point to an existing rule or a new one, and add a code check where the point is mechanical. The Insights tool's "suggested new rules" will do the mapping automatically once letters go through the portal.
, as a pre-submission check section

Jake: "the CashCalc will need to reconcile with the MADS we use, and the summary in the MADS will need to align with the cashflow as well" then "it will need to reconcile with the Fact Find etc., maybe that will be AO1 really, maybe we leave that for now" and "I think that will be a section to build where the admin do their checks and see this problem early, before it goes out." So: a new Admin portal tool where admin reconcile the whole pack (MADS, Fact Find, CashCalc report, the letter) before anything is sent, probably the AO1 check or its first part. Left until the session transcript says what AO1 is. What is already known, so it is quick to pick up:

- The MADS is an `.xlsm` whose **Template sheet is the mail-merge surface**: row 1 holds every field name (2,779 columns in V3.26), row 2 holds formulas pointing at the input cells, and Excel stores the formula results as cached values in the same cells. Reading rows 1 and 2 of the Template sheet gives the complete field → value record the letter was merged from, with no need to know the layout of the other 31 sheets. The browser side already does this (`extractTemplateMap` in `ff/w09.html`: `sheetPaths`, `sharedStringsOf`); the server would need the same in `rwl_server.js` over fflate, reading only `xl/workbook.xml`, its rels, `xl/sharedStrings.xml` and the Template sheet.
- The check is then three-way: MADS cashflow facts (income, expenditure, pension values, retirement age, dates of birth, and the narrative fields such as the retirement-goals paragraph) must appear in the CashCalc report; the letter's cashflow summary must match the CashCalc (C8/R16, done); and the merge fields in the letter must carry the MADS values. `figuresOf` / `cashflowCheck` extend to it; the reviewer would get the MADS record as a third block. The Fact Find record in the Adviser portal is a fourth source (objectives, risk, residence) and is the cross-check already listed as open.
- Needs before building: a blank or fictional MADS of the version in use (V.28), and the AO1 process from the session transcript.

### What is still to do

1. **Admin gating.** RWL Review is currently visible to every signed-in user. Decide with Dion whether it should be `isAdmin` only, or a new `role` on user records (small change in `/api/users` and a check in `rwl_server.js`).
2. **Harness page.** Write `harness/rwltest.html` (built with `mkfull.js`) in the style of `txtest.html` to cover the engine and the screen inside the portal build, so the next change to the portal cannot silently break it. The engine itself is covered by `rwl-review/test/engine.test.mjs`.
3. **Real-model test.** Put an `ANTHROPIC_API_KEY` in the sandbox `.dev.vars`, remove `MOCK_AI`, and run a fictional letter through both steps; tune the prompts in `rwl_server.js` if the edits are too timid or too sweeping.
4. **Then**, when Dion and Jake say so: new repo in the firm's GitHub, GitHub Action running `wrangler deploy` with a Cloudflare API token secret, Jake's Cloudflare account (new D1, secrets `SECRET`, `SETUP_CODE`, `ANTHROPIC_API_KEY`), Blacktower approval before real letters.

## 6a. The roadmap Jake set (13 Oct 2026)

Jake replied to Dion's email: "Happy to do this. I'll tell Vickey to share all emails from Tom and Rob too so you have more to go off. I think what we can do is the following for both NB and EC: RWL checks for UK related business; AO1 Checks; AO2 Checks (including FRFs in the US); Apps In Checks."

So the Admin portal is to grow to four checks, each for new business (NB) and existing clients (EC). RWL Review is the first. The processes behind AO1, AO2 (and FRFs in the US) and Apps In are **not known yet**: Dion is holding a session with Jake, transcribing it, and the tools get built from that transcript. The question list for that session is in `Session with Jake - questions.md` in this folder. Do not guess what the acronyms mean or what the checks involve; wait for the transcript and the examples from Vickey, Tom and Rob.

## 6. Open questions for Dion or Jake

- Who may use RWL Review: all advisers, admin staff only, or both?
- Should the pre-check (step 2) be mandatory before a letter can be marked as sent to Blacktower?
- Retention period for uploaded letters (prototype: 30 days).
- Whether Blacktower will accept tracked changes from a system author name, or whether the adviser must accept all changes before resubmission (the reply note can say either).
