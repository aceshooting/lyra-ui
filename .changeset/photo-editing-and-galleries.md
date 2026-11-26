---
"@aceshooting/lyra-ui": minor
---

Add `lr-image-editor` for photo adjustments, cropping, rotation, flipping, before-and-after comparison, and full-resolution image export. Add responsive columns to `lr-virtual-list`, a per-image details panel to data-backed lightboxes, and opt-in clearing and visible labels to ratings.

The image editor, lightbox details and map styling bring the media barrel to 417,689 gzip bytes. The viewers barrel includes the map through the GeoJSON viewer and measures 496,491 bytes. Responsive virtual rows also ship with components that render virtual lists, including the PDF viewer. The JSON viewer used in the chat composition adds 609 gzip bytes to its lazy JavaScript. Rating labels and the additional English messages contribute to the overlays and localization bundles. The registration catalog includes the new editor tag, bringing the scoped loader’s initial route to 11,849 bytes. The 16 exceeded direct-entry ceilings and that initial-route ceiling advance to the next 64-byte boundary of their measured sizes.

Bound pan-and-zoom image viewports to the available height so portraits fit and zoomed images stay scrollable. Add mouse dragging for overflowing images.

Support clustered thumbnail markers, categorical line colors, and dash patterns on map data layers. Decorative overlay layers no longer intercept feature clicks. Map legend entries can omit their pattern, and empty map and word-cloud legends have a localized empty state.

The image editor messages add 78,541 unpacked bytes across 75 existing media catalogs. The generated IDE archive for the new tag and expanded APIs measures 1,975,207 packed bytes. The exceeded unpacked translations and packed IDE limits advance to the next 64-byte boundary.
