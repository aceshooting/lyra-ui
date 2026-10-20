# WebGL 3D views (`@aceshooting/lyra-3d`)

Status: planned; nothing in this plan has shipped. Today `lr-graph` `view="3d"` is a zero-dependency
Canvas 2D perspective mode with no 3D force solver, intended for low hundreds of nodes, and
`lr-embedding-explorer` draws an SVG scatter that renders at most 1,000 points (an evenly spaced
sample of larger inputs).

## Objective and boundaries

Add GPU-rendered views for the components whose data outgrows SVG and Canvas 2D, in an optional
companion that only the applications using those views install. The model is `lr-map`: the tag
stays in Lyra UI and its engine loads on demand from an optional companion.

- `@aceshooting/lyra-3d` holds WebGL engines only, one entry point per component
  (`@aceshooting/lyra-3d/graph`, `@aceshooting/lyra-3d/embeddings`), so an application loads only
  the engine it uses. Three.js and the 3D layout code live there and are never reachable from any
  Lyra UI entry point.
- `lr-graph` and `lr-embedding-explorer` remain Lyra UI tags with the same public properties,
  events, parts and tokens. An application opts in per element; the component then loads the engine
  on demand. Without the opt-in nothing changes and nothing new is downloaded.
- Selection, events, getters, the keyboard model, localization, accessibility and the list fallback
  keep one implementation in the component; engines only render, lay out and pick.
- Fallback chain: the WebGL engine, then the component's built-in renderer (Canvas 3D for
  `lr-graph`, the SVG scatter for `lr-embedding-explorer`), then the list. A missing companion,
  missing WebGL or a lost context falls back the same way, with a localized notice.
- Clean-room: behavior-only reference to existing open-source 3D graph libraries; no dependency on
  their wrapper packages and no copied source.

Not in scope:

- Moving the existing graph, flow-canvas and mind-map code out of Lyra UI. An earlier version of
  this plan proposed it; it is withdrawn. Those engines already load on demand (d3 through the
  optional-peer loader, the spatial controller and layered layout through dynamic imports), so a
  move would not reduce any application's download, while every graph, flow and mind-map user would
  face a migration.
- Maps: `lr-map` already renders with WebGL through `@aceshooting/lyra-map`.
- Heatmap and charts: their Canvas 2D renderers meet current needs.

## Engine contract

Phase 0 fixes the exact interface; its shape is:

- An engine mounts into a container the component owns, accepts data and resolved styling, lays
  out (or applies given positions), picks at a point, fits and focuses the camera, resizes and
  disposes. It reports hover, pick and camera changes back to the component, which turns them into
  its existing events.
- The component resolves tokens through computed style and passes plain values (colors, sizes,
  motion preference), so engines never read Lyra UI styles or internals.
- The component validates the loaded module's capabilities before use, as `lr-map` does, and fails
  closed to the next renderer in the chain.
- Disposal releases GPU buffers, workers and listeners; reconnecting recreates them.

## Versioning

- `@aceshooting/lyra-3d` versions independently of the fixed `lyra-ui`/`lyra-ide`/
  `lyra-translations` group, like `@aceshooting/lyra-map`, and declares the Lyra UI range it
  supports. Lyra UI lists it as an optional peer.
- The opt-in is additive in Lyra UI; it ships in 30.0.0 because that release also carries the
  immutable identity collections change.
- A new npm package needs its trusted-publisher entry configured before the first publish; without
  it the publish fails with E404.

## Graph engine

- 3D force layout in a module worker (Barnes-Hut octree; clean-room, behavior-referenced), so the
  main thread only applies positions.
- Instanced nodes and edges; GPU picking; orbit controls; fit and focus.
- Labels, arrows, node dragging with pinning and directional link particles.
- Colors and sizes come from tokens; reduced motion disables particles and animated camera moves.
- `lr-knowledge-graph-explorer` forwards the opt-in to its inner graph.

## Embeddings engine

- A WebGL point cloud that draws every point up to the documented limit instead of a sample.
- 2D and 3D views; points gain an optional `z` coordinate for the 3D view.
- Hover, pick and selection through the existing `lr-point-select` event; cluster colors from
  tokens; the list fallback and keyboard model stay in the component.

## Targets and budgets

- Graph: 10k nodes and 30k edges at 60 fps on the reference hardware; 100k nodes with progressive
  layout in phase 4.
- Embeddings: 100k points at 60 fps on the reference hardware.
- Three.js never reachable from any Lyra UI entry point; the size gates enforce it. Numeric limits
  live in the executable budget configuration, not here.
- Initial render time, layout convergence time, interaction latency and retained memory measured
  per the performance gates in the roadmap, with raw results and variability kept.

## Delivery sequence

Each phase requires its own public contract, documentation, stories and three-engine tests.
Accessibility, localization and RTL apply from the first interactive increment. Phases 0 to 2 ship
together as lyra-ui 30.0.0 with lyra-3d 1.0.0.

### 0. Specification, package and feasibility (S)

- [ ] Engine contract and loading rules shared by both components.
- [ ] WebGL feasibility spike in Chromium, Firefox and WebKit: instancing, picking, context loss,
  worker layout and a measured baseline.
- [ ] Package skeleton: build, entry points, size budgets, packaging checks and trusted publisher.

Exit: written contract, measured spike, and a go or narrow decision.

### 1. Graph engine (L)

- [ ] Instanced nodes and edges, orbit controls, picking, fit and focus, worker layout, labels,
  arrows, dragging with pinning and link particles; events, getters and the list fallback through
  `lr-graph`; forwarding in `lr-knowledge-graph-explorer`; tests and stories.

Exit: the fallback chain works in all three engines and meets the 10k-node target.

### 2. Embeddings engine (M)

- [ ] WebGL point cloud for `lr-embedding-explorer` in 2D and 3D, with picking, cluster colors,
  selection and the list fallback; tests and stories.

Exit: every point renders up to the documented limit; the fallback chain works in all three engines
and meets the 100k-point target.

### 3. Further graph visuals (M) — lyra-3d 1.1.0

- [ ] Curved edges, DAG layouts, a custom node renderer and optional glow.

Exit: each visual honors reduced motion, tokens and the list fallback.

### 4. Scale to 100k nodes (M-L) — lyra-3d 1.2.0

- [ ] Progressive layout and a performance gate.

Exit: recorded budgets pass in CI; documentation matches released behavior.

### Later

- [ ] Optional WebXR presentation, only on demand and separately qualified.

## Risks

- WebGL context loss, driver variance and WebKit differences; mitigated by the fallback chain.
- Worker and bundler configuration burden for consumers, as with the map companion.
- Accessibility regression if engines leak into selection or keyboard handling; the contract keeps
  those in the components.
- Dependency licensing and size of Three.js; verify each exact dependency and notice.
- Headless CI renders WebGL in software, so frame-rate targets need measurement on real GPU
  hardware in addition to the three-engine functional tests.
