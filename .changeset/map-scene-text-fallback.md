---
"@aceshooting/lyra-ui": minor
---

Add property-only `lr-map.scene` input with atomic synchronous admission, owned source snapshots, a localized accessible object list with pagination, and immutable scene status and activation events. Invalid updates preserve previously accepted objects, and text-row activation does not move the camera.

Nonempty accepted scenes currently report `unavailable` with code `engine`. Scene objects are not drawn, model sources are not fetched or decoded, and scene depth, terrain resolution and completed-frame projection are not provided.

Update eight exceeded bundle ceilings to the next 64-byte boundary above reviewed measurements for scene ownership, accessible feedback and shared localization. Optional 3D engines remain separately loaded.
