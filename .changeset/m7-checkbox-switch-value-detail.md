---
'@aceshooting/lyra-ui': major
---

`lr-checkbox` and `lr-switch`'s `input`/`change`/`lr-input`/`lr-change`/`lr-checkbox-toggle-request`/`lr-switch-toggle-request` events now carry `detail: { checked: boolean, value: string }`, matching `lr-radio`'s shape (previously `{ checked: boolean }` only). MIGRATION: no consumer code needs to change unless it relied on the detail object having exactly one key (for example a strict `deep.equal({ checked: true })` assertion) — before: `{ checked: true }`; after: `{ checked: true, value: 'on' }` (or the control's current `.value`). New code may read `event.detail.value` instead of `event.target.value`.
