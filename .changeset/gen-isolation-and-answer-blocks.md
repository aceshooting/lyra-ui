---
'@aceshooting/lyra-gen': minor
---

Add opt-in error isolation. With `recovery: 'isolate'`, `validateView`, `applyViewPatch`, the JSON
and completion parse routes, the AI SDK bridge, chat options and `<lr-gen-view recovery="isolate">`
replace a component-local failure (unknown role, invalid or missing property, invalid text or slot,
disallowed child, missing accessible name, invalid block content) by an in-place fallback with part
`isolated` and the localized invalid-view message, and report it in `isolated` plus warning
diagnostics. Identity, binding, action, URL and security, budget and root failures still reject the
whole view, and identities are never renamed. Strict rejection remains the default; persist the
original input and isolate again on load.

Add `answerBlocksCatalog()`, an opt-in catalog overlay with three composite answer blocks:
`kpi-row` (one to six metrics rendered as stat cards), `comparison` (rendered as a table) and
`steps` (a read-only stepper). Blocks expand during validation into existing components with
deterministic child identities; existing catalogs and stored views are unchanged.
