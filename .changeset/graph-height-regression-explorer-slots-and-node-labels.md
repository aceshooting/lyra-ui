---
"@aceshooting/lyra-ui": minor
---

Fix `<lr-graph>`'s `height` regression, add two additive detail slots to
`<lr-knowledge-graph-explorer>`, and let both respect a node's `accessibleLabel` with a new
`nodeLabels` visibility control.

`height` stopped sizing the rendered viewport somewhere between the `:host` reservation rule
(13.0.0) and the pre-upgrade reservation stylesheet (10.0.1) — it kept resizing the SVG
`viewBox`/canvas backing store, but `:host { block-size: var(--lr-canvas-reserved-height,
var(--lr-size-24rem)) }` never referenced it, so the rendered box silently stayed at
`--lr-canvas-reserved-height`'s default (or override) regardless of `height`. `<lr-graph>` now
writes its normalized `height` to a private `--_lr-graph-requested-height` custom property, and
`:host`'s `block-size` falls back to it beneath the author-facing `--lr-canvas-reserved-height`
(`block-size: var(--lr-canvas-reserved-height, var(--_lr-graph-requested-height,
var(--lr-size-24rem)))`) — an explicit `--lr-canvas-reserved-height` or outer `block-size` still
wins, exactly like `--lr-chart-height`/`--_lr-chart-height` on `<lr-chart>`. `<lr-knowledge-graph-
explorer>`'s own `[part="graph"]` rule mirrors the same fallback chain so its composed graph
responds to `height` the same way once the explorer's own layout gives it room.

`<lr-knowledge-graph-explorer>`'s `details` slot was all-or-nothing: overriding it meant
reimplementing the whole default card, list, and pin button from scratch. Two new slots are
additive instead — `detail-body` renders inside the default `lr-entity-card`'s body alongside its
`lr-neighbor-list`, and `detail-actions` renders into the card's `actions` slot beside the existing
pin button — so a consumer can append content without giving up the built-in behavior. Neither has
any effect while `details` itself is overridden.

The explorer's own `nodeLabel()`/`entityFor()` helpers ignored a node's `accessibleLabel`, falling
straight from `label` to the bare `id` — so a node with only a spoken label (no visible one) showed
its raw id in search results, pinned chips, and the details popover's name instead of that label.
Both now resolve `label || accessibleLabel || id`, matching the precedence `<lr-graph>` already uses
for its own spoken text.

`<lr-graph>` also gains a `nodeLabels: 'always' | 'zoom' | 'none'` property (attribute
`node-labels`), mirroring `showEdgeLabels`/`edgeLabelMinZoom`'s zoom-gate mechanism for node labels
too: `'always'` draws every label unconditionally, `'zoom'` hides them below the existing canvas
declutter threshold in both renderers (a `data-node-labels-hidden` attribute toggled on the zoomed
`<g>` for `renderer="svg"`, no Lit re-render), and `'none'` never renders them. Left unset, each
renderer keeps its exact pre-existing default — `'always'` for `renderer="svg"`, `'zoom'` for
`renderer="canvas"` — so this is a purely additive opt-in. `<lr-knowledge-graph-explorer>` forwards
its own new `nodeLabels` property straight through to the composed graph.
