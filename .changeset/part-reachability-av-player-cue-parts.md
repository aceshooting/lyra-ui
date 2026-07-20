---
"@aceshooting/lyra-ui": minor
---

Fix `lr-av-player`'s transcript cue styling never applying, and make every cue-level part reachable
from a consumer stylesheet.

Cues are composed through `lr-virtual-list`, whose `renderItem` result is committed inside that
element's **own** shadow root — one boundary below the player's. A bare `[part='cue']` selector in
the player's stylesheet cannot cross that boundary, so every cue rule was silently inert and each
transcript row fell back to the raw browser button appearance: a grey background, a visible border,
`1px 6px` padding and centered text, with no timestamp or speaker treatment and no visual state for
the playing cue or the search matches. Every one of those rules now goes through
`lr-virtual-list::part(…)`.

`::part()` cannot be followed by an attribute selector, so the three cue states get their own part
names, added alongside `cue` as a part list (`::part()` carries `part~=` semantics, so both names
match the same element):

- **New:** `cue-current` — the row the playhead is inside.
- **New:** `cue-match` — a row matching the current search query.
- **New:** `cue-active-match` — the row holding the current search match.

The `aria-current`, `data-match` and `data-active-match` attributes are unchanged and still describe
each row's state.

This also makes two documented custom properties live for the first time:
`--lr-av-player-cue-current-bg` now retints the playing cue, and
`--lr-av-player-cue-active-match-color` now recolors the active search match's outline. Both
previously resolved against a rule that never matched anything.

The player forwards `cue`, `cue-current`, `cue-match`, `cue-active-match`, `cue-time`, `cue-speaker`
and `cue-text` through `exportparts`, so `lr-av-player::part(cue)` and friends work from a consumer
stylesheet for the first time.
