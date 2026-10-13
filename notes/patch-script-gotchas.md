---
name: patch-script-gotchas
description: "Two bugs that have bitten the node patch scripts used to edit the built HTML and JS files: String.replace collapsing $$ to $, and code appended after the app.js IIFE closes"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 703737d9-fbd3-4138-a9f1-f49809fcc366
  modified: 2026-09-17T13:01:29.736Z
---

When patching `public/app.js` (or any file) with `s.replace(anchor, newCode)`, use a **function** as the replacement (`s.replace(a, () => b)`), never a string: a string replacement turns `$$` into `$` (and `$'` / `` $` `` into slices of the file), which silently broke six `$$('[data-…]').forEach` calls on 10 Sep 2026 ("$(...).forEach is not a function"). Also: `app.js` is one big IIFE ending with `})();` — appending new functions after it puts them outside the scope where `setTitle`, `api`, `$` live ("setTitle is not defined"); insert before the closing line instead.

The function-replacement rule is for `String.replace` **only**. `h.split(a).join(b)` takes a plain string and is already literal (no `$` patterns); passing it a function writes the function's source text (`()=>b`) into the file. That happened on 17 Sep 2026 in the SJB Innovation Lab page — four edits and the logo line all became literal `()=>b`, caught only by a `new Function()` parse check.

**Why:** both errors passed `node --check` and only surfaced when Dion clicked the page, and I cannot log into the CRM to click it myself.
**How to apply:** in every patch script use `rep = (s, a, b) => s.replace(a, () => b)` for `replace`, and a plain string for `split().join()`; insert UI code before the IIFE close; parse-check the page script with `new Function()` after every patch; and after deploying ask Dion to open the page rather than assuming it works.

