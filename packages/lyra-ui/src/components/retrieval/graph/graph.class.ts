import { html, nothing, svg, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { isRtl } from '../../../internal/rtl.js';
import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';
import { getScratchCtx } from '../../../internal/canvas.js';
import { styles } from './graph.styles.js';
import { loadD3, type D3Modules } from './graph-loader.js';
import { convexHull, hullPathD, hullCentroidX, hullTopY, type HullPoint } from './graph-hull.js';
import { drawGraphScene, drawPickingScene, pickColorToIndex, type CanvasCamera, type CanvasScene } from './graph-canvas.js';
import { layeredLayout } from '../../../internal/layered-layout.js';
import { finiteNumber, finiteRange, finiteInteger } from '../../../internal/numbers.js';
import '../../overlays/skeleton/skeleton.class.js';

export interface GraphNode {
  id: string;
  label?: string;
  /** Spoken label when it needs more context than the visible label. */
  accessibleLabel?: string;
  /** Optional native SVG tooltip text. */
  description?: string;
  /** Clamped to [6, 24] (a non-finite/missing value uses the midpoint, 15) — never rendered smaller/larger. */
  radius?: number;
  color?: string;
  /** Key into `nodeTypes` (by `GraphNodeType.id`) and `hiddenTypes`. Unknown/absent = untyped
   *  (renders as a default circle with the token fill, but still participates in `hiddenTypes`
   *  filtering by its raw string value even with no matching `nodeTypes` entry). */
  type?: string;
  /** Renders a "+" adornment (`part="expand-indicator"`) and marks the node expandable in spoken
   *  text via `graphExpandableItem`. Controlled -- the component never clears this on its own; a
   *  consumer flips it (or leaves it) after appending neighbors in response to a `lr-node-expand`.
   *  Does not gate the `lr-node-expand` event itself, which fires for any node's double-activate. */
  expandable?: boolean;
  /** Community membership shorthand, unioned with any `GraphCommunity.memberIds` that also lists
   *  this node's id. */
  communityId?: string;
}

/** One entry in `nodeTypes` — declares a node type's legend label, optional fill color (sanitized
 *  like `GraphNode.color`), and rendered shape. */
export interface GraphNodeType {
  id: string;
  label: string;
  color?: string;
  shape?: 'circle' | 'square' | 'diamond';
}

/** One entry in `communities` — declares a hull's id, optional label/fill color (sanitized like
 *  `GraphNode.color`), and explicit membership. A node also joins this hull when its own
 *  `GraphNode.communityId` matches this entry's `id`, so `memberIds` and `communityId` are two
 *  ways to express the same membership relationship. */
export interface GraphCommunity {
  id: string;
  label?: string;
  memberIds: string[];
  color?: string;
}
/** A link whose `target` id has no matching node renders as a short dashed stub off `source`'s
 *  own position instead of being silently dropped -- e.g. for a wiki-style `[[link]]` reference to
 *  a not-yet-created page. A link whose `source` id has no matching node is still dropped
 *  entirely (there is no position to draw a stub from). */
export interface GraphLink {
  /** Optional stable id returned by `lr-link-click`. */
  id?: string;
  source: string;
  target: string;
  width?: number;
  /** Optional spoken-name and SVG-tooltip fallback used before the generated source/target text.
   * It is not rendered as a visible edge label. */
  label?: string;
  /** Spoken label for the keyboard-operable link. */
  accessibleLabel?: string;
  /** Optional native SVG tooltip text. */
  description?: string;
  /** Draw an arrowhead at the target end. */
  directed?: boolean;
  /** Per-link stroke color; unsafe CSS declaration delimiters are rejected. */
  color?: string;
  /** SVG stroke-dash sequence. Invalid/negative entries are rejected as a whole. */
  dash?: number[];
}

// `interface ... extends` heritage clauses only accept an identifier/qualified-name
// (not an inline `import('...').X` type query), so the lazy d3-force types are routed
// through these local, non-exported aliases instead of a top-level `import type`. Since
// SimNode/SimLink are themselves never exported (module-private, elided from the emitted
// .d.ts entirely), this indirection doesn't reintroduce the barrel leak the inline
// `import()` idiom elsewhere in this file exists to avoid.
type SimulationNodeDatum = import('d3-force').SimulationNodeDatum;
type SimulationLinkDatum<N extends SimulationNodeDatum> = import('d3-force').SimulationLinkDatum<N>;

interface SimNode extends GraphNode, SimulationNodeDatum {}
type SimLink = Omit<GraphLink, 'source' | 'target'> & SimulationLinkDatum<SimNode> & {
  /** `true` when `target` couldn't be resolved to a real node -- `target` is then a synthetic,
   *  non-simulated position (kept in sync with `source` every tick), rendered as a short dead-end
   *  stub instead of a real edge, and excluded from `forceLink`'s own simulation input. */
  dangling?: boolean;
};

const STUB_OFFSET_PX = 14; // matches the length of a typical broken-link stub in comparable UIs
const EDGE_LABEL_OFFSET_PX = 4; // perpendicular offset from the segment midpoint, in world px
const EDGE_LABEL_LENGTH_GATE_RATIO = 0.85; // label hides when its measured width exceeds this * edge length
const EDGE_LABEL_WIDTH_CACHE_MAX = 512; // distinct measured label texts kept before the oldest entry is evicted
const EXPAND_KEY_INTERVAL_MS = 500; // window for a double-Enter/Space to count as a double-activate
const EXPAND_BADGE_R = 5; // world px, the "+" badge circle radius
const EXPAND_BADGE_OFFSET = Math.SQRT1_2; // places the badge at the node's edge, diagonally upper-right
const FOCUS_HALO_PADDING = 6; // world px added to the node's own radius for the halo ring
const HULL_PADDING = 24; // world px; CSS mirrors this via stroke-width: 2 * --lr-size-24px
const CANVAS_NODE_LABEL_MIN_ZOOM = 0.5; // canvas-only declutter -- node labels draw only at/above this scale


/**
 * Tiny deterministic PRNG (mulberry32, public-domain) used only when `seed`
 * is set, so a node's initial x/y is reproducible instead of whatever
 * forceSimulation() would otherwise randomize it to. This is the whole
 * algorithm — not worth a dependency for.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derives a per-node mulberry32 seed from the component's `seed` and the
 * node's **id** — hashing by id (a simple FNV-1a-style mix), not by the
 * node's index in `nodes`, is what keeps a seeded layout reproducible no
 * matter how a caller orders/reorders the `nodes` array between renders.
 */
function hashNodeSeed(seed: number, id: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 2654435761);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

const MIN_RADIUS = 6;
const MAX_RADIUS = 24;

/**
 * Rejects a `GraphNode.color` that could break out of the single
 * `--lr-node-fill` custom-property declaration it's assigned to — `;`,
 * `{`, and `}` are all a value needs to terminate that declaration and start
 * another. This matters even though the node fill is set via Lit's
 * `styleMap` directive (not raw string interpolation): `styleMap`'s first
 * commit for a given attribute part serializes the whole `style` value as a
 * single string (only later updates go through the safe
 * `CSSStyleDeclaration.setProperty()` path), so an unsanitized value could
 * still inject on that first render.
 */
function sanitizeNodeColor(color: string | undefined): string | undefined {
  return color != null && !/[;{}]/.test(color) ? color : undefined;
}

function normalizeLinkDash(dash: number[] | undefined): string | undefined {
  if (!dash?.length || dash.some((value) => !Number.isFinite(value) || value < 0)) return undefined;
  return dash.join(' ');
}

/** Assigns a typed node with no explicit color a slot from the ordered categorical fallback
 *  palette, cycling every 8 entries (`--lr-graph-cat-1`…`--lr-graph-cat-8`). `index` is the
 *  node's `GraphNodeType`'s position in `nodeTypes`, not the node's own index in `nodes`. */
function categoricalPaletteColor(index: number): string {
  return `var(--lr-graph-cat-${(index % 8) + 1})`;
}

/** side = r * sqrt(pi), area-matched to a circle of radius r (side^2 = pi*r^2). Half-side is what
 *  the path data actually needs, since both shapes are drawn centered on the origin and
 *  positioned via a `transform="translate(x,y)"` per tick, never via absolute cx/cy. */
function shapeHalfSide(r: number): number {
  return (r * Math.sqrt(Math.PI)) / 2;
}

/** A square, centered on the origin, side ~= 1.772 * r (area-matched to the circle of radius r). */
function squarePath(r: number): string {
  const s = shapeHalfSide(r);
  return `M ${-s} ${-s} L ${s} ${-s} L ${s} ${s} L ${-s} ${s} Z`;
}

/** The same square as `squarePath()`, rotated 45 degrees: same side length, vertices at the
 *  half-diagonal distance (s * sqrt(2)) along each axis instead of the square's own corners. */
function diamondPath(r: number): string {
  const d = shapeHalfSide(r) * Math.SQRT2;
  return `M 0 ${-d} L ${d} 0 L 0 ${d} L ${-d} 0 Z`;
}

export interface LyraGraphEventMap {
  'lr-node-click': CustomEvent<{ id: string; x: number; y: number }>;
  'lr-link-click': CustomEvent<{ source: string; target: string; id?: string }>;
  'lr-node-enter': CustomEvent<{ id: string }>;
  'lr-node-leave': CustomEvent<{ id: string }>;
  'lr-link-enter': CustomEvent<{ source: string; target: string; id?: string }>;
  'lr-link-leave': CustomEvent<{ source: string; target: string; id?: string }>;
  'lr-node-expand': CustomEvent<{ id: string }>;
  'lr-selection-change': CustomEvent<{ nodeIds: string[]; linkIds: string[] }>;
  'lr-community-click': CustomEvent<{ id: string }>;
  /** Frame-coalesced pan/zoom/layout signal — see the class doc's `lr-viewport-change` event entry. */
  'lr-viewport-change': CustomEvent<{ k: number; x: number; y: number }>;
}
/**
 * `<lr-graph>` — a force-directed node-link diagram with pan/zoom/drag.
 * Requires the optional peer deps `d3-force`/`d3-drag`/`d3-zoom`/`d3-selection`
 * (lazy-loaded; a consumer who never uses this component pays zero d3 cost).
 *
 * Set `seed` for a deterministic layout: node initial positions become
 * reproducible (keyed by node id) and the settle happens synchronously
 * instead of animating, like `prefers-reduced-motion`. `seed` only takes
 * effect on the update that first populates `nodes`/`links` (or a later
 * update that adds genuinely new node ids) — willUpdate() only reads it from
 * inside rebuildSimulation(), which itself only ever assigns x/y to nodes
 * that don't already have a settled position, so changing `seed` on an
 * already-rendered graph is a no-op; nothing re-derives already-positioned
 * nodes' x/y from the new value.
 *
 * `hiddenTypes` filters nodes/links by `GraphNode.type` without discarding position state --
 * `lastPositionById` remembers every node's last settled x/y across a hide/show round-trip, so
 * toggling a type off and back on restores each node where it was instead of re-randomizing it.
 *
 * `communities` draws one translucent convex-hull blob per entry, behind links/nodes -- a hull's
 * membership is the union of its own `memberIds` and every node whose `communityId` matches its
 * `id`. A community with no currently-visible members (all its nodes hidden by `hiddenTypes`, or
 * simply empty) renders no hull.
 *
 * `layout="layered"` swaps the d3-force simulation for a deterministic layered layout (see
 * `src/internal/layered-layout.ts`) -- node drag is disabled in that mode, and `chargeStrength` is
 * a documented no-op.
 *
 * `renderer="canvas"` swaps the per-node/per-link SVG DOM for a single DPR-aware `<canvas>` --
 * every event/method/property behaves identically to `renderer="svg"` (the default), with hit-
 * testing resolved via an offscreen color-picking canvas instead of DOM event targets. The
 * documented trade-offs: no `::part(node)`/`::part(link)` styling (pixels, not elements -- theme
 * via cssprops instead), no native SVG `<title>` tooltip (replaced by `part="tooltip"`), and a
 * drawn focus ring instead of a CSS one. Keyboard roving/announcements are preserved through an
 * offscreen `part="cursor-item"` button per node/link/hull, driving the identical roving-tabindex
 * logic as `renderer="svg"`.
 *
 * @customElement lr-graph
 * @event lr-node-click - `detail: { id, x, y }`, where `x` and `y` are the
 *   node's current coordinates in the graph's local drawing space.
 * @event lr-link-click - `detail: { source, target, id? }`.
 * @event lr-node-enter - A node was hovered. `detail: { id }`. Suppressed while dragging or
 *   panning. Also toggles a `data-hovered` attribute on that node's `[part="node"]` element for
 *   pure-CSS theming (not a substitute for this event — a consumer computing its own
 *   adjacency-based highlight needs the id, which only the event carries).
 * @event lr-node-leave - The hover from `lr-node-enter` ended. `detail: { id }`.
 * @event lr-link-enter - A link was hovered. `detail: { source, target, id? }`. Same
 *   suppression/`data-hovered` behavior as `lr-node-enter`.
 * @event lr-link-leave - The hover from `lr-link-enter` ended. `detail: { source, target, id?
 *   }`.
 * @event lr-node-expand - A node was double-activated (native `dblclick`, or two Enter/Space
 *   activations of the same focused node within 500ms). `detail: { id }`. Fires for any node
 *   regardless of `GraphNode.expandable` -- that flag only controls the visual "+" affordance and
 *   spoken "expandable" suffix.
 * @event lr-selection-change - `detail: { nodeIds, linkIds }`. Fires when `selectionMode` is not
 *   `'none'` and the user activates/clears a node or link. The component never assigns
 *   `selectedNodeIds`/`selectedLinkIds` itself -- controlled, mirroring `lr-heatmap.selectedCell`.
 * @event lr-community-click - A hull was activated. `detail: { id }`.
 * @event lr-viewport-change - `detail: { k, x, y }`, the live d3-zoom camera transform. Fires at
 *   most once per animation frame regardless of how many pan/zoom/simulation-tick updates land
 *   within it, coalescing every source that can move a rendered node's screen position -- a user
 *   pan/zoom gesture, `focusNode()`/`fit()`'s camera tween, and every d3-force simulation tick
 *   (dragging a node, or the initial settle). A consumer anchoring its own UI (e.g. a details
 *   popover) to a node's `getBoundingClientRect()` can re-read it from this event instead of
 *   polling on a `requestAnimationFrame` loop of its own.
 * @csspart base - The graph wrapper.
 * @csspart svg - The graph SVG.
 * @csspart node - A graph node.
 * @csspart link - A graph link.
 * @csspart arrowhead - The marker used by directed graph links.
 * @csspart label - A node label.
 * @csspart link-label - A drawn edge label (only rendered when `showEdgeLabels` is set).
 * @csspart expand-indicator - The "+" badge rendered on a node with `expandable: true`.
 * @csspart focus-halo - The persistent ring tracking `focusId`'s node.
 * @csspart hull - A community hull (behind links/nodes; role="button").
 * @csspart community-label - A hull's label text.
 * @csspart live-region - The current graph item announcement.
 * @csspart data-list - A visually hidden list alternative for graph data.
 * @csspart empty - The empty-state message, shown when `nodes` is empty.
 * @csspart canvas - The single canvas surface (`renderer="canvas"` only).
 * @csspart tooltip - The hover tooltip (`renderer="canvas"` only; the SVG `<title>` replacement).
 * @csspart cursor-items - The container of offscreen keyboard-roving items (`renderer="canvas"` only).
 * @csspart cursor-item - An offscreen keyboard-roving item (`renderer="canvas"`'s a11y virtual cursor).
 * @cssprop [--lr-node-fill=var(--lr-color-brand)] - Default node fill, overridden per-node by `GraphNode.color`.
 * @cssprop [--lr-link-color=var(--lr-color-border)] - Default link stroke, overridden per-link by a link's own `color`.
 * @cssprop [--lr-graph-cat-1..8] - Ordered categorical fallback palette for a typed node with no
 *   `GraphNodeType.color`, assigned by the type's index in `nodeTypes` (wraps every 8 entries).
 *   Declared centrally in `tokens.styles.ts` so `<lr-graph>` and any future `<lr-graph-legend>`-
 *   style component resolve the identical default.
 * @cssprop [--lr-graph-edge-label-halo=var(--lr-color-surface)] - Legibility halo (`stroke`)
 *   behind a drawn edge label, painted under the fill via `paint-order: stroke`.
 * @cssprop [--lr-graph-focus-halo-color=var(--lr-color-brand)] - `focus-halo` stroke color.
 * @cssprop [--lr-graph-selected-color=var(--lr-color-success)] - Selected node/link stroke.
 * @cssprop [--lr-graph-dimmed-opacity=0.35] - Opacity applied to a node/link when
 *   `dimmedNodeIds`/`dimmedLinkIds` includes its id (both SVG and canvas renderers). Visible by
 *   default -- a consumer controlling `dimmedNodeIds`/`dimmedLinkIds` (e.g.
 *   `lr-knowledge-graph-explorer`) sees the dimming take effect with no extra host styling.
 * @cssprop [--lr-graph-hull-fill=var(--lr-color-brand)] - Hull fill/stroke color.
 * @cssprop [--lr-graph-hull-opacity=0.12] - Hull element opacity (composites fill+stroke as one
 *   group, avoiding a double-opacity seam at the fill/stroke boundary).
 */
export class LyraGraph extends LyraElement<LyraGraphEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

  @property({ attribute: false }) nodes: GraphNode[] = [];
  @property({ attribute: false }) links: GraphLink[] = [];
  /** Declares each `GraphNode.type` value's legend label, fill color, and shape. A typed node with
   *  no matching entry here renders as untyped (default circle, token fill) but still participates
   *  in `hiddenTypes` filtering by its raw `type` string. */
  @property({ attribute: false }) nodeTypes: GraphNodeType[] = [];
  /** Hides every node whose raw `type` value is listed here (no matching `nodeTypes` entry
   *  required), plus every link incident to a hidden node -- removed from the render, the
   *  simulation input, the keyboard roving ring, the sr-only data list, and the accessible
   *  diagram counts, as if absent. Positions round-trip via `lastPositionById`: toggling a type
   *  off and back on restores each node where it was. */
  @property({ attribute: false }) hiddenTypes: string[] = [];
  /** Renders one translucent hull per entry, behind links/nodes. Membership is the union of
   *  `memberIds` and every node whose `communityId` matches this entry's `id`. */
  @property({ attribute: false }) communities: GraphCommunity[] = [];
  /** `'force'` (default) runs the existing d3-force simulation, untouched. `'layered'` computes a
   *  deterministic Sugiyama-lite layout (`src/internal/layered-layout.ts`, a shared,
   *  dependency-free util suitable for any future layered-diagram consumer) instead -- no settle
   *  animation, node drag disabled (dragging would fight a computed layout), `chargeStrength` a
   *  documented no-op, `linkDistance` retunes the layer gap. Switching at runtime repositions
   *  without a tween. */
  @property() layout: 'force' | 'layered' = 'force';
  /** `'svg'` (default, unchanged) renders the existing per-node/per-link DOM. `'canvas'` swaps to
   *  a single `<canvas part="canvas">` -- the scale path (an honest ceiling for `'svg'`: dozens to
   *  low hundreds of nodes; `'canvas'` targets roughly 5,000 nodes / 10,000 links). Feature-reduced
   *  by design: no `::part(node)`/`::part(link)` styling (pixels, not elements -- theme via
   *  cssprops), no SVG `<title>`, a drawn focus ring instead of a CSS one. All events/methods/
   *  props otherwise behave identically across renderers. Runtime changes tear down and rebuild
   *  the surface; positions survive via `prevById`/`lastPositionById`. */
  @property() renderer: 'svg' | 'canvas' = 'svg';
  @property({ type: Number }) width = 800;
  @property({ type: Number }) height = 600;
  @property({ type: Number, attribute: 'charge-strength' }) chargeStrength = -300;
  @property({ type: Number, attribute: 'link-distance' }) linkDistance = 100;
  @property({ type: Number, attribute: 'min-zoom' }) minZoom = 0.1;
  @property({ type: Number, attribute: 'max-zoom' }) maxZoom = 8;
  /** Accessible name forwarded from the host to the semantic graph SVG. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  /** When set, seeds each node's initial x/y deterministically (keyed by
   *  node id, not array index) instead of forceSimulation()'s own random
   *  start, and settles the simulation synchronously — see rebuildSimulation().
   *  Only takes effect on the update that first assigns a given node id an
   *  x/y (i.e. supplied at/before `nodes`/`links` first populate, or when a
   *  later update introduces new node ids) — changing `seed` afterwards does
   *  not retroactively reposition already-settled nodes; there is currently
   *  no way to make an already-rendered graph reproducible after the fact. */
  @property({ type: Number }) seed?: number;
  /** Draws each resolved (non-dangling) link's `label` as visible SVG text at the segment
   *  midpoint. Off by default — `GraphLink.label` stays spoken/tooltip-only, matching today's
   *  behavior, unless this is set. */
  @property({ type: Boolean, attribute: 'show-edge-labels' }) showEdgeLabels = false;
  /** Below this zoom scale, every drawn edge label is hidden (a `data-edge-labels-hidden`
   *  attribute toggled on the zoomed `<g>`, no Lit re-render). Ignored when `showEdgeLabels` is
   *  false. */
  @property({ type: Number, attribute: 'edge-label-min-zoom' }) edgeLabelMinZoom = 0.6;
  /** Declaratively centers the camera on this node id once, the first time it resolves (on mount
   *  or when the id first appears in `nodes`) -- does not re-center on later mutations, so it
   *  can't fight a user's panning on a streaming graph. Renders a persistent halo
   *  (`part="focus-halo"`) around the node while set. See `focusNode()` for the imperative twin. */
  @property({ attribute: 'focus-id' }) focusId: string | null = null;
  /** `'none'` (default) preserves today's behavior exactly -- no `aria-pressed`/`data-selected`,
   *  no `lr-selection-change`. Controlled, mirroring `lr-heatmap.selectedCell`: the component
   *  never mutates `selectedNodeIds`/`selectedLinkIds` itself, only emits intent; the host assigns
   *  them back. */
  @property({ attribute: 'selection-mode' }) selectionMode: 'none' | 'single' | 'multiple' = 'none';
  @property({ attribute: false }) selectedNodeIds: string[] = [];
  @property({ attribute: false }) selectedLinkIds: string[] = [];
  /** Node ids to render dimmed (`data-dimmed` on the matching `[part="node"]`, themeable via
   *  `--lr-graph-dimmed-opacity`). Controlled, mirroring `selectedNodeIds`/`selectedLinkIds`: the
   *  component never assigns this itself, only renders it -- a host typically computes it from a
   *  `lr-node-enter`/`lr-link-enter` hover (the complement of the hovered id's neighbor set,
   *  computed from the host's own `links` array) and assigns the result back. Empty (the default)
   *  renders every node at full opacity, unchanged from today. */
  @property({ attribute: false }) dimmedNodeIds: string[] = [];
  /** Same contract as `dimmedNodeIds`, for links. A link's dimming key is the same `linkKey()`
   *  value (`GraphLink.id`, else `` `${source}->${target}` ``) `selectedLinkIds` already uses. */
  @property({ attribute: false }) dimmedLinkIds: string[] = [];

  private readonly arrowMarkerId = nextId('graph-arrow');

  /** True until the lazy-loaded d3 peer dependencies have settled (success or failure). */
  @state() private loading = true;

  @state() private simNodes: SimNode[] = [];
  @state() private simLinks: SimLink[] = [];
  private danglingLinks: SimLink[] = [];
  /** Every node's last-known settled position, keyed by id, independent of current visibility --
   *  consulted by `rebuildSimulation()` (after the existing carried-over-position map) so a
   *  `hiddenTypes` toggle restores a node where it was instead of re-randomizing it. Pruned to ids
   *  present in `this.nodes` (not just currently-visible ones) on every rebuild. */
  private lastPositionById = new Map<string, { x: number; y: number }>();
  /** The `hiddenNodeCount` computed by the most recent `rebuildSimulation()` -- lets that method
   *  tell "nothing has ever been hidden" (never touch `graphLiveText`, so a consumer that never
   *  sets `hiddenTypes` keeps today's exact live-region output) apart from "a hide was just
   *  cleared" (still announce the resulting "0 of N" count). */
  private lastHiddenNodeCount = 0;
  /** One roving tab stop across all nodes and links; nodes are the initial entry order. */
  @state() private activeGraphItem = 0;
  @state() private graphLiveText = '';

  private simulation?: import('d3-force').Simulation<SimNode, SimLink>;
  /** The live charge/link force objects, kept so chargeStrength/linkDistance
   *  changes can retune them in place (see updated()) instead of requiring a
   *  full rebuildSimulation(). */
  private chargeForce?: import('d3-force').ForceManyBody<SimNode>;
  private linkForce?: import('d3-force').ForceLink<SimNode, SimLink>;
  private d3?: D3Modules;
  /** The `<svg>` (or, in `renderer="canvas"` mode, the `<canvas>`) currently wired up with d3-zoom
   *  (guards a one-time bind per element). */
  private zoomedEl?: SVGSVGElement | HTMLCanvasElement;
  /** The pan/zoom `<g>`, cached alongside `zoomedEl` so the zoom handler can
   *  write the transform straight to the DOM (see applyInteractions()) instead
   *  of round-tripping through a Lit reactive property on every pan/zoom event. */
  private gEl?: SVGGElement;
  /** The live zoom behavior, kept so minZoom/maxZoom changes can retune its
   *  scaleExtent in place (see applyInteractions()) instead of requiring the
   *  `<svg>` to be rebound. */
  private zoomBehavior?: import('d3-zoom').ZoomBehavior<SVGSVGElement | HTMLCanvasElement, unknown>;
  /** Node `<circle>`s already wired up with d3-drag; cleared on every simulation rebuild
   *  so DOM elements Lit reuses across a rebuild get rebound to their fresh datum. */
  private boundNodeEls = new WeakSet<Element>();
  /** Node/link/label DOM elements, index-aligned with simNodes/simLinks, cached
   *  once per structural rebuild and written to directly by onTick() — this is
   *  what lets ticks update positions without going through Lit's reactive
   *  simNodes/simLinks properties (see rebuildSimulation()'s doc comment). */
  private nodeEls: SVGElement[] = [];
  private nodeLabelEls: (SVGTextElement | null)[] = [];
  private expandIndicatorEls: (SVGGElement | null)[] = [];
  /** Tracks the index/time of the last Enter/Space activation, for double-Enter expand detection
   *  (mirroring native dblclick semantics for keyboard users). */
  private lastKeyActivateIndex: number | null = null;
  private lastKeyActivateTime = 0;
  /** The last `focusId` value `focusNode()` was auto-invoked for by `updated()`'s declarative
   *  centering branch -- guards against re-centering on every update while `focusId` stays set
   *  (see the `focusId` property doc for why it only ever centers once per value). Reset to `null`
   *  whenever `focusId` itself is cleared, so the same id can center again later. */
  private lastAppliedFocusId: string | null = null;
  private focusHaloEl?: SVGCircleElement;
  private communityHullEls: SVGPathElement[] = [];
  private communityLabelEls: SVGTextElement[] = [];
  @query('canvas') private canvasEl?: HTMLCanvasElement;
  private canvasCtx?: CanvasRenderingContext2D;
  /** Offscreen, same-size, same-camera-transform canvas used only for hit-testing (see
   *  `redrawPickCanvas()`/`hitTest()`) -- never attached to the DOM or painted to the screen. */
  private pickCanvas?: HTMLCanvasElement;
  private pickCtx?: CanvasRenderingContext2D | null;
  private canvasResizeObserver?: ResizeObserver;
  private canvasDprQuery?: MediaQueryList;
  private canvasDrawRafId?: number;
  private pickDirty = true;
  private canvasCamera: CanvasCamera = { k: 1, x: 0, y: 0 };
  private canvasTooltipEl?: HTMLDivElement;
  /** Flat, index-aligned list matching `drawPickingScene()`'s own hulls-then-links-then-nodes pick
   *  order -- rebuilt by `redrawPickCanvas()` alongside the pick canvas itself, so a pick color's
   *  decoded index always maps back to the exact item it was drawn for. */
  private pickItems: (
    | { kind: 'hull'; entry: { community: GraphCommunity; members: SimNode[] } }
    | { kind: 'link'; link: SimLink }
    | { kind: 'node'; node: SimNode }
  )[] = [];
  private canvasDragNode?: SimNode;
  private canvasPointerId?: number;
  private canvasPointerDownAt?: { x: number; y: number };
  /** The latest hover pointer position awaiting a hit test -- `pointermove` can fire far more
   *  often than the display refreshes, and each hit test costs a bounding-rect read plus a
   *  pick-pixel readback, so hover resolution is coalesced to at most one per animation frame. */
  private pendingHover?: { x: number; y: number };
  private hoverRafId?: number;
  /** Cached world-space draw scene, reused for camera-only repaints (pan/zoom moves the camera,
   *  not the scene) -- building it costs a `getComputedStyle()` pass plus full per-node/per-link
   *  array rebuilds, so it's only invalidated (`markCanvasDirty()`) when data/selection/style
   *  state or node positions actually change. */
  private canvasScene?: CanvasScene;
  /** Whether `canvasScene` was built with edge labels included -- the zoom gate makes the scene
   *  camera-dependent at exactly two thresholds (`edgeLabelMinZoom`, `CANVAS_NODE_LABEL_MIN_ZOOM`),
   *  so a camera-only draw that crosses either must rebuild instead of reusing the cache. */
  private canvasSceneHasEdgeLabels = false;
  /** The in-flight `requestAnimationFrame` id for a camera tween (`focusNode()`/`fit()`), if any --
   *  canceled by a new tween request or a user pan/zoom gesture (see `applyInteractions()`'s zoom
   *  `'start'` handler). */
  private cameraTweenId?: number;
  /** The current tween's own `resolve`, so cancellation (a superseding tween, or a real user
   *  pan/zoom gesture) settles it with `false` instead of leaving the caller's `Promise` hanging
   *  forever -- `cancelAnimationFrame()` alone stops the rAF loop but never touches the Promise. */
  private cameraTweenResolve?: (arrived: boolean) => void;
  /** True for a camera tween's whole duration (set before its first frame, cleared on
   *  resolution) -- `isPanning` alone doesn't cover this: `applyZoomTransform()`'s per-frame
   *  `zoomBehavior.transform()` call on a non-transition selection fires d3-zoom's
   *  start/zoom/end synchronously within that single call, so `isPanning` flips true-then-false
   *  within one frame rather than staying true for the tween's real duration the way an actual
   *  user gesture does. */
  private isCameraTweening = false;
  /** Pending rAF id for the coalesced `lr-viewport-change` emission — see
   *  `scheduleViewportChange()`. Only one is ever outstanding at a time regardless of how many
   *  zoom/tick callbacks request one within the same frame. */
  private viewportChangeRafId?: number;
  private linkEls: SVGLineElement[] = [];
  private linkLabelEls: (SVGTextElement | null)[] = [];
  /** Per-simLink-index flip cache for the length declutter gate -- `onTick()` only writes
   *  `visibility` when the boolean actually changes, not every tick. */
  private linkLabelHiddenByLength: boolean[] = [];
  private edgeLabelWidthCache = new Map<string, number>();
  /** Dangling-stub `<line>`s, index-aligned with `danglingLinks` -- cached separately from
   *  `linkEls` (real, simulated links only) so onTick() can write their positions too; see
   *  onTick()'s own comment for why a stub needs this at all. */
  private danglingLinkEls: SVGLineElement[] = [];

  connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent that keeps this same
    // element instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between — this.d3 is already set from
    // the initial mount, and the live simulation/DOM are still intact
    // (disconnectedCallback only stops the simulation's timer, it doesn't
    // tear anything down). Redoing the lazy-load + rebuildSimulation() here
    // would discard every already-settled node's position and restart the
    // whole ~300-tick alpha=1 settle animation for no reason — just resume
    // the existing simulation in place instead.
    if (this.d3) {
      this.simulation?.restart();
      // renderer="canvas" mode's own resize/DPR watchers are torn down by disconnectedCallback()
      // below on every disconnect (including this reconnect) -- the <canvas> element itself
      // survived the reparent along with the rest of this shadow tree (canvasEl === zoomedEl still
      // holds), so re-arm them in place instead of waiting for a property-driven update that a bare
      // reparent never triggers.
      if (this.renderer === 'canvas' && this.canvasEl && this.canvasEl === this.zoomedEl) {
        this.watchCanvasResize();
        this.watchCanvasDpr();
        this.markCanvasDirty();
      }
      return;
    }
    void loadD3().then((mods) => {
      this.loading = false;
      // The element may have been removed from the DOM while the dynamic
      // d3 imports were in flight — don't spin up a simulation for a
      // detached instance (disconnectedCallback's cleanup already ran).
      if (!mods || !this.isConnected) return;
      this.d3 = mods;
      this.rebuildSimulation();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.simulation?.stop();
    // An in-flight focusNode()/fit() tween would otherwise keep scheduling frames and writing
    // zoom transforms against the detached tree -- cancel it (which also settles the caller's
    // pending Promise with `false` instead of leaving it hanging forever).
    this.cancelCameraTween();
    this.canvasResizeObserver?.disconnect();
    this.canvasDprQuery?.removeEventListener('change', this.onCanvasDprChange);
    if (this.canvasDrawRafId != null) {
      cancelAnimationFrame(this.canvasDrawRafId);
      this.canvasDrawRafId = undefined;
    }
    if (this.hoverRafId != null) {
      cancelAnimationFrame(this.hoverRafId);
      this.hoverRafId = undefined;
    }
    this.pendingHover = undefined;
    if (this.viewportChangeRafId != null) {
      cancelAnimationFrame(this.viewportChangeRafId);
      this.viewportChangeRafId = undefined;
    }
  }

  /** Coalesces every pan/zoom/tick-driven `lr-viewport-change` emission into at most one per
   *  animation frame -- called from both the svg/canvas zoom handlers and `onTick()`, all of which
   *  can fire far more often than once per frame (a wheel-zoom gesture, a settling simulation). */
  private scheduleViewportChange(): void {
    if (this.viewportChangeRafId != null) return;
    this.viewportChangeRafId = requestAnimationFrame(() => {
      this.viewportChangeRafId = undefined;
      const transform =
        this.renderer === 'canvas' || !this.d3 || !this.zoomedEl
          ? this.canvasCamera
          : this.d3.zoomTransform(this.zoomedEl);
      this.emit('lr-viewport-change', { k: transform.k, x: transform.x, y: transform.y });
    });
  }

  /**
   * A caller-supplied `radius` is clamped to [MIN_RADIUS, MAX_RADIUS] (and a
   * non-finite/NaN value falls back to the same default average as an unset
   * one) — an unclamped 0/negative radius would render an invisibly small
   * `<circle>` that's still `role="button" tabindex="0"`, an invisible,
   * focusable/clickable control with no visible focus indicator.
   */
  private nodeRadius(n: GraphNode): number {
    const r = n.radius ?? (MIN_RADIUS + MAX_RADIUS) / 2;
    return Number.isFinite(r) ? Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, r)) : (MIN_RADIUS + MAX_RADIUS) / 2;
  }

  /** `width`/`height` normalized to a finite, positive viewport size — an invalid attribute value
   *  would otherwise flow straight into `forceCenter`, the SVG `viewBox`, and the canvas backing
   *  store's `width`/`height`, producing `NaN` geometry/transforms that silently render nothing
   *  instead of erroring. */
  private get safeWidth(): number {
    return finiteRange(this.width, 800, 1);
  }
  private get safeHeight(): number {
    return finiteRange(this.height, 600, 1);
  }

  /** `minZoom`/`maxZoom` normalized to finite, positive scale bounds before ever reaching
   *  d3-zoom's `scaleExtent()` or a camera-clamp `Math.min`/`Math.max` — a non-finite bound would
   *  otherwise poison every subsequent zoom/pan computation with `NaN`. */
  private get safeMinZoom(): number {
    return finiteRange(this.minZoom, 0.1, 0.001, 1000);
  }
  private get safeMaxZoom(): number {
    return finiteRange(this.maxZoom, 8, 0.001, 1000);
  }

  /** `edgeLabelMinZoom` is compared directly against the live camera scale (same domain as
   *  `minZoom`/`maxZoom`), so it's normalized with the same bounds -- a non-finite value would
   *  otherwise make every `>=`/`<` comparison against it silently `false`/`true` forever. */
  private get safeEdgeLabelMinZoom(): number {
    return finiteRange(this.edgeLabelMinZoom, 0.6, 0.001, 1000);
  }

  /** `seed`, normalized to a finite integer when set -- `undefined` (unseeded/random) is left
   *  untouched, since it's a meaningful third state, not a missing number. Without this,
   *  `hashNodeSeed`/`mulberry32`'s `>>> 0` coercion would silently fold `NaN`/`Infinity` to `0`
   *  instead of normalizing an out-of-range attribute value the way every other numeric prop here
   *  does. */
  private get safeSeed(): number | undefined {
    return this.seed == null ? undefined : finiteInteger(this.seed, 0);
  }

  /** `chargeStrength` is a signed d3-force strength (negative = repulsion, positive = attraction)
   *  — only guarded for finiteness, not clamped to a range, since either sign is a legitimate
   *  value. */
  private get safeChargeStrength(): number {
    return finiteNumber(this.chargeStrength, -300);
  }

  /** `linkDistance` normalized to a finite, non-negative pixel distance — feeds `forceLink()`'s
   *  `distance()`, the layered layout's `gapY`, and the neighbor-jitter spawn radius, none of
   *  which have a sane meaning for a negative/non-finite value. */
  private get safeLinkDistance(): number {
    return finiteRange(this.linkDistance, 100, 0);
  }

  private resolveNodeType(node: GraphNode): GraphNodeType | undefined {
    return node.type != null ? this.nodeTypes.find((t) => t.id === node.type) : undefined;
  }

  private nodeShape(node: GraphNode): 'circle' | 'square' | 'diamond' {
    return this.resolveNodeType(node)?.shape ?? 'circle';
  }

  /** Resolution precedence: `node.color` (existing, most specific) > matched `GraphNodeType.color`
   *  > the ordered categorical fallback palette by the type's index in `nodeTypes` > (returns
   *  `undefined`, letting the untyped `--lr-node-fill` token default apply). Both data-driven
   *  color sources pass the existing `sanitizeNodeColor()`. */
  private nodeFill(node: GraphNode): string | undefined {
    const ownColor = sanitizeNodeColor(node.color);
    if (ownColor) return ownColor;
    const type = this.resolveNodeType(node);
    if (!type) return undefined;
    const typeColor = sanitizeNodeColor(type.color);
    if (typeColor) return typeColor;
    return categoricalPaletteColor(this.nodeTypes.indexOf(type));
  }

  /** `this.nodes` filtered down to the ids `hiddenTypes` doesn't hide -- an untyped node (`type ==
   *  null`) is never hidden, regardless of `hiddenTypes`' contents. */
  private visibleNodes(): GraphNode[] {
    if (!this.hiddenTypes.length) return this.nodes;
    const hidden = new Set(this.hiddenTypes);
    return this.nodes.filter((n) => n.type == null || !hidden.has(n.type));
  }

  /** Resolves `this.links` against an already-built `byId` node map: a link whose source isn't in
   *  `byId` is dropped (hidden source, or a genuinely missing one); a link whose target isn't in
   *  `byId` either stubs as a dangling link (target id doesn't exist in `this.nodes` at all) or is
   *  dropped (target exists but is hidden by `hiddenTypes`). Shared by both the force and layered
   *  layout paths in `rebuildSimulation()`. */
  private resolveLinksAgainst(byId: Map<string, SimNode>): { resolved: SimLink[]; dangling: SimLink[] } {
    const nodeExists = new Set(this.nodes.map((n) => n.id));
    const resolved: SimLink[] = [];
    const dangling: SimLink[] = [];
    for (const l of this.links) {
      const source = byId.get(l.source);
      if (!source) continue;
      const target = byId.get(l.target);
      if (target) {
        resolved.push({ ...l, source, target });
      } else if (!nodeExists.has(l.target)) {
        dangling.push({ ...l, source, target: { id: l.target, x: source.x, y: source.y } as SimNode, dangling: true });
      }
    }
    return { resolved, dangling };
  }

  /** A community's currently-visible members -- the union of `memberIds` and every currently
   *  simulated node (already filtered by `hiddenTypes`) whose `communityId` matches. */
  private communityMembers(community: GraphCommunity): SimNode[] {
    const idSet = new Set(community.memberIds);
    return this.simNodes.filter((n) => idSet.has(n.id) || n.communityId === community.id);
  }

  /** Memoized `visibleCommunities()` result -- `undefined` means "stale, recompute on next call".
   *  Cleared from `willUpdate()` whenever `simNodes`/`communities` actually change, the same
   *  structural-change gate `applyInteractions()` re-caches its own DOM lookups on, so every other
   *  call site (roving-ring math, `render()`'s template, keyboard navigation) shares one
   *  `O(communities × simNodes)` computation per structural update instead of repeating it. */
  private visibleCommunitiesCache?: { community: GraphCommunity; members: SimNode[] }[];

  /** `communities` narrowed to entries with at least one currently-visible member -- a community
   *  whose members are all hidden by `hiddenTypes` (or that starts out empty) draws no hull and
   *  doesn't occupy a roving-ring slot. */
  private visibleCommunities(): { community: GraphCommunity; members: SimNode[] }[] {
    if (!this.visibleCommunitiesCache) {
      this.visibleCommunitiesCache = this.communities
        .map((community) => ({ community, members: this.communityMembers(community) }))
        .filter((entry) => entry.members.length > 0);
    }
    return this.visibleCommunitiesCache;
  }

  private communityHull(members: SimNode[]): HullPoint[] {
    return convexHull(members.map((n) => ({ x: n.x ?? 0, y: n.y ?? 0 })));
  }

  private onCommunityClick(community: GraphCommunity): void {
    this.emit('lr-community-click', { id: community.id });
  }

  private cameraTransitionMs(): number {
    const parsed = parseFloat(getComputedStyle(this).getPropertyValue('--lr-transition-base'));
    return Number.isFinite(parsed) ? parsed : 180;
  }

  private cancelCameraTween(): void {
    if (this.cameraTweenId != null) {
      cancelAnimationFrame(this.cameraTweenId);
      this.cameraTweenId = undefined;
    }
    this.isCameraTweening = false;
    const resolve = this.cameraTweenResolve;
    if (resolve) {
      this.cameraTweenResolve = undefined;
      resolve(false);
    }
  }

  /** Writing a transform on a plain (non-transition) selection makes d3-zoom fire its own
   *  start/zoom/end sequence synchronously, in this same call -- `isApplyingZoomTransform` lets
   *  the zoom `'start'` handler tell that self-triggered echo apart from a genuine external
   *  gesture, so a camera tween's own per-frame write doesn't cancel itself. */
  private isApplyingZoomTransform = false;

  private applyZoomTransform(transform: OptionalPeerApi): void {
    if (!this.d3 || !this.zoomedEl || !this.zoomBehavior) return;
    this.isApplyingZoomTransform = true;
    try {
      this.zoomBehavior.transform(this.d3.select(this.zoomedEl), transform);
    } finally {
      this.isApplyingZoomTransform = false;
    }
  }

  /** Animates from the zoom behavior's current transform toward `computeTarget()`'s result via a
   *  rAF tween that calls `zoomBehavior.transform()` every frame -- keeps d3-zoom's own internal
   *  state consistent (so the next user pan doesn't jump), unlike writing the `<g>` transform
   *  attribute directly. `computeTarget` is re-invoked on every single frame (not read once
   *  up-front) so the tween keeps tracking a still-settling force simulation's live node positions
   *  instead of tweening toward a stale snapshot from the moment the call was made --
   *  `focusNode()`/`fit()` are just as likely to run while the graph is still animating its initial
   *  layout as after it's settled. `prefers-reduced-motion` jumps straight to one write of the
   *  then-current target. A concurrent call cancels the previous tween -- resolves `true` on
   *  genuine arrival, `false` if superseded or interrupted by a user gesture before completing. */
  private tweenCamera(computeTarget: () => OptionalPeerApi): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.d3 || !this.zoomedEl || !this.zoomBehavior) {
        resolve(false);
        return;
      }
      this.cancelCameraTween();
      this.cameraTweenResolve = resolve;
      this.isCameraTweening = true;
      if (prefersReducedMotion()) {
        this.applyZoomTransform(computeTarget());
        this.isCameraTweening = false;
        this.cameraTweenResolve = undefined;
        resolve(true);
        return;
      }
      const current = this.d3.zoomTransform(this.zoomedEl);
      const duration = this.cameraTransitionMs();
      const start = performance.now();
      const startK = current.k as number;
      const startX = current.x as number;
      const startY = current.y as number;
      const step = (now: number): void => {
        const t = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
        const target = computeTarget();
        const targetK = target.k as number;
        const targetX = target.x as number;
        const targetY = target.y as number;
        this.applyZoomTransform(
          this.d3!.zoomIdentity
            .translate(startX + (targetX - startX) * t, startY + (targetY - startY) * t)
            .scale(startK + (targetK - startK) * t),
        );
        if (t < 1) {
          this.cameraTweenId = requestAnimationFrame(step);
        } else {
          this.cameraTweenId = undefined;
          this.isCameraTweening = false;
          this.cameraTweenResolve = undefined;
          resolve(true);
        }
      };
      this.cameraTweenId = requestAnimationFrame(step);
    });
  }

  /** Animates the camera so `id` centers in the viewport (the `width` x `height` viewBox), at
   *  `options.zoom` (clamped to `[minZoom, maxZoom]`) or the current scale when omitted. Resolves
   *  `true` on arrival; `false` for an id with no matching entry in `simNodes` -- there's nothing
   *  to center on. Announces `graphNodeFocused` through the existing live region. Does not move DOM
   *  focus -- this is a camera operation, not a roving-focus one. */
  async focusNode(id: string, options?: { zoom?: number }): Promise<boolean> {
    const node = this.simNodes.find((n) => n.id === id);
    if (!node || !this.d3 || !this.zoomedEl || !this.zoomBehavior) return false;
    const current = this.d3.zoomTransform(this.zoomedEl);
    const k = Math.min(this.safeMaxZoom, Math.max(this.safeMinZoom, options?.zoom ?? (current.k as number)));
    const arrived = await this.tweenCamera(() =>
      this.d3!.zoomIdentity
        .translate(this.safeWidth / 2 - k * (node.x ?? 0), this.safeHeight / 2 - k * (node.y ?? 0))
        .scale(k),
    );
    if (arrived) {
      this.graphLiveText = this.localize('graphNodeFocused', undefined, { label: this.nodeAccessibleText(node) });
    }
    return arrived;
  }

  /** Animates the camera to frame the bounding box of every currently visible node position (plus
   *  each node's own radius) at the largest scale that fits within `width` x `height` minus
   *  `padding` viewport-px on each side (clamped to `[minZoom, maxZoom]`). Silent -- no data
   *  changed, so no announcement. A no-op with no visible nodes. */
  fit(options?: { padding?: number }): void {
    if (!this.d3 || !this.zoomedEl || !this.zoomBehavior || !this.simNodes.length) return;
    const padding = options?.padding ?? 24;
    void this.tweenCamera(() => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const n of this.simNodes) {
        const r = this.nodeRadius(n);
        minX = Math.min(minX, (n.x ?? 0) - r);
        maxX = Math.max(maxX, (n.x ?? 0) + r);
        minY = Math.min(minY, (n.y ?? 0) - r);
        maxY = Math.max(maxY, (n.y ?? 0) + r);
      }
      for (const entry of this.visibleCommunities()) {
        for (const p of this.communityHull(entry.members)) {
          minX = Math.min(minX, p.x - HULL_PADDING);
          maxX = Math.max(maxX, p.x + HULL_PADDING);
          minY = Math.min(minY, p.y - HULL_PADDING);
          maxY = Math.max(maxY, p.y + HULL_PADDING);
        }
      }
      const boxW = Math.max(1, maxX - minX);
      const boxH = Math.max(1, maxY - minY);
      const availW = Math.max(1, this.safeWidth - padding * 2);
      const availH = Math.max(1, this.safeHeight - padding * 2);
      const k = Math.min(this.safeMaxZoom, Math.max(this.safeMinZoom, Math.min(availW / boxW, availH / boxH)));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      return this.d3!.zoomIdentity.translate(this.safeWidth / 2 - k * cx, this.safeHeight / 2 - k * cy).scale(k);
    });
  }

  private updateFocusHalo(): void {
    if (!this.focusHaloEl) return;
    const node = this.focusId != null ? this.simNodes.find((n) => n.id === this.focusId) : undefined;
    if (node) {
      this.focusHaloEl.setAttribute('cx', String(node.x ?? 0));
      this.focusHaloEl.setAttribute('cy', String(node.y ?? 0));
      this.focusHaloEl.setAttribute('r', String(this.nodeRadius(node) + FOCUS_HALO_PADDING));
      this.focusHaloEl.removeAttribute('hidden');
    } else {
      this.focusHaloEl.setAttribute('hidden', '');
    }
  }

  // ---------------------------------------------------------------------------------------------
  // renderer="canvas": surface setup, DPR/resize watching, scene building, and the static draw.
  // ---------------------------------------------------------------------------------------------

  private setUpCanvasSurface(): void {
    this.canvasCtx = this.canvasEl!.getContext('2d') ?? undefined;
    this.pickCanvas = document.createElement('canvas');
    this.pickCtx = this.pickCanvas.getContext('2d', { willReadFrequently: true });
    this.watchCanvasResize();
    this.watchCanvasDpr();
    this.canvasTooltipEl = (this.renderRoot.querySelector('[part="tooltip"]') as HTMLDivElement) ?? undefined;
    // bindCanvasPointer() (which owns onCanvasDblClick) is bound BEFORE bindCanvasZoom() -- both
    // end up with a 'dblclick' listener on this same <canvas>, and d3-zoom's own default
    // double-click-to-zoom-in handler calls stopImmediatePropagation() unconditionally (see
    // onCanvasDblClick()'s own comment). Registering first means onCanvasDblClick() runs first and
    // gets the chance to itself stop the event (only when it actually hit a node) before d3-zoom's
    // handler would otherwise suppress it from ever being observed at all.
    this.bindCanvasPointer();
    this.bindCanvasZoom();
  }

  private watchCanvasResize(): void {
    // Re-arming replaces the observer instance -- disconnect the previous one first, or a
    // canvas -> svg -> canvas renderer round trip leaves an orphaned observer still watching the
    // host (disconnectedCallback only ever cleans up whichever instance is current).
    this.canvasResizeObserver?.disconnect();
    this.canvasResizeObserver = new ResizeObserver(() => this.markCanvasDirty());
    this.canvasResizeObserver.observe(this);
  }

  private watchCanvasDpr(): void {
    // A MediaQueryList's `matches` is fixed at creation time, so crossing the DPR threshold it was
    // built for means building a fresh one for the new ratio -- remove the previous instance's
    // listener first, or it leaks (disconnectedCallback only ever cleans up whichever is current).
    this.canvasDprQuery?.removeEventListener('change', this.onCanvasDprChange);
    this.canvasDprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.canvasDprQuery.addEventListener('change', this.onCanvasDprChange);
  }

  private onCanvasDprChange = (): void => {
    this.watchCanvasDpr();
    this.markCanvasDirty();
  };

  private markCanvasDirty(): void {
    this.canvasScene = undefined;
    this.pickDirty = true;
    this.scheduleCanvasDraw();
  }

  /** The camera-only sibling of `markCanvasDirty()`: a pan/zoom moves the camera but leaves every
   *  world-space scene value (positions, colors, labels) untouched, so the cached `canvasScene`
   *  stays valid and only needs redrawing under the new transform. The pick canvas bakes the
   *  camera transform into its pixels, though, so it still needs a redraw before the next hit
   *  test. */
  private markCanvasCameraDirty(): void {
    this.pickDirty = true;
    this.scheduleCanvasDraw();
  }

  private scheduleCanvasDraw(): void {
    if (this.canvasDrawRafId != null) return;
    this.canvasDrawRafId = requestAnimationFrame(() => {
      this.canvasDrawRafId = undefined;
      this.drawCanvas();
    });
  }

  /** Canvas 2D's `fillStyle`/`strokeStyle` don't accept a raw `var(--x)` string the way an inline
   *  SVG `style` attribute does -- resolves it to the actual cascaded color via `getComputedStyle`
   *  first (the same "canvas can't consume var() directly" resolution `<lr-heatmap>` already
   *  uses for its own canvas-drawn tokens). `value` untouched when it isn't a bare `var(...)` ref
   *  (a literal `GraphNode.color`/`GraphLink.color` hex/rgb string already resolves fine as-is). */
  private resolveCssColorValue(value: string, cs: CSSStyleDeclaration): string {
    const match = value.match(/^var\((--[\w-]+)/);
    if (!match) return value;
    return cs.getPropertyValue(match[1]!).trim() || value;
  }

  private buildCanvasScene(cs: CSSStyleDeclaration): CanvasScene {
    const hullFillDefault =
      cs.getPropertyValue('--lr-graph-hull-fill').trim() || cs.getPropertyValue('--lr-color-brand').trim();
    const hulls = this.visibleCommunities().map((entry) => ({
      d: hullPathD(this.communityHull(entry.members)),
      fill: sanitizeNodeColor(entry.community.color) ?? hullFillDefault,
    }));
    const linkColorDefault =
      cs.getPropertyValue('--lr-link-color').trim() || cs.getPropertyValue('--lr-color-border').trim();
    const links = this.simLinks.map((l) => {
      const coords = this.linkCoordinates(l);
      const own = sanitizeNodeColor(l.color);
      return {
        x1: coords.x1,
        y1: coords.y1,
        x2: coords.x2,
        y2: coords.y2,
        color: own ? this.resolveCssColorValue(own, cs) : linkColorDefault,
        width: l.width ?? 1.5,
        dash: l.dash,
        directed: l.directed,
        selected: this.isSelected('link', this.linkKey(l)),
        dimmed: this.isDimmed('link', this.linkKey(l)),
      };
    });
    const edgeLabels =
      this.showEdgeLabels && this.canvasCamera.k >= this.safeEdgeLabelMinZoom
        ? this.simLinks
            .filter((l) => l.label)
            .map((l) => {
              const pos = this.edgeLabelPosition(l);
              const coords = this.linkCoordinates(l);
              const edgeLength = Math.hypot(coords.x2 - coords.x1, coords.y2 - coords.y1);
              const tooLong = this.edgeLabelWidth(l.label!) > edgeLength * EDGE_LABEL_LENGTH_GATE_RATIO;
              return { x: pos.x, y: pos.y, text: l.label!, tooLong };
            })
            .filter((l) => !l.tooLong)
            .map(({ x, y, text }) => ({ x, y, text }))
        : [];
    const nodeFillDefault =
      cs.getPropertyValue('--lr-node-fill').trim() || cs.getPropertyValue('--lr-color-brand').trim();
    const nodes = this.simNodes.map((n) => {
      const fill = this.nodeFill(n);
      return {
        x: n.x ?? 0,
        y: n.y ?? 0,
        r: this.nodeRadius(n),
        shape: this.nodeShape(n),
        fill: fill ? this.resolveCssColorValue(fill, cs) : nodeFillDefault,
        selected: this.isSelected('node', n.id),
        dimmed: this.isDimmed('node', n.id),
      };
    });
    const nodeLabels = this.simNodes
      .filter((n) => n.label)
      .map((n) => ({ x: (n.x ?? 0) + this.nodeRadius(n) + 2, y: n.y ?? 0, text: n.label! }));
    const focusNode = this.focusId != null ? this.simNodes.find((n) => n.id === this.focusId) : undefined;
    const activeNode =
      this.activeGraphItem >= 0 && this.activeGraphItem < this.simNodes.length
        ? this.simNodes[this.activeGraphItem]
        : undefined;
    return {
      hulls,
      links,
      edgeLabels,
      nodes,
      nodeLabels,
      focusHalo: focusNode
        ? { x: focusNode.x ?? 0, y: focusNode.y ?? 0, r: this.nodeRadius(focusNode) + FOCUS_HALO_PADDING }
        : undefined,
      keyboardFocusRing: activeNode
        ? { x: activeNode.x ?? 0, y: activeNode.y ?? 0, r: this.nodeRadius(activeNode) + 4 }
        : undefined,
      showNodeLabels: this.canvasCamera.k >= CANVAS_NODE_LABEL_MIN_ZOOM,
      haloColor:
        cs.getPropertyValue('--lr-graph-focus-halo-color').trim() || cs.getPropertyValue('--lr-color-brand').trim(),
      selectedColor:
        cs.getPropertyValue('--lr-graph-selected-color').trim() || cs.getPropertyValue('--lr-color-success').trim(),
      dimmedOpacity: Number(cs.getPropertyValue('--lr-graph-dimmed-opacity').trim()) || 0.35,
      labelColor: cs.getPropertyValue('--lr-color-text').trim(),
      labelHaloColor:
        cs.getPropertyValue('--lr-graph-edge-label-halo').trim() || cs.getPropertyValue('--lr-color-surface').trim(),
      font: `${this.edgeLabelFontPx()}px ${cs.getPropertyValue('--lr-font').trim() || 'sans-serif'}`,
    };
  }

  /** Sizes the backing store to the canvas's own rendered CSS box (`clientWidth`/`clientHeight`,
   *  themselves stretched to fill the host via `[part="base"]`/`[part="canvas"]`'s `100%` sizing)
   *  times `devicePixelRatio`, only touching `width`/`height` when the target actually changed --
   *  reassigning either unconditionally would implicitly clear the canvas and reset its transform
   *  on every single draw, even a pure pan/zoom repaint. Mirrors `<lr-heatmap>`'s own DPR-scaled
   *  backing-store convention (`watchDpr()`/`onDprChange()`), adapted to `setTransform()` (an
   *  absolute reset) rather than a relative `scale()`, since this canvas -- unlike heatmap's, which
   *  always resizes its backing store on every draw -- only resizes conditionally. */
  private drawCanvas(): void {
    if (!this.canvasEl || !this.canvasCtx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvasEl.clientWidth || this.safeWidth;
    const h = this.canvasEl.clientHeight || this.safeHeight;
    const backingW = Math.round(w * dpr);
    const backingH = Math.round(h * dpr);
    if (this.canvasEl.width !== backingW || this.canvasEl.height !== backingH) {
      this.canvasEl.width = backingW;
      this.canvasEl.height = backingH;
    }
    const ctx = this.canvasCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // Reuse the cached scene for a camera-only repaint; rebuild when it was invalidated
    // (markCanvasDirty()) or when the camera crossed one of the two label-visibility zoom gates
    // the scene bakes in (see canvasSceneHasEdgeLabels' doc).
    const edgeLabelsVisible = this.showEdgeLabels && this.canvasCamera.k >= this.safeEdgeLabelMinZoom;
    const nodeLabelsVisible = this.canvasCamera.k >= CANVAS_NODE_LABEL_MIN_ZOOM;
    if (
      !this.canvasScene ||
      this.canvasScene.showNodeLabels !== nodeLabelsVisible ||
      this.canvasSceneHasEdgeLabels !== edgeLabelsVisible
    ) {
      this.canvasScene = this.buildCanvasScene(getComputedStyle(this));
      this.canvasSceneHasEdgeLabels = edgeLabelsVisible;
    }
    drawGraphScene(ctx, this.canvasCamera, this.canvasScene);
  }

  // ---------------------------------------------------------------------------------------------
  // renderer="canvas": color-picking hit-testing, pointer interaction, and the hover tooltip.
  // ---------------------------------------------------------------------------------------------

  private rebuildPickItems(): void {
    this.pickItems = [
      ...this.visibleCommunities().map((entry) => ({ kind: 'hull' as const, entry })),
      ...this.simLinks.map((link) => ({ kind: 'link' as const, link })),
      ...this.simNodes.map((node) => ({ kind: 'node' as const, node })),
    ];
  }

  private redrawPickCanvas(): void {
    if (!this.pickCtx || !this.canvasEl || !this.pickCanvas) return;
    if (this.pickCanvas.width !== this.canvasEl.width || this.pickCanvas.height !== this.canvasEl.height) {
      this.pickCanvas.width = this.canvasEl.width;
      this.pickCanvas.height = this.canvasEl.height;
    }
    this.rebuildPickItems();
    const dpr = window.devicePixelRatio || 1;
    this.pickCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPickingScene(this.pickCtx, this.canvasCamera, {
      hulls: this.pickItems
        .filter((i): i is Extract<(typeof this.pickItems)[number], { kind: 'hull' }> => i.kind === 'hull')
        .map((i) => ({ d: hullPathD(this.communityHull(i.entry.members)) })),
      links: this.pickItems
        .filter((i): i is Extract<(typeof this.pickItems)[number], { kind: 'link' }> => i.kind === 'link')
        .map((i) => {
          const c = this.linkCoordinates(i.link);
          return { x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, width: i.link.width ?? 1.5 };
        }),
      nodes: this.pickItems
        .filter((i): i is Extract<(typeof this.pickItems)[number], { kind: 'node' }> => i.kind === 'node')
        .map((i) => ({
          x: i.node.x ?? 0,
          y: i.node.y ?? 0,
          r: this.nodeRadius(i.node) + 2,
          shape: this.nodeShape(i.node),
        })),
    });
    this.pickDirty = false;
  }

  private hitTest(clientX: number, clientY: number): (typeof this.pickItems)[number] | undefined {
    if (!this.canvasEl || !this.pickCtx) return undefined;
    if (this.pickDirty) this.redrawPickCanvas();
    const rect = this.canvasEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round((clientX - rect.left) * dpr);
    const py = Math.round((clientY - rect.top) * dpr);
    if (px < 0 || py < 0 || px >= this.pickCtx.canvas.width || py >= this.pickCtx.canvas.height) return undefined;
    const data = this.pickCtx.getImageData(px, py, 1, 1).data;
    const index = pickColorToIndex(data[0]!, data[1]!, data[2]!);
    return index >= 0 ? this.pickItems[index] : undefined;
  }

  private bindCanvasZoom(): void {
    if (!this.d3 || !this.canvasEl) return;
    this.zoomBehavior = this.d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([this.safeMinZoom, this.safeMaxZoom])
      .on('start', () => {
        // Same self-triggered-echo guard as the svg zoom bind's own 'start' handler above (see its
        // comment) -- a camera tween's per-frame applyZoomTransform() call fires this synchronously,
        // and without the guard cancelCameraTween() here would cancel that very tween on its own
        // first frame.
        if (this.isApplyingZoomTransform) return;
        this.isPanning = true;
        this.cancelCameraTween();
      })
      .on('zoom', (event: OptionalPeerApi) => {
        this.canvasCamera = { k: event.transform.k, x: event.transform.x, y: event.transform.y };
        this.markCanvasCameraDirty();
        this.scheduleViewportChange();
      })
      .on('end', () => {
        this.isPanning = false;
      });
    this.d3.select(this.canvasEl).call(this.zoomBehavior);
  }

  private bindCanvasPointer(): void {
    const canvas = this.canvasEl!;
    canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    canvas.addEventListener('pointermove', this.onCanvasPointerMove);
    canvas.addEventListener('pointerup', this.onCanvasPointerUp);
    canvas.addEventListener('pointerleave', this.onCanvasPointerLeave);
    canvas.addEventListener('dblclick', this.onCanvasDblClick);
  }

  private onCanvasPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return; // primary button only, matching native `click`'s own semantics
    this.canvasPointerDownAt = { x: e.clientX, y: e.clientY };
    if (this.layout === 'layered') return; // drag disabled in layered mode, same as svg mode
    const hit = this.hitTest(e.clientX, e.clientY);
    if (hit?.kind === 'node') {
      this.canvasDragNode = hit.node;
      this.canvasPointerId = e.pointerId;
      this.canvasEl!.setPointerCapture(e.pointerId);
      hit.node.fx = hit.node.x;
      hit.node.fy = hit.node.y;
      this.simulation?.alphaTarget(0.3).restart();
    }
  };

  private onCanvasPointerMove = (e: PointerEvent): void => {
    if (this.canvasDragNode && this.canvasPointerId === e.pointerId) {
      const rect = this.canvasEl!.getBoundingClientRect();
      this.canvasDragNode.fx = (e.clientX - rect.left - this.canvasCamera.x) / this.canvasCamera.k;
      this.canvasDragNode.fy = (e.clientY - rect.top - this.canvasCamera.y) / this.canvasCamera.k;
      this.markCanvasDirty();
      return;
    }
    // Coalesce hover hit-testing to one per animation frame (see pendingHover's doc) -- only the
    // latest position matters, and running the readback-per-pointermove would multiply the cost
    // by however many moves the browser delivers between paints.
    this.pendingHover = { x: e.clientX, y: e.clientY };
    if (this.hoverRafId != null) return;
    this.hoverRafId = requestAnimationFrame(() => {
      this.hoverRafId = undefined;
      const pending = this.pendingHover;
      this.pendingHover = undefined;
      if (!pending) return;
      // While the force simulation is still ticking, every tick invalidates the pick canvas, so
      // resolving hover here would re-render the full offscreen picking scene once per frame on
      // top of the per-tick visible redraw -- and the result would be stale a frame later anyway,
      // since positions are still moving. Defer hover resolution until the layout settles; the
      // next pointermove after that picks it up.
      if (this.pickDirty && this.simulationIsTicking()) return;
      const hit = this.hitTest(pending.x, pending.y);
      this.updateCanvasTooltip(hit, pending.x, pending.y);
    });
  };

  /** `alpha` decays toward `alphaMin` and d3-force stops its internal timer once it crosses below
   *  it, so `alpha > alphaMin` mirrors the simulation's own running condition -- including a drag's
   *  `alphaTarget(0.3)` reheat, and correctly excluding a seeded/reduced-motion graph whose settle
   *  loop already converged synchronously. */
  private simulationIsTicking(): boolean {
    return this.simulation != null && this.simulation.alpha() > this.simulation.alphaMin();
  }

  private onCanvasPointerUp = (e: PointerEvent): void => {
    // Starting a drag on a node (onCanvasPointerDown) and ending it here without ever crossing the
    // move-distance threshold below is exactly a plain click -- release the drag state first, but
    // keep going into the same click-vs-drag distance check every pointerup goes through, instead
    // of returning early and silently swallowing the click. This mirrors svg mode, where a plain
    // click on a node fires both d3-drag's own start/end (a no-op, since fx/fy never actually
    // moved) and the browser's native `click` event -- the two aren't mutually exclusive there
    // either.
    if (this.canvasDragNode && this.canvasPointerId === e.pointerId) {
      this.simulation?.alphaTarget(0);
      this.canvasDragNode.fx = null;
      this.canvasDragNode.fy = null;
      this.canvasDragNode = undefined;
      this.canvasPointerId = undefined;
      this.markCanvasDirty();
    }
    const down = this.canvasPointerDownAt;
    this.canvasPointerDownAt = undefined;
    if (!down) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; // a pan/drag gesture, not a click
    const hit = this.hitTest(e.clientX, e.clientY);
    if (!hit) {
      this.clearSelection();
      return;
    }
    if (hit.kind === 'node') this.onNodeClick(hit.node, e);
    else if (hit.kind === 'link') this.onLinkClick(hit.link, e);
    else this.onCommunityClick(hit.entry.community);
  };

  private onCanvasPointerLeave = (): void => {
    // Drop any coalesced hover still waiting on its frame -- letting it run after the pointer
    // already left would re-show the tooltip this handler is about to hide.
    this.pendingHover = undefined;
    if (this.hoverRafId != null) {
      cancelAnimationFrame(this.hoverRafId);
      this.hoverRafId = undefined;
    }
    this.updateCanvasTooltip(undefined, 0, 0);
  };

  private onCanvasDblClick = (e: MouseEvent): void => {
    const hit = this.hitTest(e.clientX, e.clientY);
    const node = hit?.kind === 'node' ? hit.node : this.nodeAtCanvasPoint(e.clientX, e.clientY);
    if (!node) return; // background dblclick still reaches d3-zoom's own zoom-in, same as svg mode
    // d3-zoom's own default double-click-to-zoom-in handler is bound to this identical <canvas>
    // element (not an ancestor, so plain stopPropagation() -- which only blocks *bubbling*, not a
    // sibling listener on the very same target -- would not suppress it). Matches svg mode's own
    // onNodeDblClick(), which stops the equivalent bubble-phase echo on the svg one level up.
    e.stopImmediatePropagation();
    this.emit('lr-node-expand', { id: node.id });
  };

  /** Geometric fallback for dblclick: browsers can deliver the event before the offscreen pick
   * canvas has painted the latest frame, while the simulation coordinates are already current. */
  private nodeAtCanvasPoint(clientX: number, clientY: number): SimNode | undefined {
    if (!this.canvasEl) return undefined;
    const rect = this.canvasEl.getBoundingClientRect();
    const worldX = (clientX - rect.left - this.canvasCamera.x) / this.canvasCamera.k;
    const worldY = (clientY - rect.top - this.canvasCamera.y) / this.canvasCamera.k;
    let closest: SimNode | undefined;
    let closestDistance = Infinity;
    for (const node of this.simNodes) {
      const distance = Math.hypot((node.x ?? 0) - worldX, (node.y ?? 0) - worldY);
      if (distance <= this.nodeRadius(node) + 2 / this.canvasCamera.k && distance < closestDistance) {
        closest = node;
        closestDistance = distance;
      }
    }
    return closest;
  }

  private updateCanvasTooltip(hit: (typeof this.pickItems)[number] | undefined, clientX: number, clientY: number): void {
    if (!this.canvasTooltipEl) return;
    if (!hit || hit.kind === 'hull') {
      this.canvasTooltipEl.setAttribute('hidden', '');
      return;
    }
    const rect = this.canvasEl!.getBoundingClientRect();
    this.canvasTooltipEl.textContent =
      hit.kind === 'node' ? this.nodeAccessibleText(hit.node) : this.linkAccessibleText(hit.link);
    // `clientX - rect.left`/`clientY - rect.top` are physical viewport offsets, so they must be
    // written to the physical `left`/`top` -- a logical `inset-inline-start` maps to `right` under
    // RTL and would mirror the tooltip across the canvas instead of tracking the cursor.
    this.canvasTooltipEl.style.left = `${clientX - rect.left}px`;
    this.canvasTooltipEl.style.top = `${clientY - rect.top}px`;
    this.canvasTooltipEl.removeAttribute('hidden');
  }

  private isSelected(kind: 'node' | 'link', id: string): boolean {
    return kind === 'node' ? this.selectedNodeIds.includes(id) : this.selectedLinkIds.includes(id);
  }

  private isDimmed(kind: 'node' | 'link', id: string): boolean {
    return kind === 'node' ? this.dimmedNodeIds.includes(id) : this.dimmedLinkIds.includes(id);
  }

  private linkKey(link: SimLink): string {
    const source = typeof link.source === 'object' ? (link.source as SimNode).id : String(link.source);
    const target = typeof link.target === 'object' ? (link.target as SimNode).id : String(link.target);
    return link.id ?? `${source}->${target}`;
  }

  /** Computes and emits the selection intent for activating `id`; never assigns
   *  `selectedNodeIds`/`selectedLinkIds` itself -- see the class doc's controlled-selection note. */
  private emitSelectionIntent(kind: 'node' | 'link', id: string, toggle: boolean): void {
    if (this.selectionMode === 'none') return;
    const selected = this.isSelected(kind, id);
    if (this.selectionMode === 'single' || !toggle) {
      if (this.selectionMode === 'single' && selected) {
        this.emit('lr-selection-change', { nodeIds: [], linkIds: [] });
        return;
      }
      this.emit(
        'lr-selection-change',
        kind === 'node' ? { nodeIds: [id], linkIds: [] } : { nodeIds: [], linkIds: [id] },
      );
      return;
    }
    const nodeIds =
      kind === 'node'
        ? selected
          ? this.selectedNodeIds.filter((x) => x !== id)
          : [...this.selectedNodeIds, id]
        : this.selectedNodeIds;
    const linkIds =
      kind === 'link'
        ? selected
          ? this.selectedLinkIds.filter((x) => x !== id)
          : [...this.selectedLinkIds, id]
        : this.selectedLinkIds;
    this.emit('lr-selection-change', { nodeIds, linkIds });
  }

  private clearSelection(): void {
    if (this.selectionMode === 'none') return;
    if (!this.selectedNodeIds.length && !this.selectedLinkIds.length) return;
    this.emit('lr-selection-change', { nodeIds: [], linkIds: [] });
  }

  protected willUpdate(changed: PropertyValues): void {
    // rebuildSimulation() (re)assigns the simNodes/simLinks reactive
    // properties — doing that from willUpdate() folds them into the render
    // this same update is already about to perform. Doing it from updated()
    // instead would set a reactive property *after* the update completed,
    // which Lit schedules as a whole extra update pass (a dev-mode warning,
    // and pointless work).
    if (
      this.d3 &&
      (changed.has('nodes') ||
        changed.has('links') ||
        changed.has('hiddenTypes') ||
        changed.has('layout') ||
        (this.layout === 'layered' && changed.has('linkDistance')))
    ) {
      this.rebuildSimulation();
    }
    // rebuildSimulation() above always reassigns simNodes, so checking it here (after that call)
    // also catches a nodes/links/hiddenTypes-driven rebuild, not just a direct communities set.
    if (changed.has('simNodes') || changed.has('communities')) {
      this.visibleCommunitiesCache = undefined;
    }
    // Same reasoning as rebuildSimulation() above -- assigning graphLiveText from updated() would
    // schedule a whole extra update pass instead of landing in the render this update is already
    // about to perform.
    if (changed.has('selectedNodeIds') || changed.has('selectedLinkIds')) {
      this.graphLiveText = this.localize('graphSelectionCount', undefined, {
        count: this.selectedNodeIds.length + this.selectedLinkIds.length,
      });
    }
  }

  protected updated(changed: PropertyValues): void {
    if (this.loading) this.setAttribute('aria-busy', 'true');
    else this.removeAttribute('aria-busy');

    if (!this.d3) return;
    if (!changed.has('nodes') && !changed.has('links') && !changed.has('hiddenTypes')) {
      // These two branches are independent (not else-if): a consumer can set
      // width/height and chargeStrength/linkDistance in the same reactive
      // update batch, and both retunes must apply — not just whichever branch
      // happens to come first.
      if (changed.has('width') || changed.has('height')) {
        this.simulation?.force('center', this.d3.forceCenter(this.safeWidth / 2, this.safeHeight / 2));
        this.simulation?.alpha(0.1).restart();
      }
      if (changed.has('chargeStrength') || changed.has('linkDistance')) {
        // Without this branch, chargeStrength/linkDistance only took effect
        // the next time nodes/links also changed (rebuildSimulation() reads
        // them fresh) — retune the already-created force objects in place
        // instead of rebuilding the whole simulation.
        if (changed.has('chargeStrength')) this.chargeForce?.strength(this.safeChargeStrength);
        if (changed.has('linkDistance')) this.linkForce?.distance(this.safeLinkDistance);
        this.simulation?.alpha(0.3).restart();
      }
    }
    // simNodes/simLinks only ever change once per structural rebuild (see
    // rebuildSimulation()'s doc comment) — never on a tick — so gating the
    // node/link querySelectorAll scan on that is equivalent to "structurally
    // changed" without needing a separate flag.
    this.applyInteractions(changed);
    this.applyCanvasInteractions();
    if (this.focusId == null) {
      this.lastAppliedFocusId = null;
    } else if (this.focusId !== this.lastAppliedFocusId && this.simNodes.some((n) => n.id === this.focusId)) {
      this.lastAppliedFocusId = this.focusId;
      void this.focusNode(this.focusId);
    }
    this.updateFocusHalo();
  }

  /** Suppresses hover events/`data-hovered` while a node drag is in progress (tracked from the
   *  existing d3-drag `.on('start')`/`.on('end')` handlers in `applyInteractions()`) — a drag
   *  crossing over other nodes/links would otherwise spam enter/leave pairs unrelated to genuine
   *  pointer hovering. */
  private isDragging = false;
  /** Same purpose as `isDragging`, for d3-zoom pan/zoom gestures (tracked from `applyInteractions()`'s
   *  zoom `.on('start')`/`.on('end')` handlers, added by this same change). */
  private isPanning = false;

  /**
   * Imperatively wires up d3-zoom (pan/zoom on the `<svg>`) and d3-drag
   * (per-node drag) against the just-rendered DOM. The zoom bind itself is a
   * one-time guard (`zoomedEl`) — but the bound `zoomBehavior`'s
   * `scaleExtent` is re-read from `minZoom`/`maxZoom` on every call so a
   * post-mount change to either still takes effect. The node-drag bind +
   * node/link/label element caching for `onTick()` only run when
   * `changed` indicates a fresh structural render just happened, not on
   * every call — otherwise this would re-scan the DOM via
   * `querySelectorAll` on every Lit update, which used to include every
   * single simulation tick. `<circle>`s already bound are skipped
   * (`boundNodeEls`) — a WeakSet reset on every `rebuildSimulation()` so DOM
   * nodes Lit reuses across a rebuild get rebound against their new datum
   * instead of a stale one. The zoom handler writes the resulting transform
   * straight to the cached `gEl` (bound once alongside `zoomedEl`, since the
   * outer `<g>` is a static part of the template and never recreated by Lit)
   * instead of assigning a Lit reactive property — panning/zooming fires
   * continuously while dragging, and reassigning a `@state()` there would
   * force a full re-render (recomputing every node/link template) on every
   * single event, the same class of cost `onTick()` already avoids for ticks.
   */
  private applyInteractions(changed: PropertyValues): void {
    if (!this.d3) return;
    if (this.renderer !== 'svg') return;

    const svgEl = this.renderRoot.querySelector('svg');
    if (svgEl && svgEl !== this.zoomedEl) {
      // Binding a fresh svg means any previous renderer="canvas" surface is gone -- stop its
      // resize watcher now (it observes the host, not the removed <canvas>, so it would keep
      // firing markCanvasDirty() for as long as the element lives in svg mode).
      this.canvasResizeObserver?.disconnect();
      this.canvasResizeObserver = undefined;
      this.zoomedEl = svgEl;
      this.gEl = this.renderRoot.querySelector('g') ?? undefined;
      this.focusHaloEl = (this.renderRoot.querySelector('[part="focus-halo"]') as SVGCircleElement) ?? undefined;
      this.zoomBehavior = this.d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([this.safeMinZoom, this.safeMaxZoom])
        .on('start', () => {
          // A camera tween writes a transform on every frame via applyZoomTransform(), which
          // itself synchronously replays this same 'start' handler -- ignore that self-triggered
          // echo so a tween doesn't cancel itself on its own first frame.
          if (this.isApplyingZoomTransform) return;
          this.isPanning = true;
          this.cancelCameraTween();
        })
        .on('zoom', (event: OptionalPeerApi) => {
          this.gEl?.setAttribute('transform', event.transform.toString());
          this.updateEdgeLabelZoomGate(event.transform.k);
          this.scheduleViewportChange();
        })
        .on('end', () => {
          this.isPanning = false;
        });
      this.d3.select(svgEl).call(this.zoomBehavior);
      // `.call(zoomBehavior)` does not synchronously fire the 'zoom' handler above (only a real
      // user gesture or an explicit `.transform()` call does, and nothing in this component ever
      // calls `.transform()`) -- so the initial transform right here is always d3-zoom's own
      // identity transform, k=1. Apply the edge-label zoom gate against that known value now, or
      // it stays unset (edge labels wrongly visible) until the user's first pan/zoom, regardless
      // of what edgeLabelMinZoom actually is.
      this.updateEdgeLabelZoomGate(1);
    } else if (this.zoomBehavior && (changed.has('minZoom') || changed.has('maxZoom'))) {
      this.zoomBehavior.scaleExtent([this.safeMinZoom, this.safeMaxZoom]);
    }

    if (
      !(
        changed.has('simNodes') ||
        changed.has('simLinks') ||
        changed.has('nodeTypes') ||
        changed.has('showEdgeLabels') ||
        changed.has('communities')
      )
    )
      return;

    const nodeEls = Array.from(this.renderRoot.querySelectorAll('[part="node"]')) as SVGElement[];
    this.nodeEls = nodeEls;
    this.nodeLabelEls = nodeEls.map(
      (el) => (el.parentElement?.querySelector('[part="label"]') as SVGTextElement | null) ?? null,
    );
    this.expandIndicatorEls = nodeEls.map(
      (el) => (el.parentElement?.querySelector('[part="expand-indicator"]') as SVGGElement | null) ?? null,
    );
    // Dangling stubs also carry part="link" (so they inherit the same themeable styling as a
    // real edge) -- excluded here explicitly so `linkEls` stays index-aligned with `simLinks`
    // rather than relying on stubs always sorting after real links in template/DOM order.
    this.linkEls = Array.from(this.renderRoot.querySelectorAll('[part="link"]:not([data-dangling])')) as SVGLineElement[];
    this.linkLabelEls = this.linkEls.map(
      (el) => (el.parentElement?.querySelector('[part="link-label"]') as SVGTextElement | null) ?? null,
    );
    this.linkLabelHiddenByLength = [];
    this.danglingLinkEls = Array.from(this.renderRoot.querySelectorAll('[part="link"][data-dangling]')) as SVGLineElement[];
    this.communityHullEls = Array.from(this.renderRoot.querySelectorAll('[part="hull"]')) as SVGPathElement[];
    this.communityLabelEls = Array.from(
      this.renderRoot.querySelectorAll('[part="community-label"]'),
    ) as SVGTextElement[];

    if (this.layout !== 'layered') {
      nodeEls.forEach((el, i) => {
        if (this.boundNodeEls.has(el)) return;
        const n = this.simNodes[i];
        if (!n) return;
        this.boundNodeEls.add(el);
        this.d3!.select<Element, SimNode>(el).call(
          this.d3!.drag<Element, SimNode>()
            .on('start', (event: OptionalPeerApi) => {
              this.isDragging = true;
              // Keep a node drag from also triggering the svg's own pan gesture.
              (event.sourceEvent as Event | undefined)?.stopPropagation();
              if (!event.active) this.simulation?.alphaTarget(0.3).restart();
              n.fx = n.x;
              n.fy = n.y;
            })
            .on('drag', (event: OptionalPeerApi) => {
              n.fx = event.x;
              n.fy = event.y;
            })
            .on('end', (event: OptionalPeerApi) => {
              this.isDragging = false;
              if (!event.active) this.simulation?.alphaTarget(0);
              n.fx = null;
              n.fy = null;
            }),
        );
      });
    }
  }

  /** The `renderer="canvas"` twin of `applyInteractions()`'s svg zoom-bind branch -- binds d3-zoom
   *  and the pointer/hit-testing handlers to the just-rendered `<canvas>` once (guarded by the same
   *  `zoomedEl` field `applyInteractions()` uses, so `focusNode()`/`fit()`/`tweenCamera()` keep
   *  working unmodified against whichever element -- svg or canvas -- is currently bound), then
   *  marks the canvas dirty on every call so any structural/style-affecting change (new nodes/
   *  links, a selection change, a hiddenTypes toggle, ...) schedules a fresh draw the same way a
   *  Lit re-render already does for svg mode. */
  private applyCanvasInteractions(): void {
    if (this.renderer !== 'canvas' || !this.canvasEl) return;
    if (this.canvasEl !== this.zoomedEl) {
      this.zoomedEl = this.canvasEl;
      this.setUpCanvasSurface();
    }
    this.markCanvasDirty();
  }

  /**
   * Runs on every d3-force simulation tick (up to ~300 while a graph settles
   * on load, continuously while a node is being dragged via
   * `alphaTarget(0.3)`). Writes positions straight to the already-rendered
   * DOM via `setAttribute()` instead of reassigning the reactive
   * `simNodes`/`simLinks` properties, which would force a full Lit re-render
   * (and, before the structural-render gate in `applyInteractions()`, an
   * unconditional `querySelectorAll` scan) on every single frame. Writing attributes
   * directly (rather than wrapping each element in a d3 selection just to
   * call `.attr()`) avoids allocating a throwaway Selection per element on
   * this component's highest-frequency code path.
   */
  private onTick(): void {
    for (const l of this.danglingLinks) {
      const source = l.source as SimNode;
      const target = l.target as SimNode;
      target.x = (source.x ?? 0) + STUB_OFFSET_PX;
      target.y = (source.y ?? 0) + STUB_OFFSET_PX;
    }
    // Keep the remembered-position cache current with a position captured mid-settle or mid-drag
    // (not just the one snapshotted at the end of rebuildSimulation()) -- a hiddenTypes toggle
    // that lands before the next structural rebuild should still restore a node to where it
    // actually was, not an earlier, since-superseded snapshot. Plain Map writes, no DOM/no
    // reactive-property touch, so this stays on the same cheap per-tick path as the rest of this
    // method.
    for (const n of this.simNodes) {
      if (n.x != null && n.y != null) this.lastPositionById.set(n.id, { x: n.x, y: n.y });
    }
    this.simNodes.forEach((n, i) => {
      const el = this.nodeEls[i];
      if (el) {
        if (el.tagName === 'circle') {
          el.setAttribute('cx', String(n.x ?? 0));
          el.setAttribute('cy', String(n.y ?? 0));
        } else {
          el.setAttribute('transform', `translate(${n.x ?? 0},${n.y ?? 0})`);
        }
      }
      const label = this.nodeLabelEls[i];
      if (label) {
        label.setAttribute('x', String((n.x ?? 0) + this.nodeRadius(n) + 2));
        label.setAttribute('y', String(n.y ?? 0));
      }
    });
    this.simLinks.forEach((l, i) => {
      const line = this.linkEls[i];
      if (!line) return;
      const coordinates = this.linkCoordinates(l);
      line.setAttribute('x1', String(coordinates.x1));
      line.setAttribute('y1', String(coordinates.y1));
      line.setAttribute('x2', String(coordinates.x2));
      line.setAttribute('y2', String(coordinates.y2));
    });
    if (this.showEdgeLabels) {
      this.simLinks.forEach((l, i) => {
        const labelEl = this.linkLabelEls[i];
        if (!labelEl) return;
        const pos = this.edgeLabelPosition(l);
        labelEl.setAttribute('x', String(pos.x));
        labelEl.setAttribute('y', String(pos.y));
        const { x1, y1, x2, y2 } = this.linkCoordinates(l);
        const edgeLength = Math.hypot(x2 - x1, y2 - y1);
        const tooLong = this.edgeLabelWidth(l.label ?? '') > edgeLength * EDGE_LABEL_LENGTH_GATE_RATIO;
        if (this.linkLabelHiddenByLength[i] !== tooLong) {
          this.linkLabelHiddenByLength[i] = tooLong;
          labelEl.setAttribute('visibility', tooLong ? 'hidden' : 'visible');
        }
      });
    }
    this.simNodes.forEach((n, i) => {
      const indicator = this.expandIndicatorEls[i];
      if (indicator) indicator.setAttribute('transform', `translate(${n.x ?? 0},${n.y ?? 0})`);
    });
    // Dangling stubs are excluded from d3-force's own simulation input (see
    // rebuildSimulation()'s "stubs never enter d3-force's own simulation input"), so the
    // synthetic target position the danglingLinks loop at the top of this method just
    // recomputed is never picked up by the simLinks loop above -- write it here the same way,
    // or a stub stays frozen at its pre-settle position while the source node it hangs off
    // keeps moving.
    this.danglingLinks.forEach((l, i) => {
      const line = this.danglingLinkEls[i];
      if (!line) return;
      const coordinates = this.linkCoordinates(l);
      line.setAttribute('x1', String(coordinates.x1));
      line.setAttribute('y1', String(coordinates.y1));
      line.setAttribute('x2', String(coordinates.x2));
      line.setAttribute('y2', String(coordinates.y2));
    });
    this.updateFocusHalo();
    this.visibleCommunities().forEach((entry, i) => {
      const hullEl = this.communityHullEls[i];
      const labelEl = this.communityLabelEls[i];
      if (!hullEl && !labelEl) return;
      const hull = this.communityHull(entry.members);
      if (hullEl) hullEl.setAttribute('d', hullPathD(hull));
      if (labelEl) {
        labelEl.setAttribute('x', String(hullCentroidX(hull)));
        labelEl.setAttribute('y', String(hullTopY(hull) - HULL_PADDING));
      }
    });
    // renderer="canvas" mode has no DOM to write positions straight to (everything above this line
    // no-ops there: nodeEls/linkEls/etc. are only ever populated by applyInteractions()'s svg-only
    // branch) -- schedule a fresh draw off the same simulation tick instead, so the settle
    // animation and a live node drag actually repaint the canvas rather than freezing at whatever
    // was last drawn on mount.
    if (this.renderer === 'canvas') this.markCanvasDirty();
    // A settling/dragged simulation moves rendered node screen positions the same way a pan/zoom
    // does, even with the camera transform unchanged -- see `lr-viewport-change`'s class doc.
    this.scheduleViewportChange();
  }

  private rebuildSimulation(): void {
    if (!this.d3) return;
    this.simulation?.stop();
    this.boundNodeEls = new WeakSet();

    // Prune remembered positions for ids no longer present in `this.nodes` at all (not merely
    // hidden by hiddenTypes) -- otherwise this cache would grow forever across a long-lived,
    // mutating graph instead of tracking only ids that could plausibly reappear.
    const liveIds = new Set(this.nodes.map((n) => n.id));
    for (const id of this.lastPositionById.keys()) {
      if (!liveIds.has(id)) this.lastPositionById.delete(id);
    }

    // Carry over each existing SimNode's settled position/velocity (and any
    // in-progress drag fx/fy) by id instead of starting every node fresh —
    // otherwise any structural nodes/links change (e.g. appending one new
    // node to a live/streaming graph) would discard every already-settled
    // node's (x, y) and restart the whole force layout's ~300-tick random-
    // start settle animation from scratch. Only nodes with no previous
    // counterpart (genuinely new ids) get forceSimulation()'s default
    // fresh random start below.
    const visible = this.visibleNodes();

    if (this.layout === 'layered') {
      this.rebuildLayeredLayout(visible);
      return;
    }

    const prevById = new Map(this.simNodes.map((n) => [n.id, n]));
    const nodes: SimNode[] = visible.map((n) => {
      const prev = prevById.get(n.id);
      if (prev) return { ...prev, ...n };
      // A node hidden by hiddenTypes and now visible again has no prevById entry (it fell out of
      // simNodes while hidden) but may still have a remembered settled position from before it was
      // hidden -- restore that instead of leaving it for the neighbor-jitter/seed spawn logic below,
      // or forceSimulation()'s own random start, to place it as if it were a brand-new node.
      const remembered = this.lastPositionById.get(n.id);
      return remembered ? { ...n, x: remembered.x, y: remembered.y } : { ...n };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const { resolved: resolvedLinks, dangling: danglingLinks } = this.resolveLinksAgainst(byId);
    const links = resolvedLinks; // stubs never enter d3-force's own simulation input
    this.danglingLinks = danglingLinks;

    const seedForSpawn = this.safeSeed;

    // Give a brand-new node with no carried-over position (from prevById above) a spawn point
    // near an already-positioned neighbor instead of forceSimulation()'s eventual random start --
    // expanded neighborhoods bloom around their origin instead of flying in from nowhere. Only
    // touches nodes with no position yet, so it can't move anything already settled.
    for (const n of nodes) {
      if (n.x != null && n.y != null) continue;
      const neighborLink = resolvedLinks.find((l) => {
        const source = l.source as SimNode;
        const target = l.target as SimNode;
        return (source.id === n.id && target.x != null) || (target.id === n.id && source.x != null);
      });
      if (!neighborLink) continue;
      const source = neighborLink.source as SimNode;
      const target = neighborLink.target as SimNode;
      const neighbor = source.id === n.id ? target : source;
      const jitterRadius = this.safeLinkDistance / 2;
      const angle =
        seedForSpawn != null
          ? (hashNodeSeed(seedForSpawn, n.id) / 4294967296) * Math.PI * 2
          : Math.random() * Math.PI * 2;
      n.x = (neighbor.x ?? 0) + Math.cos(angle) * jitterRadius;
      n.y = (neighbor.y ?? 0) + Math.sin(angle) * jitterRadius;
    }

    // Give any remaining brand-new nodes (no carried-over position from prevById above, and no
    // already-positioned neighbor for the jitter spawn above to anchor to) a deterministic
    // starting x/y, keyed by node id, instead of leaving them for forceSimulation() below to
    // randomize. Nodes that already have a position are left untouched — same "only randomize
    // nodes without x/y" rule forceSimulation() itself follows — so an incremental update to a
    // seeded, already-settled graph doesn't reshuffle existing nodes.
    if (seedForSpawn != null) {
      for (const n of nodes) {
        if (n.x != null && n.y != null) continue;
        const rng = mulberry32(hashNodeSeed(seedForSpawn, n.id));
        n.x = rng() * this.safeWidth;
        n.y = rng() * this.safeHeight;
      }
    }

    this.linkForce = this.d3.forceLink<SimNode, SimLink>(links).distance(this.safeLinkDistance);
    this.chargeForce = this.d3.forceManyBody<SimNode>().strength(this.safeChargeStrength);

    const simulation = this.d3
      .forceSimulation(nodes)
      .force('link', this.linkForce)
      .force('charge', this.chargeForce)
      .force('center', this.d3.forceCenter(this.safeWidth / 2, this.safeHeight / 2))
      .force(
        'collide',
        this.d3.forceCollide<SimNode>().radius((n: SimNode) => this.nodeRadius(n) + 10),
      )
      .on('tick', () => this.onTick());
    this.simulation = simulation;

    if (prefersReducedMotion() || this.safeSeed != null) {
      // Pin every node that already had a known position before this rebuild -- either carried
      // over directly (fx/fy, the same mechanism a user drag uses) or restored from
      // lastPositionById after being hidden by hiddenTypes -- so introducing a new node/link can't
      // visibly reposition it during this synchronous settle. Only a genuinely new node (no prior
      // counterpart in either source) is free to move while the simulation converges. A node whose
      // fx/fy was already set (an active user drag concurrent with this rebuild) is left alone
      // entirely -- both the pin and the later release below only apply to a node this loop itself
      // pinned, so a real in-progress drag's own fx/fy is never clobbered. Everything this loop
      // does pin gets released again immediately below, so this has no lasting effect on a later
      // user-initiated drag, nor on the live, async settle a non-seeded/non-reduced-motion graph
      // still animates over ~300 frames.
      const pinnedForSettle = new Set<string>();
      for (const n of nodes) {
        const hadKnownPosition = prevById.has(n.id) || this.lastPositionById.has(n.id);
        if (hadKnownPosition && n.x != null && n.y != null && n.fx == null && n.fy == null) {
          n.fx = n.x;
          n.fy = n.y;
          pinnedForSettle.add(n.id);
        }
      }
      // Converge synchronously instead of animating the settle over ~300
      // rendered frames — the simulation is already stopped (alpha at
      // alphaMin) by the time the DOM for this rebuild is first painted.
      // A seed converging synchronously (not just deterministically-seeded)
      // is what makes its end state reproducible: two runs must agree on the
      // exact same number of ticks, not merely start from the same x/y.
      // User-initiated motion (dragging a node) is unaffected.
      simulation.stop();
      while (simulation.alpha() > simulation.alphaMin()) simulation.tick();
      for (const n of nodes) {
        if (pinnedForSettle.has(n.id)) {
          n.fx = null;
          n.fy = null;
        }
      }
    }

    // Assign these SAME array/object references (not copies) exactly once
    // for this structural rebuild: forceSimulation(nodes) above already
    // initialized their .x/.y synchronously, so this one Lit re-render
    // creates the initial DOM with correct starting positions. Every
    // subsequent tick mutates these same node/link objects in place and
    // calls onTick() to write positions straight to the DOM — reassigning
    // simNodes/simLinks on every tick (as before) would force a full Lit
    // re-render up to ~300 times on load and continuously while dragging.
    this.simNodes = nodes;
    this.simLinks = links;

    for (const n of nodes) {
      if (n.x != null && n.y != null) this.lastPositionById.set(n.id, { x: n.x, y: n.y });
    }

    this.announceHiddenNodeCount(nodes.length);
  }

  /** Announces the current hidden-node count via the live region -- shared by both the force and
   *  layered rebuild paths (each calls this with its own final visible-node count) so `hiddenTypes`
   *  filtering announces identically regardless of `layout`. Called from right here (not from
   *  willUpdate()/updated() gated on a 'hiddenTypes'/'nodes' PropertyValues diff) because
   *  rebuildSimulation() itself is also invoked directly from connectedCallback() once the lazy d3
   *  peer deps resolve -- a call that never goes through Lit's changed-property diffing at all.
   *  Computing it there instead would miss that path entirely: a graph mounted with hiddenTypes
   *  already set would compute this from a still-empty simNodes (0 settled nodes yet) on the
   *  property-driven pass, then never get a chance to correct it once the real simNodes became
   *  available. Only ever touches graphLiveText when there's something to say -- a node is
   *  currently hidden, or one just stopped being hidden -- so a consumer that never sets
   *  hiddenTypes keeps today's exact live-region output. */
  private announceHiddenNodeCount(visibleNodeCount: number): void {
    const totalNodeCount = this.nodes.length;
    const hiddenNodeCount = totalNodeCount - visibleNodeCount;
    if (totalNodeCount > 0 && (hiddenNodeCount > 0 || this.lastHiddenNodeCount > 0)) {
      this.graphLiveText = this.localize('graphNodesHidden', undefined, {
        hidden: hiddenNodeCount,
        total: totalNodeCount,
      });
    }
    this.lastHiddenNodeCount = hiddenNodeCount;
  }

  /** The `layout="layered"` path: computes final positions synchronously via the shared
   *  `layeredLayout()` util (2r x 2r boxes, `gapY = linkDistance`, `gapX = 12`), centers the
   *  drawing in `width` x `height`, and skips forceSimulation() entirely -- no `this.simulation`,
   *  no ticking, no `prevById` carry-over (deterministic input -> output makes it unnecessary; a
   *  structural change simply recomputes wholesale). `lr-graph` never passes `fixedPositions`. */
  private rebuildLayeredLayout(visible: GraphNode[]): void {
    const boxes = visible.map((n) => {
      const r = this.nodeRadius(n);
      return { id: n.id, width: r * 2, height: r * 2 };
    });
    const visibleIds = new Set(visible.map((n) => n.id));
    const edges = this.links
      .filter((l) => visibleIds.has(l.source) && visibleIds.has(l.target))
      .map((l) => ({ source: l.source, target: l.target }));
    const raw = layeredLayout({ nodes: boxes, edges, options: { gapX: 12, gapY: this.safeLinkDistance } });

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of raw.values()) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const offsetX = raw.size ? this.safeWidth / 2 - (minX + (maxX - minX) / 2) : this.safeWidth / 2;
    const offsetY = raw.size ? this.safeHeight / 2 - (minY + (maxY - minY) / 2) : this.safeHeight / 2;

    const nodes: SimNode[] = visible.map((n) => {
      const p = raw.get(n.id);
      return { ...n, x: (p?.x ?? this.safeWidth / 2) + offsetX, y: (p?.y ?? this.safeHeight / 2) + offsetY };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const { resolved, dangling } = this.resolveLinksAgainst(byId);
    this.danglingLinks = dangling;
    this.simulation = undefined;
    this.simNodes = nodes;
    this.simLinks = resolved;
    for (const n of nodes) {
      if (n.x != null && n.y != null) this.lastPositionById.set(n.id, { x: n.x, y: n.y });
    }
    this.announceHiddenNodeCount(nodes.length);
  }

  private onNodeClick(node: SimNode, e?: MouseEvent | KeyboardEvent): void {
    this.emit('lr-node-click', { id: node.id, x: node.x ?? 0, y: node.y ?? 0 });
    this.emitSelectionIntent('node', node.id, !!(e?.ctrlKey || e?.metaKey));
  }

  /** Returns a node's current position in the graph's local drawing space. */
  getNodePosition(id: string): { x: number; y: number } | undefined {
    const node = this.simNodes.find((candidate) => candidate.id === id);
    if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return undefined;
    return { x: node.x!, y: node.y! };
  }

  private onLinkClick(link: SimLink, e?: MouseEvent | KeyboardEvent): void {
    const source = typeof link.source === 'object' ? (link.source as SimNode).id : String(link.source);
    const target = typeof link.target === 'object' ? (link.target as SimNode).id : String(link.target);
    this.emit('lr-link-click', { source, target, ...(link.id ? { id: link.id } : {}) });
    this.emitSelectionIntent('link', this.linkKey(link), !!(e?.ctrlKey || e?.metaKey));
  }

  private onNodeEnter(node: SimNode, e: MouseEvent): void {
    if (this.isDragging || this.isPanning || this.isCameraTweening) return;
    (e.currentTarget as SVGElement).setAttribute('data-hovered', '');
    this.emit('lr-node-enter', { id: node.id });
  }

  private onNodeLeave(node: SimNode, e: MouseEvent): void {
    if (this.isDragging || this.isPanning || this.isCameraTweening) return;
    (e.currentTarget as SVGElement).removeAttribute('data-hovered');
    this.emit('lr-node-leave', { id: node.id });
  }

  private onNodeDblClick(node: SimNode, e: MouseEvent): void {
    // Stops the dblclick from also reaching the svg's own d3-zoom double-click-to-zoom-in
    // listener -- background double-click (not on a node) keeps that default behavior.
    e.stopPropagation();
    this.emit('lr-node-expand', { id: node.id });
  }

  private onLinkEnter(link: SimLink, e: MouseEvent): void {
    if (this.isDragging || this.isPanning || this.isCameraTweening) return;
    (e.currentTarget as SVGElement).setAttribute('data-hovered', '');
    const source = typeof link.source === 'object' ? (link.source as SimNode).id : String(link.source);
    const target = typeof link.target === 'object' ? (link.target as SimNode).id : String(link.target);
    this.emit('lr-link-enter', { source, target, ...(link.id ? { id: link.id } : {}) });
  }

  private onLinkLeave(link: SimLink, e: MouseEvent): void {
    if (this.isDragging || this.isPanning || this.isCameraTweening) return;
    (e.currentTarget as SVGElement).removeAttribute('data-hovered');
    const source = typeof link.source === 'object' ? (link.source as SimNode).id : String(link.source);
    const target = typeof link.target === 'object' ? (link.target as SimNode).id : String(link.target);
    this.emit('lr-link-leave', { source, target, ...(link.id ? { id: link.id } : {}) });
  }

  private nodeAccessibleText(node: GraphNode): string {
    let text = node.accessibleLabel || node.label || node.id;
    const type = this.resolveNodeType(node);
    if (type) text = this.localize('graphTypedNode', undefined, { label: text, type: type.label });
    if (node.expandable) text = this.localize('graphExpandableItem', undefined, { item: text });
    return text;
  }

  private linkAccessibleText(link: SimLink): string {
    if (link.accessibleLabel) return link.accessibleLabel;
    const source =
      typeof link.source === 'object'
        ? this.nodeAccessibleText(link.source as SimNode)
        : String(link.source);
    const target =
      typeof link.target === 'object'
        ? this.nodeAccessibleText(link.target as SimNode)
        : String(link.target);
    return link.label || this.localize('graphLink', undefined, { source, target });
  }

  private linkCoordinates(link: SimLink): { x1: number; y1: number; x2: number; y2: number } {
    const source = link.source as SimNode;
    const target = link.target as SimNode;
    const x1 = source.x ?? 0;
    const y1 = source.y ?? 0;
    const targetX = target.x ?? 0;
    const targetY = target.y ?? 0;
    if (!link.directed || link.dangling) return { x1, y1, x2: targetX, y2: targetY };
    const dx = targetX - x1;
    const dy = targetY - y1;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return { x1, y1, x2: targetX, y2: targetY };
    const inset = Math.min(this.nodeRadius(target), distance);
    return {
      x1,
      y1,
      x2: targetX - (dx / distance) * inset,
      y2: targetY - (dy / distance) * inset,
    };
  }

  /** World-space midpoint of a link, offset EDGE_LABEL_OFFSET_PX perpendicular to the segment
   *  (horizontal, unrotated text — rotated edge-label text is a readability and RTL hazard). */
  private edgeLabelPosition(link: SimLink): { x: number; y: number } {
    const { x1, y1, x2, y2 } = this.linkCoordinates(link);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    if (len === 0) return { x: mx, y: my };
    return {
      x: mx + (-dy / len) * EDGE_LABEL_OFFSET_PX,
      y: my + (dx / len) * EDGE_LABEL_OFFSET_PX,
    };
  }

  private edgeLabelFontPx(): number {
    const raw = getComputedStyle(this).getPropertyValue('--lr-font-size-2xs').trim();
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed)) return 10;
    // rem tokens are resolved relative to the root font-size; this is a decluttering heuristic,
    // not a pixel-perfect layout, so the standard 16px/rem approximation is sufficient.
    return raw.endsWith('rem') ? parsed * 16 : parsed;
  }

  private edgeLabelWidth(text: string): number {
    const cached = this.edgeLabelWidthCache.get(text);
    if (cached != null) return cached;
    const ctx = getScratchCtx();
    let width: number;
    if (ctx) {
      const fontFamily = getComputedStyle(this).getPropertyValue('--lr-font').trim() || 'sans-serif';
      ctx.font = `${this.edgeLabelFontPx()}px ${fontFamily}`;
      width = ctx.measureText(text).width;
    } else {
      width = text.length * this.edgeLabelFontPx() * 0.6;
    }
    // Bound the cache under label churn (a streaming graph can cycle through unbounded distinct
    // label texts) -- Map iteration yields insertion order, so evicting the first key drops the
    // oldest-measured entry.
    if (this.edgeLabelWidthCache.size >= EDGE_LABEL_WIDTH_CACHE_MAX) {
      const oldest = this.edgeLabelWidthCache.keys().next().value;
      if (oldest !== undefined) this.edgeLabelWidthCache.delete(oldest);
    }
    this.edgeLabelWidthCache.set(text, width);
    return width;
  }

  /** Toggles `data-edge-labels-hidden` on the cached zoomed `<g>` when crossing `edgeLabelMinZoom`
   *  -- called from the d3-zoom `'zoom'` handler (render-free, CSS hides `[part="link-label"]`
   *  beneath the attribute) so this scales with every pan/zoom event without a Lit re-render. */
  private updateEdgeLabelZoomGate(k: number): void {
    if (!this.gEl) return;
    if (k < this.safeEdgeLabelMinZoom) this.gEl.setAttribute('data-edge-labels-hidden', '');
    else this.gEl.removeAttribute('data-edge-labels-hidden');
  }

  private graphItemCount(): number {
    return this.simNodes.length + this.simLinks.length + this.visibleCommunities().length;
  }

  private normalizedGraphItem(index = this.activeGraphItem): number {
    const count = this.graphItemCount();
    return count ? Math.min(Math.max(index, 0), count - 1) : -1;
  }

  private graphItemText(index: number): string {
    if (index < this.simNodes.length) {
      const node = this.simNodes[index];
      return node ? this.localize('graphNode', undefined, { label: this.nodeAccessibleText(node) }) : '';
    }
    const linkIndex = index - this.simNodes.length;
    if (linkIndex < this.simLinks.length) {
      const link = this.simLinks[linkIndex];
      return link ? this.linkAccessibleText(link) : '';
    }
    const hullIndex = linkIndex - this.simLinks.length;
    const entry = this.visibleCommunities()[hullIndex];
    return entry
      ? this.localize('graphCommunity', undefined, {
          label: entry.community.label ?? entry.community.id,
          count: entry.members.length,
        })
      : '';
  }

  private graphItemAnnouncement(index: number): string {
    return this.localize('graphItemAnnouncement', undefined, {
      item: this.graphItemText(index),
      index: index + 1,
      total: this.graphItemCount(),
    });
  }

  private onGraphItemFocus(index: number): void {
    if (this.normalizedGraphItem(index) < 0) return;
    this.activeGraphItem = index;
    this.graphLiveText = this.graphItemAnnouncement(index);
  }

  private focusGraphItem(index: number): void {
    const normalized = this.normalizedGraphItem(index);
    if (normalized < 0) return;
    this.activeGraphItem = normalized;
    this.graphLiveText = this.graphItemAnnouncement(normalized);
    void this.updateComplete.then(() => {
      // renderer="canvas" has no [part="node"]/[part="link"]/[part="hull"] elements at all -- the
      // roving tab stop lives on the offscreen [part="cursor-item"] buttons instead (see render()),
      // in the same flat nodes-then-links-then-hulls order.
      const items = (
        this.renderer === 'canvas'
          ? Array.from(this.renderRoot.querySelectorAll('[part="cursor-item"]'))
          : [
              ...Array.from(this.renderRoot.querySelectorAll('[part="node"]')),
              ...Array.from(this.renderRoot.querySelectorAll('[part="link"]')),
              ...Array.from(this.renderRoot.querySelectorAll('[part="hull"]')),
            ]
      ) as HTMLElement[];
      items[normalized]?.focus();
    });
  }

  /**
   * The forward physical arrow key (`ArrowRight` in LTR, `ArrowLeft` under
   * `dir="rtl"` — see `isRtl()`) moves to the next roving-tabindex item, the
   * backward one to the previous, in flat array order (`simNodes` then
   * `simLinks`) — the same `forwardKey`/`backwardKey` swap this library's
   * other "physical arrow key drives sequential previous/next" components
   * (`<lr-tabs>`, `<lr-slider>`, `<lr-segmented>`) apply under RTL.
   * `ArrowDown`/`ArrowUp` always mean next/previous regardless of direction.
   */
  private onGraphKeyDown(e: KeyboardEvent, index: number, activate: (e: KeyboardEvent) => void): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.onGraphItemFocus(index);
      activate(e);
      if (index < this.simNodes.length) {
        const now = performance.now();
        if (this.lastKeyActivateIndex === index && now - this.lastKeyActivateTime <= EXPAND_KEY_INTERVAL_MS) {
          const node = this.simNodes[index];
          if (node) this.emit('lr-node-expand', { id: node.id });
          this.lastKeyActivateIndex = null;
        } else {
          this.lastKeyActivateIndex = index;
          this.lastKeyActivateTime = now;
        }
      }
      return;
    }
    const count = this.graphItemCount();
    if (!count) return;
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = index;
    if (e.key === forwardKey || e.key === 'ArrowDown') next = Math.min(count - 1, index + 1);
    else if (e.key === backwardKey || e.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    else return;
    e.preventDefault();
    this.focusGraphItem(next);
  }

  render(): TemplateResult {
    if (this.loading) {
      return html`
        <div part="base">
          <lr-skeleton
            variant="rect"
            style=${`--lr-skeleton-w:${this.safeWidth}px;--lr-skeleton-h:${this.safeHeight}px`}
          ></lr-skeleton>
        </div>
      `;
    }
    if (!this.nodes.length) {
      return html`<div part="base"><div part="empty">${this.localize('noData')}</div></div>`;
    }
    if (this.renderer === 'canvas') {
      return html`
        <div part="base">
          <canvas
            part="canvas"
            role="group"
            aria-label=${this.accessibleLabel ||
            this.localize('graphDiagram', undefined, {
              nodeCount: this.simNodes.length,
              linkCount: this.simLinks.length,
            })}
            tabindex=${this.graphItemCount() ? '-1' : '0'}
          ></canvas>
          <div part="tooltip" hidden></div>
          <div part="live-region" class="sr-only" role="status" aria-live="polite" aria-atomic="true">
            ${this.graphLiveText ||
            (this.normalizedGraphItem() >= 0 ? this.graphItemAnnouncement(this.normalizedGraphItem()) : '')}
          </div>
          <ul part="data-list" class="sr-only" aria-label=${this.localize('graphDataList')}>
            ${this.simNodes.map(
              (node) => html`<li>${this.localize('graphNode', undefined, { label: this.nodeAccessibleText(node) })}</li>`,
            )}
            ${this.simLinks.map((link) => html`<li>${this.linkAccessibleText(link)}</li>`)}
            ${this.visibleCommunities().map(
              (entry) =>
                html`<li>${this.localize('graphCommunity', undefined, {
                  label: entry.community.label ?? entry.community.id,
                  count: entry.members.length,
                })}</li>`,
            )}
          </ul>
          <div
            part="cursor-items"
            class="sr-only"
            @keydown=${(e: KeyboardEvent) => {
              // Escape-clears-selection lives here (not on the canvas itself) because keydown from
              // a focused cursor-item bubbles up through this container, never through the canvas
              // -- the cursor-items list is canvas's sibling, not its descendant. Mirrors the svg
              // template's own root-level Escape handler; each cursor-item's own onGraphKeyDown()
              // (Enter/Space/arrows/Home/End) leaves Escape unhandled the same way a node/link
              // element does, so it bubbles here.
              if (e.key === 'Escape') this.clearSelection();
            }}
          >
            ${this.simNodes.map(
              (n, i) => html`
                <!-- hit-area-exempt: this button lives inside [part="cursor-items"]'s
                     class="sr-only" (internal/a11y.ts's clip: rect(0 0 0 0) box) -- it's
                     the offscreen keyboard-roving a11y virtual cursor described in this
                     class's own doc comment, never a visible/pointer-clickable box, so
                     the 40px hit-area floor (meant for on-screen tap targets) doesn't apply. -->
                <button
                  part="cursor-item"
                  tabindex=${this.normalizedGraphItem() === i ? '0' : '-1'}
                  aria-label=${this.nodeAccessibleText(n)}
                  @focus=${() => this.onGraphItemFocus(i)}
                  @keydown=${(e: KeyboardEvent) => this.onGraphKeyDown(e, i, (ev) => this.onNodeClick(n, ev))}
                  @click=${(e: MouseEvent) => this.onNodeClick(n, e)}
                ></button>
              `,
            )}
            ${this.simLinks.map((l, li) => {
              const i = this.simNodes.length + li;
              return html`
                <!-- hit-area-exempt: see the node cursor-item above -- same offscreen
                     sr-only virtual-cursor button, no visible/pointer-clickable box. -->
                <button
                  part="cursor-item"
                  tabindex=${this.normalizedGraphItem() === i ? '0' : '-1'}
                  aria-label=${this.linkAccessibleText(l)}
                  @focus=${() => this.onGraphItemFocus(i)}
                  @keydown=${(e: KeyboardEvent) => this.onGraphKeyDown(e, i, (ev) => this.onLinkClick(l, ev))}
                  @click=${(e: MouseEvent) => this.onLinkClick(l, e)}
                ></button>
              `;
            })}
            ${this.visibleCommunities().map((entry, hi) => {
              const i = this.simNodes.length + this.simLinks.length + hi;
              const label = this.localize('graphCommunity', undefined, {
                label: entry.community.label ?? entry.community.id,
                count: entry.members.length,
              });
              return html`
                <!-- hit-area-exempt: see the node cursor-item above -- same offscreen
                     sr-only virtual-cursor button, no visible/pointer-clickable box. -->
                <button
                  part="cursor-item"
                  tabindex=${this.normalizedGraphItem() === i ? '0' : '-1'}
                  aria-label=${label}
                  @focus=${() => this.onGraphItemFocus(i)}
                  @keydown=${(e: KeyboardEvent) => this.onGraphKeyDown(e, i, () => this.onCommunityClick(entry.community))}
                  @click=${() => this.onCommunityClick(entry.community)}
                ></button>
              `;
            })}
          </div>
        </div>
      `;
    }
    return html`
      <div part="base">
        <svg
          part="svg"
          role="group"
          aria-label=${this.accessibleLabel ||
          this.localize('graphDiagram', undefined, {
            nodeCount: this.simNodes.length,
            linkCount: this.simLinks.length,
          })}
          viewBox="0 0 ${this.safeWidth} ${this.safeHeight}"
          tabindex=${this.graphItemCount() ? '-1' : '0'}
          @click=${(e: MouseEvent) => {
            if (e.target === e.currentTarget) this.clearSelection();
          }}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Escape') this.clearSelection();
          }}
        >
          <defs>
            <marker
              id=${this.arrowMarkerId}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
              markerUnits="strokeWidth"
            >
              <path part="arrowhead" d="M 0 0 L 10 5 L 0 10 z"></path>
            </marker>
          </defs>
          <g transform="">
            ${this.visibleCommunities().map((entry, hullIndex) => {
              const itemIndex = this.simNodes.length + this.simLinks.length + hullIndex;
              const hull = this.communityHull(entry.members);
              const fill = sanitizeNodeColor(entry.community.color);
              const label = this.localize('graphCommunity', undefined, {
                label: entry.community.label ?? entry.community.id,
                count: entry.members.length,
              });
              return svg`<g>
                <path
                  part="hull"
                  role="button"
                  tabindex=${this.normalizedGraphItem() === itemIndex ? '0' : '-1'}
                  aria-label=${label}
                  d=${hullPathD(hull)}
                  style=${styleMap(fill ? { '--lr-graph-hull-fill': fill } : {})}
                  @click=${() => this.onCommunityClick(entry.community)}
                  @focus=${() => this.onGraphItemFocus(itemIndex)}
                  @keydown=${(e: KeyboardEvent) => this.onGraphKeyDown(e, itemIndex, () => this.onCommunityClick(entry.community))}
                ></path>
                <text part="community-label" aria-hidden="true" x=${hullCentroidX(hull)} y=${hullTopY(hull) - HULL_PADDING}>${entry.community.label ?? entry.community.id}</text>
              </g>`;
            })}
            ${this.simLinks.map((l, linkIndex) => {
              const itemIndex = this.simNodes.length + linkIndex;
              const coordinates = this.linkCoordinates(l);
              const color = sanitizeNodeColor(l.color);
              const dash = normalizeLinkDash(l.dash);
              const labelPos = this.showEdgeLabels && l.label ? this.edgeLabelPosition(l) : undefined;
              const lineEl = svg`<line
                  part="link"
                  role="button"
                  tabindex=${this.normalizedGraphItem() === itemIndex ? '0' : '-1'}
                  aria-label=${this.linkAccessibleText(l)}
                  aria-pressed=${this.selectionMode !== 'none' ? String(this.isSelected('link', this.linkKey(l))) : nothing}
                  ?data-selected=${this.isSelected('link', this.linkKey(l))}
                  ?data-dimmed=${this.isDimmed('link', this.linkKey(l))}
                  stroke-width=${l.width ?? 1.5}
                  stroke-dasharray=${dash ?? nothing}
                  marker-end=${l.directed ? `url(#${this.arrowMarkerId})` : nothing}
                  style=${styleMap(color ? { '--lr-link-color': color } : {})}
                  x1=${coordinates.x1}
                  y1=${coordinates.y1}
                  x2=${coordinates.x2}
                  y2=${coordinates.y2}
                  @click=${(e: MouseEvent) => this.onLinkClick(l, e)}
                  @focus=${() => this.onGraphItemFocus(itemIndex)}
                  @keydown=${(e: KeyboardEvent) => this.onGraphKeyDown(e, itemIndex, (ev) => this.onLinkClick(l, ev))}
                  @mouseenter=${(e: MouseEvent) => this.onLinkEnter(l, e)}
                  @mouseleave=${(e: MouseEvent) => this.onLinkLeave(l, e)}
                >${l.description || l.label ? svg`<title>${l.description || l.label}</title>` : nothing}</line>`;
              // Only wrap in a <g> when a label will actually be drawn -- an unconditional wrapper
              // would change existing consumers' rendered link DOM (bare <line part="link">) even
              // when showEdgeLabels is never set, breaking the "existing usage renders byte-for-byte
              // identical output" contract this drawn-edge-label feature must preserve.
              return labelPos
                ? svg`<g>${lineEl}<text part="link-label" aria-hidden="true" text-anchor="middle" x=${labelPos.x} y=${labelPos.y}>${l.label}</text></g>`
                : lineEl;
            })}
            ${this.danglingLinks.map((l) => {
              const source = l.source as SimNode;
              const target = l.target as SimNode;
              return svg`<line
                part="link"
                data-dangling
                aria-hidden="true"
                x1=${source.x ?? 0}
                y1=${source.y ?? 0}
                x2=${target.x ?? 0}
                y2=${target.y ?? 0}
              ></line>`;
            })}
            ${this.simNodes.map((n, nodeIndex) => {
              const shape = this.nodeShape(n);
              const fill = this.nodeFill(n);
              const itemIndex = nodeIndex;
              const tabindex = this.normalizedGraphItem() === itemIndex ? '0' : '-1';
              const label = this.nodeAccessibleText(n);
              // Unlike link styling below (which always renders style=${styleMap(...)}, even as
              // an empty string), an untyped/unknown-type node must render with NO style
              // attribute at all -- not just an empty one -- so hasAttribute('style') distinguishes
              // "no fill override" from "fill override present" for consumers/tests probing the DOM.
              const style = fill ? styleMap({ '--lr-node-fill': fill }) : nothing;
              const title = n.description ? svg`<title>${n.description}</title>` : nothing;
              const shapeEl =
                shape === 'circle'
                  ? svg`<circle
                      part="node"
                      role="button"
                      tabindex=${tabindex}
                      aria-label=${label}
                      aria-pressed=${this.selectionMode !== 'none' ? String(this.isSelected('node', n.id)) : nothing}
                      ?data-selected=${this.isSelected('node', n.id)}
                      ?data-dimmed=${this.isDimmed('node', n.id)}
                      r=${this.nodeRadius(n)}
                      cx=${n.x ?? 0}
                      cy=${n.y ?? 0}
                      style=${style}
                      @click=${(e: MouseEvent) => this.onNodeClick(n, e)}
                      @dblclick=${(e: MouseEvent) => this.onNodeDblClick(n, e)}
                      @focus=${() => this.onGraphItemFocus(itemIndex)}
                      @keydown=${(e: KeyboardEvent) => this.onGraphKeyDown(e, itemIndex, (ev) => this.onNodeClick(n, ev))}
                      @mouseenter=${(e: MouseEvent) => this.onNodeEnter(n, e)}
                      @mouseleave=${(e: MouseEvent) => this.onNodeLeave(n, e)}
                    >${title}</circle>`
                  : svg`<path
                      part="node"
                      role="button"
                      tabindex=${tabindex}
                      aria-label=${label}
                      aria-pressed=${this.selectionMode !== 'none' ? String(this.isSelected('node', n.id)) : nothing}
                      ?data-selected=${this.isSelected('node', n.id)}
                      ?data-dimmed=${this.isDimmed('node', n.id)}
                      d=${shape === 'square' ? squarePath(this.nodeRadius(n)) : diamondPath(this.nodeRadius(n))}
                      transform="translate(${n.x ?? 0},${n.y ?? 0})"
                      style=${style}
                      @click=${(e: MouseEvent) => this.onNodeClick(n, e)}
                      @dblclick=${(e: MouseEvent) => this.onNodeDblClick(n, e)}
                      @focus=${() => this.onGraphItemFocus(itemIndex)}
                      @keydown=${(e: KeyboardEvent) => this.onGraphKeyDown(e, itemIndex, (ev) => this.onNodeClick(n, ev))}
                      @mouseenter=${(e: MouseEvent) => this.onNodeEnter(n, e)}
                      @mouseleave=${(e: MouseEvent) => this.onNodeLeave(n, e)}
                    >${title}</path>`;
              return svg`<g>
                ${shapeEl}
                ${n.label
                  ? svg`<text part="label" aria-hidden="true" x=${(n.x ?? 0) + this.nodeRadius(n) + 2} y=${n.y ?? 0}>${n.label}</text>`
                  : ''}
                ${n.expandable
                  ? svg`<g part="expand-indicator" aria-hidden="true" transform="translate(${n.x ?? 0},${n.y ?? 0})">
                      <circle r=${EXPAND_BADGE_R} cx=${this.nodeRadius(n) * EXPAND_BADGE_OFFSET} cy=${-this.nodeRadius(n) * EXPAND_BADGE_OFFSET}></circle>
                      <path d="M ${this.nodeRadius(n) * EXPAND_BADGE_OFFSET - EXPAND_BADGE_R / 2} ${-this.nodeRadius(n) * EXPAND_BADGE_OFFSET} L ${this.nodeRadius(n) * EXPAND_BADGE_OFFSET + EXPAND_BADGE_R / 2} ${-this.nodeRadius(n) * EXPAND_BADGE_OFFSET} M ${this.nodeRadius(n) * EXPAND_BADGE_OFFSET} ${-this.nodeRadius(n) * EXPAND_BADGE_OFFSET - EXPAND_BADGE_R / 2} L ${this.nodeRadius(n) * EXPAND_BADGE_OFFSET} ${-this.nodeRadius(n) * EXPAND_BADGE_OFFSET + EXPAND_BADGE_R / 2}"></path>
                    </g>`
                  : ''}
              </g>`;
            })}
            <circle part="focus-halo" aria-hidden="true" hidden r="0" cx="0" cy="0"></circle>
          </g>
        </svg>
        <div part="live-region" class="sr-only" role="status" aria-live="polite" aria-atomic="true">
          ${this.graphLiveText ||
          (this.normalizedGraphItem() >= 0 ? this.graphItemAnnouncement(this.normalizedGraphItem()) : '')}
        </div>
        <ul part="data-list" class="sr-only" aria-label=${this.localize('graphDataList')}>
          ${this.simNodes.map(
            (node) => html`<li>${this.localize('graphNode', undefined, { label: this.nodeAccessibleText(node) })}</li>`,
          )}
          ${this.simLinks.map((link) => html`<li>${this.linkAccessibleText(link)}</li>`)}
          ${this.visibleCommunities().map(
            (entry) =>
              html`<li>${this.localize('graphCommunity', undefined, {
                label: entry.community.label ?? entry.community.id,
                count: entry.members.length,
              })}</li>`,
          )}
        </ul>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-graph': LyraGraph;
  }
}
