---
'@aceshooting/lyra-ui': minor
---

One `positioning-strategy` property across every anchored surface, with `hoist` retained as its alias

`<lr-popover>`, `<lr-dropdown>`, `<lr-select>`, `<lr-tooltip>` and `<lr-color-picker>` now all
accept `positioning-strategy="absolute" | "fixed"` — the same name, the same values, the same
meaning. Each component keeps its own default, so nothing renders differently until you set it:
`<lr-popover>` stays `fixed` (previously hard-coded and unreachable, now a real property you can
turn off), and the other four stay `absolute`.

Where `hoist` already existed it keeps working indefinitely, as the exact boolean alias of
`positioning-strategy="fixed"`. Writing either spelling updates the other, so the two attributes
can never disagree in the DOM, and an unsupported value resolves back to the component's own
default. Prefer `positioning-strategy` in new code; `hoist` remains supported for the Shoelace
spelling it mirrors.
