---
"@aceshooting/lyra-ui": patch
---

The cascading `--lr-positioning-strategy` custom property (`src/internal/positioning-strategy.ts`)
was documented as read by "every anchored/positioned overlay in this library", but until now only
`<lr-select>`, `<lr-popover>` (and `<lr-dropdown>` through it), `<lr-tooltip>`, `<lr-color-picker>`
and `<lr-combobox>` actually routed their placement through the shared resolver. An app that set the
property once on `:root` to retune every floating surface silently left every other anchored surface
behind.

`<lr-menu>` (the private submenu surface), `<lr-mention-popover>`, `<lr-export-button>`,
`<lr-usage-badge>`, `<lr-tool-call-chip>`, `<lr-tour>`, `<lr-locale-picker>`, `<lr-date-input>`,
`<lr-time-input>`, `<lr-citation-badge>`, `<lr-entity-chip>`, and `<lr-app-rail-item>` now honour the
same cascading property. None of them exposes a per-instance `positioning-strategy` property — that
remains a separate, deliberate decision — so an ancestor override is the only way to change them, and
their own default stays exactly what it always rendered (`fixed` in every case), so nothing moves for
anyone who sets nothing.

`<lr-popup>`, the low-level positioning primitive, is deliberately excluded: its own `strategy`
property is a plain, always-defined value (default `'absolute'`, never `undefined`), so there is no
way to distinguish "left unset" from "authored the default" without adding the same
explicit-vs-default tracking machinery the higher-level components' `positioning-strategy` property
uses — which this sweep does not add anywhere. It is also meant to be composed directly by a consumer
who already controls `strategy` explicitly.
