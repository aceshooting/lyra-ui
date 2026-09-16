---
"@aceshooting/lyra-ui": minor
---

`<lr-context-meter>`'s interactive mode can now express a non-actionable band. A `segments` entry
accepts `disabled`, which renders that band and its legend row as genuinely disabled controls — no
tab stop, no hover or press affordance, and no `lr-segment-activate` on activation. Previously a
band that filtered to nothing was still a fully enabled, tabbable button, so a keyboard user tabbed
through dead controls with no indication, and nothing distinguished the row visually.

Two derived state tokens join `segment-selected`/`legend-item-selected`, and all of them compose:
`segment-empty`/`legend-item-empty` for a band whose `value` is 0, and
`segment-disabled`/`legend-item-disabled` for a declared-disabled entry. `--lr-context-meter-disabled-opacity`
(default `0.5`) themes the disabled treatment.

Inertness is deliberately never inferred from `value === 0`: a zero band is legitimately clickable
in a token-budget meter, so the empty pair is a presentational hook with no built-in treatment while
`disabled` is declared by the consumer. A meter whose entries set neither renders exactly as before.

Internally this adds a shared `statePart()` helper, so a part name carrying several states is built
one way across the library instead of being hand-rolled per component.
