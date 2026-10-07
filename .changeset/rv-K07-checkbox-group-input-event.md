---
"@aceshooting/lyra-ui": major
---
lr-checkbox-group now consumes a child checkbox's `lr-input` and republishes it as the group's own `lr-input` with `detail: { value: string[] }` (order: `input`, `lr-input`, `change`, `lr-change`), instead of letting the child's `{ checked, value }` event escape. Migration: listen to the group's `lr-input`, or to the checkbox itself, for per-option details.
