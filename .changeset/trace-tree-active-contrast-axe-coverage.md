---
"@aceshooting/lyra-ui": patch
---

Cover `lr-trace-tree`'s active row with an axe assertion. The active-row test group previously
carried a comment explaining why no accessibility assertion could be made there — the default tint
put the row's own secondary text below the WCAG AA contrast floor, so any axe run against a
populated active row would have failed. With that fixed, the assertion now runs for real: a
populated tree is asserted accessible with each status tone in turn made active, after first
proving the fixture actually reached the `[data-active]` state so the check cannot pass vacuously.
It was verified to bite by reverting the fix and confirming axe reports the exact contrast
violations it is meant to catch. The active-row Storybook story now sets
`--lr-trace-tree-row-active-bg` and `--lr-trace-tree-row-active-color` together and documents why
they are a pair.
