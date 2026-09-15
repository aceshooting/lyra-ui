---
"@aceshooting/lyra-ui": minor
---

`<lr-popover>`, `<lr-dropdown>`, `<lr-select>`, `<lr-tooltip>` and `<lr-color-picker>` now honor a
new cascading `--lr-positioning-strategy` custom property (`absolute` | `fixed`) as a theme-level
alternative to authoring `positioning-strategy`/`hoist` on every instance.

A consumer whose dropdowns or selects live inside an `overflow: hidden` card, a scroller, or any
other clipping ancestor previously had to set `hoist`/`positioning-strategy="fixed"` on each one;
forgetting a single instance silently clipped it. Setting `--lr-positioning-strategy: fixed` once
on that ancestor (or on `:root`, or on a theme) now changes every unset overlay beneath it instead.
Precedence is unchanged for anyone who sets nothing: an explicit `positioning-strategy`/`hoist` on
the instance always wins; otherwise the inherited custom property; otherwise the component's own
mirrored default (`fixed` for `<lr-popover>`, `absolute` for the other four). The property is read
from computed style only when the popup is actually (re)positioned (open, or a placement/anchor
change while already open), never per animation frame, and never during server rendering.

Aligning `<lr-dropdown>`/`<lr-select>`'s default strategy with `<lr-popover>` was declined for
upstream parity (each mirrored component
keeps its own shipped default), but the requester's stated alternative — a single global/theme-level
way to set the strategy — is what this change delivers.

Implementation note: fixed a latent ambiguity in each of the four duplicated
`positioningStrategy` setters (`popover.class.ts`, `select.class.ts`, `tooltip.class.ts`,
`color-picker.class.ts`) that this feature exposed. Writing an explicit value equal to the
component's own mirrored default (e.g. `positioning-strategy="absolute"` on `<lr-select>`) never
recorded that the author had set anything, because the setter's own no-op guard ran before the
private field was assigned — making that case indistinguishable from "unset" once a cascading
override needed to check it. The private field is now always recorded; the no-op guard still skips
the reactive update and the `hoist` alias sync exactly as before, so no other observable behavior
changes.

Sibling sweep: every other component calling the shared positioner's `place()` was checked.
`<lr-popup>` has its own `strategy` property but is deliberately excluded — it is the library's
documented low-level "raw knobs" primitive, and an implicit ambient override would work against
its whole purpose. `<lr-combobox>`'s listbox has no `positioningStrategy` property at all (it
always places `fixed`, which already escapes the clipping scenario this change targets) and gaining
one is a separate, larger feature gap outside this task. The remaining eleven `place()` callers
(`lr-menu` submenus, `lr-tour`, `lr-mention-popover`, `lr-app-rail-item`, `lr-export-button`,
`lr-tool-call-chip`, `lr-locale-picker`, `lr-date-input`, `lr-time-input`, `lr-citation-badge`,
`lr-entity-chip`) expose no `positioning-strategy`/`hoist` property either and were never in this
property's scope.
