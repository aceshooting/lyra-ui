---
"@aceshooting/lyra-ui": minor
---

`lyra-switch` gains an opt-in `hint`/`error-text` form-control chrome (props + matching named `hint`/`error` slots + CSS parts), mirroring `lyra-select`'s pattern for those two pieces, with `aria-describedby` wired to whichever are rendered. Left unset, neither renders and the control is unchanged. The default slot stays the control's visible, clickable label (same as `lyra-checkbox`) — no separate top-of-field `label` prop was added.
