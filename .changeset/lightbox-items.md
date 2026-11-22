---
'@aceshooting/lyra-ui': minor
---

`lr-lightbox` now mirrors `wa-lightbox`, and the new `lr-lightbox-item` mirrors `wa-lightbox-item`.

- Slot `<lr-lightbox-item>` children (links that work without JavaScript, `type="image|video"`, `srcset`/`sizes`, `width`/`height`, `thumbnail`, `alt`, a `caption` slot); the existing `images`/`imageSource` data mode is unchanged and still takes precedence.
- New lightbox members: `with-thumbnails`, `without-navigation`, `without-zoom`, `label`, `items`, `currentItem`, `zoomIn()`, `zoomOut()`, the `lr-item-change` event (alongside `lr-index-change`), icon slots (`close-icon`, `previous-icon`, `next-icon`, `zoom-in-icon`, `zoom-out-icon`), and the parts `dialog`, `scroll-container`, `navigation-button(-previous|-next)`, `slide`, `video`, `zoom-button`, `thumbnails`, `thumbnail` and `thumbnail-active`.
- Touch/pen swipe between items, video playback that pauses on slide change, and open/close/slide animation driven by `--show-duration`, `--hide-duration` and `--slide-gap` (plus `--thumbnail-size`, `--media-border-radius` and `--lr-lightbox-*` forms), stopped under reduced motion. `lr-after-show` and `lr-after-hide` now fire after that animation finishes.
