## `lr-graph`

A force-directed node-link diagram with pan/zoom/drag, built on `d3-force`.

**Properties:**
- `nodes: GraphNode[] = []` (attribute: false) — `GraphNode { id: string; label?: string;
  accessibleLabel?: string; description?: string; radius?: number; color?: string; type?: string }`;
  `accessibleLabel` supplies richer spoken text than the visible label, while `description` renders
  as native SVG `<title>` tooltip text. `radius` is clamped to `[6, 24]` (an unset/non-finite value
  falls back to the midpoint, `15`) so a node can never render invisibly small or absurdly large.
  `type` is a key into `nodeTypes` (matched by `GraphNodeType.id`); unknown/absent renders as an
  untyped default circle with the token fill, but an unmatched `type` still participates in
  `hiddenTypes` filtering by its raw string value
- `nodeTypes: GraphNodeType[] = []` (attribute: false) — `GraphNodeType { id: string; label: string;
  color?: string; shape?: 'circle' | 'square' | 'diamond' }`, one entry per `GraphNode.type` value:
  `label` feeds the spoken "typed node" summary, and `shape`/`color` drive rendering per node.
  Per-node fill resolution precedence is `GraphNode.color` (most specific) > the matched
  `GraphNodeType.color` > an ordered categorical fallback palette assigned by the type's index in
  `nodeTypes` (`--lr-graph-cat-1` through `-8`, wrapping every 8 entries) > the untyped
  `--lr-node-fill` default; both data-driven color sources are sanitized the same way as
  `GraphNode.color` itself. A typed node with no matching `nodeTypes` entry renders as a plain
  circle with the untyped default fill
- `links: GraphLink[] = []` (attribute: false) — `GraphLink { id?: string; source: string; target:
  string; width?: number; label?: string; accessibleLabel?: string; description?: string; directed?:
  boolean; color?: string; dash?: number[] }` (source/target are node ids). `directed` adds an
  arrowhead; `color` and `dash` style the individual stroke; `label` provides a spoken-name and SVG
  tooltip fallback but is not rendered as visible edge text; `accessibleLabel` and `description`
  can override the spoken name and tooltip independently. A link whose `source` id doesn't resolve
  to a real node is still dropped entirely
  (there's no position to draw a stub from). A link whose `target` id doesn't resolve instead renders
  as a short, dashed, non-interactive stub off `source`'s own position
  (`[part='link'][data-dangling]`, `aria-hidden="true"`) rather than being silently dropped — e.g. for
  a wiki-style `[[link]]` reference to a not-yet-created node. A dangling stub is excluded from
  `d3-force`'s own simulation input and from click/keyboard interaction.
- `width: number = 800`
- `height: number = 600`
- `chargeStrength: number = -300` (attribute `charge-strength` — live-reactive, see gotchas)
- `linkDistance: number = 100` (attribute `link-distance` — live-reactive, see gotchas)
- `minZoom: number = 0.1` (attribute `min-zoom`)
- `maxZoom: number = 8` (attribute `max-zoom`)
- `accessibleLabel: string | null = null` (attribute `aria-label`) — host accessible name forwarded
  to the internal semantic SVG; when unset, the SVG uses the localized node/link-count summary
- `seed?: number` — when set, seeds each node's initial x/y deterministically
  (keyed by node **id**, not array index/order) instead of `forceSimulation()`'s own random start,
  and settles the simulation synchronously instead of animating the settle (same effect
  `prefers-reduced-motion` has, see gotchas)
- `showEdgeLabels: boolean = false` (attribute `show-edge-labels`) — draws each resolved
  (non-dangling) link's `label` as visible SVG text (`[part="link-label"]`) at the segment midpoint.
  Off by default: `GraphLink.label` stays spoken/tooltip-only, matching pre-existing behavior, unless
  this is set
- `edgeLabelMinZoom: number = 0.6` (attribute `edge-label-min-zoom`) — below this zoom scale, every
  drawn edge label is hidden (toggled via a `data-edge-labels-hidden` attribute on the zoomed `<g>`,
  not a Lit re-render, so it tracks pan/zoom smoothly). Ignored entirely when `showEdgeLabels` is
  `false`
- `layout: 'force' | 'layered' = 'force'` — `'force'` runs the `d3-force` simulation described
  throughout this section, unchanged. `'layered'` swaps in a deterministic Sugiyama-lite layered
  layout instead (longest-path layering, barycenter crossing reduction, cycle-safe — back edges are
  reversed only for layering, never mutating caller data): positions are computed synchronously
  with no settle animation, sized from each node's own radius and spaced by `linkDistance` (the
  layer gap) and a fixed 12px in-layer gap. Node drag is disabled in this mode (dragging would fight
  a computed layout) and `chargeStrength` becomes a documented no-op; pan/zoom, keyboard roving,
  `focusNode()`/`fit()`, hulls, edge labels, and `hiddenTypes` filtering all work identically to
  force mode. Switching `layout` at runtime repositions every node without a tween. The layering
  algorithm itself lives in the standalone, dependency-free `layeredLayout()` export
  (`@aceshooting/lyra-ui/internal/layered-layout`), reusable by any other layered-diagram consumer
- `renderer: 'svg' | 'canvas' = 'svg'` — `'canvas'` swaps the per-node/per-link SVG DOM for a single
  DPR-aware `<canvas>`; every event/method/property behaves identically to `'svg'`, with hit-testing
  resolved via an offscreen color-picking canvas instead of DOM event targets. Trade-offs: no
  `::part(node)`/`::part(link)` styling (pixels, not elements — theme via cssprops instead), no
  native SVG `<title>` tooltip (replaced by `part="tooltip"`), and a drawn focus ring instead of a
  CSS one. Keyboard roving/announcements are preserved through an offscreen `part="cursor-item"`
  button per node/link/hull.

**Methods:** `focusNode(id, options?: { zoom? })` and `fit(options?: { padding?: number })` control the
camera; `getNodePosition(id)` returns the current `{ x, y }` in graph-local drawing coordinates, or
`undefined` when the id is not currently simulated.

**Events:** `lr-node-click` (`detail: { id, x, y }`, where `x` and `y` are the clicked node's current
local drawing coordinates), `lr-link-click` (`detail: { source, target,
id? }`; the optional `id` is the stable `GraphLink.id` supplied by the caller), `lr-node-enter`/
`lr-node-leave` (`detail: { id }`, hover start/end, suppressed while dragging/panning),
`lr-link-enter`/`lr-link-leave` (`detail: { source, target, id? }`, same hover contract),
`lr-node-expand` (`detail: { id }`, a node was double-activated — native `dblclick`, or two
Enter/Space activations within 500ms — regardless of `GraphNode.expandable`), `lr-community-click`
(`detail: { id }`, a hull was activated)

**Slots:** none.

**CSS parts:** `base`, `svg`, `node`, `link`, `arrowhead` (the marker path shared by directed links),
`label`, `link-label` (a drawn edge label, only rendered when `showEdgeLabels` is set),
`expand-indicator` (the "+" badge on a node with `expandable: true`), `focus-halo` (the persistent
ring tracking `focusId`'s node), `hull` (a community hull), `community-label`,
`live-region`, `data-list`, `empty`, `canvas`/`tooltip`/`cursor-items`/`cursor-item`
(`renderer="canvas"` only — the drawing surface, its hover tooltip replacing the SVG `<title>`, and
the offscreen keyboard-roving items)

**Themeable custom properties:** `--lr-node-fill` (set inline per-node from `GraphNode.color`,
falls back to `--lr-color-brand`) and `--lr-link-color` (set inline per-link from
`GraphLink.color`, falling back to `--lr-color-border`); also uses `--lr-color-text` +
`--lr-font` (label text), `--lr-focus-ring-*` (node/link `:focus-visible` outline).
`--lr-graph-cat-1..8` (i.e. `--lr-graph-cat-1` through `--lr-graph-cat-8`) — the ordered
categorical fallback palette for a typed node with no `GraphNodeType.color`, assigned by the type's
index in `nodeTypes` (wraps every 8 entries); declared centrally in `tokens.styles.ts` so this stays
the same default across components.
`--lr-graph-edge-label-halo` (default `var(--lr-color-surface)`) — the legibility halo painted
behind a drawn `[part="link-label"]` (via `paint-order: stroke`).
`--lr-graph-focus-halo-color` (default `var(--lr-color-brand)`) — `[part="focus-halo"]` stroke.
`--lr-graph-selected-color` (default `var(--lr-color-success)`) — selected node/link stroke.
`--lr-graph-dimmed-opacity` (default `0.35`) — opacity of a node/link listed in
`dimmedNodeIds`/`dimmedLinkIds`.
`--lr-graph-hull-fill` (default `var(--lr-color-brand)`) — community hull fill/stroke color
(overridden inline per hull from `GraphCommunity.color`).
`--lr-graph-hull-opacity` (default `0.12`) — hull element opacity (composites fill+stroke as one).
Under `renderer="canvas"` these five are read from computed style at paint time (there are no
per-node elements to inherit them), so they must be set on or above the `<lr-graph>` host itself.

**Optional peer deps:** `d3-force`, `d3-drag`, `d3-zoom`, `d3-selection` (all four required
together; lazy-`import()`ed once per page, `console.warn` once and renders empty if missing —
install with `pnpm add d3-force d3-drag d3-zoom d3-selection`).

```html
<lr-graph style="display:block;height:500px"></lr-graph>
<script>
  const g = document.querySelector('lr-graph');
  g.nodes = [
    { id: 'a', label: 'A', accessibleLabel: 'Source document A', description: 'The source document' },
    { id: 'b', label: 'B', description: 'The cited document' },
  ];
  g.links = [{
    id: 'citation-a-b', source: 'a', target: 'b', label: 'cites',
    accessibleLabel: 'Document A cites document B', description: 'Citation relationship',
    directed: true, color: 'var(--lr-color-brand)', dash: [6, 3],
  }];
  g.addEventListener('lr-node-click', (e) => console.log(e.detail.id));
  g.addEventListener('lr-link-click', (e) => console.log(e.detail.id, e.detail.source, e.detail.target));
</script>
```

**Known gotchas:**
- per-tick full re-render is expensive: every d3-force tick (up to ~300 by default,
  continuously while dragging via `alphaTarget(0.3)`) writes node/link positions straight onto the
  already-rendered DOM via `setAttribute()` rather than reassigning `simNodes`/`simLinks` (that
  reassignment — and the Lit re-render/`applyInteractions()` re-scan it used to force on every tick —
  now only happens once per structural `nodes`/`links` change). Still a noticeable cost building up
  the initial layout or while a node is actively being dragged, just no longer once per tick on an
  otherwise-settled graph.
- `chargeStrength`/`linkDistance` **are** live-reactive post-mount now (retuned on the existing
  force objects and the simulation nudged via `alpha(0.3).restart()`) — no need to also touch
  `nodes`/`links` to see the effect.
- `width`/`height` are also live-reactive post-mount: changing either re-centers the `forceCenter`
  force on the new midpoint and nudges the simulation via `alpha(0.1).restart()`, in addition to
  resizing the rendered `viewBox` — both branches apply independently, so setting `width` and
  `chargeStrength` in the same synchronous batch retunes both, not just one.
- zoom is bounded via `minZoom`/`maxZoom` (`d3-zoom`'s `.scaleExtent(...)`, live-reactive); pan/
  zoom/drag are still pointer-only with no keyboard equivalent. Links (`<line part="link">`) are now
  keyboard-operable too (`tabindex="0"`, `role="button"`, `aria-label`, Enter/Space), matching nodes.
- while the `d3-force`/`d3-drag`/`d3-zoom`/`d3-selection` peers are resolving, the host shows a
  `<lr-skeleton>` sized to `width`/`height` with `aria-busy="true"` — but if they fail to load
  (not installed), it still settles into a permanently empty `<svg>` (0 nodes/0 links) plus a
  one-time console warning, same as before; the skeleton only covers the loading window itself.
- `GraphNode.color` is sanitized (rejects `;`/`{`/`}`) before being written into the
  `--lr-node-fill` inline custom property, so an untrusted color string can't break out of that
  CSS declaration.
- `GraphLink.color` applies the same declaration-delimiter sanitization. `GraphLink.dash` is used
  only when every entry is finite and non-negative; an empty or invalid array falls back to a solid
  line rather than partially applying malformed SVG stroke data.
- a structural `nodes`/`links` change now carries over each already-settled node's position (and any
  in-progress drag) by id when rebuilding the simulation, instead of discarding every node's (x, y)
  and re-running the whole ~300-tick random-start settle from scratch — only genuinely new ids get a
  fresh start. Handy for a streaming/incrementally-updated graph, whose existing layout no longer
  jumps every time a node/link is appended.
- under `prefers-reduced-motion: reduce`, or whenever `seed` is set, the simulation converges
  synchronously (ticked in a loop down to `alphaMin` before first paint) instead of animating over
  ~300 rendered frames; user-initiated motion (dragging a node) is unaffected either way.
- the `<svg part="svg">` now carries `role="group"` and an `aria-label` summarizing the node/link
  counts (e.g. "Node-link diagram with 5 nodes and 4 links"), and node `<text part="label">`s are
  `aria-hidden="true"` (their content is already covered by each node's own `aria-label`).
- `nodeTypes` and `showEdgeLabels` are live-reactive post-mount: either changing re-scans/rebinds the
  cached per-node and per-link DOM element arrays, alongside the existing `simNodes`/`simLinks`
  structural-change trigger — no need to also touch `nodes`/`links` to see a type/shape/color or
  edge-label change take effect.
- when `showEdgeLabels` is `false` (the default), a resolved link renders as a bare `<line
  part="link">` with no extra wrapping element, so existing consumers who never set it see
  byte-for-byte identical link DOM; setting it wraps each link's `<line>` and its
  `[part="link-label"]` `<text>` together. `edgeLabelMinZoom`'s hide/show gate is applied once at
  mount (against d3-zoom's known identity transform) as well as on every subsequent pan/zoom, so
  labels never wrongly start visible before the first user gesture.

**Selection & focus:** `selectionMode: 'none' | 'single' | 'multiple' = 'none'` (attribute
`selection-mode`) gates click/keyboard selection; the component never mutates
`selectedNodeIds: string[] = []` / `selectedLinkIds: string[] = []` (both attribute: false) itself,
only emits `lr-selection-change` (`detail: { nodeIds, linkIds }`) — the host assigns them back,
mirroring `lr-heatmap`'s `selectedCell` contract. `dimmedNodeIds: string[] = []` / `dimmedLinkIds:
string[] = []` (both attribute: false) are the same controlled shape for dimming instead of
selecting — the component never assigns either itself, only renders `data-dimmed` on the matching
`[part="node"]`/`[part="link"]`, themed via `--lr-graph-dimmed-opacity` (default `0.35` — visible out
of the box with no host styling required); a host typically computes the set from a
`lr-node-enter`/`lr-link-enter` hover (the complement of the hovered id's neighbor set) and assigns
it back — `lr-knowledge-graph-explorer`'s own `highlight` property is exactly this composition,
built-in. Empty (the default) renders every node/link at full opacity, unchanged from today.
`communities: GraphCommunity[] = []` (attribute:
false) draws one translucent convex-hull blob per entry behind links/nodes. `focusId: string | null =
null` (attribute `focus-id`) tracks a persistent focus ring (`[part="focus-halo"]`) around one node;
`focusNode(id, options?)` and `fit(options?)` are the imperative camera-tween counterparts (pan/zoom
to a node, or to fit the whole graph), both resolving once the tween settles. `lr-viewport-change`
(`detail: { k, x, y }`, the live d3-zoom camera transform) fires at most once per animation frame,
coalescing every source that can move a rendered node's screen position — a pan/zoom gesture, a
`focusNode()`/`fit()` tween, and every simulation tick — so a consumer anchoring its own UI (e.g. a
details popover) to a node's `getBoundingClientRect()` can re-read it from this event instead of
polling its own `requestAnimationFrame` loop.

---

## `lr-node-palette`

The searchable, categorized node library for workflow editors: drag an item onto a canvas, or place
it by keyboard. Never creates nodes or touches a canvas's data itself — the drop/place handshake ends
at `lr-node-add`/`lr-palette-place`; the host mutates `nodes`. Fully decoupled from
`lr-flow-canvas` (no `for` resolution, unlike the other three companions) — it only needs to agree
with a `droppable` canvas on the `FLOW_PALETTE_MIME_TYPE` drag payload shape.

**Properties:**
- `items: PaletteItem[] = []` (attribute: false) — `PaletteItem { type: string; label: string;
  description?: string; category?: string; keywords?: string[]; icon?: unknown; disabled?: boolean }`;
  `type` is the `FlowNode.type` a placement/drop creates, `category` groups items under
  first-appearance-ordered headings, `disabled` renders an item visible but not draggable/placeable
- `label: string = ''` — accessible name for the search field/listbox
- `accessibleLabel: string | null = null` (attribute `aria-label`) — overrides the listbox's
  computed accessible name; wins over `label` and the localized default, and attribute-reflects
  from a host-level `aria-label`

**Events:** `lr-palette-place` (`detail: { type }`, a pointer click or Enter/Space — the
click/keyboard alternative to dragging), `lr-select` (`detail: { item }`, emitted alongside
`lr-palette-place` on both gestures, carrying the full item).

**Slots:** `header` (content above the search field, e.g. a heading or tabs), `footer` (content
below the list).

**CSS parts:** `base`, `search`, `list` (the listbox), `group-header`, `item`, `item-icon`,
`item-label`, `item-description`, `empty` (no-results message), `live-region` (result-count
announcement).

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

```html
<lr-node-palette id="palette"></lr-node-palette>
<lr-flow-canvas id="canvas" droppable style="height:480px"></lr-flow-canvas>
<script>
  document.getElementById('palette').items = [
    { type: 'http-request', label: 'HTTP Request', category: 'Actions' },
    { type: 'transform', label: 'Transform', category: 'Actions' },
  ];
  document.getElementById('canvas').addEventListener('lr-node-add', (e) => {
    console.log('drop payload type:', e.detail.type, e.detail.position);
  });
</script>
```

**Known gotchas:**
- A drag from this palette carries `FLOW_PALETTE_MIME_TYPE` as its `DataTransfer` type — only a
  `droppable` `lr-flow-canvas` (or a host reimplementing the same MIME type) accepts it.
- Clicking or activating an item by keyboard fires `lr-palette-place`/`lr-select` immediately, no
  drag required — the host decides where the new node lands (there's no pointer position to derive
  one from on a keyboard placement).

---

## `lr-graph-legend`

A node-type legend for a paired `lr-graph`: one swatch + label + count row per node type, doubling
as visibility filters. Never reads or writes a graph directly — the host forwards `types` in from
`graph.nodeTypes` and `hiddenTypes` back out to `graph.hiddenTypes` on `lr-visibility-change`, the
same event-decoupled contract every sibling in this family follows.

**Properties:**
- `types: LyraGraphLegendType[] = []` (attribute: false) — `{ id: string; label: string; color?:
  string; shape?: 'circle' | 'square' | 'diamond' }`, the exact `lr-graph.nodeTypes` entry shape
  (declared locally, not imported, so this stays a zero-dependency component)
- `counts?: Record<string, number>` (attribute: false) — optional per-type count shown alongside the
  label
- `hiddenTypes: string[] = []` (attribute: false) — controlled; the host assigns this back from
  `lr-visibility-change`
- `interactive: boolean = true` (reflected) — renders each row as a toggle `<button>`; `false` renders
  plain, non-interactive rows
- `label: string = ''` — accessible name for the `role="group"` wrapper

**Events:** `lr-visibility-change` (`detail: { hiddenTypes }`, the complete updated array, fired
after each toggle).

**Slots:** none.

**CSS parts:** `base`, `item` (a `<button>` when `interactive`, a plain `<div>` otherwise), `swatch`,
`label`, `count`, `live-region` (the visually hidden filter-toggle announcement).

**Themeable custom properties:** no component-local tokens; reads `--lr-graph-cat-1` through `-8`
(the same computed-style fallback palette `lr-graph`/`lr-word-cloud` use) plus shared tokens.

**Optional peer deps:** none.

```html
<lr-graph-legend id="legend"></lr-graph-legend>
<lr-graph id="graph" style="height:480px"></lr-graph>
<script>
  const graph = document.getElementById('graph');
  const legend = document.getElementById('legend');
  legend.types = [{ id: 'person', label: 'Person', color: '#0969da' }, { id: 'org', label: 'Organization' }];
  legend.addEventListener('lr-visibility-change', (e) => {
    legend.hiddenTypes = e.detail.hiddenTypes;
    graph.hiddenTypes = e.detail.hiddenTypes;
  });
</script>
```

**Known gotchas:**
- Ships no coupling to `lr-graph`'s optional `d3-force`/`d3-drag`/`d3-zoom`/`d3-selection` peers —
  `types`/`counts`/`hiddenTypes` are plain data the host derives from a graph, never a live reference
  to one.

---

## `lr-entity-card`

A dossier card for one knowledge-graph entity: type badge, description, key/value property rows,
degree, community chip, plus a built-in "focus in graph" action. Never fetches or focuses a graph
itself — `lr-entity-activate` is a request a host routes into `lr-graph`'s own
`focusNode(id, options?)`.

**Properties:**
- `entity: LyraEntity | null = null` (attribute: false) — `LyraEntity { id: string; label: string;
  type?: string; description?: string; properties?: Record<string, string | number>; degree?:
  number; communityId?: string }`; field names deliberately mirror `lr-graph`'s `GraphNode`
  additions, so a graph node adapts into a `LyraEntity` with no mapping table; `null` renders the
  empty state
- `types: NodeTypeStyle[] = []` (attribute: false) — the same `lr-graph.nodeTypes`/
  `lr-graph-legend.types` entry shape, resolving `entity.type` to a label/color/shape for the badge
- `communityLabel: string = ''` (attribute `community-label`) — override text for the community chip
- `showFocusButton: boolean = true` (attribute `show-focus-button`)

**Events:** `lr-entity-activate` (`detail: { id }`, the built-in focus button was activated).

**Slots:** default (extra body content below the property rows, e.g. a `lr-neighbor-list`),
`actions` (extra header actions alongside the built-in focus button).

**CSS parts:** `base`, `header`, `type-badge`, `title` (`role="heading" aria-level="3"` by default),
`description`, `properties`, `property` (one key/value row), `degree`, `community`, `actions`,
`focus-button`, `empty` (shown when `entity` is `null`).

**Themeable custom properties:** shared tokens only; a data-driven `entity.type` color is applied as
sanitized inline `--lr-badge-*` overrides on the type badge only (the one "type color is
data-driven by design" exception this library already grants graph nodes) — every other color comes
from tokens.

**Optional peer deps:** none.

```html
<lr-entity-card id="card"></lr-entity-card>
<script>
  document.getElementById('card').entity = {
    id: 'e1', label: 'Ada Lovelace', type: 'person',
    description: 'Mathematician', properties: { born: 1815 }, degree: 4,
  };
  document.getElementById('card').addEventListener('lr-entity-activate', (e) => graph.focusNode(e.detail.id));
</script>
```

**Known gotchas:**
- The type badge's data-driven background uses an 8% (not this codebase's usual 16%) quiet-tint mix
  against `--lr-color-surface` — the lower percentage is required to hold WCAG AA 4.5:1 text
  contrast for arbitrary, unvetted type colors (even 10% isn't safe margin for every hue in the
  palette).

---

## `lr-entity-chip`

An inline `@entity` mention for agent prose: flow content, keyboard-focusable, with a hover/focus
preview popover. The knowledge-graph sibling of `lr-citation-badge`, reusing its interaction
contract wholesale. Carries ids through events only — no entity data resolution, no navigation.

**Properties:**
- `entityId: string = ''` (attribute `entity-id`)
- `label: string = ''` — the chip's visible text
- `type: string = ''` (reflected) — lets a host theme per type from CSS, e.g.
  `lr-entity-chip[type='person'] { --lr-entity-chip-color: ... }`
- `typeLabel?: string` (attribute `type-label`) — optional spoken/visible type qualifier

**Events:** `lr-entity-activate` (`detail: { id }`, click, or Enter while focused),
`lr-entity-open` (`detail: { id }`, dblclick, or Space while focused).

**Slots:** default — rich preview content (typically a compact `lr-entity-card`), shown in a
floating popover on hover/focus. No content means no popover and no hover affordance at all.

**CSS parts:** `base` (the clickable `<button>`), `label`, `popover`.

**Themeable custom properties:** `--lr-entity-chip-color` (default `var(--lr-color-brand)`,
text/accent color), `--lr-entity-chip-bg` (default `var(--lr-color-brand-quiet)`),
`--lr-entity-chip-border` (default `transparent`, the chip's `--lr-border-width-thin` outline).

**Optional peer deps:** none.

```html
<p>…first described by <lr-entity-chip entity-id="e1" label="Ada Lovelace" type="person">
  <lr-entity-card slot=""></lr-entity-card>
</lr-entity-chip>.</p>
```

**Known gotchas:**
- Reuses `lr-citation-badge`'s exact "real preview content" detection (an assigned element with no
  other `slot`, or non-whitespace text) to decide whether a popover exists at all.

---

## `lr-neighbor-list`

One entity's relationship rows: relation, direction, neighbor, with per-row navigate and
expand-in-graph affordances. Never computes neighbors itself (the host derives rows from its own
graph data) and never mutates a graph.

**Properties:**
- `rows: LyraNeighborRow[] = []` (attribute: false) — `LyraNeighborRow { relation: string; direction:
  'in' | 'out' | 'both'; node: LyraEntity }`
- `groupByRelation: boolean = false` (attribute `group-by-relation`) — inserts a `group-header` row per
  distinct `relation`
- `expandable: boolean = false` — renders a per-row expand-in-graph icon button
- `virtualizeAt: number = 100` (attribute `virtualize-at`) — row count above which the list virtualizes
- `label: string = ''`

**Events:** `lr-entity-activate` (`detail: { id }`, a row's node button was activated),
`lr-node-expand` (`detail: { id }`, a row's expand button was activated — deliberately the same
name and detail shape as `lr-graph`'s own event, so one host handler serves both).

**Slots:** none.

**CSS parts:** `base` (`role="list"`), `group-header` (only when `groupByRelation`), `row`
(`role="listitem"`), `direction` (`aria-hidden` glyph), `relation`, `node-label`, `node-meta`
(secondary type/degree text, when present), `expand-button` (only when `expandable`), `empty`
(shown when `rows` is empty).

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

```html
<lr-neighbor-list expandable group-by-relation></lr-neighbor-list>
<script>
  document.querySelector('lr-neighbor-list').rows = [
    { relation: 'works_for', direction: 'out', node: { id: 'e2', label: 'Analytical Engine Co.' } },
  ];
</script>
```

**Known gotchas:**
- `lr-node-expand`'s detail shape is intentionally identical to `lr-graph`'s own event of the
  same name, so a single listener wired to both handles "expand this node's neighborhood" uniformly.

---

## `lr-path-strip`

A linear node → relation → node chain rendering "why A connects to B" (GraphRAG local-search
reasoning paths) as a compact, horizontally scrollable strip. One-dimensional and presentational: no
path finding, no branching, no per-element popovers.

**Properties:**
- `path: LyraPathElement[] = []` (attribute: false) — a flat alternating sequence:
  `{ kind: 'node'; node: LyraEntity } | { kind: 'edge'; relation: string; directed?: boolean;
  reverse?: boolean }`
- `label: string = ''`

**Events:** `lr-entity-activate` (`detail: { id }`, a node element activated),
`lr-relation-activate` (`detail: { relation, sourceId?, targetId? }`, an edge element activated —
source/target resolved from the adjacent node elements, `undefined` when the path is malformed at
that position).

**Slots:** none.

**CSS parts:** `base` (hosts the delegated roving-tabindex keydown handler), `node` (a `<button>`),
`relation` (a `<button>`), `arrow` (`aria-hidden`, logical — mirrors under RTL), `empty` (shown when
`path` is empty).

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

```html
<lr-path-strip></lr-path-strip>
<script>
  document.querySelector('lr-path-strip').path = [
    { kind: 'node', node: { id: 'a', label: 'Ada Lovelace' } },
    { kind: 'edge', relation: 'wrote', directed: true },
    { kind: 'node', node: { id: 'b', label: 'Notes on the Analytical Engine' } },
  ];
</script>
```

**Known gotchas:**
- Purely presentational rendering of a caller-supplied path — it never computes shortest paths or
  fetches relationship data itself, and never branches (one linear chain per instance).

---

## `lr-community-card`

A cluster/community summary card (GraphRAG community report): label, LLM summary excerpt, member
count, member chips with overflow, and a drill-in action. Doesn't own community rendering on the
graph or membership fetching — `lr-drill` asks the host to load members/subgraph.

**Properties:**
- `community: LyraCommunity | null = null` (attribute: false) — `LyraCommunity { id: string; label:
  string; summary?: string; memberCount?: number }`; `memberCount` is authoritative when it exceeds
  `members.length`; `null` renders the empty state
- `members: LyraEntity[] = []` (attribute: false) — rendered as chips, up to `maxMembers`
- `maxMembers: number = 8` (attribute `max-members`) — remaining members collapse into a "+N"
  overflow chip
- `compact: boolean = false` (reflected) — omits the summary excerpt and member chips

**Events:** `lr-drill` (`detail: { id }`, the drill button, header, or overflow chip — all three
mean "show me this whole community"), `lr-entity-activate` (`detail: { id }`, a member chip was
activated).

**Slots:** `actions` — extra header actions alongside the built-in drill button.

**CSS parts:** `base`, `header`, `title` (`role="heading" aria-level="3"` wrapping a `<button>`),
`member-count`, `summary` (omitted in `compact`), `members` (omitted in `compact`), `member`,
`overflow` (the "+N" chip button), `drill-button`, `actions`, `empty` (shown when `community` is
`null`).

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

```html
<lr-community-card></lr-community-card>
<script>
  document.querySelector('lr-community-card').community = { id: 'c1', label: 'Early computing pioneers', summary: 'A cluster of 19th-century mathematicians and engineers.', memberCount: 12 };
</script>
```

**Known gotchas:**
- `memberCount` (not `members.length`) is the authoritative displayed count whenever it's larger —
  useful when the host sends only a preview slice of members alongside the real total.

---

## `lr-chunk-inspector`

A ranked retrieved-chunks list: relevance score bars with tier tones, expandable chunk text, and the
deep-link event that lands a chunk in `lr-document-viewer`. Never fetches, ranks, or dedupes; never
opens documents itself.

**Properties:**
- `chunks: LyraChunk[] = []` (attribute: false) — `LyraChunk { id: string; text: string; score:
  number; sourceId: string; title?: string; page?: string | number; anchor?: LyraChunkAnchor }`;
  `score` is 0–1, `title` falls back to a localized "untitled source", `anchor` (the same
  discriminated union `lr-document-viewer.anchor` accepts — page/text-quote/fragment/line-range/
  cell-range/cfi/time-range/region/node-path) is carried through `lr-chunk-open` verbatim
- `thresholds: { high: number; medium: number } = { high: 0.75, medium: 0.5 }` (attribute: false) —
  score-bar tier cutoffs
- `sort: 'score' | 'none' = 'score'`
- `activeId: string = ''` (attribute `active-id`)
- `virtualizeAt: number = 50` (attribute `virtualize-at`)
- `compact: boolean = false` (reflected) — hides the text preview/toggle, title/score row only
- `label: string = ''`

**Events:** `lr-chunk-open` (`detail: { id, sourceId, anchor? }`, a chunk's title/open button was
activated — the event a host routes into `lr-document-viewer`, setting `src` from `sourceId` and
`anchor` from the chunk's own), `lr-expand` (`detail: { id, expanded }`, a chunk's text toggle was
activated).

**Slots:** none.

**CSS parts:** `base` (`role="group"`), `chunk` (`role="listitem"`), `score` (visible percent text),
`score-bar` (`aria-hidden` track), `score-fill` (tone-mapped fill), `open-button`, `title` (the
`<span>` inside `open-button` carrying the visible title text), `text` (line-clamped unless
expanded, omitted when `compact`), `toggle` ("Show more"/"Show less", omitted when `compact`),
`empty` (shown when `chunks` is empty).

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

```html
<lr-chunk-inspector></lr-chunk-inspector>
<script>
  const inspector = document.querySelector('lr-chunk-inspector');
  inspector.chunks = [
    { id: 'c1', text: 'Revenue grew 12% year over year…', score: 0.91, sourceId: 'doc-1', title: 'Q3 report', page: 4 },
  ];
  inspector.addEventListener('lr-chunk-open', (e) => documentViewer.openAt(e.detail.sourceId, e.detail.anchor));
</script>
```

**Known gotchas:**
- `title` and `open-button` are split into two separate parts (rather than one dual-part-name
  element) because an exact-match `[part="..."]` CSS attribute selector — as this component's own
  tests use — cannot match a multi-token `part` attribute value.

---

## `lr-source-picker`

A checkbox tree/list scoping which sources ground the next answer: tri-state folders, select-all,
type icons, search. **Not `FormAssociated`, deliberately**: this is a scoping panel, not a form
control — the selection is immediate app state consumed by the next retrieval call, exactly the
stance `lr-tool-select-dialog` already takes.

**Properties:**
- `sources: LyraSourceEntry[] = []` (attribute: false) — `LyraSourceEntry { id: string; label:
  string; mimeType?: string; name?: string; children?: LyraSourceEntry[] }`; flat (no `children`) or
  a tree — presence of `children` makes a row a group/folder with tri-state select
- `selectedIds: string[] = []` (attribute: false) — controlled; the host assigns this back from
  `lr-sources-change`
- `showSelectAll: boolean = true` (attribute `show-select-all`)
- `searchable: boolean = true`
- `label: string = ''`
- `accessibleLabel: string | null = null` (attribute `aria-label`) — overrides the tree's computed
  accessible name; wins over `label` and the localized default, and attribute-reflects from a
  host-level `aria-label` so plain markup gets ARIA-name forwarding

**Events:** `lr-sources-change` (`detail: { selectedIds }`, the complete updated leaf-id array,
fired after every toggle including select-all).

**Slots:** none.

**CSS parts:** `base`, `search` (the built-in filter `lr-input`, only when `searchable`),
`select-all` (only when `showSelectAll`), `summary` ("{selected} of {total} selected"), `tree`
(`role="tree"`), `item` (`role="treeitem"`), `checkbox` (tri-state glyph), `icon` (the
`lr-file-icon` type badge), `label`, `empty` (`noData` when `sources` is empty, `noMatches` when a
filter empties the tree).

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

```html
<lr-source-picker></lr-source-picker>
<script>
  const picker = document.querySelector('lr-source-picker');
  picker.sources = [
    { id: 'folder-1', label: 'Reports', children: [{ id: 'doc-1', label: 'Q3.pdf', mimeType: 'application/pdf' }] },
  ];
  picker.addEventListener('lr-sources-change', (e) => (retrievalScope = e.detail.selectedIds));
</script>
```

**Known gotchas:**
- Deliberately not form-associated — `lr-sources-change` is the only wiring; there's no
  `name`/`value`/`FormData` participation the way a genuine form control would have.

---

## `lr-provenance-panel`

The grounding breakdown for one answer: a sectioned disclosure panel (Entities / Relationships /
Communities / Text chunks) composing this family's own pieces. The chat ↔ graph ↔ document glue
component. Pure projection + event conduit: no fetching, no graph/viewer imports, no persistence.

**Properties:**
- `provenance: LyraProvenance | null = null` (attribute: false) — `LyraProvenance { entities?:
  LyraEntity[]; relationships?: { path: LyraPathElement[] }[]; communities?: LyraCommunity[]; chunks?:
  LyraChunk[] }`; each present array renders through the matching sibling component (`lr-entity-
  chip` row, one `lr-path-strip` per relationship, `lr-community-card`, `lr-chunk-inspector`);
  `null` or every section empty renders the overall empty state
- `types: NodeTypeStyle[] = []` (attribute: false) — forwarded to the Entities section's chips
- `thresholds: { high: number; medium: number } = { high: 0.75, medium: 0.5 }` (attribute: false) —
  forwarded to the Text chunks section's `lr-chunk-inspector`
- `label: string = ''`

**Events:** `lr-toggle` (`detail: { section, expanded }`, a section header was toggled —
`section` is `'entities' | 'relationships' | 'communities' | 'chunks'`).

**Slots:** none.

**CSS parts:** `base`, `section`, `header` (a section's disclosure `<button>`), `count` (a section's
item-count badge), `body` (`hidden` while collapsed), `empty` (shown when every section is empty).

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

```html
<lr-provenance-panel></lr-provenance-panel>
<script>
  document.querySelector('lr-provenance-panel').provenance = {
    entities: [{ id: 'e1', label: 'Ada Lovelace', type: 'person' }],
    chunks: [{ id: 'c1', text: 'Revenue grew 12%…', score: 0.91, sourceId: 'doc-1' }],
  };
</script>
```

**Known gotchas:**
- Composes `lr-entity-chip`, `lr-path-strip`, `lr-community-card`, and `lr-chunk-inspector`
  directly rather than reimplementing their rendering — events from those inner components (e.g.
  `lr-entity-activate`, `lr-chunk-open`) still bubble/compose up through this panel's light DOM
  for the host to handle in one place.

---

## `lr-mind-map`

A radial expandable topic tree (NotebookLM Mind Maps): a spatial overview of a topic hierarchy where
activating a topic drills in or hands the topic to the chat. Hierarchy, not network — no cross-links,
no force simulation, no communities, no edge labels (that's `lr-graph`). Zero-dependency SVG; the
radial layout is closed-form arithmetic, in its own `mind-map-layout.ts` module, mirroring
`lr-word-cloud`'s dependency-free precedent.

**Properties:**
- `topics: LyraTopic[] = []` (attribute: false) — `LyraTopic { id: string; label: string; children?:
  LyraTopic[] }`; a single root sits at the center, multiple roots hang off an implicit center hub
- `label: string = ''` — accessible name for the SVG group and the implicit hub's text
- `expandDepth: number = 1` (attribute `expand-depth`) — initial expansion depth (root + first
  ring); expansion state afterward is component-managed per topic id and survives `topics`
  reassignment

**Events:** `lr-topic-select` (`detail: { id }`, a *leaf* topic was activated),
`lr-topic-toggle` (`detail: { id, expanded }`, a parent topic was activated, or auto-expanded by
keyboard descent).

**Slots:** none.

**CSS parts:** `base`, `svg` (the single-tab-stop focus target), `node`, `node-label`, `link`
(parent-child connector), `focus-ring` (keyboard focus ring), `live-region` (visually hidden
announcement region), `empty` (shown when `topics` is empty).

**Themeable custom properties:** `--lr-mind-map-ring-gap` (default `6rem`, radius step per depth
ring).

**Optional peer deps:** none.

```html
<lr-mind-map style="height:480px" expand-depth="2"></lr-mind-map>
<script>
  document.querySelector('lr-mind-map').topics = [
    { id: 'root', label: 'Computing history', children: [
      { id: 'people', label: 'People', children: [{ id: 'ada', label: 'Ada Lovelace' }] },
      { id: 'machines', label: 'Machines' },
    ] },
  ];
</script>
```

**Known gotchas:**
- A user's explicit expand/collapse only ever overrides the `depth < expandDepth` default in the
  direction chosen — reassigning `topics` (even with the same ids) never silently discards that
  override.
- Node-position transitions use `--lr-transition-base`, which already collapses to near-zero under
  `prefers-reduced-motion: reduce` globally, so expansion snaps rather than tweening for a
  reduced-motion user with no extra branching in this component.

---

## `lr-citation-badge`

An inline `[n]` citation marker with a hover/focus preview popover and confidence/verification-status
coloring. First-party invention (no Web Awesome equivalent). Meant to sit inline in a chat message's
text, each badge carrying a `source-id` that matches a corresponding `<lr-source-card>` shown
elsewhere on the page (a sibling component in this family) — this component never imports or knows
anything about `<lr-source-card>`, it only carries the id through its event details.

**Properties:**
- `index: number = 1` — the citation number shown, e.g. `3` renders as `[3]`.
- `status: CitationBadgeStatus = 'default'` (reflected) — one of `'default' | 'high' | 'medium' |
  'low' | 'verified' | 'unverified'`; drives the badge's color and (unless `label` is set) part of
  its accessible name.
- `sourceId: string = ''` (attribute `source-id`) — id of a corresponding `<lr-source-card>`,
  echoed back verbatim in both events; never read or validated by this component.
- `href: string = ''` — optional direct link target for the citation's source, carried into
  `lr-citation-open`'s detail as-is; this component never navigates.
- `label: string = ''` — overrides the computed accessible name. The built-in citation/status
  summary is a complete localized template; a host `aria-label` has highest precedence.

**Events:**
- `lr-citation-activate` (`detail: { sourceId: string; index: number }`) — fires on click, or on
  Enter while focused (native `<button>` behavior, no listener needed for the Enter case). The
  lightweight "jump to this source" signal.
- `lr-citation-open` (`detail: { sourceId: string; index: number; href?: string }`) — fires on
  dblclick, or on Space while focused. A distinct "full preview" signal; `href` is `undefined` when
  the `href` prop isn't set. A double-click also fires two `lr-citation-activate` events (one per
  constituent click, standard browser `dblclick` behavior) in addition to the one `lr-citation-open`.

**Slots:** default — rich preview/tooltip content (e.g. a filename + excerpt), shown in a floating
popover on hover/focus. This is *not* the badge's visible content (the badge always renders
`[index]`); nothing renders at all (no hover affordance) when this slot is empty.
When populated, the button carries `aria-describedby` referencing the same-shadow-tree popover,
which owns `role="tooltip"` whether currently shown or hidden.

**CSS parts:** `base` (the clickable `<button>`), `bracket` (each of the two literal `[`/`]` glyphs),
`index` (the citation number), `popover` (the floating preview panel, only meaningful while open).

**Themeable custom properties:** `--lr-citation-badge-accent` / `--lr-citation-badge-bg` /
`--lr-citation-badge-border` (internal per-status accent variables, not typically overridden
directly — set instead by the `:host([status=...])` rules), plus shared tokens
`--lr-color-text-quiet`, `--lr-color-text`, `--lr-color-success` / `-success-quiet`,
`--lr-color-warning` / `-warning-quiet`, `--lr-color-danger` / `-danger-quiet`, `--lr-radius`,
`--lr-color-surface`, `--lr-color-border`, `--lr-shadow`, `--lr-space-s`/`-m`,
`--lr-transition-fast`, `--lr-focus-ring-*`.

**Optional peer deps:** none.

```html
<p>
  Revenue grew 12% year over year
  <lr-citation-badge index="1" status="verified" source-id="doc-1">
    <strong>annual_report.pdf</strong> — "Revenue grew 12% year over year, driven primarily by..."
  </lr-citation-badge>.
</p>
<script type="module">
  document.addEventListener('lr-citation-activate', (e) => {
    document.querySelector(`lr-source-card[source-id="${e.detail.sourceId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
</script>
```

The popover is positioned with the same internal `place()` helper (`top-start` placement) that
`<lr-tool-call-chip>` uses for its own detail tooltip, and never traps focus — it's supplementary
preview content, not a modal, so Tab continues past the badge normally even while the popover happens
to be visible from a mouse hover. Hovering and focus are tracked as independent "keep it open"
reasons (mirroring `<lr-toast-item>`'s hovering/focused pair), so the pointer leaving while the
badge still holds keyboard focus doesn't schedule a hide the focus is still holding open. There's a
200ms grace period before a hover/focus-out actually hides the popover, so moving the pointer from
the badge into the popover itself (to select/copy its text) doesn't make it vanish mid-move; Escape
and blur (Tab away) close it immediately instead, with no delay.

Status coloring follows a semantic scheme: `verified`/`high` use the success tones (a claim that's
been checked, or the model is confident in); `medium`/`low` use warning tones; `unverified` uses the
*danger* tone — deliberately distinct from `low`, since "hasn't been checked at all" is a different
(arguably riskier) claim than "checked but uncertain". `default` renders as plain neutral text with
no background tint, for citations that carry no confidence/verification signal at all.

**Known gotchas:**
- Enter and Space are given distinct meanings (Enter = activate via native `<button>` click, Space =
  open) — Space's native click-on-keyup is pre-empted with `preventDefault()` on keydown so it fires
  `lr-citation-open` instead of triggering a second `lr-citation-activate`.
- Escape closes the popover but calls `stopPropagation()`, so it won't also close a surrounding
  `<lr-dialog>` that has its own Escape-to-close handler.
- The preview slot's presence is tracked in JS (`hasPreviewSlot`), not via CSS `:empty` — the
  `[part="popover"]` always contains a literal `<slot>` child, so `:empty` would never match even
  with nothing assigned.

---

## `lr-source-list` / `lr-source-card`

A collapsible "Sources" panel for one chat message (`lr-source-list`) that groups a set of
`lr-source-card` entries. First-party invention (no Web Awesome equivalent). Cards are meant to be
direct light-DOM children of the list (plain composition — no `.items` array prop, the same shape
`<lr-split>`'s panels take), though `lr-source-card` renders and functions fine standalone.

### `lr-source-list`

**Properties:**
- `expanded: boolean = false` (reflected) — whether the card list is currently shown. Starts
  collapsed by default so a message's sources don't eat vertical space until asked for.
- `label: string = ''` — header text used when `label-plural` isn't set, e.g. `"Sources"`.
- `labelPlural: string = ''` (attribute `label-plural`) — fully consumer-built, already-pluralized
  header summary, e.g. `"3 sources"` or `"1 source"`; this component never counts or pluralizes on
  its own. Takes precedence over `label` when both are set. If neither is set, the header falls back
  to the literal word `"Sources"`.

**Getters:** `sourceCount: number` — read-only, live-updated count of the currently-slotted children,
handy for building a `label-plural` string reactively, e.g. `` list.labelPlural = `${list.sourceCount} sources` ``.

**Events:** `lr-toggle` (`detail: { expanded: boolean }`) — the header was activated, expanding or
collapsing the list.

**Slots:** default — `<lr-source-card>` elements (or any content, though the card pairing is the
intended usage).

**CSS parts:** `base` (outer container), `header` (the clickable `<button>` toggling `expanded`),
`toggle` (the chevron indicator inside the header), `list` (wrapper around the default slot, `hidden`
while collapsed).

**Themeable custom properties:** shared tokens only — `--lr-color-border`, `--lr-color-surface`,
`--lr-color-text`, `--lr-color-brand` / `-brand-quiet`, `--lr-radius`, `--lr-space-xs`/`-s`/
`-m`, `--lr-transition-fast`, `--lr-focus-ring-*`.

**Optional peer deps:** none.

### `lr-source-card`

**Properties:**
- `sourceId: string = ''` (attribute `source-id`) — stable identifier matching a
  `<lr-citation-badge>` elsewhere on the page.
- `title: string = ''` — the source's display title, e.g. a filename. Falls back to `"Untitled
  source"` when empty.
- `page?: string | number` — optional page reference, e.g. `12` or `"iv"`, rendered as-is (never
  parsed/validated as a number), appended to the title as `" — p. {page}"`.
- `href?: string` — optional URL, echoed back (unopened) in `lr-open`'s detail.

**Events:**
- `lr-expand` (`detail: { sourceId: string; expanded: boolean }`) — the per-card "Show
  more"/"Show less" toggle was activated. Unrelated to the parent `lr-source-list`'s own
  expand/collapse, which only ever hides/shows the *set* of cards, never a single card's own content.
- `lr-open` (`detail: { sourceId: string; href?: string }`) — the title was activated. This
  component never navigates on its own (a controlled component, the same convention
  `<lr-tool-call-chip>`'s `lr-tool-call-chip-select` follows); a listener decides what "open"
  means.

**Slots:** `excerpt` (a short preview; when left empty, the `excerpt` part collapses away entirely —
its wrapper is `hidden`, not just visually empty), `full` (the complete source text/chunk, hidden
behind the "Show more"/"Show less" toggle — when left empty, no toggle renders at all; removing all
`full`-slotted content while expanded auto-collapses it back).

**CSS parts:** `base` (outer container), `title` (the clickable title/page heading, a `<button>`),
`excerpt` (wrapper around the `excerpt` slot, `hidden` when the slot has no assigned content), `full`
(wrapper around the `full` slot, `hidden` while collapsed), `toggle` (the "Show more"/"Show less"
button — only rendered when the `full` slot has content).

**Themeable custom properties:** shared tokens only — `--lr-color-border`, `--lr-color-surface`,
`--lr-color-text` / `-text-quiet`, `--lr-color-brand`, `--lr-radius`, `--lr-space-xs`/`-s`,
`--lr-focus-ring-*`.

**Optional peer deps:** none.

```html
<lr-source-list label-plural="2 sources">
  <lr-source-card source-id="doc-1" title="annual_report.pdf" page="12">
    <span slot="excerpt">Revenue grew 12% year over year...</span>
    <span slot="full">Revenue grew 12% year over year, driven primarily by...</span>
  </lr-source-card>
  <lr-source-card source-id="doc-2" title="q3_notes.md">
    <span slot="excerpt">No matching full-text chunk for this source.</span>
  </lr-source-card>
</lr-source-list>
<script type="module">
  // Elsewhere, a <lr-citation-badge>'s activation handler can scroll to and
  // highlight the matching card -- neither component needs extra API surface
  // for that, only source-id to be targeted by:
  document.addEventListener('lr-citation-activate', (e) => {
    const card = document.querySelector(`lr-source-card[source-id="${e.detail.sourceId}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
</script>
```

`lr-source-list` removes the card list from the accessibility tree (not just visually hides it)
while collapsed, via the native `hidden` attribute on `[part="list"]` — a screen reader user tabbing
past the header never lands on off-screen source cards they can't currently see. Both components
track slot presence in JS state (`slottedCount` on the list, `hasFullSlot` on the card) rather than
relying on CSS `:empty`, since a `[part]` wrapper always contains a literal `<slot>` child regardless
of assigned content; both also reconcile that state in `firstUpdated()` as a fallback for slot-
forwarding scenarios or engines that don't fire `slotchange` for content already present at parse
time.

**Known gotchas:**
- This library has no built-in i18n/pluralization (the same stance `<lr-empty>`'s plain
  `description` prop takes) — `lr-source-list`'s header text is entirely consumer-supplied via
  `label`/`label-plural`; there's no automatic "N sources" string generation beyond the literal
  `"Sources"` fallback.
- `lr-source-card`'s own expand/collapse (`full` slot, `lr-expand` event) is completely
  independent of the parent list's `expanded`/`lr-toggle` — collapsing the list doesn't reset an
  individual card's `fullExpanded` state, and there is no cross-talk between the two components at
  all beyond DOM nesting.
- `lr-source-card` actively strips a bare host-level `title` attribute right after Lit syncs it into
  the `title` property — otherwise the whole card would grow an unsolicited native tooltip repeating
  the title text on hover. Set `title` only as a property/attribute meant to become the rendered
  heading; don't rely on it surviving as a DOM attribute afterward.

---

## `lr-entity-dossier`

Entity detail surface: a persistent header (`lr-entity-card` + an optional confidence `lr-stat`)
above an `lr-tabs` strip for Relationships (`lr-neighbor-list`), Supporting chunks
(`lr-chunk-inspector`), and Provenance (`lr-provenance-panel`). Pure layout — never fetches, ranks,
or mutates graph/document state.

**Properties:**
- `entity: LyraEntity | null = null` (attribute: false) — `lr-entity-card`'s own `LyraEntity`;
  `null` renders the shared `lr-empty` `noData` state in place of the whole dossier
- `confidence: LyraEntityDossierConfidence | null = null` (attribute: false) —
  `LyraEntityDossierConfidence { label: string; value: string; unit?: string; variant?: StatVariant;
  exactValue?: string; caption?: string; rows?: StatRow[] }` (exported by this module; `StatVariant`
  and `StatRow` are `lr-stat`'s own types). All caller-supplied domain data, never routed through
  `localize()`. `null` omits the stat entirely — no placeholder
- `neighbors: LyraNeighborRow[] = []` (attribute: false) — forwarded verbatim to
  `lr-neighbor-list.rows` (`{ relation: string; direction: 'in' | 'out' | 'both'; node: LyraEntity }`)
- `chunks: LyraChunk[] = []` (attribute: false) — forwarded to `lr-chunk-inspector.chunks`; the
  evidence for *this entity's own* summary/properties
- `provenance: LyraProvenance | null = null` (attribute: false) — forwarded to
  `lr-provenance-panel.provenance`; deliberately a separate input from `chunks` (the broader
  grounding chain, which may span other entities/relationships/communities). Pass the same array to
  both when the two genuinely coincide
- `types: NodeTypeStyle[] = []` (attribute: false) — `{ id: string; label: string; color?: string;
  shape?: 'circle' | 'square' | 'diamond' }`, the `lr-graph.nodeTypes` entry shape; forwarded to both
  `lr-entity-card` and `lr-provenance-panel`
- `thresholds: { high: number; medium: number } = { high: 0.75, medium: 0.5 }` (attribute: false) —
  forwarded to both `lr-chunk-inspector` and `lr-provenance-panel`
- `groupByRelation: boolean = false` (attribute `group-by-relation`) — forwarded to `lr-neighbor-list`
- `expandable: boolean = false` — forwarded to `lr-neighbor-list`
- `showFocusButton: boolean = true` (attribute `show-focus-button`) — forwarded to `lr-entity-card`
- `communityLabel: string = ''` (attribute `community-label`) — forwarded to `lr-entity-card`
- `accessibleLabel: string | null = null` (attribute `aria-label`) — accessible name for the internal
  `lr-tabs` strip; unset renders the strip with no `aria-label`

**Events:** declares none of its own. Every composed child's event bubbles through unmodified
(`composed: true`): `lr-entity-activate` (`detail: { id }`), `lr-node-expand` (`detail: { id }`),
`lr-chunk-open` (`detail: { id, sourceId, anchor? }`), `lr-expand` (`detail: { id, expanded }`),
`lr-toggle` (`detail: { section, expanded }`), and `lr-tabs-change`
(`detail: { tabId: LyraEntityDossierTab }`, where `LyraEntityDossierTab = 'relationships' | 'chunks'
| 'provenance'` — also the `lr-tabs` slot/tab ids).

**Slots:** none.

**CSS parts:** `base` (root, or the empty state's wrapper), `empty` (shown when `entity` is `null`),
`header`, `entity-card`, `confidence` (only when `confidence` is set), `tabs`, `neighbor-list`,
`chunk-inspector`, `provenance-panel`.

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

**Known gotchas:**
- The active tab is internal `@state`, not a controlled property — `lr-tabs` already owns it, and a
  stale public property re-bound on an unrelated re-render would fight the user's own click.
- Tab labels reuse each composed child's own `localize()` key (`neighborListLabel`,
  `chunkInspectorLabel`, `provenancePanelLabel`), so a locale only translates each string once.

---

## `lr-grounding-summary`

Claim-level grounding scorecard for one generated answer: supported/unsupported claim counts,
citation coverage, optional confidence, warnings, and evidence citations linking back to their exact
spans. Consumes `GroundingAssessment` from `@aceshooting/lyra-ui/ai` directly. Pure projection +
event conduit — never fetches or computes an assessment. Composes `lr-stat` for every numeric display
and `lr-citation-badge` for each evidence entry.

**Properties:**
- `assessment: GroundingAssessment | null = null` (attribute: false) — **`GroundingAssessment`,
  imported from `@aceshooting/lyra-ui/ai`** (`src/ai/types.ts`): `{ supportedClaims: number;
  unsupportedClaims: number; coverage: number; confidence?: number; warnings?: string[] }`, where
  `coverage` and `confidence` are 0–1 fractions. `null` renders the empty state
- `citations: Citation[] = []` (attribute: false) — **`Citation` from `@aceshooting/lyra-ui/ai`**:
  `{ id: string; chunkId?: string; sourceId?: string; span?: { start: number; end: number };
  label?: string }`. Independent of `assessment`; empty omits the whole evidence section. Each entry
  renders as an `lr-citation-badge` whose `index` is its 1-based position and whose `source-id` is
  `citation.sourceId ?? ''`
- `thresholds: GroundingSummaryThresholds = { high: 0.8, medium: 0.5 }` (attribute: false) —
  `GroundingSummaryThresholds { high: number; medium: number }` (exported here), both 0–1 fractions,
  applied to both `coverage` and `confidence`: `>= high` → `success` tone, `>= medium` → `warning`,
  below → `danger`
- `label: string = ''` — accessible group label; falls back to a host `aria-label`, then the
  localized `groundingSummaryLabel`

**Events:** `lr-citation-select` (`detail: CitationSelectEventDetail` from
`@aceshooting/lyra-ui/ai` = `{ citation: Citation }`) — emitted when an evidence badge is activated.
The inner `lr-citation-badge`'s own `lr-citation-activate` (`detail: { sourceId, index }`) still
bubbles through unmodified; this richer event exists because a bare `sourceId`/`index` pair can't
tell a host which exact evidence *span* to jump to.

**Slots:** none.

**CSS parts:** `base` (`role="group"` root), `stats` (the claim-count/coverage/confidence `lr-stat`
row), `warnings` (omitted when there are none), `warnings-heading`, `warnings-count`,
`warnings-list` (a `<ul>`), `warning` (one `<li>`), `evidence` (omitted when `citations` is empty),
`evidence-heading`, `evidence-count`, `evidence-item` (badge + always-visible label/span text),
`evidence-label` (omitted when `Citation.label` is unset), `evidence-span` (the formatted
`Citation.span` range, omitted when unset), `empty` (shown when `assessment` is `null`).

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

---

## `lr-ingestion-queue`

Controlled list of documents moving through an ingestion pipeline: stage badge, progress, chunk/
embedding counts, retry attempts, errors, and retry/cancel requests. Never ingests anything itself.

**Properties:**
- `items: IngestionQueueItem[] = []` (attribute: false) — `IngestionQueueItem { id: string;
  document: DocumentRef; stage: IngestionStage; progress?: number; chunkCount?: number;
  embeddedChunkCount?: number; attempts?: number; error?: string }` (exported here). `document` is
  **`DocumentRef` from `@aceshooting/lyra-ui/ai`** (`{ id, name, mimeType?, uri?, version? }`), not a
  divergent name/mimeType pair, so a caller can reuse the same list a `DocumentRef`-typed
  knowledge-base view already holds. `IngestionStage = 'queued' | 'uploading' | 'extracting' |
  'chunking' | 'embedding' | 'indexing' | 'done' | 'failed' | 'cancelled'` — the first six are
  in-flight (in pipeline order), the last three terminal. `progress` is 0–100 *within the current
  stage* (omitted/non-finite renders an indeterminate indicator, and it is only meaningful during an
  active non-`'queued'` stage). `embeddedChunkCount` renders only alongside a defined `chunkCount`.
  `error` renders only while `stage === 'failed'`. Controlled — pass a new array to update
- `label: string = ''` — accessible name for the region; defaults to the localized
  `ingestionQueueLabel`
- `virtualizeThreshold: number = 100` (attribute `virtualize-threshold`) — item count above which the
  list renders through an internal `lr-virtual-list`

**Events:**
- `lr-retry` (`detail: IngestionRetryEventDetail` = `RetryEventDetail & { itemId: string }` =
  `{ attempt: number; messageId?: string; itemId: string }`) — `attempt` is the attempt about to be
  made, `(item.attempts ?? 0) + 1`. Only offered on `'failed'` rows.
- `lr-cancel` (`detail: IngestionCancelEventDetail` = `CancelEventDetail & { itemId: string }` =
  `{ reason?: string; itemId: string }`) — this component never supplies `reason` itself. Only
  offered on non-terminal rows (`'queued'` plus the five active stages).

Both `RetryEventDetail` and `CancelEventDetail` come from `@aceshooting/lyra-ui/ai`.

**Slots:** none.

**CSS parts:** `base`, `list`, `item`, `item-header`, `item-name`, `item-meta`, `item-progress`,
`item-chunk-count`, `item-embedding-status` (the "N of M chunks embedded" text, only once both
`chunkCount` and `embeddedChunkCount` are set), `item-attempts` (only once `attempts > 0`),
`item-error` (only for `stage="failed"` with `error` set), `item-actions`, `retry-button`,
`cancel-button`, `empty`.

**Themeable custom properties:** `--lr-ingestion-queue-max-height` (default `none`) — non-virtualized
mode only: caps how tall the list grows before it scrolls internally. No effect once virtualized —
retheme the internal list via `lr-virtual-list { --lr-virtual-list-height: … }` instead.

**Optional peer deps:** none.

---

## `lr-knowledge-base`

Controlled source list for a retrieval knowledge base: sync status, indexing health, permissions, and
per-row create/sync/pause/delete requests. Composes `lr-table`, `lr-badge`, `lr-stat`, and a per-row
`lr-menu`. Never syncs or indexes anything itself.

**Properties:**
- `sources: KnowledgeSource[] = []` (attribute: false) — `KnowledgeSource { id: string; name: string;
  type?: string; syncStatus: KnowledgeSourceSyncStatus; indexingHealth?: KnowledgeSourceIndexingHealth;
  permission?: KnowledgeSourcePermission; documentCount?: number; lastSyncedAt?: Date | string;
  errorMessage?: string }` (all four types exported here), where
  `KnowledgeSourceSyncStatus = 'idle' | 'syncing' | 'paused' | 'synced' | 'error'`,
  `KnowledgeSourceIndexingHealth = 'healthy' | 'degraded' | 'failed' | 'unknown'` (absent is treated
  as `'unknown'`), and `KnowledgeSourcePermission = 'owner' | 'editor' | 'viewer' | 'restricted'`.
  `type` is a free-form connector kind (`'drive'`, `'notion'`, `'upload'`, `'url'`, …) rendered
  as-is. `lastSyncedAt` follows this library's `Date | string` timestamp convention (epoch ms Date or
  ISO-8601); absent/unparseable renders "never synced". `errorMessage` shows only while
  `syncStatus === 'error'`. `id`/`name` follow `DocumentRef`'s spirit, but a source is a *connector
  feeding* documents, not a document, so the rest of the fields are its own
- `label: string = ''` — heading text and the table's accessible name; falls back to a localized default
- `hideSummary: boolean = false` (attribute `hide-summary`, reflected) — hides the aggregate
  total/synced/syncing/needs-attention row
- `hideCreate: boolean = false` (attribute `hide-create`, reflected) — hides the "Add source"
  affordance, e.g. for a read-only or permission-gated view

**Events:** `lr-kb-create` (`detail: undefined` — nothing exists yet to reference), `lr-kb-sync`
(`detail: { sourceId: string }`), `lr-kb-pause` (`detail: { sourceId: string }`), `lr-kb-delete`
(`detail: { sourceId: string }`, no built-in confirmation, matching `lr-thread-list`'s
`lr-thread-delete`).

**Slots:** none.

**CSS parts:** `base`, `toolbar` (heading + "Add source" row), `heading` (the heading text),
`create-button` (omitted while `hideCreate`), `summary` (omitted while `hideSummary` or `sources` is
empty), `summary-stat`, `table`, `name-cell`, `source-name`, `source-type` (omitted when `type` is
unset), `sync-cell`, `sync-badge`, `sync-timestamp`, `sync-error`, `health-cell`, `health-badge`,
`document-count` (omitted when unset), `permission-badge` (omitted when `permission` is unset),
`actions-menu`, `actions-trigger` (the kebab `<button>`).

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

**Known gotchas:**
- `permission` is rendered informationally only — the per-row action menu is never gated by it.
  Authorization enforcement is the host's concern.
- "Sync now" is disabled only while `syncStatus === 'syncing'` (including on `'error'` rows, so
  re-running a failed sync is one click); "Pause sync" is enabled only while `'syncing'`.
- The inner `lr-table`'s own `lr-row-click` is deliberately stopped from propagating — this component
  exposes no row-click/selection semantics, only the per-row action menu.

---

## `lr-knowledge-graph-explorer`

Orchestration-level knowledge-graph surface: the `lr-graph` canvas plus entity search, type filters,
neighborhood expansion, pinned nodes, path finding between pins, node selection, and a details
overlay. Composes `lr-graph`, `lr-graph-legend`, `lr-entity-card`, `lr-neighbor-list`,
`lr-path-strip`, and `lr-popover.showAt()`.

**Properties:** (host-supplied data, rendered as given)
- `nodes: GraphNode[] = []`, `links: GraphLink[] = []`, `nodeTypes: GraphNodeType[] = []`,
  `communities: GraphCommunity[] = []` (all attribute: false) — exactly `lr-graph`'s own types,
  forwarded verbatim; see the `lr-graph` section above for each shape
- `entityDetails: Record<string, LyraKnowledgeGraphEntityDetails> = {}` (attribute: false) —
  `LyraKnowledgeGraphEntityDetails = Pick<LyraEntity, 'description' | 'properties' | 'degree'>`, i.e.
  `{ description?: string; properties?: Record<string, string | number>; degree?: number }`, keyed by
  node id. Merged onto the matching `GraphNode` to build the entity shown in the details popover and
  neighbor rows. A node with no entry still renders: `degree` falls back to a live count derived from
  `links`, `description`/`properties` are omitted
- `path: LyraPathElement[] = []` (attribute: false) — host-supplied path-finding *result*, rendered
  via `lr-path-strip` (`{ kind: 'node'; node: LyraEntity } | { kind: 'edge'; relation: string;
  directed?: boolean; reverse?: boolean }`). Empty renders no strip

(self-managed but presettable/observable — this component toggles its own copy on interaction, the
same self-toggle-then-emit contract `lr-graph-legend` uses, so every feature works with zero host wiring)
- `hiddenTypes: string[] = []` (attribute: false) — forwarded to both `lr-graph.hiddenTypes` and
  `lr-graph-legend.hiddenTypes`
- `selectedNodeId: string | null = null` (attribute `selected-node-id`) — drives the details popover
  and `lr-graph.selectedNodeIds`; `null` shows no selection and keeps the popover closed
- `pinnedNodeIds: string[] = []` (attribute: false) — exactly two pinned nodes reveals the "Find
  path" action

(presentation)
- `renderer: 'svg' | 'canvas' = 'svg'` — forwarded to `lr-graph.renderer`
- `width: number = 800`, `height: number = 600`
- `highlight: 'selection' | 'hover' | 'none' = 'selection'` — what drives the dimming forwarded to
  `lr-graph`'s `dimmedNodeIds`/`dimmedLinkIds`, on top of the always-active search-match dimming:
  `'selection'` dims by the selected node's immediate neighborhood; `'hover'` additionally dims by
  the pointer-hovered node (falling back to selection while nothing is hovered); `'none'` forwards
  empty arrays regardless of search/selection state, for a host driving dimming its own way
- `label: string = ''` — accessible name for the root landmark; falls back to the localized
  `graphExplorerLabel`

**Events:**
- `lr-path-request` (`detail: { sourceId: string; targetId: string }`) — the "Find path" action was
  activated with exactly two nodes pinned. This component has no traversal algorithm; the host
  computes/fetches the path and assigns it back through `path`.
- `lr-pin-change` (`detail: { pinnedNodeIds: string[] }`) — the complete updated array. Already
  self-applied before emitting, so reassigning back is optional.
- Bubbling straight through from composed children, unmodified: `lr-node-click`
  (`detail: { id, x, y }`), `lr-link-click` (`detail: { source, target, id? }`), `lr-community-click`
  (`detail: { id }`), `lr-node-expand` (`detail: { id }`, from `lr-graph` and/or `lr-neighbor-list`),
  `lr-relation-activate` (`detail: { relation, sourceId?, targetId? }`, from `lr-path-strip`).

**Slots:** `details` — overrides the details popover's default content (an `lr-entity-card` with a
nested `lr-neighbor-list` and a pin toggle). Receives no data; an overriding consumer reads the
selected entity from `selectedNodeId`/`nodes` itself.

**CSS parts:** `base` (`role="group"`), `toolbar`, `search` (the search `lr-input`), `legend` (the
composed `lr-graph-legend`), `search-results` (only while the internal search query is non-empty),
`search-result` (`role="listitem"` wrapping a `<button>`), `search-empty`, `pinned` (only while
`pinnedNodeIds` is non-empty), `pinned-heading`, `graph` (the composed `lr-graph`), `path` (only
while `path` is non-empty), `detail-popover`, `detail-card`.

**Themeable custom properties:** shared tokens only; retheme the graph through `lr-graph`'s own
tokens (see above).

**Optional peer deps:** `lr-graph`'s `d3-force`/`d3-drag`/`d3-zoom`/`d3-selection` set, transitively.

**Known gotchas:**
- The search query is internal `@state`, not a public property.
- `lr-graph.getNodePosition()` and `lr-node-click`'s `{ x, y }` are graph-*local* drawing
  coordinates, never viewport pixels. For `renderer="svg"` this component resolves the real viewport
  rect from `event.composedPath()`'s `[part="node"]` element; for `renderer="canvas"` (no per-node
  DOM) it uses the click's `clientX`/`clientY`. While an svg-click popover stays open it re-anchors
  on every `lr-viewport-change` from the graph — no `requestAnimationFrame` polling loop.
- Selecting a node any *other* way (search result, neighbor row, path element, keyboard Enter/Space
  on a graph node — which dispatches no native `click`) has no rect to read, so it calls
  `lr-graph.focusNode(id)` and anchors at the graph element's own bounding-box center instead; no
  continuous tracking applies on that path.

---

## `lr-memory-panel`

Agent working-memory surface: short-term context and long-term memories, each with confidence and
optional grounding provenance, and add/remove/forget actions gated behind an explicit confirmation.
Composes `lr-provenance-panel` (per-item provenance, behind a disclosure toggle) and `lr-confirm-bar`
(every confirmation).

**Properties:**
- `shortTerm: LyraMemoryItem[] = []` / `longTerm: LyraMemoryItem[] = []` (both attribute: false) —
  `LyraMemoryItem { id: string; text: string; confidence?: number; provenance?: LyraProvenance }`
  (exported here). `text` renders as plain text. `confidence` is 0–1; omit it and the confidence
  indicator is omitted entirely rather than showing 0%/unknown. `provenance` reuses
  `lr-provenance-panel`'s own `LyraProvenance` shape verbatim (`{ entities?; relationships?;
  communities?; chunks? }`); omit it and the disclosure toggle is omitted entirely. Both arrays are
  controlled and never mutated here — approving an action only fires the matching event
- `types: NodeTypeStyle[] = []` (attribute: false) — `{ id: string; label: string; color?: string;
  shape?: 'circle' | 'square' | 'diamond' }`, forwarded verbatim to every expanded item's
  `lr-provenance-panel`
- `thresholds: { high: number; medium: number } = { high: 0.75, medium: 0.5 }` (attribute: false) —
  confidence-tier boundaries (reusing `lr-citation-badge`'s high/medium/low confidence vocabulary and
  success/warning/danger tones), also forwarded as the provenance relevance tiers
- `label: string = ''` — overall accessible label override

**Events:**
- `lr-add` (`detail: LyraMemoryAddDetail` = `{ item: LyraMemoryItem }`) — a pending "promote to
  long-term" was approved; the short-term item as-is. Only offered on short-term items.
- `lr-remove` (`detail: LyraMemoryRemoveDetail` = `{ id: string; scope: 'short-term' | 'long-term' }`)
  — a pending per-item removal was approved. Offered on every item.
- `lr-forget` (`detail: undefined`) — the pending "forget all long-term memories" bulk action was
  approved. Only rendered while `longTerm` is non-empty.
- `lr-expand` (`detail: LyraMemoryExpandDetail` = `{ id: string; expanded: boolean }`) — an item's
  provenance disclosure was toggled.

**Slots:** none.

**CSS parts:** `base`, `empty` (the all-empty `lr-empty`, shown when both lists are empty),
`section` (one of the two, carries `data-scope`), `section-header`, `heading` (a section's visible
heading text), `section-empty`, `list` (`role="list"`, omitted while that section is empty), `item`
(`role="listitem"`, carries `data-id`/`data-scope` and a stable `tabindex="-1"` so focus has
somewhere to land after a confirmation resolves), `item-row`, `item-text`, `confidence` (carries
`data-tone`; omitted when `confidence` is unset), `expand-toggle` / `item-body` (both omitted when
`provenance` is unset; `item-body` is `hidden` while collapsed), `item-actions`, `add-button`,
`remove-button`, `forget-all-button`.

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

**Known gotchas:**
- At most one confirmation is pending at a time — starting a new action (same item or not) silently
  cancels whichever confirmation was already open.
- `remove` (one item, either list) and `forget` (the whole long-term list) are deliberately distinct
  actions; there is no per-item forget and no bulk remove.

---

## `lr-retrieval-results`

Orchestration-level ranked-chunk surface: takes raw `RetrievalChunk[]` and adds deduplication,
optional source grouping, multi-selection, pagination/infinite loading, and a compact/expanded
switch. Each row wraps exactly one chunk in an internal `lr-chunk-inspector` (fed a single-element
array), reusing its score bar, tier coloring, title+page rendering, and expandable text verbatim.
Large sets window through an internal `lr-virtual-list`.

**Properties:**
- `chunks: RetrievalChunk[] = []` (attribute: false) — **`RetrievalChunk`, imported from
  `@aceshooting/lyra-ui/ai`** (`src/ai/types.ts`): `{ id: string; text: string; score: number;
  source: DocumentRef; metadata?: Record<string, unknown> }`. The raw, un-deduplicated/unsorted/
  ungrouped result set; host-owned. Internally mapped to `lr-chunk-inspector`'s flatter `LyraChunk`
  via `source.id → sourceId`, `source.name → title` (no `page`/`anchor` — `RetrievalChunk` carries
  neither, and they're left unset rather than guessed from `metadata`)
- `selectedIds: string[] = []` (attribute: false) — controlled selection by chunk `id`. The component
  updates its own copy on toggle *then* emits `lr-select`; reassign to control. An id with no
  matching chunk is harmless
- `selectable: boolean = true` (reflected) — shows a per-row `lr-checkbox`
- `dedupe: boolean = true` (reflected) — drops duplicate `id`s, keeping the higher `score`
- `sort: 'score' | 'none' = 'score'` — `'score'` sorts descending; `'none'` preserves given order
- `grouping: 'source' | 'none' = 'none'` — `'source'` buckets rows under a header per `source.id`,
  each bucket ordered by its own best-scoring chunk, and **always** virtualizes regardless of
  `virtualizeAt`
- `presentation: 'compact' | 'expanded' = 'expanded'` — `'expanded'` shows each chunk's full row
  (score bar, text preview with its own toggle) plus any `metadata`; `'compact'` shows title + score
  bar only and omits `metadata` entirely
- `thresholds: { high: number; medium: number } = { high: 0.75, medium: 0.5 }` (attribute: false) —
  forwarded to every per-row `lr-chunk-inspector`
- `virtualizeAt: number = 50` (attribute `virtualize-at`) — row count (after dedup, before grouping)
  above which rendering switches to the internal `lr-virtual-list`
- `activeId: string = ''` (attribute `active-id`) — the chunk currently open in a viewer; forwarded
  to each row and to the virtual list (which scrolls the matching row into view)
- `loading: boolean = false` (reflected)
- `hasMore: boolean = false` (attribute `has-more`, reflected) — while virtualized, forwarded to the
  virtual list so scroll-near-bottom fires `lr-load-more`; otherwise shows the built-in footer button
- `error: string = ''` — non-empty replaces the whole result view with a `role="alert"` message.
  Caller-supplied text, not localized (app/network data, not library copy)
- `label: string = ''` — accessible name; defaults to the localized `chunkInspectorLabel`

**Events:**
- `lr-select` (`detail: RetrievalResultsSelectDetail` = `{ ids: string[]; chunks: RetrievalChunk[] }`)
  — the *complete* updated selection, both as ids and as the matching deduplicated records, so a host
  needn't re-look-up ids against its own copy on every toggle.
- `lr-load-more` (`detail: undefined`) — from the virtual list's scroll-near-bottom detection while
  virtualized, or the `[part="load-more"]` button otherwise. Only fires while `hasMore` is true and
  `loading` is false.
- `lr-chunk-open` (`detail: { id: string; sourceId: string }`) — forwarded verbatim from a row's
  `lr-chunk-inspector`; the event a host routes into `lr-document-viewer`.

**Slots:** none.

**CSS parts:** `base`, `error` (`role="alert"`, while `error` is non-empty), `spinner` (initial-load
`lr-spinner`, while `loading` and `chunks` is still empty), `empty` (when `chunks` is empty and
neither `error` nor `loading` is set), `row` (a plain element in this shadow root below the
virtualization threshold; exported from the internal `lr-virtual-list`'s own `row` part while
virtualized — `::part(row)` reaches it either way), `group-header` (exported from the virtual list's
`group` part; grouped/virtualized mode only), `select` (per-row `lr-checkbox`, omitted when
`selectable` is false), `row-body` (carries `data-selected`), `metadata` (a `<dl>`; omitted when the
chunk has none or while `presentation="compact"`), `metadata-entry`, `load-more-row`, `load-more`.

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

**Known gotchas:**
- While virtualized, each row's content lives inside `lr-virtual-list`'s shadow root, not this
  component's.
- Below the virtualization threshold, scroll-near-bottom isn't a meaningful gesture, so a
  `[part="load-more"]` button takes its place (replaced by a spinner while `loading`).

---

## `lr-retrieval-search`

Query bar for a retrieval/RAG surface: query text, an active filter/scope chip row, a
vector/keyword/hybrid mode selector, and loading/error/empty feedback. Emits `RetrievalQuery` on
submit. Fully controlled; performs no retrieval itself. Composes `lr-input type="search"`,
`lr-segmented`, `lr-chip`/`lr-chip-group`, `lr-spinner`, and a compact `lr-empty`.

**Properties:**
- `query: string = ''` — the query text. The internal `lr-input` updates it optimistically as the
  user types; a host reassignment always wins
- `mode: LyraRetrievalMode = 'hybrid'` — `LyraRetrievalMode = RetrievalQuery['mode'] = 'vector' |
  'keyword' | 'hybrid'`, re-exported here rather than redefined
- `filters: Record<string, unknown> = {}` (attribute: false) — arbitrary metadata filters, rendered
  as removable `"{key}: {value}"` chips. Controlled
- `scope: string[] = []` (attribute: false) — source-scope ids/labels this query is restricted to,
  rendered as removable chips alongside `filters`. Controlled
- `loading: boolean = false` (reflected) — host-driven busy flag; this component cannot know when a
  request resolves
- `errorText: string = ''` (attribute `error-text`) — last failed search's message, shown verbatim
  (caller-owned text, not localized) in a `role="alert"` region
- `empty: boolean = false` (reflected) — host-driven "the last completed search returned zero
  results"; never inferred, since this component holds no results data (see `lr-retrieval-results`)
- `placeholder: string = ''` — falls back to the localized generic "Search" placeholder, which also
  becomes the field's accessible name
- `label: string = ''` — accessible name for the `role="search"` landmark; falls back to a localized
  default
- `accessibleLabel: string | null = null` (attribute `aria-label`) — overrides the landmark's
  computed accessible name; wins over `label` and the localized default, and attribute-reflects from
  a host-level `aria-label`

**Events:**
- `lr-search` (`detail: RetrievalQuery` from `@aceshooting/lyra-ui/ai` = `{ text: string;
  filters?: Record<string, unknown>; mode: 'vector' | 'keyword' | 'hybrid'; scope?: string[] }`) —
  Enter in the query field, or the submit button while not `loading`.
- `lr-cancel` (`detail: CancelEventDetail` from `@aceshooting/lyra-ui/ai` = `{ reason?: string }`) —
  either the button was clicked while `loading` (`detail: {}`), or a new submission superseded an
  in-flight one (`detail: { reason: 'superseded' }`, fired immediately *before* the new `lr-search`).
- `lr-filters-change` (`detail: RetrievalFiltersChangeDetail` = `{ filters: Record<string, unknown>;
  scope: string[] }`) — a chip's remove button was activated; the complete already-updated next
  state, not a delta. The component updates its own copy first, then emits; reassign to control.

**Slots:** none.

**CSS parts:** `base` (the `role="search"` landmark), `row`, `query`, `mode`, `submit` (reads
"Search" while idle, "Cancel" while `loading`), `filters` (omitted entirely when both `filters` and
`scope` are empty), `spinner` (only while `loading`), `error` (`role="alert"`, only when `errorText`
is non-empty and not `loading`), `empty` (only when `empty` and neither `loading` nor `errorText`).

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

**Known gotchas:**
- Submitting while `loading` is already true **supersedes** the in-flight request: `lr-cancel` fires
  immediately before the new `lr-search`. Clicking the submit button (rather than pressing Enter)
  while `loading` only emits `lr-cancel` and does not resubmit.

---

## `lr-retrieval-trace`

A retrieval pipeline's stage timeline (query rewriting, embedding, retrieval, reranking, filtering)
rendered through `lr-span-waterfall`, plus a disclosure list exposing each stage's evidence. Never
fetches, ranks, or computes retrieval results itself.

**Properties:**
- `stages: RetrievalStage[] = []` (attribute: false) — `RetrievalStage { id: string; kind:
  RetrievalStageKind; label?: string; startMs: number; endMs?: number; status: 'pending' | 'running'
  | 'success' | 'error' | 'denied'; detail?: string; evidence?: RetrievalStageEvidence }` (exported
  here), where `RetrievalStageKind = 'query-rewrite' | 'embed' | 'retrieve' | 'rerank' | 'filter'`.
  `startMs`/`endMs` are milliseconds relative to the trace start (`endMs` absent while still
  running); `status` uses `LyraSpan.status`'s vocabulary verbatim; `label` overrides the localized
  default label for `kind`; `detail` is secondary text under the stage name. Pass in any order — the
  timeline sorts by `startMs`. Each stage projects to one `LyraSpan` with `kind` mapped
  `query-rewrite → 'llm'`, `embed → 'embedding'`, `retrieve → 'retriever'`,
  `rerank`/`filter` → `'tool'`
- `RetrievalStageEvidence { text?: string; chunks?: RetrievalChunk[]; metadata?: Record<string,
  unknown> }` — `chunks` is **`RetrievalChunk` from `@aceshooting/lyra-ui/ai`** verbatim, rendered
  through `lr-chunk-inspector` (`source.id → sourceId`, `source.name → title`); `text` is free-form
  (e.g. the rewritten query, an embedding model id); `metadata` renders as a plain key/value list. A
  stage whose evidence has none of the three renders no disclosure row at all
- `activeStageId: string | null = null` (attribute `active-stage-id`) — controlled selection,
  forwarded verbatim to the internal `lr-span-waterfall`'s `activeSpanId`
- `label: string = ''` — accessible name for the timeline; falls back to a host `aria-label`, then
  the waterfall's own localized default

**Events:** `lr-stage-select` (`detail: { id: string }`, a stage's bar was activated — click, Enter,
Space), `lr-stage-toggle` (`detail: { id: string; expanded: boolean }`, an evidence panel was
toggled, either by its own button or implicitly by selecting that stage in the timeline for the
first time).

**Slots:** none.

**CSS parts:** `base`, `timeline` (the internal `lr-span-waterfall`), `evidence-list` (omitted when
no stage has evidence), `evidence-row` (omitted for a stage with no evidence), `evidence-toggle`,
`evidence-toggle-icon`, `evidence-body` (hidden while collapsed), `evidence-text`,
`evidence-metadata` (a `<dl>`), `evidence-metadata-key` (`<dt>`), `evidence-metadata-value` (`<dd>`).

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

**Known gotchas:**
- Every stage starts collapsed; expansion state is internal `@state` keyed by stage id, not a
  controlled property.
