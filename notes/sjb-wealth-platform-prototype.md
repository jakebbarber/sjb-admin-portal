---
name: sjb-wealth-platform-prototype
description: "The SJB Global Wealth Platform prototype — what it is, where it lives, and the MADS source of truth"
metadata: 
  node_type: memory
  type: project
  originSessionId: cccb46eb-0864-4abb-b985-500d27469c0c
  modified: 2026-08-21T16:17:58.232Z
---

Building **SJB Global Wealth Platform**, a prototype for SJB's proprietary financial-planning operating system (adviser workspace, MADS Fact Find, SJB LifePlan cashflow, annual reviews, My SJB client portal, management view).

- Delivered as a **single self-contained HTML artifact** (published 15 Aug 2026), not a Next.js project — Node and npx/wrangler ARE available now (Sep 2026), though the prototype itself stays a single HTML file. Vanilla JS + hand-built SVG charts was the only runnable option.
- **Excel IS installed** (`C:\Program Files\Microsoft Office\Root\Office16\EXCEL.EXE`) — COM automation (`New-Object -ComObject Excel.Application`, `AutomationSecurity=3` for macros-off) works for verifying generated workbooks. Also: pages too big for the preview pane (~500KB ceiling) can be served with a PowerShell `HttpListener` on `http://localhost:8123` (scratchpad `serve.ps1`), which gives a real origin with working localStorage.
- Source of truth for the Fact Find is `SJB MADS V 3.26 - Ann & Nick Gout.xlsm` in the project folder — 32 worksheets. It is an `.xlsm`, i.e. a zip: unpack with `Expand-Archive` and read `xl/sharedStrings.xml` + `xl/workbook.xml` to recover every field label and sheet name without Excel.
- The workbook contains a **real client's data and real third-party provider/introducer contact details**. Use it only for field structure and business rules; never seed demo data from it.
- MADS is **cross-border and multi-currency**: every monetary field stores original amount + currency alongside the Fact Find currency conversion. Household metrics are in each household's own FF currency, so anything aggregated across households must convert to a reporting currency first.

Working copy also saved to the project folder as `sjb-wealth-platform.html` (opens offline by double-clicking). Brand tokens in [[sjb-brand-tokens]].
