---
'@aceshooting/lyra-ui': patch
---

- The agent docs and component JSDoc name the tag-shaped registration entries
  (`components/lr-<tag>.js`) everywhere they previously named per-directory modules that no longer
  ship, such as `pdf-viewer.js`, `table.js` or `.../markdown/markdown-core.js`.
- `check:doc-specifiers` also rejects abbreviated prose routes (`components/...js`, `.../x/y.js`,
  `../x/y.js` and a bare component-directory `x.js`) that no export provides.
- The CSS-reset guidance explains why a reset such as Tailwind preflight strips the host box of
  `lr-callout`, `lr-zoomable-frame`, a standalone `lr-menu` and the modal hosts whatever the layer
  order, and gives a same-layer `revert-layer` rule that restores them.
