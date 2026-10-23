---
'@aceshooting/lyra-ui': minor
---

`lr-map` image capacity for sprite catalogs: `images` admits up to 1,024 entries within the unchanged pixel and byte budget, accepts `sdf: true` for signed-distance-field icons recolored by `icon-color`, and adds, replaces or removes images in place without removing and re-adding the layers that use them. The new `imageProvider` supplies missing images on demand through the engine's missing-image hook, sharing the same budget and re-adding them after a style swap.
