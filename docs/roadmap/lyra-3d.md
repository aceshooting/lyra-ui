# WebGL 3D views (`@aceshooting/lyra-3d`)

Status: planned; nothing in this plan has shipped. Phase 0 is in progress. Today `lr-graph`
`view="3d"` is a zero-dependency Canvas 2D perspective mode with no 3D force solver, intended for low
hundreds of nodes; `lr-embedding-explorer` draws an SVG scatter that renders at most 1,000 points (an
evenly spaced sample of larger inputs); no component shows 3D models, point clouds or 360° media.

## Objective and boundaries

Add GPU-rendered views in an optional companion that only the applications using them install. The
model is `lr-map`: the tag stays in Lyra UI and its engine loads on demand from an optional companion.

- `@aceshooting/lyra-3d` holds WebGL engines only, one entry point per engine, so an application
  loads only what it uses:

  | Entry point | Used by |
  |---|---|
  | `@aceshooting/lyra-3d/graph` | `lr-graph`, `lr-knowledge-graph-explorer` (3D force graph) |
  | `@aceshooting/lyra-3d/points` | `lr-embedding-explorer`, the 3D scatter chart, point-cloud files |
  | `@aceshooting/lyra-3d/panorama` | `lr-image-viewer` (360° photos), `lr-video` (360° video) |
  | `@aceshooting/lyra-3d/model` | `lr-model-viewer` (glTF/GLB, STL, OBJ) |

  Three.js and all 3D code live there and are never reachable from any Lyra UI entry point.
- Components stay Lyra UI tags. An application opts in per element; the component then loads the
  engine on demand. Without the opt-in nothing changes and nothing new is downloaded.
- Selection, events, getters, the keyboard model, localization, accessibility, loading and error
  states and the list or text fallback keep one implementation in the component; engines only
  render, lay out and pick.
- Fallback chain: the WebGL engine, then the component's built-in renderer where one exists (Canvas
  3D for `lr-graph`, the SVG scatter for `lr-embedding-explorer`, the flat image or video), then the
  list or text alternative. A missing companion, missing WebGL or a lost context falls back the same
  way, with a localized notice.
- Clean-room: behavior-only reference to existing open-source 3D libraries; no dependency on their
  wrapper packages and no copied source.

Not in scope:

- Moving the existing graph, flow-canvas and mind-map code out of Lyra UI. An earlier version of
  this plan proposed it; it is withdrawn. Those engines already load on demand, so a move would not
  reduce any application's download, while every graph, flow and mind-map user would face a
  migration.
- 3D bar and pie charts (perspective distorts the values they encode), volume rendering, AR/VR.
- Maps: `lr-map` already renders with WebGL through `@aceshooting/lyra-map`; see
  [map-adoption.md](map-adoption.md).

## Engine contract

One small interface shared by every entry point; per-engine data and camera types:

- `mount(container, host)`: the engine owns its own canvas inside a container the component owns
  (a canvas cannot switch between WebGL and 2D contexts, so a fallback renders a fresh canvas).
- `setData(data, revision)`, `setStyle(style)`, `setCamera(camera)`, `resize(w, h)`, `dispose()`;
  optional `setState` (selected, dimmed, hover, focus), `fit`, `focus`, `pick`, `project`,
  `positionOf`.
- The engine reports back through the host: `hover`, `pick`, `camera` (at most once per frame),
  `progress` (file loads) and `lost` (context loss or error, which moves down the fallback chain).
  The component turns these into its existing events.
- Items are indices into component-owned order; the component maps ids once per model.
- The component resolves tokens through computed style and passes plain values (colors, palette,
  sizes, font, device pixel ratio, reduced motion, forced colors), so engines never read Lyra UI
  styles or internals.
- The component validates the loaded module (a `contract` version and required methods) before use,
  as `lr-map` does, through the shared optional-peer loader, which allows a retry after a failed load.
- Mount lazily on first visibility; dispose on disconnect (WebGL context budget).
- Camera values keep the existing `lr-graph` convention, so a camera round-trips when the chain
  falls back from WebGL to Canvas 3D.

## Opt-in

A new `engine` property (`'builtin' | 'webgl'`, default `'builtin'`) on each component that gains a
WebGL engine, normalized like `view` and switchable while connected. `renderer` keeps its 2D meaning.
`lr-model-viewer` has no built-in renderer, so it always loads its engine and falls back to its text
alternative and download link. `lr-map`'s `engine` stays a strict choice; these components treat
`webgl` as a preference with a fallback, and the docs say so.

## Large data input

The shared public-collection snapshot admits at most 10,000 array entries and 50,000 nested values,
which cannot carry 30k edges or 100k points. Phase 0 adds a documented large-data input for the
WebGL views: typed columns (ids, coordinates, sizes, categories, edge index pairs) admitted without
per-item object snapshots, with an explicit ceiling, validation and the same events reporting ids.
The existing `nodes`, `edges` and `points` properties and their limits stay unchanged.

## Versioning

- `@aceshooting/lyra-3d` versions independently of the fixed `lyra-ui`/`lyra-ide`/
  `lyra-translations` group, like `@aceshooting/lyra-map`, and declares the Lyra UI range it
  supports. Lyra UI lists it as an optional peer.
- Every opt-in and the new `lr-model-viewer` are additive; they ship in 30.0.0 together with the
  release's breaking changes.
- A new npm package needs its trusted-publisher entry configured before the first publish; without
  it the publish fails with E404.

## Targets and budgets

- Graph: 10k nodes and 30k edges at 60 fps on the reference hardware; 100k nodes later.
- Points: 100k points at 60 fps on the reference hardware.
- Model viewer: models up to the documented byte ceiling load progressively without blocking input.
- Three.js never reachable from any Lyra UI entry point; the size gates enforce it per entry point.
  Numeric limits live in the executable budget configuration, not here.
- Initial render, layout convergence, interaction latency and retained memory measured per the
  roadmap's performance gates, with raw results and variability kept. Headless CI renders WebGL in
  software unless a GPU configuration is proven, so frame-rate targets also need real-GPU runs.

## Delivery sequence

Each phase requires its own public contract, JSDoc, `llms/` documentation, stories, manifest and
editor data, and three-engine tests (Chromium, Firefox, WebKit). Accessibility, localization and RTL
apply from the first interactive increment. Phases 0 to 6 ship together as lyra-ui 30.0.0 with
lyra-3d 1.0.0.

### 0. Specification and feasibility (S)

- [x] Engine-seam inventory of `lr-graph` and `lr-embedding-explorer`.
- [x] WebGL feasibility spike in Chromium, Firefox and WebKit: go. Rendering keeps 60 fps at 30k
  nodes and 90k edges on a real GPU with large headroom; the force layout is the bottleneck (about
  14 layout steps per second at 10k nodes), so layout convergence gets its own budget. CI can
  measure real-GPU frame rates in headless Chromium; Firefox and WebKit render in software there,
  so they get functional and fallback coverage. GPU id picking costs 1-2 ms at any size; a restored
  context needs renderer state re-applied.
- [ ] Engine contract, opt-in vocabulary and large-data input written and approved.

Exit: written contract, measured spike, and a go or narrow decision.

### 1. Foundation (M)

- [ ] `packages/lyra-3d`: build, entry points, `sideEffects`, licenses and notices, size budgets,
  packaging and freshness checks, CI lanes, changeset and trusted publisher.
- [ ] Shared engine core: renderer setup, orbit camera, fit and focus, GPU picking, token style
  input, resize, context loss, disposal, reduced motion.
- [ ] Lyra UI side: shared engine loader and capability validation, the `engine` property helper,
  the large-data input, fallback notices and localized strings in every catalog.
- [ ] Size gates prove Three.js is unreachable from every Lyra UI entry point.

### 2. Graph engine (L)

- [ ] Extract `lr-graph`'s Canvas 3D drawing behind the contract (the built-in fallback), keeping
  selection, events and keyboard handling unchanged.
- [ ] `lyra-3d/graph`: 3D force layout in a module worker (Barnes-Hut octree), instanced nodes and
  edges, labels, arrows, node dragging with pinning, directional link particles; explicit node
  positions stay pinned.
- [ ] `engine` on `lr-graph`, forwarded by `lr-knowledge-graph-explorer`; events, getters,
  `camera`, `fit`, `focusNode` and the list fallback work identically on every renderer.

Exit: the fallback chain works in all three engines and meets the 10k-node target.

### 3. Points engine (M)

- [ ] `lyra-3d/points`: instanced point cloud with picking, category colors and 2D or 3D cameras.
- [ ] `lr-embedding-explorer`: `engine`, optional `z` coordinate, a keyboard cursor and paginated
  list for large point sets, every point rendered up to the documented limit.
- [ ] 3D scatter, bubble and line charts with axes, gridlines and tick labels (a chart type through
  the existing chart API, or a small dedicated tag if phase 0 shows the chart API does not fit).
- [ ] Point-cloud files (PLY, XYZ, PCD) through the model viewer's file pipeline.

Exit: meets the 100k-point target; the fallback chain works in all three engines.

### 4. Panorama engine (S)

- [ ] `lyra-3d/panorama`: equirectangular sphere with drag and keyboard look-around, field of view
  zoom and hotspot picking.
- [ ] Opt-in 360° mode on `lr-image-viewer` and `lr-video`; playback state and controls stay in
  `lr-video`; the flat image or video is the fallback.

### 5. Model viewer (M)

- [ ] New `lr-model-viewer` tag (viewers family): glTF/GLB, STL, OBJ and point-cloud files, orbit,
  fit, lighting from tokens, progress, loading and error states, a text alternative and a download
  link.
- [ ] Remote files through `safeFetchUrl()`, byte ceilings and a generation guard after every await;
  no script or external resource execution from model files.
- [ ] Registered in `lr-document-viewer`'s MIME registry so model attachments open in place.

### 6. Release qualification

- [ ] Three-engine tests, visual captures, performance results on real GPU hardware, size budgets,
  `llms/` docs, stories, migration guide, changesets, and publication of lyra-3d 1.0.0.

### Later (lyra-3d 1.x)

- [ ] Curved edges, DAG layouts, a custom node renderer and optional glow.
- [ ] 100k graph nodes with progressive layout and a performance gate.
- [ ] Optional WebXR presentation, only on demand and separately qualified.

## Risks

- WebGL context loss, driver variance and WebKit differences; mitigated by the fallback chain.
- Worker and bundler configuration burden for consumers, as with the map companion.
- Accessibility regression if engines leak into selection or keyboard handling; the contract keeps
  those in the components.
- Untrusted model files: parser hardening, byte ceilings and no external resource loading.
- Dependency licensing and size of Three.js and its loaders; verify each exact dependency and notice.
- Headless CI renders WebGL in software, so frame-rate targets need measurement on real GPU hardware.
