# Graph engines and WebGL 3D

Status: planned; nothing in this plan has shipped. Today the graph rendering and layout code lives
inside `@aceshooting/lyra-ui`, and `lr-graph` `view="3d"` is a zero-dependency Canvas 2D
perspective mode with no 3D force solver, intended for low hundreds of nodes.

## Objective and boundaries

Move all graph engine code into an optional companion, `@aceshooting/lyra-graph`, and add an
opt-in WebGL 3D engine there. The model is the map move in 29.0.0: `lr-map` stays a Lyra UI tag
while its engine loads on demand from the optional `@aceshooting/lyra-map` companion.

- `lr-graph` and `lr-knowledge-graph-explorer` remain Lyra UI tags with the same public
  properties, events, parts and tokens. They load the engine on demand.
- The list view, the paginated list fallback, the keyboard model, localization and accessibility
  contracts stay in Lyra UI, so a graph is usable before or without any engine.
- Selection, events and getters keep one implementation in `lr-graph`; engines only render, lay
  out and pick.
- Clean-room: behavior-only reference to existing open-source graph libraries; no dependency on
  their wrapper packages and no copied source.

## Scope of the move

Candidates in `packages/lyra-ui/src/components/retrieval/graph/` (confirm each during phase 0):

| Area | Files today |
|---|---|
| Canvas renderer, hit indexes | `graph-canvas.ts`, `graph-hull.ts` |
| Graph model | `graph-model.ts` |
| 2D force and layered layouts | the layout code reached from `graph-canvas.ts` and `graph-model.ts` |
| Canvas 3D (spatial) mode | `graph-spatial.ts`, `graph-spatial-model.ts`, `graph-spatial-controller.ts` |
| Source composition | `graph-source-composition.ts`, `graph-source-controller.ts` |
| Loader | `graph-loader.ts` (already an on-demand seam) |

Staying in Lyra UI: `graph.class.ts`, `graph.styles.ts`, `graph-legend`, the list fallback and
accessibility behavior, and the `lr-knowledge-graph-explorer` composition.

Component families, from the shared imports of each family's model and layout code:

| Family | Engine | Components | Proposal |
|---|---|---|---|
| A. Network graphs | `graph-model`, `graph-canvas`, `graph-spatial*`, `graph-hull`, `graph-loader`, `graph-source-*`, layered layout | `lr-graph`; `lr-knowledge-graph-explorer` (composes `lr-graph` and `graph-model`); `lr-neighbor-list` (imports `lr-graph` and `graph-model`) | Move to `@aceshooting/lyra-graph` |
| B. Node editors | `flow-model`, `flow-types` layered layout, `flow-viewport-index`, `flow-companion-controller` | `lr-flow-canvas`, `lr-flow-node`, `lr-flow-minimap`, `lr-flow-controls`, `lr-flow-run-status`, `lr-node-palette` (imports `flow-canvas`) | Move to `@aceshooting/lyra-graph` |
| C. Tree layout | `mind-map-layout.ts`, `mind-map-model.ts` | `lr-mind-map` | Move to `@aceshooting/lyra-graph` |

Keep in Lyra UI by default, being light, presentational and shared: `lr-graph-legend` (also used
by `lr-agent-trace`), `lr-path-strip` and `lr-community-card`. `lr-graph-query-builder` is
graph-domain UI without an engine; moving it is optional.

Explicitly not graph components, so unaffected: `lr-trace-tree`, `lr-agent-trace`,
`lr-data-grid`, `lr-heatmap`, `lr-sequence-strip` and `lr-tree`.

Open decision: do the tags move with their engines (separate registration entry points in
`@aceshooting/lyra-graph`), or do the tags stay in Lyra UI and load the engine on demand, as
`lr-map` does? Moving tags gives one package API surface for graph users but changes every
import path and registration. Keeping tags gives install and import simplicity and a stable
public API, at the cost of an engine interface in Lyra UI that must be maintained. Decide in
phase 0; the default assumption in this plan is that tags stay.

## Versioning

Making an optional companion the default engine changes install requirements, so the move ships
in a major release, like the map move: a migration note, `lyra-ui-migrate` guidance (detect
`lr-graph` use, report the new dependency and any explicit engine setting), and a changeset for
each package. A new npm package also needs its trusted-publisher entry configured before the first
publish; without it the publish fails with E404. The package versions independently of
`@aceshooting/lyra-ui` but is released alongside it.

Targets: phases 0 and 1 ship as lyra-ui 30.0.0 with lyra-graph 1.0.0; phase 2 (WebGL 3D) as
lyra-ui 30.1.0 with lyra-graph 1.1.0; phases 3 and 4 as lyra-graph 1.2.0 and 1.3.0.

## Approach for the 3D engine

- Three.js as an optional peer, strictly lazy: never in the root barrel, never in the default
  import graph.
- Layout with a 3D force solver in a module worker (clean-room, behavior-referenced), so the main
  thread only applies positions.
- Instanced rendering for nodes and edges; GPU picking at scale.
- Renderer hook in `lr-graph`: an engine implements a small interface (mount, set data, set
  positions, pick, camera fit/focus, resize, dispose). Events, selection, keyboard model,
  localization and the list fallback stay in `lr-graph`.
- Fallback chain: WebGL, then Canvas 3D, then the paginated list.
- Colors and sizes are resolved from tokens through computed style; reduced motion disables
  particles and animated camera moves.
- Disposal releases GPU buffers, workers and listeners; context loss falls back down the chain.

## Targets and budgets

- 10k nodes and 30k edges at 60 fps on the reference hardware; stretch target 100k nodes with
  progressive layout.
- Three.js never in the root barrel or any non-3D entry; numeric limits live in the executable
  budget configuration, not here.
- Initial render time, layout convergence time, interaction latency and retained memory measured
  per the performance gates in the roadmap, with raw results and variability kept.

## Delivery sequence

Each phase requires its own public contract, documentation, stories and three-engine tests.
Accessibility, localization and RTL apply from the first interactive increment.

### 0. Specification, package boundary and feasibility (S)

- [ ] Inventory the graph files and their consumers; decide the package boundary and the
  engine interface.
- [ ] Design the renderer hook so `lr-graph` owns events, selection, keyboard, localization and
  the list fallback.
- [ ] WebGL feasibility spike in Chromium, Firefox and WebKit: instancing, picking, context
  loss, worker layout and measured baseline.
- [ ] Confirm the family A, B and C scope and decide whether tags move or stay.

Exit: written contract, measured spike, and a go or narrow decision.

### 1. Extract existing engines (M)

- [ ] Create `@aceshooting/lyra-graph` and move the families A, B and C engines (2D force and
  layered layouts, canvas renderer, spatial controller, model and hit indexes, flow model and
  viewport index, mind-map layout) behind the on-demand loader, with no behavior change.
- [ ] Keep existing graph tests passing against the moved code; keep the list view and
  accessibility tests in Lyra UI.
- [ ] Update size budgets, packaging checks and the trusted-publisher setup; ship the migration
  note and `lyra-ui-migrate` guidance.

Exit: identical behavior and a measured smaller default Lyra UI import graph; major release.

### 2. WebGL 3D MVP (L)

- [ ] Instanced nodes and edges, orbit controls, picking, fit and focus, events and getters, worker
  layout, list fallback, tests and stories.
- [ ] Opt-in selection of the WebGL engine; Canvas 3D remains the fallback.

Exit: the fallback chain works in all three engines and meets the 10k-node target.

### 3. Advanced visuals (M)

- [ ] Curved edges, arrows, directional particles, DAG layouts, node drag with pinning,
  distance-based labels, a custom node renderer and optional bloom.

Exit: each visual honors reduced motion, tokens and the list fallback.

### 4. Scale to 100k nodes (M-L)

- [ ] Barnes-Hut approximation, GPU picking and progressive layout.
- [ ] Performance gate, `llms/` documentation and `lr-knowledge-graph-explorer` forwarding.

Exit: recorded budgets pass in CI; documentation matches released behavior.

### Later

- [ ] Optional WebXR presentation, only on demand and separately qualified.

## Risks

- WebGL context loss, driver variance and WebKit differences; mitigated by the fallback chain.
- Worker and bundler configuration burden for consumers, as with the map companion.
- Accessibility regression if engines leak into selection or keyboard handling; the hook keeps
  those in `lr-graph`.
- Dependency licensing and size of the optional 3D peer; verify each exact dependency and notice.
- Migration friction from moving a default engine; mitigated by the migration tool and note.
