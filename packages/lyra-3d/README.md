# Lyra 3D

[![Coverage](https://img.shields.io/endpoint?url=https://aceshooting.github.io/lyra-ui/badges/coverage-lyra-3d.json)](https://codecov.io/gh/aceshooting/lyra-ui "Coverage rounded up to the next whole percent")

`@aceshooting/lyra-3d` holds the WebGL engines behind Lyra UI's 3D views. A Lyra UI component that
supports one loads it on demand, only when an application opts in on that element, so an
application that never opts in never downloads three.js or any engine code. The components keep
selection, events, keyboard handling, localization, accessibility and their list or text fallback;
engines only render, lay out and pick.

```sh
pnpm add @aceshooting/lyra-3d
```

`three` is a regular dependency with a caret range, so an application that also uses three.js
resolves one shared copy.

## Entry points

| Entry point | Contents |
| --- | --- |
| `@aceshooting/lyra-3d/core` | The engine contract, renderer setup, orbit camera, GPU picking, style input and worker tasks shared by every engine |
| `@aceshooting/lyra-3d/graph` | Graph rendering, worker-backed layout, decorations and graph appearance |
| `@aceshooting/lyra-3d/points` | Point clouds, line segments and axes in two or three dimensions |
| `@aceshooting/lyra-3d/panorama` | Equirectangular images or existing video elements, with camera controls and hotspots |
| `@aceshooting/lyra-3d/model` | Bounded model admission and rendering for glTF/GLB, OBJ, STL, PLY, XYZ and PCD |

Each engine entry point exports `createEngine()` and its data types. Graph, points and model
engines use the core orbit camera; panorama exports its own yaw/pitch/field-of-view camera.
Import an individual engine entry to avoid loading the other engines. Component integration and
accessible alternatives remain the responsibility of the host.

The panorama engine uses an already-loaded image or the host's existing video element; it does
not fetch media or create a second player. The model engine accepts model bytes, rejects
external resources before parsing, and enforces the exported `MODEL_LIMITS`. Its `admitModel()`
helper reports admission failures through `ModelAdmissionError`; it does not fetch URLs.

PLY headers must use consistent LF or CRLF line endings, exact `ply` and `end_header` lines,
and no lone carriage returns. Header comments and metadata must not contain `end_header` text.
Both binary byte orders and ASCII bodies are supported. OBJ
point (`p`) and line (`l`) records require single ASCII spaces between the directive and
references; repeated internal spaces and tabs are rejected. Positive and negative references
remain supported. These restrictions keep admission and format-loader token boundaries aligned.

## Engine contract

Every engine reports `contract: 1`, and Lyra UI validates the loaded module structurally (the
version and the required methods) before using it, so this package never imports Lyra UI and the
two packages share no types. Items are indices into the order the component owns; the component
maps them to ids.

```ts
import { LYRA_3D_CONTRACT, type Lyra3dEngine, type Lyra3dHost } from '@aceshooting/lyra-3d/core';
```

- `mount(container, host)` creates the engine's own canvas inside the component's container and
  rejects with `Lyra3dUnsupportedError` (`code: 'webgl-unavailable'`) without WebGL2.
- `setData`, `setStyle`, `setCamera` (silent), `resize` and `dispose` are required; `setState`,
  `fit`, `focus`, `pick`, `project` and `positionOf` are optional.
- The engine calls the host's `hover`, `pick` and `camera` (at most once per animation frame),
  `progress` for file loads, and `lost` when its WebGL context is lost or it fails. It also calls
  `rendering({ software })` once after mounting, so a component can lower its detail when the
  browser only offers software rasterization, and `restored()` after a lost context came back.
  Software rendering counts as detected when the browser refuses a context without a major
  performance caveat or the renderer names a software rasterizer (`isSoftwareRendererName`).

Graph, points and panorama numeric columns require typed arrays backed by ordinary `ArrayBuffer`
objects. Shared-memory buffers are unsupported: admission rejects them before inspecting or copying
their elements. Accepted numeric columns are copied for the engine revision; application callbacks
and native media objects remain caller-owned integrations.

## Core building blocks

- `createLyra3dViewport(container, host, options)` creates the renderer, a scene whose world
  group keeps Lyra UI's y-down convention, an orbit camera, pointer handling (drag to orbit,
  Shift-drag or a secondary button to pan, optional wheel zoom, hover and activation), on-demand
  rendering, resizing, context-loss recovery that re-applies renderer state, reduced-motion camera
  transitions and disposal that releases the WebGL context at once. The optional `primaryPan`
  callback is evaluated at each primary press; returning `true` enables primary-drag panning,
  while an omitted callback or `false` preserves orbiting. A renderer or picker failure stops
  interaction and reports `host.lost('error', 'Rendering failed.')` once; dispose that viewport
  before mounting a replacement. Application callback exceptions remain observable to the caller.
- `fitOrbitCamera`, `focusOrbitCamera`, `orbitBy`, `panBy`, `zoomBy` and `projectOrbitPoint` use
  the same camera fields (`yaw`, `pitch`, `distance`, `target`) and orientation convention as
  Lyra UI's built-in Canvas 3D renderer. World coordinates are bounded independently of camera
  distance, so fitting large scenes and narrow viewports can place the eye beyond the scene bounds.
- `createPickColors`, `createPickMaterial` and `Lyra3dIdPicker` implement GPU id picking: a pick
  costs about the same at any item count.
- `resolveLyra3dStyle` validates the plain style values (colors, palette, sizes, font, device
  pixel ratio, reduced motion, forced colors) a component resolves from its design tokens.
- `startLyra3dTask` runs an iterative kernel in a module worker and transfers typed-array outputs.
  When no worker can start, the same kernel runs on the main thread in short time slices. Create
  the worker at the call site so bundlers find it:

  ```ts
  startLyra3dTask({
    input,
    kernel: createLayoutKernel,
    worker: () => new Worker(new URL('./layout.worker.js', import.meta.url), { type: 'module' }),
    onOutput: (positions, done) => engine.applyPositions(positions, done),
  });
  ```

  The worker module calls `serveLyra3dTask(createLayoutKernel)`. Vite, webpack 5 and Rollup with
  a worker plugin handle this pattern without extra configuration.

## TypeScript

The renderer-facing declarations in `./core` reference three.js types. Install `@types/three`
(an optional peer) to type-check code that uses them; the contract types need nothing else.

## License

MIT. three.js is MIT-licensed; see `THIRD_PARTY_NOTICES.md`.
