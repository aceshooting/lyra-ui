# @aceshooting/lyra-3d

## 1.0.0

### Major Changes

- 5e6b131: Add the graph, points, panorama and model engine entrypoints to the optional 3D companion. Include bounded input admission, owned numeric snapshots, graph layout workers and packed-consumer coverage. Model imports validate supported file syntax before parsing, and numeric columns reject shared-memory backing.

  The archive file-count budget increases to 87 for the shared core and four engines: 41 JavaScript modules with matching declarations, plus five package, documentation and license files. The packed and unpacked byte ceilings remain unchanged.
- 166f12c: Introduce `@aceshooting/lyra-3d`, the optional companion that will hold the WebGL engines behind Lyra UI's 3D views, with `three` as a regular dependency.

  - `@aceshooting/lyra-3d/core` exports the engine contract (`contract: 1`, `Lyra3dHost`, `Lyra3dEngine`, `Lyra3dStyle`) and the shared engine core: a WebGL2 viewport with software-rendering detection, an orbit camera that uses Lyra UI's camera values with fit and focus, GPU id picking, style validation, resizing, context-loss recovery that re-applies renderer state, reduced-motion camera transitions, disposal that releases the WebGL context, and module-worker tasks with a main-thread fallback.
  - Lyra UI lists `@aceshooting/lyra-3d` as an optional peer dependency. Graph, embedding, chart, model and panorama views load the corresponding companion engines lazily when their WebGL rendering is opted into; built-in defaults and accessible alternatives remain available.

### Patch Changes

- e2701e9: Remove unreachable guards and fallbacks found while bringing the companion packages to full test coverage. Behavior is unchanged.
- 1c49a93: Reduce force-layout arithmetic overhead for ordinary coordinate and softening ranges while retaining robust handling of very large finite softening values.
- 8087f55: Keep paused panorama video textures current when seeking. Retire frame callbacks when a new seek starts, upload only readable media, and refresh once if the browser does not deliver a paused frame notification.
- 27d9e64: Refresh decoded paused video textures during requested panorama renders so a completed seek can replace an earlier uploaded frame without restarting playback or scheduling extra frames.
- 3cc71c2: Keep mention caret measurements explicitly text-only, avoid excessive backtracking when parsing malformed 3D color values, and escape embedded values when generating map modules.
- 96ac5e7: Move spatial graph projection, clipping and stroke expansion to vertex shaders so camera movement reuses geometry buffers. Opaque graphs use depth testing, while translucent graphs reuse painter order during small rotations and restore exact depth order once rotation settles. Keep mixed glyph and stroke batches visible across consecutive frames. Avoid empty label texture uploads and keep camera updates from animation callbacks rendering on consecutive frames.

  Resolve translucent CSS self-loop segment painter order from the current camera and viewport, including pan, zoom and resize.
