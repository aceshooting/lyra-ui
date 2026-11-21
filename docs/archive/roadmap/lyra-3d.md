# Archived: WebGL 3D views delivery record

Moved from docs/roadmap/lyra-3d.md; the completed 1.0.0 delivery phases and the 1.1.0 maintenance
measurements, not current guidance.

## Release notes

The published lyra-ui 30.1.0 release does not complete the later visuals or scale targets listed
below. At that release the companion remained at 1.0.0; expanded integration tests do not extend the hardware
measurements. Current [lyra-3d 1.1.0](https://github.com/aceshooting/lyra-ui/releases/tag/lyra-3d%401.1.0) was published on 2026-10-25.

## Published 1.1.0 maintenance

The [30.2 maintenance delivery](https://github.com/aceshooting/lyra-ui/releases/tag/lyra-ui%4030.2.0) includes sparse point/graph
visual-state updates, resumable graph fallback work, lower-allocation XYZ parsing, admitted-format
loader boundaries and an additive asynchronous model-loading path. These changes do not complete
the later visuals or 100k-node graph target.

The final real-GPU campaign passes 48 runs, 24 pairs and 120 exact-output stages, with independent
review of hardware/source identity, pixel/render/pick parity, worker completion and disposal. Dense
upload fragmentation is corrected; residual CPU overhead remains disclosed under the advisory
timing policy and required changeset explanation. Upload counts
and two-frame paint opportunities do not measure compositor presentation or GPU duration.

Paired Node graph runs preserve completed-iteration outputs and near-baseline large-workload
throughput, retaining small exact-solver overhead. Bounded scheduler/heartbeat and cancellation
checks supplement the passing packed three-engine cases. Twelve trusted interruption cases
preserve exact replacement/disposal behavior during initialization before the first completed
iteration; they do not establish mid-solver input latency. The hardware Chromium campaign has
three trials per action, with automation-inclusive dispatch-to-handler timing; synchronous admission
and scene creation remain outside the resumable work.

XYZ fixtures retain exact input/position/color/bounds parity; large Node parse cases improve, while
empty/single-vertex startup increases about 1 ms. Shared synchronous model admission, descriptors, all-format
asynchronous service routing and UI adoption are implemented and reviewed. Model checks pass
686 unit tests and 106 packed cases in each of Chromium, Firefox and WebKit after cleanup. Lifecycle
ownership and bounded finite Float64-to-Float32 conversion correct the reproduced PLY mesh cases
while preserving float meshes and double point clouds. UI adoption passes 82 cases in
Chromium/WebKit and 76 with six retained skips in Firefox.

Actual public synchronous GLB admission still measures about 44–49 ms against a roughly 12 ms
baseline. Garbage collection contributes, but the exact cost remains unresolved. The advisory
timing policy requires a public changeset explanation. The packed production request-boundary
check passes for XYZ, OBJ and GLB. Three cold-load pairs preserve exact pixels/positions and
hardware/request boundaries. Initial artifact gzip estimate falls from 181,525 to 170,847 bytes, while later format
loads are slower; no general loading-throughput improvement is claimed. The three-sample tiny-fixture
comparison uses fresh documents in a shared browser/OS environment; artifact gzip estimates do
not represent transferred compressed bytes or measure isolated CPU, allocation or GPU duration. Complete coverage
records all 7,860 lines/statements hit (100%), functions 99.69% and branches 97.95%, with 686 unit
checks and 106 packed cases passing in each of Chromium, Firefox and WebKit.
The refreshed full coverage run
includes the five additional meaningful critical-branch tests without runtime changes. Final
lint/spelling and current size/budget checks pass. The final asynchronous model campaign passes
42 hardware-browser cases for XYZ, binary PLY and OBJ at 100k/1M vertices on worker/fallback routes.
Observed counts, bounds, coordinate samples, rendering and picks pass. All six trusted cancellations
reject before commit and preserve the prior scene; these cancellations occur after preparation.

Eight of eighteen successful 100k loads have commit-overlapping main-thread tasks of 51–74 ms;
1M XYZ/PLY reaches 253–283 ms. Worker examples occur after the worker result, without established
parser causation. No blanket jank-free loading or performance improvement is claimed. Sampled,
instrumented main-realm JavaScript heap excludes worker, GPU and whole-process peaks; disposal
observations do not prove complete native-resource reclamation. Historical native endpoint and
post-disposal counters are complete, but process-maximum RSS does not establish parser-only peak
heap. Version-stamped package/budget verification and exact-commit release qualification are complete.

[lyra-3d 1.1.0](https://github.com/aceshooting/lyra-ui/releases/tag/lyra-3d%401.1.0) was published on 2026-10-25; the
[qualification record](test-health.md#current-302-maintenance-qualification) links the passing workflows.
The measurements above retain their original scope and limitations.

## Delivery phases (1.0.0)

### 0. Specification and feasibility (S)

- [x] Engine-seam inventory of `lr-graph` and `lr-embedding-explorer`.
- [x] WebGL feasibility spike in Chromium, Firefox and WebKit: go. Rendering keeps 60 fps at 30k
  nodes and 90k edges on a real GPU with large headroom; the force layout is the bottleneck (about
  14 layout steps per second at 10k nodes), so layout convergence gets its own budget. CI can
  measure real-GPU frame rates in headless Chromium; Firefox and WebKit render in software there,
  so they get functional and fallback coverage. GPU id picking latency needs workload- and
  hardware-specific measurement; a restored context needs renderer state re-applied.
- [x] Engine contract, opt-in vocabulary and large-data input written and approved (2026-10-20):
  `three` as a dependency of the companion, standard module workers with a main-thread fallback,
  typed-column inputs (`graphColumns`, `pointColumns`) as immutable objects, and a dedicated
  `lr-chart-3d` tag for 3D charts.

Exit: written contract, measured spike, and a go or narrow decision.

### 1. Foundation (M)

- [x] `packages/lyra-3d`: build, entry points, `sideEffects`, licenses and notices, size budgets,
  packaging and freshness checks, CI lanes and changeset.
- [x] Shared engine core: renderer setup, orbit camera, fit and focus, GPU picking, token style
  input, resize, context loss, disposal and reduced motion.
- [x] Lyra UI side: shared engine loader and capability validation, the `engine` property helper,
  typed-column validation and localized foundation strings.
- [x] Size gates prove Three.js is unreachable from every Lyra UI entry point.
- [x] Connect component opt-ins and fallback notices in the later view phases.
- [x] Complete the protected first-publication bootstrap for lyra-3d 1.0.0.
- [x] Verify trusted-publisher configuration: the 1.1.0 publication successfully used OIDC
  trusted publishing on 2026-10-25.

### 2. Graph engine (L)

- [x] Extract `lr-graph`'s Canvas 3D drawing behind the contract (the built-in fallback), keeping
  selection, events and keyboard handling unchanged.
- [x] `lyra-3d/graph`: 3D force layout in a module worker (Barnes-Hut octree), instanced nodes and
  edges, labels, arrows, node dragging with pinning, directional link particles; explicit node
  positions stay pinned.
- [x] `engine` on `lr-graph`, forwarded by `lr-knowledge-graph-explorer`; events, getters,
  `camera`, `fit`, `focusNode` and the list fallback work identically on every renderer.

Exit: the fallback chain works in all three engines and meets the 10k-node target.

### 3. Points engine (M)

- [x] `lyra-3d/points`: instanced point cloud with picking, category colors and 2D or 3D cameras.
- [x] `lr-embedding-explorer`: `engine`, optional `z` coordinate, a keyboard cursor and paginated
  list for large point sets, every point rendered up to the documented limit.
- [x] `lr-chart-3d`: 3D scatter, bubble and line charts with axes, gridlines and tick labels.
- [x] Point-cloud files (PLY, XYZ, PCD) through the model viewer's file pipeline.

Exit: meets the 100k-point target; the fallback chain works in all three engines.

### 4. Panorama engine (S)

- [x] `lyra-3d/panorama`: equirectangular sphere with pointer look-around, field of view
  zoom and hotspot picking.
- [x] Opt-in 360° mode and keyboard look-around on `lr-image-viewer` and `lr-video`; playback
  state and controls stay in `lr-video`; the flat image or video is the fallback.

### 5. Model viewer (M)

- [x] `lyra-3d/model`: bounded model-file admission and rendering for glTF/GLB, STL, OBJ, PLY,
  XYZ and PCD, embedded-resource handling, orbit camera, picking and owned-resource disposal.
- [x] New `lr-model-viewer` tag (viewers family): glTF/GLB, STL, OBJ and point-cloud files, orbit,
  fit, lighting from tokens, progress, loading and error states, a text alternative and a download
  link.
- [x] Remote files through the shared owner-aware safe URL resolver, byte ceilings and generation
  guards after asynchronous reads;
  no script or external resource execution from model files.
- [x] Registered in `lr-document-viewer`'s MIME registry so model attachments open in place.

### 6. Release qualification

- [x] Complete the 1.0.0 release qualification: three-engine tests, visual captures, recorded
  real-GPU performance results, size budgets, `llms/` docs, stories, migration guide, changesets
  and publication. These results qualify the recorded release scope and measured hardware only.
