---
"@aceshooting/lyra-ui": minor
---

`lr-icon-button` hosts natural-aspect-ratio content

The default slot is now rendered as a **sibling** of the built-in glyph instead of being piped
through `<lr-icon>`, and `<lr-icon>` is mounted only when `icon` is set. The button box is also
floored with `min-inline-size`/`min-block-size: var(--lr-icon-button-size)` instead of being pinned
to it, matching that token's documented contract (a minimum tappable box, not a fixed size).

Slotted content previously went through `lr-icon`'s node-cloning path, which rebuilds every
assigned node with `document.createElementNS('http://www.w3.org/2000/svg', localName)` — a slotted
custom element such as `<lr-flag>` became an SVG-namespaced element that never upgraded and never
painted. It now renders normally, at its own aspect ratio.

**Migration.** Slotted **bare SVG geometry** (`<path>`, `<circle>`, …) with no `icon` attribute
relied on the removed `<lr-icon>` wrapper to supply an SVG parent, and must now be wrapped
explicitly:

```html
<!-- before -->
<lr-icon-button aria-label="Star"><path d="…"></path></lr-icon-button>
<!-- after -->
<lr-icon-button aria-label="Star"><lr-icon path="…"></lr-icon></lr-icon-button>
```

A complete element — an `<svg>`, an `<img>`, an `<lr-flag>` — keeps working, renders more reliably,
and is no longer constrained to a 1:1 box: content larger than `--lr-icon-button-size` now grows the
button and keeps its own aspect ratio, while a small glyph still pads out to the full tappable
target on both axes.
