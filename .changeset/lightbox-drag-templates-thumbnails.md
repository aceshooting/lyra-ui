---
'@aceshooting/lyra-ui': minor
---

`lr-lightbox` follow-ups:

- Touch and pen swipes now follow the pointer: once a drag is clearly horizontal the slide moves with
  it, a release at least 50px toward an existing item moves there with the incoming slide continuing
  from the release point, and a shorter or mostly vertical drag, a drag past the first or last item
  without `loop` (followed with resistance) or a `pointercancel` settles the slide back. Directions
  reverse under RTL, and under reduced motion the slide does not follow the pointer. A swipe no longer
  starts on a form field or editable content, or when the `pointerdown` was already handled.
- An `lr-lightbox-item` whose direct child is a `<template>` shows that template's content as a
  custom slide. The content is copied only while the slide is shown, into a light-DOM
  `<div slot="slide-content">` so page styles apply, and is removed on another slide or after the close
  motion; `width`/`height` keep its proportions and it cannot be zoomed. Slotted form fields and sliders
  in the lightbox keep their own arrow keys.
- `with-thumbnails` now works with `imageSource`: the strip covers the 15 positions around the current
  image and reads only those descriptors. `LyraLightboxImage` gains an optional `thumbnail` used by the
  strip in `images` and `imageSource` modes.
- Documented: `lr-item-change`, like `lr-index-change` and `lr-carousel`'s `lr-slide-change`, reports
  navigation (buttons, keys, swipes, thumbnails, `goTo()`/`next()`/`previous()`) and is not fired when
  `index` is written directly.
