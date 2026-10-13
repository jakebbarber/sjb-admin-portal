# SJB Admin Portal — project instructions

Read `HANDOVER.md` first. It is the brief for continuing work that started in another Claude Code session on 12 October 2026, and it says what has been decided, what exists, and what to do next.

Standing rules from Dion Angove (the person who commissioned this):

- Never use a real client's personal information as seed, test or demonstration data. Create fictional clients (the fixtures use "Dana Hale" and "Peter Marlow").
- Never put real credentials in source. Secrets go in `.dev.vars` locally (git-ignored) and in Cloudflare secrets when deployed.
- Do not embed real client data in source code, and never expose provider secrets in browser code. Claude is called only from the server.
- Sandbox first. Nothing is deployed until Dion or Jake says so. "Build the prototype on Cloudflare" means run it with `wrangler dev` locally.
- All code lives in GitHub. Deploy from GitHub Actions, never from a laptop.
- The Cloudflare account and the Anthropic Console account for this system are Jake's or the firm's, not Dion's personal ones.
- Admin staff will use this. Keep it simple: upload, paste, one button, download.

Toolchain notes for this machine type (Windows, PowerShell): Word and Excel are available through COM; Python is not installed; `zip` is not in Git Bash (use PowerShell `Compress-Archive` or node); headless Chrome can print HTML to PDF. The portal build is PowerShell (`build_server.ps1`, then `build_worker.ps1`), run from `sjb-portal/`.
