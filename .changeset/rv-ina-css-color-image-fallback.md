---
"@aceshooting/lyra-ui": patch
---
Caller-supplied colors (option `dotColor` in `lr-select`/`lr-combobox`, event `color` in `lr-calendar`, chart, map, graph and terminal colors, swatches) are now rejected when they hide an image-producing function or a quoted string, for example `var(--x, image-set("https://…" 1x))`; such a value previously passed the color check and made every viewer's browser fetch the URL when the swatch rendered. Colors that use `var()` with a color fallback keep working.
