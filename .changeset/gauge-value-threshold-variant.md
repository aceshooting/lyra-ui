---
"@aceshooting/lyra-ui": minor
---

`<lr-gauge>` can now recolor its fill from the current `value` instead of a single fixed color.

- New `thresholds` property: an array of `{ at, variant }` entries. The fill uses the last entry
  (sorted by `at`, regardless of authored order) whose `at` is at or below the current `value`,
  falling back to the new `variant` property when `thresholds` is empty or none match. The same
  rule supports both a higher-is-worse mapping (e.g. CPU load: `[{at: 0, variant: 'success'},
  {at: 70, variant: 'warning'}, {at: 90, variant: 'danger'}]`) and a higher-is-better one (e.g.
  battery charge: `[{at: 0, variant: 'danger'}, {at: 20, variant: 'warning'}, {at: 50, variant:
  'success'}]`) — only the authored pairs change.
- New `variant` property, matching `<lr-progress-bar>`'s shared semantic-tone vocabulary
  (`'neutral'|'brand'|'success'|'warning'|'danger'`, defaulting to `'brand'`).

Leaving both unset renders exactly as before. The existing `--lr-gauge-fill` custom property still
overrides everything, for a color outside the shared semantic-tone vocabulary.
