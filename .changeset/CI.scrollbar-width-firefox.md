---
---

CI-only: fixed 18 `scrollbar-width` test assertions (across `lr-carousel`, `lr-scroller`,
`lr-virtual-list`, `lr-table`, `lr-code-block`, `lr-code-block-core`, `lr-code-editor`,
`lr-time-input`, and `lr-emoji-picker`) that were unreadable or vacuously passing on this repo's
Firefox test launcher, which reports every element's computed `scrollbar-width` as `'none'`
regardless of the CSS in effect (confirmed by probe: even a forced-visible scrollbar reserves zero
gutter width there, so no rendering side effect is readable either). A new
`test/scrollbar-reporting.ts` helper reads the actual `scrollbar-width` CSS declaration text for
the named part selector straight out of the component's own `adoptedStyleSheets` -- proving the
stylesheet itself wires the theme hook into that part, not just that a custom property happens to
inherit down to it -- and only then resolves the `var()`'s custom property or literal value, on
every engine. Verified by mutation testing on all 9 files: disconnecting a part's `scrollbar-width`
from its `var(--lr-theme-scrollbar-width, ...)` (or, for `lr-scroller`'s literal
`without-scrollbar` opt-out rule, changing its hardcoded value) now fails the corresponding test on
every engine including Firefox. No runtime source changed and nothing here ships in the published
package.
