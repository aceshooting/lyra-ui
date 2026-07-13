---
"@aceshooting/lyra-ui": minor
---

`lyra-chip` gains an opt-in `selected`/pressed interactive mode: `[part='base']` becomes
keyboard-activatable and reflects `aria-pressed`, toggling on click/Enter/Space and emitting
`lyra-chip-select`. Not combinable with `removable` (avoids a nested-interactive a11y violation);
today's passive-label-pill usage is unaffected since `selected` defaults to `false`.
