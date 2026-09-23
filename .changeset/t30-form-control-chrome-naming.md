---
'@aceshooting/lyra-ui': minor
---

`lr-graph-query-builder` now exposes its outer label through the shared `form-control-label` CSS part (the existing `label` part keeps working as a compatibility alias), so a theme rule targeting `::part(form-control-label)` across every lyra-ui form control now reaches it too.

`lr-phone-input` gains a `start` slot as an alias for `country-prefix` (matching the leading-adornment slot name every other single-line form field uses) and a new `end` slot for an optional trailing adornment after the telephone input; `country-prefix` keeps working unchanged.
