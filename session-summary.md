# What happened in the previous session (SJB work only)

A chronological account of the parts of the 12 October 2026 session that this handover continues. Dion's own instructions are quoted where they set a rule.

## The ask

Dion shared the BT Sales Manual, a rejected RWL and the compliance email, and wrote:

> "Jake wants to solve a problem, what keeps happening is when we send a RWL to Blacktower, they end up using co-pilot and pull out all these problems, we need a process and system where we can add these documents, and the email from compliance and have you make the changes to the report. I am not sure if we use you directly, or build a system on cloudflare for better client data protection, then use you as an API."

Then: "I don't just want this one doing, I want a whole new system as this will keep happening on a daily basis."

## First worked example

Before the pivot to a system, the six compliance points were mapped to tracked-change edits in the real RWL with a node script (insert "Key assumptions behind the forecast" after the cashflow summary; insert "The role of this pension in your retirement plan" after the cashflow conclusion; insert "Your current tax residence and how benefits will be taxed"; rewrite the rationale paragraphs and recommendation bullets so cross-border advice, French residence, possible retirement elsewhere, Sharia-compliant investing and the ongoing relationship are the stated reasons; delete "-Better Performance"; extend the reduced-fee paragraph with "does not reduce the service you receive"). Word confirmed 16 revisions under one author and that accepting them removes the performance bullet. That script became `rwl-review/src/docx.js`.

## Decisions, in the order they were made

1. "Is it going to be better to build a portal we can use you as an API to make these changes, we have to take into consideration that admin staff will use this, it needs to be simple and easy to use." Answer given: yes, portal with Claude behind it; staff never touch an AI tool.
2. "Don't build it, I need this done in a sandbox first, then we can deploy it" followed by "well build the prototype on cloudflare." Resolved as: build it, run it only with wrangler dev.
3. "I will need to use Jake's Claude, is there a way to transfer all this to his AI?" Answer: code goes to GitHub; Jake's Anthropic Console key goes in as a Worker secret; a handover file lets his Claude Code continue.
4. "He will also need to set up his own Cloudflare account so we can use, so I don't have to use mine." Config carries no account ids.
5. "How much would the Claude API cost when doing these tasks as well?" About 27p per letter; about $40 a month at five a day; $5 a month Workers Paid.
6. "I will need this to be a proposal to what we do really, then we can build and deploy" then "We just need an email, no document" then "I want to be able to test it, don't make him aware it's built yet, we just need to let him know what we are doing and why we are doing it this way - we will also use GitHub for all code and repos." An email to Jake was drafted on that basis.
7. "With the tool, it needs to be like the SJB Portal we built, and add on to that really, and make it the SJB Admin portal." This is the next task (HANDOVER.md section 5). Work had started on reading the portal's navigation, API and server structure when Dion asked for this handover instead.
8. "What I need is for you to give me a file of everything, so I can start using it on Jake's Claude account... so we are literally picking up the conversation where we left off in his Claude account." This folder.
9. Jake's Claude Code in the browser needs a GitHub repository (it cannot open a local folder), so Dion will have Jake create one before the handover. Meanwhile: "can you build the prototype in the meantime, needs to be SJB branded as well."
10. "I need it to be separate to the SJB Adviser Portal, and we need on the sign in page, an admin portal option where this tool lives" and "the idea is we keep building new tools in there, but we need to get this one sorted first." Built as described in HANDOVER.md section 5: one sign-in with a portal choice, an Admin portal shell with a tool registry, RWL Review as the first tool, nothing admin-side visible in the Adviser portal.
12. (13 Oct) Dion asked what would make this the best tool of its kind, drawing on other compliance tools, then "can you build that then". The first tier was built: score and submission gate, evidence on every finding, automatic checks, four-eyes approval with locked versions, audit export, learning from bounce-backs, and the Insights tool (HANDOVER.md section 5).
13. (13 Oct) "We use the MADS for mail merge, so these templates will still need to work the same, so it cannot be broken." The engine was made merge-field safe and proven in Word (HANDOVER.md section 5). Then: "Once this is done, I need a full handover so I can start using Jake's Claude." This package is that handover.
11. "Because we use templates for these RWLs we need a section on the admin portal where we can add these templates and get them in line with the Blacktower sales manual; once we do that, then if we have any bounce backs we just use the RWL review tool (which needs refining)" and "we need to be able to upload a new manual if they update it." Built as the RWL Templates and Sales Manual tools (HANDOVER.md section 5). Dion tested the sandbox himself on his machine; the sandbox login he uses is recorded in his own sjb-admin-portal folder, not in this package.

## The email sent to Jake (for reference)

Subject: Fixing the RWL compliance loop. It describes the predictable objection categories, proposes an internal portal that (1) checks a letter against the manual before submission and (2) turns a compliance email into tracked changes plus a draft reply, explains why a portal rather than direct AI use (client data protection, simplicity, control, consistency), the setup (Cloudflare and AI provider accounts in Jake's name, GitHub, Blacktower Compliance and IT approval before real letters), the running cost, and asks for the accounts and a GitHub org as first steps. It says a sandbox version will be put together "for us to try on a test letter", not that one exists.

## Standing constraints quoted from Dion across the whole engagement

- "Do NOT use the actual client's personal information as application seed data. Create fictional demonstration clients."
- "Never insert real credentials."
- "Do not embed real client data in source code."
- "Never expose Zoho secrets in browser code." (applies to any provider secret)
