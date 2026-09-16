---
'@aceshooting/lyra-ui': patch
---

Documents a compact-disclosure recipe for form-control hint text in `llms/shared.md`, under a new
"Presenting hint text as a compact disclosure" section: compose an icon-only `<lr-icon-button>`
inside an `<lr-tooltip>` (or `<lr-details>` for an inline expand/collapse) and slot it into a
control's `label` slot, keeping a visually-hidden copy in the control's own `hint` slot so the text
stays wired into `aria-describedby`. `<lr-checkbox>`/`<lr-switch>` — whose default slot is the
clickable label — place the same trigger as a DOM sibling instead. No component code changed, and
no `hint-display`/`hint-placement` attribute exists or is planned; the library keeps a single,
predictable "hint renders as permanent text" default, and this composition is how to build a
compact presentation on top of it today.
