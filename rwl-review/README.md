# RWL Review

A small portal for admin staff. It does two things with a Reason Why Letter (RWL):

1. **Check it before it goes to Compliance.** The letter is read against the review rubric in `src/rubric.js`, which is distilled from the Blacktower Sales Manual and from the objections that keep coming back. The result is a list of findings with the paragraph number, the issue and what would satisfy the rule.
2. **Fix it when it comes back.** Staff paste the email from Compliance. Each point is mapped to a concrete change in the letter. The changes are written into the Word file as **tracked changes** (Review > Accept/Reject in Word), under one author name, so the adviser sees and controls every edit. A draft reply to Compliance comes with it, mapping each point to the change made.

Nothing in the letter is changed silently. Edits that cannot be placed safely are listed for the adviser instead of guessed. Facts that neither the letter nor the email contain are left as `[placeholders]` and flagged under "The adviser needs to fill in".

## How it is built

| Part | What | Why |
|---|---|---|
| Cloudflare Worker (`src/worker.js`) | The web app and API | One small service, no servers to patch, runs in the UK/EU edge |
| Cloudflare D1 | Case records and an audit log | Who uploaded what, when, and what was run |
| Cloudflare R2 | The Word files (original and redlined) | Object storage with no public access; purged after `RETENTION_DAYS` |
| Cloudflare Access (production) | Sign-in with the firm's Microsoft 365 accounts | No passwords to manage; staff list controlled centrally |
| Claude API (`src/ai.js`) | The two reviews | Called server-side only; the key never reaches a browser; API traffic is not used for training |
| `src/docx.js` | Reads the Word file and writes tracked changes | Pure JavaScript; no Office needed on the server |

Staff never talk to Claude directly. They upload a file, paste an email and press one button.

## Running the sandbox (no Cloudflare account, no API key)

```
npm install
copy .dev.vars.example .dev.vars        (already done in this folder)
npm run dev
```

Open http://127.0.0.1:8787/ and sign in with any name and the passcode `sandbox`. With `MOCK_AI=1` in `.dev.vars` the Claude calls are replaced by a fixed mock answer, so the whole flow can be tried without a key. A fictional test letter is in `test/fixture-rwl.docx` (run `npm test` to rebuild it and to run the engine tests).

To test against the real model, remove `MOCK_AI` from `.dev.vars` and add `ANTHROPIC_API_KEY=...`.

If the local database reports "internal error", run from a short path:
`npx wrangler dev --persist-to %LOCALAPPDATA%\rwl-review-state`.

## Deploying (into the firm's own Cloudflare account)

1. `npx wrangler login` with the account that will own the service.
2. `npx wrangler d1 create rwl-review` and paste the id into `wrangler.toml`.
3. `npx wrangler r2 bucket create rwl-review-docs`.
4. Secrets: `npx wrangler secret put ANTHROPIC_API_KEY` (from the Anthropic Console, in the firm's name), `npx wrangler secret put SESSION_SECRET`, and for the interim passcode sign-in `npx wrangler secret put PORTAL_PASSCODE`.
5. `npx wrangler deploy`.
6. Put the Worker behind Cloudflare Access (Zero Trust > Access > Applications, Microsoft 365 as the identity provider), then set `ACCESS_TEAM` and `ACCESS_AUD` in `wrangler.toml` and redeploy. From then on the passcode page is switched off and every request carries a signed Access token that the Worker verifies.

Deploy from GitHub, not from a laptop: a push to `main` runs `wrangler deploy` in a GitHub Action with the Cloudflare token stored as a repository secret.

## Approvals this needs before real client letters go through it

- Blacktower Compliance and IT sign-off for the AI provider and the solution (Sales Manual s.12: AI tools are permitted only where both have formally approved them).
- A data-processing agreement with Anthropic (commercial API terms; zero-data-retention can be requested) and with Cloudflare, recorded in the firm's processor register.
- Agreement that admin staff use a case reference rather than the client's full name in the portal; the letter itself of course contains the name.

## Running cost (estimate)

A typical RWL is 5,000 to 6,000 words, about 8,000 tokens, plus about 2,000 tokens of rubric and instructions.

| Step | Input | Output (incl. reasoning) | Cost at Claude Opus 5.5 ($4 / $20 per million tokens) |
|---|---|---|---|
| Pre-check | ~10k | ~5k | ~$0.14 |
| Map compliance email and draft edits | ~11k | ~8k | ~$0.20 |
| **Both steps, one letter** | | | **~$0.35 (about 27p)** |

At 5 letters a working day that is roughly $40 a month; at 20 a day roughly $150. Cloudflare Workers Paid is $5 a month (needed for the request time the reviews take); D1 and R2 stay inside the free allowances at this volume. The cached system prompt and rubric cut the input cost further on busy days.

## Files

```
src/worker.js   routes, sign-in, storage, audit log, nightly purge
src/ai.js       the two Claude calls, JSON schemas, sandbox mock
src/rubric.js   the review rules (edit this when a new objection type appears)
src/docx.js     Word reading and tracked-change writing
public/app.html the admin page
test/           fictional fixture letter and engine tests (npm test)
```
