---
'@aceshooting/lyra-ui': minor
---

`lyra-ui-migrate` now rewrites Web Awesome and Shoelace utility and theme classes (`wa-stack`, `wa-gap-*`, `wa-align-items-*`, `wa-dark`, `sl-theme-dark`, ...) in `class`, `className`, class bindings and `classList` calls, and maps theme, native and utility stylesheet imports and the autoloader entry to Lyra's `theme.css`, `native.css`, `utilities.css` and `autoloader-cdn.js`. Approximate matches rewrite with a review warning; classes and files with no Lyra counterpart (`wa-heading-*`, hue-pinned variants, `setBasePath`, `layers.css`) are reported and left unchanged.
