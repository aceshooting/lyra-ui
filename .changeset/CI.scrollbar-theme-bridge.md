---
---

Internal: `<lr-table>`, `<lr-virtual-list>`, `<lr-code-block>`/`<lr-code-block-core>` and
`<lr-code-editor>` now read the `--lr-theme-scrollbar-width`/`--lr-theme-scrollbar-gutter` hooks
directly, each keeping its own `auto` literal as the fallback -- the same shape `<lr-carousel>`,
`<lr-scroller>`, `<lr-time-input>` and `<lr-emoji-picker>` already used. The short-lived shared
`--lr-scrollbar-width`/`--lr-scrollbar-gutter` token pair that briefly sat between them is gone; it
never shipped in a release. This keeps the hooks opt-in: with neither set, every scroll container
keeps the default it documents, and importing the theme stylesheet cannot change that.
