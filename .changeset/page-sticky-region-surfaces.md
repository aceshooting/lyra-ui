---
'@aceshooting/lyra-ui': patch
---

`lr-page` now paints its sticky `banner`, `header`, and `subheader` regions with an opaque `var(--lr-color-surface)` background, so main content scrolling underneath no longer shows through them. Retheme each region with the new `--lr-page-banner-bg`, `--lr-page-header-bg`, and `--lr-page-subheader-bg` custom properties on the Page or any ancestor. A region named in `disable-sticky` and the non-sticky `footer` stay transparent.
