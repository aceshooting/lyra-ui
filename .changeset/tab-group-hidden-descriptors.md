---
"@aceshooting/lyra-ui": patch
---

Honor the native `hidden` attribute on `lr-tab` descriptors. Hidden tabs stay out of the strip and keyboard navigation, and their paired panels remain available through `lr-tab-group.show(name)` or an explicit `active` selection.

Child-mode steppers skip hidden steps during navigation, and carousels exclude hidden slides from pagination and the current-slide index. Both update when a child is hidden or revealed.

Hidden-child navigation brings the layout family bundle to 422,280 bytes gzip. Tab groups also ship through the retrieval and viewer families. The affected family, full-library, autoloader and server bundle limits advance to the next 64-byte boundary above their measurements. Updated editor descriptions bring the IDE archive to 1,977,196 packed bytes.
