# Lyra 3D

[![Coverage](https://img.shields.io/endpoint?url=https://aceshooting.github.io/lyra-ui/badges/coverage-lyra-3d.json)](https://codecov.io/gh/aceshooting/lyra-ui)

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
| `@aceshooting/lyra-3d/graph-layout` | Deterministic DAG preprocessing with synchronous and cancellable asynchronous helpers; no renderer import |
| `@aceshooting/lyra-3d/points` | Point clouds, line segments and axes in two or three dimensions |
| `@aceshooting/lyra-3d/panorama` | Equirectangular images or existing video elements, with camera controls and hotspots |
| `@aceshooting/lyra-3d/model` | Bounded model admission and rendering for glTF/GLB, OBJ, STL, PLY, XYZ and PCD |
| `@aceshooting/lyra-3d/xr` | Explicit immersive support query, fixed errors and presentation types; no renderer import |

Each engine entry point exports `createEngine()` and its data types. Graph, points and model
engines use the core orbit camera; panorama exports its own yaw/pitch/field-of-view camera.
Import an individual engine entry to avoid loading the other engines. Component integration and
accessible alternatives remain the responsibility of the host.

The panorama engine uses an already-loaded image or the host's existing video element; it does
not fetch media or create a second player. The model engine accepts model bytes, rejects
external resources before parsing, and enforces the exported `MODEL_LIMITS`. Its `admitModel()`
helper reports admission failures through `ModelAdmissionError`; it does not fetch URLs.

The model engine also exposes `setDataAsync(data, revision, { signal }?)`, which always returns
a Promise. It snapshots the bytes synchronously, then prepares and validates the model with
bounded work, using a module worker when available and a main-thread fallback otherwise.
The Promise resolves after atomic installation, or after storing the owned candidate when called
before mounting. Preparation failure or cancellation retains the previously installed model.
Snapshot copying, native image decoding and GPU upload are separate costs; the Promise does not
make those native operations interruptible.
Bounded scheduling improves opportunities to handle input and cancellation; it does not guarantee
lower total loading time. Owned snapshots and validation also contribute to allocation and garbage
collection costs, particularly for large binary inputs.

`setData` and `admitModel` retain their synchronous admission errors. For `setDataAsync`, an
invalid input envelope or revision rejects without reserving a revision. Once the input snapshot
is accepted, the revision is reserved even if deeper validation later fails or the operation is
aborted. Retrying then requires a higher revision. Replacement, abort and disposal reject pending
async operations with `AbortError`; current preparation failures also use the existing host error
notification. Hosts supporting older companion versions should check whether `setDataAsync` is
callable and otherwise use `setData`.

PLY headers must use consistent LF or CRLF line endings, exact `ply` and `end_header` lines,
and no lone carriage returns. Header comments and metadata must not contain `end_header` text.
Both binary byte orders and ASCII bodies are supported. Double-precision mesh attributes are
rounded to finite Float32 values in bounded work before GPU installation. Values outside that
range are rejected without replacing the current model. OBJ
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
  `fit`, `focus`, `pick`, `project`, `positionOf` and `prepareXrPresentation` are optional.
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

Spatial graph presentation accepts `spatialAppearance.edgeCurvatures`, a `Float32Array` with one
finite signed value per edge. Admission owns a copy and clamps values to `[-1, 1]`; omitted or
zero values retain straight strokes. Nonzero ordinary edges reserve 16 stroke segments plus any
directed arrow. Self-loops and dangling stubs retain their existing shapes. The legacy graph
route without `spatialAppearance` keeps its cylinder rendering.

The quadratic bow is defined in world space: choose the positive axis least aligned with the
source-to-target direction (ties X, Y, Z), then cross that direction with the axis. Curvature
scales the midpoint displacement along this normal by the endpoint distance. Reversing an edge
reverses its bow; camera rotation does not change it. Labels use the curve midpoint and particles
advance in the curve parameter, without an arc-length speed guarantee. Derived curve positions
may extend beyond the node coordinate bounds. Explicit fit includes analytic curve extrema,
subject to the existing camera target and distance limits.

`setAppearance()` can replace spatial presentation, including curvature, without restarting
layout, moving the camera, changing pins or clearing selection. Omitting `spatialAppearance`
retains it; supplying one replaces that entire object, so omitting `edgeCurvatures` inside the
replacement clears curves. Invalid columns or expanded geometry above the 2,000,000 primitive
limit reject before replacing the accepted scene. Curves increase geometry and delivery cost;
their throughput depends on the scene and renderer.

## Optional immersive points presentation

The points engine implements `prepareXrPresentation(options?)` for a bounded 3D scene profile.
Other engines may omit this optional method. Importing the `xr` entry does not access browser
capabilities or load a renderer. Explicitly calling `isLyra3dXrSupported()` queries
`immersive-vr` support in a secure context; it does not request permission or create a session.
A positive result does not guarantee that a later request will succeed on a particular browser
or headset.

Prepare the already-mounted engine before the entry gesture. Then call the prepared
presentation's `enter()` directly from that gesture, with no intervening `await`:

```ts
import { isLyra3dXrSupported, Lyra3dXrError } from '@aceshooting/lyra-3d/xr';

// engine, enterButton, exitButton and showMessage belong to the host application.
if (engine.prepareXrPresentation && await isLyra3dXrSupported()) {
  const showFailure = (error: unknown) => {
    showMessage(error instanceof Lyra3dXrError ? error.code : 'failed');
  };
  try {
    const presentation = await engine.prepareXrPresentation();
    enterButton.addEventListener('click', () => {
      void presentation.enter().catch(showFailure);
    });
    exitButton.addEventListener('click', () => {
      void presentation.exit().catch(showFailure);
    });
    // Call presentation.dispose() when the host removes these controls.
  } catch (error) {
    showFailure(error);
  }
}
```

Use fixed codes to select the host's localized messages. Codes are `unavailable`, `not-allowed`,
`busy`, `unsupported-scene`, `context-lost`, `failed` and `aborted`; platform error details are
not exposed. `onStateChange` receives `ready`, `requesting`, `presenting`, `ending` or `disposed`
transitions. The initial state is `ready`; the callback does not replay it. Explicit disposal
suppresses further callbacks. Each preparation permits one native entry attempt; prepare again
after completion rather than reusing it. A `busy` document refusal before an attempt leaves the
preparation ready. Disposing an unused preparation leaves inline rendering intact.

The current points profile accepts `mode: '3d'`, at most 100,000 points and 100,000 explicit
segments, plus the existing bounded axes and grids. Every point, axis and tick label must be
empty, and glow must be absent. Labels are not hidden to obtain entry. Unsupported scenes reject
preparation with `unsupported-scene` before requesting a session and preserve the inline view.
Coordinates must be normal finite Float32 values or zero. Size, scale and coordinate-offset
limits can also reject an otherwise valid inline scene.

Native point diameters and stroke widths use 0.002 metres per configured size unit; inline sizes
remain CSS pixels. The scene fits inside a sphere of radius 0.75 metres, including glyph widths
and a numerical margin. Its centre is placed two metres ahead at the first valid viewer pose's
height and horizontal heading, preserving the semantic y-down orientation. This placement stays
fixed as the viewer moves. A vertical initial view uses the inline camera heading. Rendering uses
0.01–100 metre clipping; strokes crossing an eye's near plane are omitted.

Accepted data, style or visual-state changes end a requesting or presenting session and retain
the latest values for inline recovery. Invalid inputs retain their ordinary synchronous errors
and leave the presentation unchanged. Camera, fit, focus and resize calls update only the return
view. Changes to prepared scene facts require a fresh preparation before entry.

`enter()` resolves after binding and the first successful valid-pose submission. `exit()` resolves
after the old native ownership and renderer have retired; it does not certify replacement drawing.
The engine constructs a fresh inline viewport from its latest state and calls the host's
`restored()` only after a successful default-target draw. Zero-sized allocation waits for a
nonzero resize. Recovery failure follows the ordinary `lost('error')` fallback. Disposing the
engine prevents reconstruction and further host callbacks. The host retains responsibility for
accessible controls and inline alternatives; this entry does not add component XR controls.

## Directed acyclic graph layouts

The granular `graph-layout` entry computes positions before rendering. It does not import three.js,
create an engine or change a component's layout mode. Directed cycles, including self-loops, cause
the synchronous helper to throw `GraphDagLayoutError` with code `cyclic-graph`; the asynchronous
helper rejects its promise with that error. Edges are never reversed to make a graph acyclic.

```ts
import { layoutGraphDag } from '@aceshooting/lyra-3d/graph-layout';

const input = {
  nodeCount: 4,
  source: new Uint32Array([0, 0, 1, 2]),
  target: new Uint32Array([1, 2, 3, 3]),
};
const { positions, ranks, layerCount } = layoutGraphDag(input, { direction: 'y' });
// ranks: [0, 1, 1, 2]; layerCount: 3.
// positions contains xyz triples in the original node-row order.
```

Longest-path ranks place sources before their targets. Nodes within each layer retain their
original row order on a centered grid; parallel edges do not change the layout. Directions are
`x`, `-x`, `y`, `-y`, `z` and `-z` (default `y`). `layerGap` defaults to 100 and `nodeGap` to 50;
each must be between 0.001 and 1,000,000 world units. Coordinates outside
±10,000,000 world units fail with `coordinate-range`, rather than being clamped. Results own their
`Float32Array` positions and `Uint32Array` ranks; Float32 rounding can reduce precision at large
coordinates. Input columns remain unchanged.

`layoutGraphDag` accepts up to 10,000 nodes and 100,000 edges. `layoutGraphDagAsync` accepts up to
200,000 nodes and 1,000,000 edges. Both require ordinary, non-shared, non-resizable Uint32Array
endpoint columns with equal lengths and valid node-row indices. The asynchronous helper copies
and validates columns in bounded main-thread tasks; keep the input columns unchanged until its
promise settles. It does not use a worker or promise a fixed completion time. Native buffer
allocation cannot be interrupted within a task.

An application can cancel superseded layouts before installing positions into a mounted graph
engine:

```ts
import { layoutGraphDagAsync, type GraphDagLayoutInput } from '@aceshooting/lyra-3d/graph-layout';
import type { GraphEngine } from '@aceshooting/lyra-3d/graph';

function dagUpdates(engine: GraphEngine) {
  let pending: AbortController | undefined;
  let generation = 0;
  let disposed = false;
  return {
    async replace(input: GraphDagLayoutInput) {
      if (disposed) return;
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      const revision = ++generation;
      try {
        const result = await layoutGraphDagAsync(input, undefined, { signal: controller.signal });
        if (disposed || controller.signal.aborted || revision !== generation) return;
        engine.setData({ ...input, positions: result.positions }, revision);
        engine.fit?.();
      } catch (error) {
        if (controller.signal.aborted || revision !== generation) return;
        throw error; // The application presents a message using the stable error code.
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      pending?.abort();
      engine.dispose();
    },
  };
}
```

Supplied engine positions default to pinned; no competing force layout moves this geometry.
A rejected replacement keeps the previous scene. `onProgress`, when supplied as an execution
option beside `signal`, receives immutable phase and cumulative-operation snapshots. Abort or
throwing from the callback prevents completion, including during its final `complete` notification.

The [standalone example](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-3d/examples/graph-dag.ts) mounts the actual engine, observes allocation,
installs a small DAG and releases the engine, observer and pending request on disposal. Call its
`dispose()` when the application view disconnects, and retain an accessible list or text view.
The `lr-graph` Directed acyclic layout story demonstrates the same helper with immutable
`LyraGraphNode.position` records, curved parallel links and the component's existing Fit and List
controls. Component position limits still apply independently of the helper's world bounds.

## Custom graph nodes and glow

Spatial `GraphEngineData.spatialAppearance.nodeMeshes` accepts one `GraphNodeMesh | null`
per node. Import `GraphNodeMesh` and `GraphNodeMeshData` types from
`@aceshooting/lyra-3d/graph`. Each mesh supplies non-indexed Float32Array `positions` (9 floats
per triangle), Float32Array `normals` (one outward unit XYZ normal per triangle) and an optional
four-number sRGB RGBA `color`. Color omission inherits resolved node paint. A null row keeps its
standard glyph. For an admitted spatial graph, `engine.setNodeMeshes(rows)` replaces only these
bodies; `engine.setNodeMeshes(undefined)` clears them. It preserves topology, positions, layout,
pins, selection and camera. It is also preserved when `setAppearance` omits `spatialAppearance`;
a supplied whole appearance without `nodeMeshes` clears it.

Mesh-local vertices use the graph's XYZ/y-down world axes, lie inside the unit sphere and have
consistent outward winding. World-sized bodies multiply coordinates by half the existing node
diameter. CSS-sized bodies convert that radius at the node center using the full view; perspective
across the face still affects its silhouette. A CSS-sized center at or behind the near plane is
hidden, while world-sized faces clip by their actual vertices. Flat directional face lighting
makes geometry depth visible; forced colors uses accessible flat paint. Labels and focus rings
keep their existing semantic anchors.

Admission owns copies, rejects accessor-backed descriptors, wrong/shared/resizable buffers,
nonfinite coordinates, zero-area triangles and invalid normals/color. Joint limits are 64 faces
per node, 16,384 custom rows, 65,536 faces per scene and 4 MiB reserved mesh payload per owner.
Custom byte-addressable storage accounting is capped at 32 MiB CPU and 16 MiB GPU attributes,
including both host/engine mesh copies, mixed sorting, shared pick backing and staging. An atomic
replacement can retain two generations. These bounds exclude JS object metadata, driver storage
and the existing ordinary scene; ordinary current/candidate buffers are accounted separately.
They are allocation limits, rather than a total-process memory or frame-rate guarantee.

Positive-alpha custom faces pick their exact triangle silhouette and return the original node
row, including when visual dimming reaches zero. Authored alpha-zero bodies have no body pick.
Custom triangles share opaque depth testing and translucent primitive ordering with glyphs and
strokes. Translucent sorting retains the existing approximate ordering during movement and for
intersecting faces. Camera movement never re-runs the component callback or replaces immutable
local geometry. Direct engine users supply data; the component owns its application callback,
keyboard/list alternatives, localized refusal and `lr-node-render-error` event.

`await engine.setGlow(true)` enables a lazily imported static soft halo; false cancels setup and
releases attachments. The default is false, and setting it never changes id picking. Glow captures
the visual scene, blurs premultiplied linear RGBA in two passes, then composites a halo behind the
normal full-resolution base. It preserves transparent backgrounds and leaves the component's
separate label canvas unchanged. The fixed radius is 8 CSS pixels with strength 0.6. Three RGBA8
attachments are half-resolution or smaller, at most 2,048 per side and 1,048,576 pixels each;
combined color/depth storage is estimated at 16 MiB, or 32 MiB during bounded resize replacement,
excluding driver overhead. Software contexts retain the same resource limits. Forced colors
suppresses the effect, and reduced motion keeps it static. Real-GPU qualification is required
before making workload-specific performance claims.

Hosts with older companions can check `setNodeMeshes`/`setGlow` capability only when requesting
those optional features. The core viewport also exposes `setGlow(boolean)`; ordinary engines
keep it disabled. Current effect load/allocation/render failure reports the existing host
lost-error signal, so components use their normal fallback chain. A restored enabled effect must
be ready before the host receives `restored`.

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
