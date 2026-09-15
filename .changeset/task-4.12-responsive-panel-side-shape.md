---
"@aceshooting/lyra-ui": minor
---

`<lr-responsive-panel>`'s `shape` property now accepts `'start'`/`'end'` alongside the existing
`'fullscreen'`/`'bottom-sheet'` values. These anchor the overlay presentation to the matching
*logical* inline edge instead of covering or spanning the whole viewport — a persistent inline
navigation panel on a wide screen and a slide-in-from-the-edge overlay on a narrow one, matching
the visual identity of a docked sidebar rather than a full-screen or bottom-sheet modal. The
anchored edge, and the panel's rounded free edge, both flip automatically under `dir="rtl"`
through logical `inset-inline-*`/border-radius CSS properties — no `:dir()` selector is involved.

The change is CSS-only: `mode="auto"`'s shared shadow DOM, single render path, and automatic
focus capture/restore on presentation changes are exactly as before for every shape, including the
two new ones. A new `--lr-responsive-panel-side-inline-size` custom property (default
`var(--lr-size-20rem)`) themes the side panel's width.
