---
"@aceshooting/lyra-map": minor
---

Add `createSceneLayer(map, layer, host)` to `@aceshooting/lyra-map/scene` for trusted custom 3D layers. A layer's `create(context)` receives the map's WebGL2 context and geographic services, and each frame provides projection matrices, a shader prelude for Mercator and globe, tile-local encoding and sea-level or terrain-relative altitude resolution through the engine's elevation query. The returned handle reinstalls a fresh instance after style replacement and WebGL context restoration, disposes on removal or signal abort, reports `loading`, `ready` and `unavailable` states, and forwards picking to the current instance. The scene entry now also exports the `MapCustom3dLayer`, `MapLayerContext`, `MapLayerFrame`, `MapLayerInstance` and geographic frame types. The default map entry does not load the bridge.
