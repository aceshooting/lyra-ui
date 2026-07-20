---
"@aceshooting/lyra-ui": minor
---

Fix `lr-pdf-viewer`'s page styling never applying, and make every page-level part reachable from a
consumer stylesheet.

Pages are composed through `lr-virtual-list`, whose `renderItem` result is committed inside that
element's **own** shadow root — one boundary below the viewer's. A bare `[part='page']` selector in
the viewer's stylesheet cannot cross that boundary, so the rules for `page`, `text-layer`, the page
canvas, the generated text runs, the selection tint, and both search-match states were all silently
inert: pages rendered without their centering/padding wrapper, the canvas without its border,
the text layer unpositioned, and search matches unhighlighted. Every one of those rules now goes
through `lr-virtual-list::part(…)`, including the RTL text-layer mirror.

Because `::part()` cannot be followed by a descendant combinator, two elements that were previously
addressed as descendants get their own names:

- **New:** `page-canvas` — the canvas a page's content is painted onto.
- **New:** `text-span` — one generated text run inside a page's text layer. The selection tint hangs
  off this part (`::part(text-span)::selection`), since a highlight pseudo is matched against the
  element the selected text originates in.

`search-match` / `search-match-active` are now matched directly by name (`::part()` already carries
`part~=` semantics), and the viewer forwards `page`, `page-canvas`, `text-layer`, `text-span`,
`search-match` and `search-match-active` through `exportparts`, so `lr-pdf-viewer::part(page)` and
friends work from a consumer stylesheet for the first time.
