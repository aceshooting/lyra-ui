---
'@aceshooting/lyra-3d': major
'@aceshooting/lyra-ui': minor
---

Introduce `@aceshooting/lyra-3d`, the optional companion that will hold the WebGL engines behind Lyra UI's 3D views, with `three` as a regular dependency.

- `@aceshooting/lyra-3d/core` exports the engine contract (`contract: 1`, `Lyra3dHost`, `Lyra3dEngine`, `Lyra3dStyle`) and the shared engine core: a WebGL2 viewport with software-rendering detection, an orbit camera that uses Lyra UI's camera values with fit and focus, GPU id picking, style validation, resizing, context-loss recovery that re-applies renderer state, reduced-motion camera transitions, disposal that releases the WebGL context, and module-worker tasks with a main-thread fallback.
- Lyra UI lists `@aceshooting/lyra-3d` as an optional peer dependency. No component loads it yet, and no published Lyra UI entry point reaches it or three.js except through a lazy import.
