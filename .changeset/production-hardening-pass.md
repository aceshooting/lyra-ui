---
"@aceshooting/lyra-ui": minor
---

Added `<lyra-word-cloud>` — a dependency-free SVG word/tag cloud, laid out via an outward
Archimedean-spiral placement search (heaviest word first). Supports `linear`/`sqrt` weight-to-font
scaling, optional `mixed` (rotated) orientation, per-word or per-`group` coloring with a themeable
`--lyra-word-cloud-color-1..8` palette, and roving-tabindex keyboard navigation matching
`lyra-heatmap`'s pattern (a single tab stop, arrow keys, Home/End, a live-region announcement).

Also a hardening pass across the rest of the library — real bugs fixed, not just polish:

- `lyra-skeleton`: `width`/`height` properties had zero visual effect (the custom property was set
  on the wrong shadow-DOM node); now actually resizes the placeholder.
- `lyra-combobox`: setting `open` directly (bypassing `show()`) never wired up click-outside or
  fired `lyra-show`/`lyra-hide`; picking a row or clearing while using `source` left stale async
  results displayed; a `<lyra-option selected>` appended after the first slotchange was ignored;
  two nameless `multiple` comboboxes in the same form merged their submitted values; a pending
  debounced `source` fetch could fire after the element was removed.
- `lyra-chart`: bubble-chart series got a categorical (not numeric) x-axis, collapsing every point
  onto one tick; `resetZoom()` double-emitted `lyra-zoom`, briefly reporting the stale pre-reset
  `zoomed` state to `{ once: true }` listeners.
- `lyra-date-picker` / `lyra-date-input`: the already-exported `clampDate()` was never actually
  wired in, so `goToDate()`/`goToToday()` could navigate to (and focus) an out-of-range date;
  locale/weekday-format/first-day-of-week wiring gained test coverage; outside-month placeholder
  cells are now `aria-hidden` only in rows that also have a real visible day.
- `lyra-tree`: mouse-driven expand/collapse/select could desync the roving-tabindex `activeId` from
  real DOM focus; arrow-key expand/collapse is now RTL-aware, matching `lyra-split`/`lyra-time-range`.
- `lyra-widget`: the fullscreen focus trap didn't pierce into a slotted custom element's own shadow
  root, letting focus escape to a hidden nested control.
- `lyra-toast-item`: the close button used the native `disabled` attribute, which force-blurs a
  focused element with nothing to restore it — switched to `aria-disabled`.
- `lyra-empty`: gained a live-region announcement when entering the empty state, matching
  `lyra-skeleton`'s existing `role="status"` convention.
- Accessibility, documentation, and test-coverage fixes across most other components; `llms.txt`,
  `llms-full.txt`, and both READMEs corrected for drift against the current API surface.

No breaking changes.
