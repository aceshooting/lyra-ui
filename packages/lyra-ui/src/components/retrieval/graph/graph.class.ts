import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import {
  html,
  nothing,
  svg,
  type TemplateResult,
  type PropertyValues,
} from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { specialistTokens } from '../../../internal/specialist-tokens.styles.js';
import { hostAriaLabel, nextId, srOnly } from '../../../internal/a11y.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { isRtl } from '../../../internal/rtl.js';
import { literalSetConverter } from '../../../internal/converters.js';
import { resolveCssLength } from '../../../internal/css-length.js';
import { styles } from './graph.styles.js';
import {
  loadD3,
  type D3ForceLink,
  type D3ForceManyBody,
  type D3Modules,
  type D3Simulation,
  type D3SimulationLinkDatum,
  type D3SimulationNodeDatum,
  type D3ZoomBehavior,
  type D3ZoomTransform,
} from './graph-loader.js';
import {
  convexHull,
  hullPathD,
  hullCentroidX,
  hullTopY,
  type HullPoint,
} from './graph-hull.js';
import {
  drawGraphScene,
  drawPickingScene,
  pickColorToIndex,
  type CanvasCamera,
  type CanvasScene,
} from './graph-canvas.js';
import { layeredLayout } from '../../../internal/layered-layout.js';
import {
  finiteNumber,
  finiteRange,
  finiteInteger,
} from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { activeElementIn } from '../../../internal/active-element.js';
import type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
export type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import {
  copyGraphLinkIdentity,
  graphLinkIdentity,
  normalizeGraphModel,
  type LyraGraphCommunity,
  type LyraGraphLink,
  type LyraGraphNode,
  type NormalizedGraphModel,
} from './graph-model.js';
export type {
  LyraGraphCommunity,
  LyraGraphLink,
  LyraGraphNode,
} from './graph-model.js';
import { canonicalIdentityList } from '../retrieval-identity.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import '../../overlays/skeleton/skeleton.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_graphCommunity, LYRA_DEFAULT_graphDataList, LYRA_DEFAULT_graphDiagram, LYRA_DEFAULT_graphExpandableItem, LYRA_DEFAULT_graphItemAnnouncement, LYRA_DEFAULT_graphLink, LYRA_DEFAULT_graphMissingLibrary, LYRA_DEFAULT_graphNode, LYRA_DEFAULT_graphNodeFocused, LYRA_DEFAULT_graphNodesHidden, LYRA_DEFAULT_graphSelectionCount, LYRA_DEFAULT_graphTypedNode, LYRA_DEFAULT_loading, LYRA_DEFAULT_noData } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type LyraGraphLayout = 'force' | 'layered';

const GRAPH_LAYOUT = literalSetConverter<LyraGraphLayout>(
  ['force', 'layered'],
  'force'
);
export type LyraGraphRenderer = 'svg' | 'canvas';
export type LyraGraphSelectionMode = 'none' | 'single' | 'multiple';
export type LyraGraphPickKind = 'node' | 'link';

type BrowserWindow = Window & typeof globalThis;

/** Shared score-tier thresholds for retrieval relevance and grounding confidence. */
export interface LyraScoreThresholds {
  readonly high: number;
  readonly medium: number;
}

// `interface ... extends` heritage clauses only accept an identifier/qualified-name
// (not an inline `import('...').X` type query), so the lazy d3-force types are routed
// through these local, non-exported aliases instead of a top-level `import type`. Since
// SimNode/SimLink are themselves never exported (module-private, elided from the emitted
// .d.ts entirely), this indirection doesn't reintroduce the barrel leak the inline
// `import()` idiom elsewhere in this file exists to avoid.
interface SimNode extends LyraGraphNode, D3SimulationNodeDatum {}
type SimLink = Omit<LyraGraphLink, 'source' | 'target'> &
  D3SimulationLinkDatum<SimNode> & {
    /** `true` when `target` couldn't be resolved to a real node -- `target` is then a synthetic,
     *  non-simulated position (kept in sync with `source` every tick), rendered as a short dead-end
     *  stub instead of a real edge, and excluded from `forceLink`'s own simulation input. */
    dangling?: boolean;
  };

type GraphItemIdentity =
  | { kind: 'node'; id: string }
  | { kind: 'link'; id: string }
  | { kind: 'community'; id: string };

const STUB_OFFSET_PX = 14; // matches the length of a typical broken-link stub in comparable UIs
const EDGE_LABEL_OFFSET_PX = 4; // perpendicular offset from the segment midpoint, in world px
const DEFAULT_EDGE_LABEL_FONT_PX = 10; // used when --lr-font-size-2xs carries no resolvable length
const EDGE_LABEL_LENGTH_GATE_RATIO = 0.85; // label hides when its measured width exceeds this * edge length
const EDGE_LABEL_WIDTH_CACHE_MAX = 512; // distinct measured label texts kept before the oldest entry is evicted
const EXPAND_KEY_INTERVAL_MS = 500; // window for a double-Enter/Space to count as a double-activate
const EXPAND_BADGE_R = 5; // world px, the "+" badge circle radius
const EXPAND_BADGE_OFFSET = Math.SQRT1_2; // places the badge at the node's edge, diagonally upper-right
const FOCUS_HALO_PADDING = 6; // world px added to the node's own radius for the halo ring
const HULL_PADDING = 24; // world px; CSS mirrors this via stroke-width: 2 * --lr-size-24px
const CANVAS_NODE_LABEL_MIN_ZOOM = 0.5; // canvas-only declutter -- node labels draw only at/above this scale
// WebKit does not pointer-hit-test a mathematically zero-length SVG line. A sub-pixel segment
// preserves the circular target created by the round, zoom-compensated 24px stroke in every engine.
const NODE_HIT_SEGMENT_HALF = 0.5;

/** Admits only own data-string values from controlled graph rows. This keeps malformed runtime
 * input out of rendered text without evaluating an accessor or coercing an arbitrary object. */
function ownGraphText(
  value: object,
  property: PropertyKey
): string | undefined {
  const descriptor = getOwnDataDescriptor(value, property);
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
    descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
    typeof descriptor.value !== 'string'
    ? undefined
    : descriptor.value;
}

/** Reads an own data value without crossing an accessor-backed row property. */
function ownGraphValue(
  value: object,
  property: PropertyKey
): unknown | undefined {
  const descriptor = getOwnDataDescriptor(value, property);
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
    descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    ? undefined
    : descriptor.value;
}

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

function sanitizeNodeColor(color: string | undefined): string | undefined {
  return sanitizeCssColor(color);
}

function normalizeLinkDash(
  dash: readonly number[] | undefined
): string | undefined {
  if (
    !dash?.length ||
    dash.some((value) => !Number.isFinite(value) || value < 0)
  )
    return undefined;
  return dash.join(' ');
}

/** Assigns a typed node with no explicit color a slot from the ordered categorical fallback
 *  palette, cycling every 8 entries (`--lr-graph-cat-1`…`--lr-graph-cat-8`). `index` is the
 *  node's `LyraNodeTypeStyle` position in `nodeTypes`, not the node's own index in `nodes`. */
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

/** Value equality for a controlled id-array prop (`selectedNodeIds`/`selectedLinkIds`). A host
 *  that recomputes `.selectedNodeIds=${...}` inline on every render -- the ordinary, correct Lit
 *  pattern for a controlled prop, e.g. `<lr-knowledge-graph-explorer>`'s own
 *  `.selectedNodeIds=${this.selectedNodeId ? [this.selectedNodeId] : []}` -- hands down a fresh
 *  array reference even when the actual selection hasn't changed. Lit's default reference-based
 *  `changed.has()` can't tell that apart from a real change, so `willUpdate()` below compares
 *  values here instead of trusting `changed.has()` alone before re-announcing the selection count. */
function sameIds(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

export interface LyraGraphEventMap {
  'lr-node-click': CustomEvent<{ nodeId: string; x: number; y: number }>;
  'lr-link-click': CustomEvent<{
    sourceNodeId: string;
    targetNodeId: string;
    linkId?: string;
  }>;
  'lr-node-enter': CustomEvent<{ nodeId: string }>;
  'lr-node-leave': CustomEvent<{ nodeId: string }>;
  'lr-link-enter': CustomEvent<{
    sourceNodeId: string;
    targetNodeId: string;
    linkId?: string;
  }>;
  'lr-link-leave': CustomEvent<{
    sourceNodeId: string;
    targetNodeId: string;
    linkId?: string;
  }>;
  'lr-node-expand': CustomEvent<{ nodeId: string }>;
  'lr-selection-change': CustomEvent<
    LyraEventDetailSnapshot<{ nodeIds: string[]; linkIds: string[] }>
  >;
  'lr-community-click': CustomEvent<{ communityId: string }>;
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
 * `hiddenTypes` filters nodes/links by `LyraGraphNode.type` without discarding position state --
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
 * logic as `renderer="svg"`. Both renderers skip nonoperable links when moving real keyboard
 * focus. Zero-width links retain topology but paint neither a stroke nor an arrowhead.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-graph
 * Empty/blank node, link, node-type, and community identities are omitted, and later duplicate
 * effective identities are first-wins before layout, keyed DOM, selection, focus, or events.
 * Retained identity spelling is not rewritten.
 *
 * @event lr-node-click - `detail: { nodeId, x, y }`, where `x` and `y` are the
 *   node's current coordinates in the graph's local drawing space.
 * @event lr-link-click - `detail: { sourceNodeId, targetNodeId, linkId? }`.
 * @event lr-node-enter - A node was hovered. `detail: { nodeId }`. Suppressed while dragging or
 *   panning. Canvas enter/leave events fire once per hit-identity transition or exit. In SVG,
 *   also toggles a `data-hovered` attribute on that node's `[part="node"]` element for
 *   pure-CSS theming (not a substitute for this event — a consumer computing its own
 *   adjacency-based highlight needs the id, which only the event carries).
 * @event lr-node-leave - The hover from `lr-node-enter` ended. `detail: { nodeId }`.
 * @event lr-link-enter - A link was hovered. `detail: { sourceNodeId, targetNodeId, linkId? }`. Same
 *   suppression/`data-hovered` behavior as `lr-node-enter`.
 * @event lr-link-leave - The hover from `lr-link-enter` ended. `detail: { sourceNodeId,
 *   targetNodeId, linkId? }`.
 * @event lr-node-expand - A node was double-activated (native `dblclick`, or two Enter/Space
 *   activations of the same focused node within 500ms). `detail: { nodeId }`. Fires for any node
 *   regardless of `LyraGraphNode.expandable` -- that flag only controls the visual "+" affordance and
 *   spoken "expandable" suffix.
 * @event lr-selection-change - `detail: { nodeIds, linkIds }`. Fires when `selectionMode` is not
 *   `'none'` and the user activates/clears a node or link. The component never assigns
 *   `selectedNodeIds`/`selectedLinkIds` itself -- controlled, mirroring `lr-heatmap.selectedCell`.
 * @event lr-community-click - A hull was activated. `detail: { communityId }`.
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
 * @csspart focus-halo - The persistent ring tracking `focusNodeId`'s node.
 * @csspart hull - A community hull (behind links/nodes; role="button").
 * @csspart community-label - A hull's label text.
 * @csspart live-region - The aria-hidden shadow mirror of the current graph item announcement;
 *   assistive-technology announcements use a shared light-DOM sink.
 * @csspart data-list - A visually hidden list alternative for graph data.
 * @csspart empty - The empty-state message, shown when `nodes` is empty.
 * @csspart error - Static visible error shown instead of the graph when the optional `d3` peer
 *   dependency is not installed; its transition is announced through a shared light-DOM alert.
 * @csspart canvas - The single canvas surface (`renderer="canvas"` only).
 * @csspart tooltip - The hover tooltip (`renderer="canvas"` only; the SVG `<title>` replacement).
 * @csspart cursor-items - The container of offscreen keyboard-roving items (`renderer="canvas"` only).
 * @csspart cursor-item - An offscreen keyboard-roving item (`renderer="canvas"`'s a11y virtual cursor).
 * @cssprop [--lr-canvas-reserved-height=var(--lr-size-24rem)] - Default host block size, shared
 *   with the pre-upgrade reservation stylesheet. An explicit outer `block-size` still wins.
 * @cssprop [--lr-node-fill=var(--lr-color-brand)] - Default node fill, overridden per-node by `LyraGraphNode.color`.
 * @cssprop [--lr-link-color=var(--lr-color-border)] - Default link stroke, overridden per-link by a link's own `color`.
 * @cssprop [--lr-graph-cat-1=var(--lr-theme-graph-cat-1,#8250df)] - First categorical fallback color for typed nodes.
 * @cssprop [--lr-graph-cat-2=var(--lr-theme-graph-cat-2,#bf3989)] - Second categorical fallback color for typed nodes.
 * @cssprop [--lr-graph-cat-3=var(--lr-theme-graph-cat-3,#0a7d91)] - Third categorical fallback color for typed nodes.
 * @cssprop [--lr-graph-cat-4=var(--lr-theme-graph-cat-4,#57606a)] - Fourth categorical fallback color for typed nodes.
 * @cssprop [--lr-graph-cat-5=var(--lr-theme-graph-cat-5,#b083f5)] - Fifth categorical fallback color for typed nodes.
 * @cssprop [--lr-graph-cat-6=var(--lr-theme-graph-cat-6,#f470b8)] - Sixth categorical fallback color for typed nodes.
 * @cssprop [--lr-graph-cat-7=var(--lr-theme-graph-cat-7,#52d6e8)] - Seventh categorical fallback color for typed nodes.
 * @cssprop [--lr-graph-cat-8=var(--lr-theme-graph-cat-8,#c9d1d9)] - Eighth categorical fallback color for typed nodes; the palette wraps
 *   for later `nodeTypes` entries.
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
 *   group, avoiding a double-opacity seam at the fill/stroke boundary). Applies to both SVG and
 *   canvas renderers.
 * @status stable
 * @since 4.0.0
 */
export class LyraGraph extends LyraElement<LyraGraphEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    graphCommunity: LYRA_DEFAULT_graphCommunity,
    graphDataList: LYRA_DEFAULT_graphDataList,
    graphDiagram: LYRA_DEFAULT_graphDiagram,
    graphExpandableItem: LYRA_DEFAULT_graphExpandableItem,
    graphItemAnnouncement: LYRA_DEFAULT_graphItemAnnouncement,
    graphLink: LYRA_DEFAULT_graphLink,
    graphMissingLibrary: LYRA_DEFAULT_graphMissingLibrary,
    graphNode: LYRA_DEFAULT_graphNode,
    graphNodeFocused: LYRA_DEFAULT_graphNodeFocused,
    graphNodesHidden: LYRA_DEFAULT_graphNodesHidden,
    graphSelectionCount: LYRA_DEFAULT_graphSelectionCount,
    graphTypedNode: LYRA_DEFAULT_graphTypedNode,
    loading: LYRA_DEFAULT_loading,
    noData: LYRA_DEFAULT_noData,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'nodes',
    'links',
    'nodeTypes',
    'hiddenTypes',
    'communities',
    'selectedNodeIds',
    'selectedLinkIds',
    'dimmedNodeIds',
    'dimmedLinkIds',
  ]);

  static override get observedAttributes(): string[] {
    return [...new Set([...super.observedAttributes, 'role'])];
  }

  static override styles = [
    LyraElement.styles,
    specialistTokens,
    styles,
    srOnly,
  ];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-selection-change',
  ]);

  /** Readonly nodes in the controlled graph model. Node ids provide stable render and interaction identity. */
  @property({ attribute: false }) nodes: readonly LyraGraphNode[] = [];
  /** Directed or undirected connections between node ids in `nodes`. */
  @property({ attribute: false }) links: readonly LyraGraphLink[] = [];
  /** Declares each `LyraGraphNode.type` value's legend label, fill color, and shape. A typed node with
   *  no matching entry here renders as untyped (default circle, token fill) but still participates
   *  in `hiddenTypes` filtering by its raw `type` string. */
  @property({ attribute: false }) nodeTypes: readonly LyraNodeTypeStyle[] = [];
  /** Hides every node whose raw `type` value is listed here (no matching `nodeTypes` entry
   *  required), plus every link incident to a hidden node -- removed from the render, the
   *  simulation input, the keyboard roving ring, the sr-only data list, and the accessible
   *  diagram counts, as if absent. Positions round-trip via `lastPositionById`: toggling a type
   *  off and back on restores each node where it was. */
  @property({ attribute: false }) hiddenTypes: readonly string[] = [];
  /** Renders one translucent hull per entry, behind links/nodes. Membership is the union of
   *  `memberIds` and every node whose `communityId` matches this entry's `id`. */
  @property({ attribute: false }) communities: readonly LyraGraphCommunity[] =
    [];
  private normalizedGraphModel?: NormalizedGraphModel;
  private normalizedGraphSources?: readonly [
    readonly LyraGraphNode[],
    readonly LyraGraphLink[],
    readonly LyraNodeTypeStyle[],
    readonly LyraGraphCommunity[]
  ];

  /** A single cached projection keeps every graph consumer on the same deterministic identity
   * policy without rescanning the bounded public snapshots on every lookup or render branch. */
  private get graphModel(): NormalizedGraphModel {
    const sources = this.normalizedGraphSources;
    if (
      !sources ||
      sources[0] !== this.nodes ||
      sources[1] !== this.links ||
      sources[2] !== this.nodeTypes ||
      sources[3] !== this.communities
    ) {
      this.normalizedGraphSources = [
        this.nodes,
        this.links,
        this.nodeTypes,
        this.communities,
      ];
      this.normalizedGraphModel = normalizeGraphModel(
        this.nodes,
        this.links,
        this.nodeTypes,
        this.communities
      );
    }
    return this.normalizedGraphModel!;
  }
  private _layout: LyraGraphLayout = 'force';

  /** `'force'` (default) runs the existing d3-force simulation, untouched. `'layered'` computes a
   *  deterministic Sugiyama-lite layout (`src/internal/layered-layout.ts`, a shared,
   *  dependency-free util suitable for any future layered-diagram consumer) instead -- no settle
   *  animation, node drag disabled (dragging would fight a computed layout), `chargeStrength` a
   *  documented no-op, `linkDistance` retunes the layer gap. Switching at runtime repositions
   *  without a tween. */
  @property({ converter: GRAPH_LAYOUT })
  get layout(): LyraGraphLayout {
    return this._layout;
  }
  set layout(next: LyraGraphLayout) {
    const normalized = GRAPH_LAYOUT.normalize(next);
    const old = this._layout;
    if (old === normalized) return;
    this._layout = normalized;
    this.requestUpdate('layout', old);
  }
  /** `'svg'` (default, unchanged) renders the existing per-node/per-link DOM. `'canvas'` swaps to
   *  a single `<canvas part="canvas">` -- the scale path (an honest ceiling for `'svg'`: dozens to
   *  low hundreds of nodes; `'canvas'` targets roughly 5,000 nodes / 10,000 links). Feature-reduced
   *  by design: no `::part(node)`/`::part(link)` styling (pixels, not elements -- theme via
   *  cssprops), no SVG `<title>`, a drawn focus ring instead of a CSS one. All events/methods/
   *  props otherwise behave identically across renderers. Runtime changes tear down and rebuild
   *  the surface; positions survive via `prevById`/`lastPositionById`. */
  @property() renderer: LyraGraphRenderer = 'svg';
  /** Requested graph viewport width in CSS pixels. */
  @property({ type: Number }) width = 800;
  /** Requested graph viewport height in CSS pixels. */
  @property({ type: Number }) height = 600;
  /** Many-body force strength used by the force layout. Negative values repel nodes. */
  @property({ type: Number, attribute: 'charge-strength' }) chargeStrength =
    -300;
  /** Preferred link length for force layout and layer separation for layered layout. */
  @property({ type: Number, attribute: 'link-distance' }) linkDistance = 100;
  /** Minimum camera scale accepted by zoom interactions; updates live in both renderers. */
  @property({ type: Number, attribute: 'min-zoom' }) minZoom = 0.1;
  /** Maximum camera scale accepted by zoom interactions; updates live in both renderers. */
  @property({ type: Number, attribute: 'max-zoom' }) maxZoom = 8;
  /** Accessible name for the graph. A present host `aria-label`, including an explicitly empty
   *  one, makes this host the sole graph owner; otherwise the SVG/canvas owns the localized name. */
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
   *  midpoint. Off by default — `LyraGraphLink.label` stays spoken/tooltip-only, matching today's
   *  behavior, unless this is set. */
  @property({ type: Boolean, attribute: 'show-edge-labels' }) showEdgeLabels =
    false;
  /** Below this zoom scale, every drawn edge label is hidden (a `data-edge-labels-hidden`
   *  attribute toggled on the zoomed `<g>`, no Lit re-render). Ignored when `showEdgeLabels` is
   *  false. */
  @property({ type: Number, attribute: 'edge-label-min-zoom' })
  edgeLabelMinZoom = 0.6;
  /** Declaratively centers the camera on this node id once, the first time it resolves (on mount
   *  or when the id first appears in `nodes`) -- does not re-center on later mutations, so it
   *  can't fight a user's panning on a streaming graph. Renders a persistent halo
   *  (`part="focus-halo"`) around the node while set. See `focusNode()` for the imperative twin. */
  @property({ attribute: 'focus-node-id' }) focusNodeId: string | null = null;
  /** `'none'` (default) preserves today's behavior exactly -- no `aria-pressed`/`data-selected`,
   *  no `lr-selection-change`. Controlled, mirroring `lr-heatmap.selectedCell`: the component
   *  never mutates `selectedNodeIds`/`selectedLinkIds` itself, only emits intent; the host assigns
   *  them back. */
  @property({ attribute: 'selection-mode' })
  selectionMode: LyraGraphSelectionMode = 'none';
  /** Controlled ids of selected nodes. Selection gestures emit intent without mutating this array. */
  @property({ attribute: false }) selectedNodeIds: readonly string[] = [];
  /** Controlled ids of selected links, using each link's stable effective key. */
  @property({ attribute: false }) selectedLinkIds: readonly string[] = [];
  /** Node ids to render dimmed (`data-dimmed` on the matching `[part="node"]`, themeable via
   *  `--lr-graph-dimmed-opacity`). Controlled, mirroring `selectedNodeIds`/`selectedLinkIds`: the
   *  component never assigns this itself, only renders it -- a host typically computes it from a
   *  `lr-node-enter`/`lr-link-enter` hover (the complement of the hovered id's neighbor set,
   *  computed from the host's own `links` array) and assigns the result back. Empty (the default)
   *  renders every node at full opacity, unchanged from today. */
  @property({ attribute: false }) dimmedNodeIds: readonly string[] = [];
  /** Same contract as `dimmedNodeIds`, for links. A link's dimming key is the same `linkKey()`
   *  value (`LyraGraphLink.id`, else `` `${source}->${target}` ``) `selectedLinkIds` already uses. */
  @property({ attribute: false }) dimmedLinkIds: readonly string[] = [];

  private readonly arrowMarkerId = nextId('graph-arrow');

  /** True until the lazy-loaded d3 peer dependencies have settled (success or failure). */
  @state() private loading = true;

  /**
   * True once the optional `d3` peer failed to load (not installed) -- `render()` fails closed
   * into a visible `part="error"` and announces the transition through the document-level sink.
   */
  @state() private loadFailed = false;

  // Overridable instance field (not a direct `loadD3()` call site) purely so tests can inject a
  // stubbed loader before the element ever connects -- matches map/docx-viewer's own
  // `loadLibrary` field/rationale exactly.
  private loadLibrary: () => Promise<D3Modules | null> = loadD3;
  // Invalidates a lazy-load callback when this element disconnects/reconnects. A stale callback
  // must not rebuild a freshly reconnected graph from the previous mount's lifecycle.
  private loadGeneration = 0;

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
  /** Shared document-level regions that carry announcements. The visually hidden shadow copy is
   *  an inspection mirror only because shadow-root live regions are not consistently spoken. */
  private politeAnnouncementSink?: AnnouncementSink;
  private assertiveAnnouncementSink?: AnnouncementSink;
  /** Becomes true only after the first successful, non-loading graph render. This suppresses both
   *  the default first item and an initially configured hidden-node count. */
  private graphAnnouncementsReady = false;
  /** Focus repair scheduled by `willUpdate()` after a structural graph change. A numeric value
   *  targets the surviving flat graph-item index; `'base'` targets the now-empty renderer. */
  private pendingGraphItemFocus: number | 'base' | undefined;
  /** Gates the mount-time selection announcement in `willUpdate()` so a freshly-mounted graph
   *  never announces its own initial (default-`[]`) selection as though it were a live change --
   *  mirrors `<lr-branch-picker>`'s identical `isMounting` gate. */
  private isMounting = true;
  /** Host `aria-label` makes the host the one named graph owner. Remember an independently
   *  authored role so the default `group` role can be added/removed without overwriting it. */
  private authorRole: string | null = null;
  private syncingGraphHostRole = false;

  private simulation?: D3Simulation<SimNode, SimLink>;
  /** The live charge/link force objects, kept so chargeStrength/linkDistance
   *  changes can retune them in place (see updated()) instead of requiring a
   *  full rebuildSimulation(). */
  private chargeForce?: D3ForceManyBody<SimNode>;
  private linkForce?: D3ForceLink<SimNode, SimLink>;
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
  private zoomBehavior?: D3ZoomBehavior<
    SVGSVGElement | HTMLCanvasElement,
    unknown
  >;
  /** Node `<circle>`s already wired up with d3-drag; cleared on every simulation rebuild
   *  so DOM elements Lit reuses across a rebuild get rebound to their fresh datum. */
  private boundNodeEls = new WeakSet<Element>();
  /** Node/link/label DOM elements, index-aligned with simNodes/simLinks, cached
   *  once per structural rebuild and written to directly by onTick() — this is
   *  what lets ticks update positions without going through Lit's reactive
   *  simNodes/simLinks properties (see rebuildSimulation()'s doc comment). */
  private nodeEls: SVGElement[] = [];
  private nodeHitEls: SVGLineElement[] = [];
  private nodeLabelEls: (SVGTextElement | null)[] = [];
  private expandIndicatorEls: (SVGGElement | null)[] = [];
  /** Tracks the index/time of the last Enter/Space activation, for double-Enter expand detection
   *  (mirroring native dblclick semantics for keyboard users). */
  private lastKeyActivateIndex: number | null = null;
  private lastKeyActivateTime = 0;
  /** The last `focusNodeId` value `focusNode()` was auto-invoked for by `updated()`'s declarative
   *  centering branch -- guards against re-centering on every update while `focusNodeId` stays set
   *  (see the `focusNodeId` property doc for why it only ever centers once per value). Reset to `null`
   *  whenever `focusNodeId` itself is cleared, so the same id can center again later. */
  private lastAppliedFocusNodeId: string | null = null;
  private focusHaloEl?: SVGCircleElement;
  private communityHullEls: SVGPathElement[] = [];
  private communityHullHitEls: SVGPathElement[] = [];
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
  private canvasDrawRafOwner?: BrowserWindow;
  /** Gates `scheduleCanvasDraw()` -- an off-screen (scrolled away, hidden tab panel) canvas-mode
   *  instance would otherwise still pay the full redraw cost throughout its simulation settle and
   *  any drag, same problem `<lr-chart>`'s identical `visible`/`IntersectionObserver` pair
   *  addresses. Not `@state()`: unlike `loading`, this never drives `render()`'s template, only
   *  gates the imperative canvas-raster path, so making it reactive would just schedule a wasted
   *  Lit update on every visibility crossing. */
  private visible = true;
  private intersectionObserver?: IntersectionObserver;
  /** Set when `scheduleCanvasDraw()` was asked to draw while off-screen -- consulted by the
   *  IntersectionObserver callback to catch up with exactly one draw once visible again, instead
   *  of either silently dropping the request or drawing every missed frame. */
  private canvasDrawPending = false;
  private pickDirty = true;
  private canvasCamera: CanvasCamera = { k: 1, x: 0, y: 0 };
  private canvasTooltipEl?: HTMLDivElement;
  /** Flat, index-aligned list matching `drawPickingScene()`'s own hulls-then-links-then-nodes pick
   *  order -- rebuilt by `redrawPickCanvas()` alongside the pick canvas itself, so a pick color's
   *  decoded index always maps back to the exact item it was drawn for. */
  private pickItems: (
    | {
        kind: 'hull';
        entry: { community: LyraGraphCommunity; members: SimNode[] };
      }
    | { kind: Extract<LyraGraphPickKind, 'link'>; link: SimLink }
    | { kind: Extract<LyraGraphPickKind, 'node'>; node: SimNode }
  )[] = [];
  private canvasDragNode?: SimNode;
  private canvasPointerId?: number;
  private canvasPointerDownAt?: { x: number; y: number };
  private canvasPointerDownId?: number;
  /** The latest hover pointer position awaiting a hit test -- `pointermove` can fire far more
   *  often than the display refreshes, and each hit test costs a bounding-rect read plus a
   *  pick-pixel readback, so hover resolution is coalesced to at most one per animation frame. */
  private pendingHover?: { x: number; y: number };
  private canvasHover?:
    | { kind: 'node'; id: string }
    | {
        kind: 'link';
        id: string;
        detail: LyraGraphEventMap['lr-link-enter']['detail'];
      };
  private hoverRafId?: number;
  private hoverRafOwner?: BrowserWindow;
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
  private cameraTweenFrameOwner?: BrowserWindow;
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
  private viewportChangeRafOwner?: BrowserWindow;
  private linkEls: SVGLineElement[] = [];
  private linkHitEls: SVGLineElement[] = [];
  private linkLabelEls: (SVGTextElement | null)[] = [];
  /** Per-simLink-index flip cache for the length declutter gate -- `onTick()` only writes
   *  `visibility` when the boolean actually changes, not every tick. */
  private linkLabelHiddenByLength: boolean[] = [];
  private edgeLabelWidthCache = new Map<string, number>();
  /** Dangling-stub `<line>`s, index-aligned with `danglingLinks` -- cached separately from
   *  `linkEls` (real, simulated links only) so onTick() can write their positions too; see
   *  onTick()'s own comment for why a stub needs this at all. */
  private danglingLinkEls: SVGLineElement[] = [];
  private edgeLabelMeasureCanvas?: HTMLCanvasElement;
  private edgeLabelMeasureCtx?: CanvasRenderingContext2D | null;
  private linkPaintProbe?: HTMLCanvasElement;
  private readonly linkPaintVisibilityCache = new Map<string, boolean>();
  private readonly resolvedCssColorCache = new Map<string, string>();

  constructor() {
    super();
    new ThemeWatcher(this, () => {
      this.linkPaintVisibilityCache.clear();
      this.resolvedCssColorCache.clear();
      if (this.renderer === 'canvas') this.markCanvasDirty();
    });
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    value: string | null
  ): void {
    super.attributeChangedCallback(name, oldValue, value);
    if (name === 'role' && oldValue !== value && !this.syncingGraphHostRole) {
      this.authorRole = value;
    }
  }

  private hostOwnsGraphSemantics(): boolean {
    return hostAriaLabel(this) !== null;
  }

  private syncGraphHostRole(): void {
    if (this.authorRole !== null) return;
    this.syncingGraphHostRole = true;
    try {
      if (this.hostOwnsGraphSemantics()) this.setAttribute('role', 'group');
      else this.removeAttribute('role');
    } finally {
      this.syncingGraphHostRole = false;
    }
  }

  private get ownerWindow(): BrowserWindow | undefined {
    return (
      (this.ownerDocument.defaultView as BrowserWindow | null) ?? undefined
    );
  }

  private computedStyle(element: Element = this): CSSStyleDeclaration {
    const view = this.ownerWindow;
    return view
      ? view.getComputedStyle(element)
      : 'style' in element
      ? (element as HTMLElement).style
      : this.style;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSinks();
    // Observed unconditionally (both first mount and any reconnect below) -- visibility gating
    // applies regardless of whether renderer="canvas" is active yet or d3 has finished loading.
    const IntersectionObserverCtor = this.ownerWindow?.IntersectionObserver;
    if (IntersectionObserverCtor) {
      this.intersectionObserver = new IntersectionObserverCtor((entries) => {
        const wasVisible = this.visible;
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible && !wasVisible && this.canvasDrawPending) {
          this.canvasDrawPending = false;
          this.scheduleCanvasDraw();
        }
      });
      this.intersectionObserver.observe(this);
    }
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
      if (
        this.renderer === 'canvas' &&
        this.canvasEl &&
        this.canvasEl === this.zoomedEl
      ) {
        this.ensureCanvasOwnerRealm();
        this.watchCanvasResize();
        this.watchCanvasDpr();
        this.markCanvasDirty();
      }
      return;
    }
    const generation = ++this.loadGeneration;
    void this.loadLibrary().then(async (mods) => {
      // Keep the server-rendered loading branch stable through Lit's first browser update. A
      // cached/fast d3 import may otherwise switch render() to SVG before declarative-shadow-DOM
      // hydration has claimed its markers, producing a mismatch and replacing the whole shadow
      // tree. The shared browser-state seam delays only the hydrating branch change; client-only
      // mounts proceed as soon as their initial update completes.
      try {
        await this.updateComplete;
      } catch {
        return;
      }
      await new Promise<void>((resolve) =>
        this.updateBrowserDerivedState(resolve)
      );
      if (generation !== this.loadGeneration || !this.isConnected) return;
      this.loading = false;
      // A null module means the optional `d3` peer isn't installed — fail closed into the visible
      // error branch plus its light-DOM alert rather than leaving a blank surface. Guarded on
      // `mods` alone: a disconnect is not a load failure.
      if (!mods) {
        this.loadFailed = true;
        return;
      }
      this.loadFailed = false;
      // The element may have been removed from the DOM while the dynamic
      // d3 imports were in flight — don't spin up a simulation for a
      // detached instance (disconnectedCallback's cleanup already ran).
      this.d3 = mods;
      this.rebuildSimulation();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseAnnouncementSinks();
    this.loadGeneration += 1;
    this.simulation?.stop();
    this.finishCanvasNodeDrag(undefined, true, false);
    this.takeCanvasPointerDown();
    // An in-flight focusNode()/fit() tween would otherwise keep scheduling frames and writing
    // zoom transforms against the detached tree -- cancel it (which also settles the caller's
    // pending Promise with `false` instead of leaving it hanging forever).
    this.cancelCameraTween();
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    this.canvasResizeObserver?.disconnect();
    this.canvasResizeObserver = undefined;
    this.canvasDprQuery?.removeEventListener('change', this.onCanvasDprChange);
    this.canvasDprQuery = undefined;
    if (this.canvasDrawRafId != null) {
      this.canvasDrawRafOwner?.cancelAnimationFrame(this.canvasDrawRafId);
      this.canvasDrawRafId = undefined;
      this.canvasDrawRafOwner = undefined;
    }
    if (this.hoverRafId != null) {
      this.hoverRafOwner?.cancelAnimationFrame(this.hoverRafId);
      this.hoverRafId = undefined;
      this.hoverRafOwner = undefined;
    }
    this.pendingHover = undefined;
    this.canvasHover = undefined;
    this.canvasTooltipEl?.setAttribute('hidden', '');
    this.pendingGraphItemFocus = undefined;
    if (this.viewportChangeRafId != null) {
      this.viewportChangeRafOwner?.cancelAnimationFrame(
        this.viewportChangeRafId
      );
      this.viewportChangeRafId = undefined;
      this.viewportChangeRafOwner = undefined;
    }
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.releaseAnnouncementSinks();
    this.syncAnnouncementSinks();
    this.ensureCanvasOwnerRealm();
  }

  /** Re-target the ref-counted regions after reconnect/adoption without replaying existing text. */
  private syncAnnouncementSinks(): void {
    if (!this.isConnected) return;
    const heldInOwnerDocument =
      this.politeAnnouncementSink?.element.ownerDocument ===
        this.ownerDocument &&
      this.assertiveAnnouncementSink?.element.ownerDocument ===
        this.ownerDocument;
    if (heldInOwnerDocument) return;
    this.releaseAnnouncementSinks();
    this.politeAnnouncementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    this.assertiveAnnouncementSink = acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
  }

  private releaseAnnouncementSinks(): void {
    this.politeAnnouncementSink?.release();
    this.politeAnnouncementSink = undefined;
    this.assertiveAnnouncementSink?.release();
    this.assertiveAnnouncementSink = undefined;
  }

  /** Coalesces every pan/zoom/tick-driven `lr-viewport-change` emission into at most one per
   *  animation frame -- called from both the svg/canvas zoom handlers and `onTick()`, all of which
   *  can fire far more often than once per frame (a wheel-zoom gesture, a settling simulation). */
  private scheduleViewportChange(): void {
    if (this.viewportChangeRafId != null) return;
    const frameOwner = this.ownerWindow;
    if (!frameOwner) return;
    this.viewportChangeRafOwner = frameOwner;
    this.viewportChangeRafId = frameOwner.requestAnimationFrame(() => {
      this.viewportChangeRafId = undefined;
      this.viewportChangeRafOwner = undefined;
      if (!this.isConnected || this.ownerWindow !== frameOwner) return;
      const transform =
        this.renderer === 'canvas' || !this.d3 || !this.zoomedEl
          ? this.canvasCamera
          : this.d3.zoomTransform(this.zoomedEl);
      this.emit('lr-viewport-change', {
        k: transform.k,
        x: transform.x,
        y: transform.y,
      });
    });
  }

  /**
   * A caller-supplied `radius` is clamped to [MIN_RADIUS, MAX_RADIUS] (and a
   * non-finite/NaN value falls back to the same default average as an unset
   * one) — an unclamped 0/negative radius would render an invisibly small
   * `<circle>` that's still `role="button" tabindex="0"`, an invisible,
   * focusable/clickable control with no visible focus indicator.
   */
  private nodeRadius(n: LyraGraphNode): number {
    const r = n.radius ?? (MIN_RADIUS + MAX_RADIUS) / 2;
    return Number.isFinite(r)
      ? Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, r))
      : (MIN_RADIUS + MAX_RADIUS) / 2;
  }

  /** Link stroke width reaches SVG paint, canvas stroke/arrowhead math, and the picking surface.
   *  Keep those three representations synchronized on one finite, non-negative value. */
  private safeLinkWidth(link: Pick<LyraGraphLink, 'width'>): number {
    return finiteRange(link.width ?? 1.5, 1.5, 0);
  }

  /** Invisible edge paint never creates a pointer/keyboard control. The edge remains in
   * `simLinks` and the offscreen topology summary, but is excluded from navigation and picking. */
  private isInteractiveLink(
    link: SimLink,
    resolveColor: (value: string) => string
  ): boolean {
    if (this.safeLinkWidth(link) <= 0) return false;
    const computed = this.computedStyle();
    const safe = sanitizeNodeColor(link.color);
    const effectivePaint =
      safe ??
      (computed.getPropertyValue('--lr-link-color').trim() ||
        computed.getPropertyValue('--lr-color-border').trim());
    const color = effectivePaint
      ? resolveColor(effectivePaint).trim().toLowerCase()
      : undefined;
    if (!color) return true;
    if (
      color === 'transparent' ||
      (/^#[\da-f]{4}$/.test(color) && color.endsWith('0'))
    )
      return false;
    if (/^#[\da-f]{8}$/.test(color) && color.endsWith('00')) return false;
    if (/\/\s*0(?:\.0+)?%?\s*\)$/.test(color)) return false;
    if (/^(?:rgba|hsla)\(/.test(color) && /,\s*0(?:\.0+)?\s*\)$/.test(color))
      return false;
    const cached = this.linkPaintVisibilityCache.get(color);
    if (cached !== undefined) return cached;
    // Canvas parsing supplies the effective alpha for modern CSS colors such as color(),
    // color-mix(), lab()/oklab() and translucent system colors without duplicating their grammar.
    // A parser/readback failure stays operable (the opaque sentinel), avoiding a false claim that
    // an unfamiliar but visible color is transparent.
    this.linkPaintProbe ??= this.ownerDocument.createElement('canvas');
    this.linkPaintProbe.width = 1;
    this.linkPaintProbe.height = 1;
    const context = this.linkPaintProbe.getContext('2d', {
      willReadFrequently: true,
    });
    if (!context) return true;
    let visible = true;
    try {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = 'rgb(1 2 3)';
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      visible = context.getImageData(0, 0, 1, 1).data[3] !== 0;
    } catch {
      visible = true;
    }
    this.linkPaintVisibilityCache.set(color, visible);
    return visible;
  }

  /** Cleared twice, from two different points in `willUpdate()` -- neither alone is enough:
   *  (1) unconditionally at the top, because `isInteractiveLink()` (what this filters on) reads
   *  live computed style (`--lr-link-color`, `--lr-color-border`) and `link.color`/`link.width`,
   *  none of which are reactive properties `changed` would ever report, so a style-only update
   *  (a CSS custom-property edit plus `requestUpdate()`, `nodes`/`links` untouched) must still see
   *  a fresh result; (2) again right after `rebuildSimulation()` reassigns `simLinks`, because
   *  `willUpdate()`'s own `previousIndex` computation (right after clear (1), before
   *  `rebuildSimulation()` runs) can itself call `navigableLinks()` and repopulate the cache from
   *  the OLD `simLinks` -- without this second clear a structural change would render against
   *  stale link membership. Caching within one render pass is still enough to fix the actual
   *  cost: without any caching, `navigableLinks()`'s `simLinks.filter()` re-runs on every call, and
   *  `graphItemCount()`/`normalizedGraphItem()` call it once per rendered item (roving-tabindex
   *  math in both the SVG and canvas-mode offscreen cursor-item templates) -- an O(links) refilter
   *  inside an O(nodes + links) render loop is an O((nodes + links) * links) render, confirmed by
   *  local profiling to take 60+ seconds alone for a 5,000-node/10,000-link canvas-mode graph. */
  private navigableLinksCache?: SimLink[];

  private navigableLinks(): SimLink[] {
    if (!this.navigableLinksCache) {
      this.navigableLinksCache = this.simLinks.length
        ? this.withCanvasColorResolver((resolveColor) =>
            this.simLinks.filter((link) =>
              this.isInteractiveLink(link, resolveColor)
            )
          )
        : [];
    }
    return this.navigableLinksCache;
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

  /** Stable ascending zoom domain used by d3 and every imperative camera clamp. */
  private get effectiveZoomBounds(): Readonly<{ min: number; max: number }> {
    const min = this.safeMinZoom;
    const max = this.safeMaxZoom;
    return Object.freeze({ min: Math.min(min, max), max: Math.max(min, max) });
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

  private resolveNodeType(node: LyraGraphNode): LyraNodeTypeStyle | undefined {
    return node.type != null
      ? this.graphModel.nodeTypes.find((t) => t.id === node.type)
      : undefined;
  }

  private nodeShape(node: LyraGraphNode): 'circle' | 'square' | 'diamond' {
    return this.resolveNodeType(node)?.shape ?? 'circle';
  }

  /** Resolution precedence: `node.color` (existing, most specific) > matched `LyraNodeTypeStyle.color`
   *  > the ordered categorical fallback palette by the type's index in `nodeTypes` > (returns
   *  `undefined`, letting the untyped `--lr-node-fill` token default apply). Both data-driven
   *  color sources pass the existing `sanitizeNodeColor()`. */
  private nodeFill(node: LyraGraphNode): string | undefined {
    const ownColor = sanitizeNodeColor(node.color);
    if (ownColor) return ownColor;
    const type = this.resolveNodeType(node);
    if (!type) return undefined;
    const typeColor = sanitizeNodeColor(type.color);
    if (typeColor) return typeColor;
    return categoricalPaletteColor(this.graphModel.nodeTypes.indexOf(type));
  }

  /** `this.nodes` filtered down to the ids `hiddenTypes` doesn't hide -- an untyped node (`type ==
   *  null`) is never hidden, regardless of `hiddenTypes`' contents. */
  private visibleNodes(): readonly LyraGraphNode[] {
    const hiddenTypes = canonicalIdentityList(this.hiddenTypes);
    if (!hiddenTypes.length) return this.graphModel.nodes;
    const hidden = new Set(hiddenTypes);
    return this.graphModel.nodes.filter(
      (n) => n.type == null || !hidden.has(n.type)
    );
  }

  /** Resolves `this.links` against an already-built `byId` node map: a link whose source isn't in
   *  `byId` is dropped (hidden source, or a genuinely missing one); a link whose target isn't in
   *  `byId` either stubs as a dangling link (target id doesn't exist in `this.nodes` at all) or is
   *  dropped (target exists but is hidden by `hiddenTypes`). Shared by both the force and layered
   *  layout paths in `rebuildSimulation()`. */
  private resolveLinksAgainst(byId: Map<string, SimNode>): {
    resolved: SimLink[];
    dangling: SimLink[];
  } {
    const nodeExists = new Set(this.graphModel.nodes.map((n) => n.id));
    const resolved: SimLink[] = [];
    const dangling: SimLink[] = [];
    for (const l of this.graphModel.links) {
      const source = byId.get(l.source);
      if (!source) continue;
      const target = byId.get(l.target);
      if (target) {
        resolved.push(copyGraphLinkIdentity(l, { ...l, source, target }));
      } else if (!nodeExists.has(l.target)) {
        dangling.push(
          copyGraphLinkIdentity(l, {
            ...l,
            source,
            target: { id: l.target, x: source.x, y: source.y } as SimNode,
            dangling: true,
          })
        );
      }
    }
    return { resolved, dangling };
  }

  /** A community's currently-visible members -- the union of `memberIds` and every currently
   *  simulated node (already filtered by `hiddenTypes`) whose `communityId` matches. */
  private communityMembers(community: LyraGraphCommunity): SimNode[] {
    const idSet = new Set(community.memberIds);
    return this.simNodes.filter(
      (n) => idSet.has(n.id) || n.communityId === community.id
    );
  }

  /** Memoized `visibleCommunities()` result -- `undefined` means "stale, recompute on next call".
   *  Cleared from `willUpdate()` whenever `simNodes`/`communities` actually change, the same
   *  structural-change gate `applyInteractions()` re-caches its own DOM lookups on, so every other
   *  call site (roving-ring math, `render()`'s template, keyboard navigation) shares one
   *  `O(communities × simNodes)` computation per structural update instead of repeating it. */
  private visibleCommunitiesCache?: {
    community: LyraGraphCommunity;
    members: SimNode[];
  }[];

  /** `communities` narrowed to entries with at least one currently-visible member -- a community
   *  whose members are all hidden by `hiddenTypes` (or that starts out empty) draws no hull and
   *  doesn't occupy a roving-ring slot. */
  private visibleCommunities(): {
    community: LyraGraphCommunity;
    members: SimNode[];
  }[] {
    if (!this.visibleCommunitiesCache) {
      this.visibleCommunitiesCache = this.graphModel.communities
        .map((community) => ({
          community,
          members: this.communityMembers(community),
        }))
        .filter((entry) => entry.members.length > 0);
    }
    return this.visibleCommunitiesCache;
  }

  private communityHull(members: SimNode[]): HullPoint[] {
    return convexHull(members.map((n) => ({ x: n.x ?? 0, y: n.y ?? 0 })));
  }

  private onCommunityClick(community: LyraGraphCommunity): void {
    this.emit('lr-community-click', { communityId: community.id });
  }

  private cameraTransitionMs(): number {
    const parsed = parseFloat(
      this.computedStyle().getPropertyValue('--lr-transition-base')
    );
    return Number.isFinite(parsed) ? parsed : 180;
  }

  private cancelCameraTween(): void {
    if (this.cameraTweenId != null) {
      this.cameraTweenFrameOwner?.cancelAnimationFrame(this.cameraTweenId);
      this.cameraTweenId = undefined;
      this.cameraTweenFrameOwner = undefined;
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

  private applyZoomTransform(transform: D3ZoomTransform): void {
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
  private tweenCamera(computeTarget: () => D3ZoomTransform): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.d3 || !this.zoomedEl || !this.zoomBehavior) {
        resolve(false);
        return;
      }
      this.cancelCameraTween();
      this.cameraTweenResolve = resolve;
      this.isCameraTweening = true;
      const frameOwner = this.ownerWindow;
      if (!frameOwner) {
        this.isCameraTweening = false;
        this.cameraTweenResolve = undefined;
        resolve(false);
        return;
      }
      if (prefersReducedMotion(frameOwner)) {
        this.applyZoomTransform(computeTarget());
        this.isCameraTweening = false;
        this.cameraTweenResolve = undefined;
        resolve(true);
        return;
      }
      const current = this.d3.zoomTransform(this.zoomedEl);
      const duration = this.cameraTransitionMs();
      const start = frameOwner.performance.now();
      const startK = current.k as number;
      const startX = current.x as number;
      const startY = current.y as number;
      const step = (now: number): void => {
        if (this.cameraTweenResolve !== resolve) return;
        if (!this.isConnected || this.ownerWindow !== frameOwner) {
          this.cameraTweenId = undefined;
          this.cameraTweenFrameOwner = undefined;
          this.isCameraTweening = false;
          this.cameraTweenResolve = undefined;
          resolve(false);
          return;
        }
        const t = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
        const target = computeTarget();
        const targetK = target.k as number;
        const targetX = target.x as number;
        const targetY = target.y as number;
        this.applyZoomTransform(
          this.d3!.zoomIdentity.translate(
            startX + (targetX - startX) * t,
            startY + (targetY - startY) * t
          ).scale(startK + (targetK - startK) * t)
        );
        if (t < 1) {
          this.cameraTweenFrameOwner = frameOwner;
          this.cameraTweenId = frameOwner.requestAnimationFrame(step);
        } else {
          this.cameraTweenId = undefined;
          this.cameraTweenFrameOwner = undefined;
          this.isCameraTweening = false;
          this.cameraTweenResolve = undefined;
          resolve(true);
        }
      };
      this.cameraTweenFrameOwner = frameOwner;
      this.cameraTweenId = frameOwner.requestAnimationFrame(step);
    });
  }

  /** Animates the camera so `id` centers in the viewport (the `width` x `height` viewBox), at
   *  `options.zoom` (clamped to `[minZoom, maxZoom]`) or the current scale when omitted. Resolves
   *  `true` on arrival; `false` for an id with no matching entry in `simNodes` -- there's nothing
   *  to center on. Announces `graphNodeFocused` through the shared light-DOM sink. Does not move DOM
   *  focus -- this is a camera operation, not a roving-focus one. */
  async focusNode(id: string, options?: { zoom?: number }): Promise<boolean> {
    const node = this.simNodes.find((n) => n.id === id);
    if (!node || !this.d3 || !this.zoomedEl || !this.zoomBehavior) return false;
    const current = this.d3.zoomTransform(this.zoomedEl);
    const bounds = this.effectiveZoomBounds;
    const k = finiteRange(
      options?.zoom ?? (current.k as number),
      current.k as number,
      bounds.min,
      bounds.max
    );
    const arrived = await this.tweenCamera(() =>
      this.d3!.zoomIdentity.translate(
        this.safeWidth / 2 - k * (node.x ?? 0),
        this.safeHeight / 2 - k * (node.y ?? 0)
      ).scale(k)
    );
    if (arrived) {
      this.graphLiveText = this.localize('graphNodeFocused', undefined, {
        label: this.nodeAccessibleText(node),
      });
    }
    return arrived;
  }

  /** Animates the camera to frame the bounding box of every currently visible node position (plus
   *  each node's own radius) at the largest scale that fits within `width` x `height` minus
   *  `padding` viewport-px on each side (clamped to `[minZoom, maxZoom]`). Silent -- no data
   *  changed, so no announcement. A no-op with no visible nodes. */
  fit(options?: { padding?: number }): void {
    if (
      !this.d3 ||
      !this.zoomedEl ||
      !this.zoomBehavior ||
      !this.simNodes.length
    )
      return;
    const padding = finiteRange(options?.padding ?? 24, 24, 0);
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
      const bounds = this.effectiveZoomBounds;
      const k = finiteRange(
        Math.min(availW / boxW, availH / boxH),
        bounds.min,
        bounds.min,
        bounds.max
      );
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      return this.d3!.zoomIdentity.translate(
        this.safeWidth / 2 - k * cx,
        this.safeHeight / 2 - k * cy
      ).scale(k);
    });
  }

  private updateFocusHalo(): void {
    if (!this.focusHaloEl) return;
    const node =
      this.focusNodeId != null
        ? this.simNodes.find((n) => n.id === this.focusNodeId)
        : undefined;
    if (node) {
      this.focusHaloEl.setAttribute('cx', String(node.x ?? 0));
      this.focusHaloEl.setAttribute('cy', String(node.y ?? 0));
      this.focusHaloEl.setAttribute(
        'r',
        String(this.nodeRadius(node) + FOCUS_HALO_PADDING)
      );
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
    this.ensureCanvasOwnerRealm();
    this.watchCanvasResize();
    this.watchCanvasDpr();
    this.canvasTooltipEl =
      (this.renderRoot.querySelector('[part="tooltip"]') as HTMLDivElement) ??
      undefined;
    // bindCanvasPointer() (which owns onCanvasDblClick) is bound BEFORE bindCanvasZoom() -- both
    // end up with a 'dblclick' listener on this same <canvas>, and d3-zoom's own default
    // double-click-to-zoom-in handler calls stopImmediatePropagation() unconditionally (see
    // onCanvasDblClick()'s own comment). Registering first means onCanvasDblClick() runs first and
    // gets the chance to itself stop the event (only when it actually hit a node) before d3-zoom's
    // handler would otherwise suppress it from ever being observed at all.
    this.bindCanvasPointer();
    this.bindCanvasZoom();
  }

  private ensureCanvasOwnerRealm(): void {
    const ownerDocument = this.ownerDocument;
    if (this.edgeLabelMeasureCanvas?.ownerDocument !== ownerDocument) {
      this.edgeLabelMeasureCanvas = undefined;
      this.edgeLabelMeasureCtx = undefined;
      this.edgeLabelWidthCache.clear();
    }
    if (!this.pickCanvas && this.renderer !== 'canvas') return;
    if (this.pickCanvas?.ownerDocument === ownerDocument) return;
    this.pickCanvas = ownerDocument.createElement('canvas');
    this.pickCtx = this.pickCanvas.getContext('2d', {
      willReadFrequently: true,
    });
    this.pickDirty = true;
  }

  private watchCanvasResize(): void {
    // Re-arming replaces the observer instance -- disconnect the previous one first, or a
    // canvas -> svg -> canvas renderer round trip leaves an orphaned observer still watching the
    // host (disconnectedCallback only ever cleans up whichever instance is current).
    this.canvasResizeObserver?.disconnect();
    const ResizeObserverCtor = this.ownerWindow?.ResizeObserver;
    if (!ResizeObserverCtor) {
      this.canvasResizeObserver = undefined;
      return;
    }
    this.canvasResizeObserver = new ResizeObserverCtor(() =>
      this.markCanvasDirty()
    );
    this.canvasResizeObserver.observe(this);
  }

  private watchCanvasDpr(): void {
    // A MediaQueryList's `matches` is fixed at creation time, so crossing the DPR threshold it was
    // built for means building a fresh one for the new ratio -- remove the previous instance's
    // listener first, or it leaks (disconnectedCallback only ever cleans up whichever is current).
    this.canvasDprQuery?.removeEventListener('change', this.onCanvasDprChange);
    const view = this.ownerWindow;
    if (!view?.matchMedia) {
      this.canvasDprQuery = undefined;
      return;
    }
    this.canvasDprQuery = view.matchMedia(
      `(resolution: ${view.devicePixelRatio}dppx)`
    );
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
    // markCanvasDirty()/markCanvasCameraDirty() are the only two callers, so gating here (rather
    // than at each of their own many call sites -- onTick(), drag, resize, DPR change, zoom) is
    // the single choke point every canvas redraw request funnels through. Remembers the request
    // instead of dropping it, so the connectedCallback() IntersectionObserver above can issue
    // exactly one catch-up draw once this becomes visible again.
    if (!this.visible) {
      this.canvasDrawPending = true;
      return;
    }
    if (this.canvasDrawRafId != null) return;
    const frameOwner = this.ownerWindow;
    if (!frameOwner) return;
    this.canvasDrawRafOwner = frameOwner;
    this.canvasDrawRafId = frameOwner.requestAnimationFrame(() => {
      this.canvasDrawRafId = undefined;
      this.canvasDrawRafOwner = undefined;
      if (!this.isConnected || this.ownerWindow !== frameOwner) return;
      this.drawCanvas();
    });
  }

  /** Resolves every accepted CSS color through the live cascade before it reaches Canvas 2D.
   * Canvas does not consistently accept CSS-wide keywords, custom properties, or newer color
   * functions even when the style engine does. A shadow child inherits the same host tokens and
   * `color` as the rendered graph, so its computed `color` is the concrete, canvas-safe value. */
  private resolveCssColorWithProbe(value: string, probe: HTMLElement): string {
    const cached = this.resolvedCssColorCache.get(value);
    if (cached !== undefined) return cached;
    probe.style.color = '';
    probe.style.color = value;
    const resolved = getComputedStyle(probe).color.trim();
    const result = resolved || getComputedStyle(this).color || 'transparent';
    this.resolvedCssColorCache.set(value, result);
    return result;
  }

  private createCanvasColorProbe(): HTMLElement {
    const probe = this.ownerDocument.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.position = 'absolute';
    probe.style.inlineSize = '0';
    probe.style.blockSize = '0';
    probe.style.overflow = 'hidden';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    this.renderRoot.append(probe);
    return probe;
  }

  private withCanvasColorResolver<T>(
    callback: (resolve: (value: string) => string) => T
  ): T {
    const probe = this.createCanvasColorProbe();
    try {
      return callback((value) => this.resolveCssColorWithProbe(value, probe));
    } finally {
      probe.remove();
    }
  }

  private buildCanvasScene(cs: CSSStyleDeclaration): CanvasScene {
    return this.withCanvasColorResolver((resolveColor) => {
      const hullFillDefault =
        cs.getPropertyValue('--lr-graph-hull-fill').trim() ||
        cs.getPropertyValue('--lr-color-brand').trim();
      const hulls = this.visibleCommunities().map((entry) => ({
        d: hullPathD(this.communityHull(entry.members)),
        fill: resolveColor(
          sanitizeNodeColor(entry.community.color) ?? hullFillDefault
        ),
      }));
      const linkColorDefault =
        cs.getPropertyValue('--lr-link-color').trim() ||
        cs.getPropertyValue('--lr-color-border').trim();
      const links = this.simLinks.map((l) => {
        const coords = this.linkCoordinates(l);
        const own = sanitizeNodeColor(l.color);
        return {
          x1: coords.x1,
          y1: coords.y1,
          x2: coords.x2,
          y2: coords.y2,
          color: resolveColor(own ?? linkColorDefault),
          width: this.safeLinkWidth(l),
          dash: l.dash,
          directed: l.directed,
          selected: this.isSelected('link', this.linkKey(l)),
          dimmed: this.isDimmed('link', this.linkKey(l)),
        };
      });
      const edgeLabels =
        this.showEdgeLabels && this.canvasCamera.k >= this.safeEdgeLabelMinZoom
          ? this.simLinks.flatMap((l) => {
              const label = ownGraphText(l, 'label');
              if (!label) return [];
              const pos = this.edgeLabelPosition(l);
              const coords = this.linkCoordinates(l);
              const edgeLength = Math.hypot(
                coords.x2 - coords.x1,
                coords.y2 - coords.y1
              );
              const tooLong =
                this.edgeLabelWidth(label) >
                edgeLength * EDGE_LABEL_LENGTH_GATE_RATIO;
              return tooLong ? [] : [{ x: pos.x, y: pos.y, text: label }];
            })
          : [];
      const nodeFillDefault =
        cs.getPropertyValue('--lr-node-fill').trim() ||
        cs.getPropertyValue('--lr-color-brand').trim();
      const nodes = this.simNodes.map((n) => {
        const fill = this.nodeFill(n);
        return {
          x: n.x ?? 0,
          y: n.y ?? 0,
          r: this.nodeRadius(n),
          shape: this.nodeShape(n),
          fill: resolveColor(fill ?? nodeFillDefault),
          selected: this.isSelected('node', n.id),
          dimmed: this.isDimmed('node', n.id),
        };
      });
      const nodeLabels = this.simNodes.flatMap((n) => {
        const label = ownGraphText(n, 'label');
        return label
          ? [
              {
                x: (n.x ?? 0) + this.nodeRadius(n) + 2,
                y: n.y ?? 0,
                text: label,
              },
            ]
          : [];
      });
      const expandIndicators = this.simNodes
        .filter((n) => n.expandable)
        .map((n) => ({ x: n.x ?? 0, y: n.y ?? 0, r: this.nodeRadius(n) }));
      const focusNode =
        this.focusNodeId != null
          ? this.simNodes.find((n) => n.id === this.focusNodeId)
          : undefined;
      const focusedPart =
        activeElementIn(this.shadowRoot)?.getAttribute('part')?.split(/\s+/) ??
        [];
      const activeIdentity = focusedPart.includes('cursor-item')
        ? this.graphItemIdentity(this.normalizedGraphItem())
        : undefined;
      const activeNode =
        activeIdentity?.kind === 'node'
          ? this.simNodes.find((node) => node.id === activeIdentity.id)
          : undefined;
      const activeLink =
        activeIdentity?.kind === 'link'
          ? this.navigableLinks().find(
              (link) => this.linkKey(link) === activeIdentity.id
            )
          : undefined;
      const activeCommunity =
        activeIdentity?.kind === 'community'
          ? this.visibleCommunities().find(
              (entry) => entry.community.id === activeIdentity.id
            )
          : undefined;
      const activeLinkCoordinates = activeLink
        ? this.linkCoordinates(activeLink)
        : undefined;
      return {
        hulls,
        links,
        edgeLabels,
        nodes,
        nodeLabels,
        expandIndicators,
        focusHalo: focusNode
          ? {
              x: focusNode.x ?? 0,
              y: focusNode.y ?? 0,
              r: this.nodeRadius(focusNode) + FOCUS_HALO_PADDING,
            }
          : undefined,
        keyboardFocusRing: activeNode
          ? {
              x: activeNode.x ?? 0,
              y: activeNode.y ?? 0,
              r: this.nodeRadius(activeNode) + 4,
            }
          : undefined,
        keyboardFocusLink:
          activeLink && activeLinkCoordinates
            ? {
                ...activeLinkCoordinates,
                width: this.safeLinkWidth(activeLink),
              }
            : undefined,
        keyboardFocusHull: activeCommunity
          ? { d: hullPathD(this.communityHull(activeCommunity.members)) }
          : undefined,
        showNodeLabels: this.canvasCamera.k >= CANVAS_NODE_LABEL_MIN_ZOOM,
        haloColor: resolveColor(
          this.ownerWindow?.matchMedia?.('(forced-colors: active)').matches
            ? 'CanvasText'
            : cs.getPropertyValue('--lr-graph-focus-halo-color').trim() ||
                cs.getPropertyValue('--lr-color-brand').trim()
        ),
        selectedColor: resolveColor(
          cs.getPropertyValue('--lr-graph-selected-color').trim() ||
            cs.getPropertyValue('--lr-color-success').trim()
        ),
        dimmedOpacity: (() => {
          const value = Number(
            cs.getPropertyValue('--lr-graph-dimmed-opacity').trim()
          );
          return Number.isFinite(value)
            ? Math.min(1, Math.max(0, value))
            : 0.35;
        })(),
        hullOpacity: (() => {
          const value = Number(
            cs.getPropertyValue('--lr-graph-hull-opacity').trim()
          );
          return Number.isFinite(value)
            ? Math.min(1, Math.max(0, value))
            : 0.12;
        })(),
        labelColor: resolveColor(cs.getPropertyValue('--lr-color-text').trim()),
        labelHaloColor: resolveColor(
          cs.getPropertyValue('--lr-graph-edge-label-halo').trim() ||
            cs.getPropertyValue('--lr-color-surface').trim()
        ),
        expandBadgeFill: resolveColor(
          cs.getPropertyValue('--lr-color-surface').trim()
        ),
        expandBadgeStroke: resolveColor(
          cs.getPropertyValue('--lr-color-border-strong').trim()
        ),
        font: `${this.edgeLabelFontPx()}px ${
          cs.getPropertyValue('--lr-font').trim() || 'sans-serif'
        }`,
      };
    });
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
    const dpr = this.ownerWindow?.devicePixelRatio || 1;
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
    const edgeLabelsVisible =
      this.showEdgeLabels && this.canvasCamera.k >= this.safeEdgeLabelMinZoom;
    const nodeLabelsVisible = this.canvasCamera.k >= CANVAS_NODE_LABEL_MIN_ZOOM;
    if (
      !this.canvasScene ||
      this.canvasScene.showNodeLabels !== nodeLabelsVisible ||
      this.canvasSceneHasEdgeLabels !== edgeLabelsVisible
    ) {
      this.canvasScene = this.buildCanvasScene(this.computedStyle());
      this.canvasSceneHasEdgeLabels = edgeLabelsVisible;
    }
    drawGraphScene(ctx, this.canvasCamera, this.canvasScene);
  }

  // ---------------------------------------------------------------------------------------------
  // renderer="canvas": color-picking hit-testing, pointer interaction, and the hover tooltip.
  // ---------------------------------------------------------------------------------------------

  private rebuildPickItems(): void {
    this.pickItems = [
      ...this.visibleCommunities().map((entry) => ({
        kind: 'hull' as const,
        entry,
      })),
      ...this.navigableLinks().map((link) => ({ kind: 'link' as const, link })),
      ...this.simNodes.map((node) => ({ kind: 'node' as const, node })),
    ];
  }

  private redrawPickCanvas(): void {
    if (!this.pickCtx || !this.canvasEl || !this.pickCanvas) return;
    if (
      this.pickCanvas.width !== this.canvasEl.width ||
      this.pickCanvas.height !== this.canvasEl.height
    ) {
      this.pickCanvas.width = this.canvasEl.width;
      this.pickCanvas.height = this.canvasEl.height;
    }
    this.rebuildPickItems();
    const dpr = this.ownerWindow?.devicePixelRatio || 1;
    this.pickCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPickingScene(this.pickCtx, this.canvasCamera, {
      hulls: this.pickItems
        .filter(
          (
            i
          ): i is Extract<(typeof this.pickItems)[number], { kind: 'hull' }> =>
            i.kind === 'hull'
        )
        .map((i) => ({ d: hullPathD(this.communityHull(i.entry.members)) })),
      links: this.pickItems
        .filter(
          (
            i
          ): i is Extract<(typeof this.pickItems)[number], { kind: 'link' }> =>
            i.kind === 'link'
        )
        .map((i) => {
          const c = this.linkCoordinates(i.link);
          return {
            x1: c.x1,
            y1: c.y1,
            x2: c.x2,
            y2: c.y2,
            width: this.safeLinkWidth(i.link),
          };
        }),
      nodes: this.pickItems
        .filter(
          (
            i
          ): i is Extract<(typeof this.pickItems)[number], { kind: 'node' }> =>
            i.kind === 'node'
        )
        .map((i) => ({
          x: i.node.x ?? 0,
          y: i.node.y ?? 0,
          r: this.nodeRadius(i.node) + 2,
          shape: this.nodeShape(i.node),
        })),
    });
    this.pickDirty = false;
  }

  private hitTest(
    clientX: number,
    clientY: number
  ): (typeof this.pickItems)[number] | undefined {
    if (!this.canvasEl || !this.pickCtx) return undefined;
    if (this.pickDirty) this.redrawPickCanvas();
    const rect = this.canvasEl.getBoundingClientRect();
    const dpr = this.ownerWindow?.devicePixelRatio || 1;
    const px = Math.round((clientX - rect.left) * dpr);
    const py = Math.round((clientY - rect.top) * dpr);
    if (
      px < 0 ||
      py < 0 ||
      px >= this.pickCtx.canvas.width ||
      py >= this.pickCtx.canvas.height
    )
      return undefined;
    const data = this.pickCtx.getImageData(px, py, 1, 1).data;
    const index = pickColorToIndex(data[0]!, data[1]!, data[2]!);
    return index >= 0 ? this.pickItems[index] : undefined;
  }

  private bindCanvasZoom(): void {
    if (!this.d3 || !this.canvasEl) return;
    const bounds = this.effectiveZoomBounds;
    const zoomBehavior = this.d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([bounds.min, bounds.max])
      .on('start', () => {
        // Same self-triggered-echo guard as the svg zoom bind's own 'start' handler above (see its
        // comment) -- a camera tween's per-frame applyZoomTransform() call fires this synchronously,
        // and without the guard cancelCameraTween() here would cancel that very tween on its own
        // first frame.
        if (this.isApplyingZoomTransform) return;
        this.isPanning = true;
        this.cancelCameraTween();
      })
      .on('zoom', (event) => {
        this.canvasCamera = {
          k: event.transform.k,
          x: event.transform.x,
          y: event.transform.y,
        };
        this.markCanvasCameraDirty();
        this.scheduleViewportChange();
      })
      .on('end', () => {
        this.isPanning = false;
      });
    this.zoomBehavior = zoomBehavior as unknown as typeof this.zoomBehavior;
    this.d3
      .select<HTMLCanvasElement, unknown>(this.canvasEl)
      .call(zoomBehavior);
  }

  private bindCanvasPointer(): void {
    const canvas = this.canvasEl!;
    canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    canvas.addEventListener('pointermove', this.onCanvasPointerMove);
    canvas.addEventListener('pointerup', this.onCanvasPointerUp);
    canvas.addEventListener('pointercancel', this.onCanvasPointerCancel);
    canvas.addEventListener(
      'lostpointercapture',
      this.onCanvasLostPointerCapture
    );
    canvas.addEventListener('pointerleave', this.onCanvasPointerLeave);
    canvas.addEventListener('dblclick', this.onCanvasDblClick);
  }

  private onCanvasPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return; // primary button only, matching native `click`'s own semantics
    this.canvasPointerDownAt = { x: e.clientX, y: e.clientY };
    this.canvasPointerDownId = e.pointerId;
    if (this.layout === 'layered') return; // drag disabled in layered mode, same as svg mode
    const hit = this.hitTest(e.clientX, e.clientY);
    if (hit?.kind === 'node') {
      this.canvasDragNode = hit.node;
      this.canvasPointerId = e.pointerId;
      try {
        this.canvasEl!.setPointerCapture(e.pointerId);
      } catch {
        // A synthetic/non-driver pointerId (e.g. dispatched by a test) isn't a real active
        // pointer some engines will capture -- the drag state above still tracks it via
        // pointermove/pointerup, matching finishCanvasNodeDrag()'s equivalent guard around
        // releasePointerCapture() below.
      }
      hit.node.fx = hit.node.x;
      hit.node.fy = hit.node.y;
      this.simulation?.alphaTarget(0.3).restart();
    }
  };

  private onCanvasPointerMove = (e: PointerEvent): void => {
    if (this.canvasDragNode && this.canvasPointerId === e.pointerId) {
      const rect = this.canvasEl!.getBoundingClientRect();
      this.canvasDragNode.fx =
        (e.clientX - rect.left - this.canvasCamera.x) / this.canvasCamera.k;
      this.canvasDragNode.fy =
        (e.clientY - rect.top - this.canvasCamera.y) / this.canvasCamera.k;
      this.markCanvasDirty();
      return;
    }
    // Coalesce hover hit-testing to one per animation frame (see pendingHover's doc) -- only the
    // latest position matters, and running the readback-per-pointermove would multiply the cost
    // by however many moves the browser delivers between paints.
    this.pendingHover = { x: e.clientX, y: e.clientY };
    if (this.hoverRafId != null) return;
    const frameOwner = this.ownerWindow;
    if (!frameOwner) return;
    this.hoverRafOwner = frameOwner;
    this.hoverRafId = frameOwner.requestAnimationFrame(() => {
      this.hoverRafId = undefined;
      this.hoverRafOwner = undefined;
      if (!this.isConnected || this.ownerWindow !== frameOwner) return;
      const pending = this.pendingHover;
      this.pendingHover = undefined;
      if (!pending) return;
      if (this.canvasHoverSuppressed()) return;
      // While the force simulation is still ticking, every tick invalidates the pick canvas, so
      // resolving hover here would re-render the full offscreen picking scene once per frame on
      // top of the per-tick visible redraw -- and the result would be stale a frame later anyway,
      // since positions are still moving. Defer hover resolution until the layout settles; the
      // next pointermove after that picks it up.
      if (this.pickDirty && this.simulationIsTicking()) return;
      const hit = this.hitTest(pending.x, pending.y);
      this.updateCanvasTooltip(hit, pending.x, pending.y);
      this.updateCanvasHover(hit);
    });
  };

  /** `alpha` decays toward `alphaMin` and d3-force stops its internal timer once it crosses below
   *  it, so `alpha > alphaMin` mirrors the simulation's own running condition -- including a drag's
   *  `alphaTarget(0.3)` reheat, and correctly excluding a seeded/reduced-motion graph whose settle
   *  loop already converged synchronously. */
  private simulationIsTicking(): boolean {
    return (
      this.simulation != null &&
      this.simulation.alpha() > this.simulation.alphaMin()
    );
  }

  private onCanvasPointerUp = (e: PointerEvent): void => {
    // Starting a drag on a node (onCanvasPointerDown) and ending it here without ever crossing the
    // move-distance threshold below is exactly a plain click -- release the drag state first, but
    // keep going into the same click-vs-drag distance check every pointerup goes through, instead
    // of returning early and silently swallowing the click. This mirrors svg mode, where a plain
    // click on a node fires both d3-drag's own start/end (a no-op, since fx/fy never actually
    // moved) and the browser's native `click` event -- the two aren't mutually exclusive there
    // either.
    this.finishCanvasNodeDrag(e.pointerId);
    const down = this.takeCanvasPointerDown(e.pointerId);
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

  /** Releases the force pin and capture belonging to one active canvas node drag. Pointer state is
   *  cleared before `releasePointerCapture()` because that call may synchronously dispatch
   *  `lostpointercapture`; the resulting handler then observes an already-finished gesture. */
  private finishCanvasNodeDrag(
    pointerId?: number,
    releaseCapture = true,
    redraw = true
  ): void {
    const activePointerId = this.canvasPointerId;
    if (
      activePointerId == null ||
      (pointerId != null && pointerId !== activePointerId)
    )
      return;

    const node = this.canvasDragNode;
    this.canvasDragNode = undefined;
    this.canvasPointerId = undefined;
    this.simulation?.alphaTarget(0);
    if (node) {
      node.fx = null;
      node.fy = null;
    }

    if (releaseCapture && this.canvasEl) {
      try {
        this.canvasEl.releasePointerCapture(activePointerId);
      } catch {
        // Capture may already have been revoked by the browser before cancellation is delivered.
      }
    }

    if (redraw) this.markCanvasDirty();
    else {
      this.canvasScene = undefined;
      this.pickDirty = true;
    }
  }

  private takeCanvasPointerDown(
    pointerId?: number
  ): { x: number; y: number } | undefined {
    if (pointerId != null && this.canvasPointerDownId !== pointerId)
      return undefined;
    const down = this.canvasPointerDownAt;
    this.canvasPointerDownAt = undefined;
    this.canvasPointerDownId = undefined;
    return down;
  }

  private onCanvasPointerCancel = (e: PointerEvent): void => {
    this.finishCanvasNodeDrag(e.pointerId);
    this.takeCanvasPointerDown(e.pointerId);
  };

  private onCanvasLostPointerCapture = (e: PointerEvent): void => {
    this.finishCanvasNodeDrag(e.pointerId, false);
    this.takeCanvasPointerDown(e.pointerId);
  };

  private onCanvasPointerLeave = (): void => {
    // Drop any coalesced hover still waiting on its frame -- letting it run after the pointer
    // already left would re-show the tooltip this handler is about to hide.
    this.pendingHover = undefined;
    if (this.hoverRafId != null) {
      this.hoverRafOwner?.cancelAnimationFrame(this.hoverRafId);
      this.hoverRafId = undefined;
      this.hoverRafOwner = undefined;
    }
    this.updateCanvasTooltip(undefined, 0, 0);
    if (this.canvasHoverSuppressed()) this.canvasHover = undefined;
    else this.updateCanvasHover(undefined);
  };

  private canvasHoverSuppressed(): boolean {
    return (
      !!this.canvasDragNode ||
      this.isDragging ||
      this.isPanning ||
      this.isCameraTweening
    );
  }

  private updateCanvasHover(
    hit: (typeof this.pickItems)[number] | undefined
  ): void {
    const next: typeof this.canvasHover =
      hit?.kind === 'node'
        ? { kind: 'node', id: hit.node.id }
        : hit?.kind === 'link'
          ? {
              kind: 'link',
              id: this.linkKey(hit.link),
              detail: this.linkHoverDetail(hit.link),
            }
          : undefined;
    const previous = this.canvasHover;
    if (previous?.kind === next?.kind && previous?.id === next?.id) return;
    // Store the identity before notifying controlled consumers, whose handlers may synchronously
    // remove the graph or change its renderer. Rebuilt pick objects alone are not a transition.
    this.canvasHover = next;
    if (previous?.kind === 'node')
      this.emit('lr-node-leave', { nodeId: previous.id });
    else if (previous?.kind === 'link') this.emit('lr-link-leave', previous.detail);
    if (
      !this.isConnected ||
      this.renderer !== 'canvas' ||
      this.canvasHover !== next
    )
      return;
    if (next?.kind === 'node') this.emit('lr-node-enter', { nodeId: next.id });
    else if (next?.kind === 'link') this.emit('lr-link-enter', next.detail);
  }

  private onCanvasDblClick = (e: MouseEvent): void => {
    const hit = this.hitTest(e.clientX, e.clientY);
    const node =
      hit?.kind === 'node'
        ? hit.node
        : this.nodeAtCanvasPoint(e.clientX, e.clientY);
    if (!node) return; // background dblclick still reaches d3-zoom's own zoom-in, same as svg mode
    // d3-zoom's own default double-click-to-zoom-in handler is bound to this identical <canvas>
    // element (not an ancestor, so plain stopPropagation() -- which only blocks *bubbling*, not a
    // sibling listener on the very same target -- would not suppress it). Matches svg mode's own
    // onNodeDblClick(), which stops the equivalent bubble-phase echo on the svg one level up.
    e.stopImmediatePropagation();
    this.emit('lr-node-expand', { nodeId: node.id });
  };

  /** Geometric fallback for dblclick: browsers can deliver the event before the offscreen pick
   * canvas has painted the latest frame, while the simulation coordinates are already current. */
  private nodeAtCanvasPoint(
    clientX: number,
    clientY: number
  ): SimNode | undefined {
    if (!this.canvasEl) return undefined;
    const rect = this.canvasEl.getBoundingClientRect();
    const worldX =
      (clientX - rect.left - this.canvasCamera.x) / this.canvasCamera.k;
    const worldY =
      (clientY - rect.top - this.canvasCamera.y) / this.canvasCamera.k;
    let closest: SimNode | undefined;
    let closestDistance = Infinity;
    for (const node of this.simNodes) {
      const distance = Math.hypot(
        (node.x ?? 0) - worldX,
        (node.y ?? 0) - worldY
      );
      if (
        distance <= this.nodeRadius(node) + 2 / this.canvasCamera.k &&
        distance < closestDistance
      ) {
        closest = node;
        closestDistance = distance;
      }
    }
    return closest;
  }

  private updateCanvasTooltip(
    hit: (typeof this.pickItems)[number] | undefined,
    clientX: number,
    clientY: number
  ): void {
    if (!this.canvasTooltipEl) return;
    if (!hit || hit.kind === 'hull') {
      this.canvasTooltipEl.setAttribute('hidden', '');
      return;
    }
    const rect = this.canvasEl!.getBoundingClientRect();
    this.canvasTooltipEl.textContent =
      hit.kind === 'node'
        ? this.nodeTooltipText(hit.node)
        : this.linkTooltipText(hit.link);
    // `clientX - rect.left`/`clientY - rect.top` are physical viewport offsets, so they must be
    // written to the physical `left`/`top` -- a logical `inset-inline-start` maps to `right` under
    // RTL and would mirror the tooltip across the canvas instead of tracking the cursor.
    let left = clientX - rect.left;
    let top = clientY - rect.top;
    this.canvasTooltipEl.style.left = `${left}px`;
    this.canvasTooltipEl.style.top = `${top}px`;
    this.canvasTooltipEl.removeAttribute('hidden');
    const tooltipRect = this.canvasTooltipEl.getBoundingClientRect();
    const view = this.ownerWindow;
    if (!view) return;
    const minLeft = Math.max(0, rect.left);
    const maxRight = Math.min(view.innerWidth, rect.right);
    const minTop = Math.max(0, rect.top);
    const maxBottom = Math.min(view.innerHeight, rect.bottom);
    if (tooltipRect.right > maxRight) left -= tooltipRect.right - maxRight;
    if (tooltipRect.left < minLeft) left += minLeft - tooltipRect.left;
    if (tooltipRect.bottom > maxBottom) top -= tooltipRect.bottom - maxBottom;
    if (tooltipRect.top < minTop) top += minTop - tooltipRect.top;
    this.canvasTooltipEl.style.left = `${left}px`;
    this.canvasTooltipEl.style.top = `${top}px`;
  }

  private isSelected(kind: LyraGraphPickKind, id: string): boolean {
    return kind === 'node'
      ? canonicalIdentityList(this.selectedNodeIds).includes(id)
      : canonicalIdentityList(this.selectedLinkIds).includes(id);
  }

  private isDimmed(kind: LyraGraphPickKind, id: string): boolean {
    return kind === 'node'
      ? canonicalIdentityList(this.dimmedNodeIds).includes(id)
      : canonicalIdentityList(this.dimmedLinkIds).includes(id);
  }

  private linkKey(link: SimLink): string {
    return graphLinkIdentity(link);
  }

  /** Computes and emits the selection intent for activating `id`; never assigns
   *  `selectedNodeIds`/`selectedLinkIds` itself -- see the class doc's controlled-selection note. */
  private emitSelectionIntent(
    kind: LyraGraphPickKind,
    id: string,
    toggle: boolean
  ): void {
    if (this.selectionMode === 'none') return;
    const selected = this.isSelected(kind, id);
    if (this.selectionMode === 'single' || !toggle) {
      if (this.selectionMode === 'single' && selected) {
        this.emit('lr-selection-change', { nodeIds: [], linkIds: [] });
        return;
      }
      this.emit(
        'lr-selection-change',
        kind === 'node'
          ? { nodeIds: [id], linkIds: [] }
          : { nodeIds: [], linkIds: [id] }
      );
      return;
    }
    const selectedNodeIds = canonicalIdentityList(this.selectedNodeIds);
    const selectedLinkIds = canonicalIdentityList(this.selectedLinkIds);
    const nodeIds =
      kind === 'node'
        ? selected
          ? selectedNodeIds.filter((x) => x !== id)
          : [...selectedNodeIds, id]
        : selectedNodeIds;
    const linkIds =
      kind === 'link'
        ? selected
          ? selectedLinkIds.filter((x) => x !== id)
          : [...selectedLinkIds, id]
        : selectedLinkIds;
    this.emit('lr-selection-change', { nodeIds, linkIds });
  }

  private clearSelection(): void {
    if (this.selectionMode === 'none') return;
    if (
      !canonicalIdentityList(this.selectedNodeIds).length &&
      !canonicalIdentityList(this.selectedLinkIds).length
    )
      return;
    this.emit('lr-selection-change', { nodeIds: [], linkIds: [] });
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op today, but a future shared mixin under LyraElement must still run
    this.resolvedCssColorCache.clear();
    // Every update gets a fresh navigableLinks() result computed at most once (see that cache
    // field's own doc comment for why this can't be gated on graphItemsChanged like the sibling
    // caches below).
    this.navigableLinksCache = undefined;
    this.syncGraphHostRole();
    // Gates the mount-time selection announcement below -- selectedNodeIds/selectedLinkIds both
    // default to `[]`, a non-undefined default, so Lit marks them "changed" on the very first
    // update too. `wasMounting` is captured before flipping the flag so only that first pass is
    // excluded -- mirrors `<lr-branch-picker>`'s identical `isMounting` gate for its own
    // first-update announcement.
    const wasMounting = this.isMounting;
    this.isMounting = false;
    // rebuildSimulation() (re)assigns the simNodes/simLinks reactive
    // properties — doing that from willUpdate() folds them into the render
    // this same update is already about to perform. Doing it from updated()
    // instead would set a reactive property *after* the update completed,
    // which Lit schedules as a whole extra update pass (a dev-mode warning,
    // and pointless work).
    const structureChanged =
      this.d3 &&
      (changed.has('nodes') ||
        changed.has('links') ||
        changed.has('hiddenTypes') ||
        changed.has('layout') ||
        (this.layout === 'layered' && changed.has('linkDistance')));
    const graphItemsChanged = Boolean(
      structureChanged || changed.has('simNodes') || changed.has('communities')
    );
    const activePart =
      activeElementIn(this.shadowRoot)?.getAttribute('part') ?? '';
    const hadGraphItemFocus =
      graphItemsChanged &&
      ['node', 'link', 'hull', 'cursor-item'].includes(activePart);
    const previousIndex = this.normalizedGraphItem();
    const previousIdentity = graphItemsChanged
      ? this.graphItemIdentity(previousIndex)
      : undefined;

    if (structureChanged) {
      this.rebuildSimulation();
      // rebuildSimulation() reassigns simLinks -- the unconditional clear at the top of this
      // method already ran before that reassignment (previousIndex above can call
      // navigableLinks() and repopulate the cache from the OLD simLinks), so this needs its own
      // clear rather than relying on that earlier one.
      this.navigableLinksCache = undefined;
    }
    // rebuildSimulation() above always reassigns simNodes, so checking it here (after that call)
    // also catches a nodes/links/hiddenTypes-driven rebuild, not just a direct communities set.
    if (graphItemsChanged) {
      this.visibleCommunitiesCache = undefined;
      const retainedIndex = previousIdentity
        ? this.graphItemIndex(previousIdentity)
        : -1;
      const nextIndex =
        retainedIndex >= 0
          ? retainedIndex
          : this.normalizedGraphItem(previousIndex);
      this.activeGraphItem = nextIndex >= 0 ? nextIndex : 0;
      if (hadGraphItemFocus) {
        this.pendingGraphItemFocus = nextIndex >= 0 ? nextIndex : 'base';
        if (nextIndex >= 0)
          this.graphLiveText = this.graphItemAnnouncement(nextIndex);
      }
    }
    // Same reasoning as rebuildSimulation() above -- assigning graphLiveText from updated() would
    // schedule a whole extra update pass instead of landing in the render this update is already
    // about to perform.
    //
    // Compares values (via sameIds()), not just changed.has(): a host that recomputes
    // `.selectedNodeIds=${...}`/`.selectedLinkIds=${...}` inline on every render (the ordinary,
    // correct Lit pattern for a controlled prop) hands down a fresh array reference on every
    // unrelated re-render even when the actual selection never changed. Trusting changed.has()
    // alone re-announced "N selected" on every such re-render -- e.g. a live-region assertion
    // count observably doubling whenever this graph's own initial d3 load had already settled
    // (graphAnnouncementsReady) by the time an unrelated host re-render landed.
    const selectedNodeIdsChanged =
      changed.has('selectedNodeIds') &&
      !sameIds(
        changed.get('selectedNodeIds') as string[] | undefined,
        this.selectedNodeIds
      );
    const selectedLinkIdsChanged =
      changed.has('selectedLinkIds') &&
      !sameIds(
        changed.get('selectedLinkIds') as string[] | undefined,
        this.selectedLinkIds
      );
    if ((selectedNodeIdsChanged || selectedLinkIdsChanged) && !wasMounting) {
      this.graphLiveText = this.localize('graphSelectionCount', undefined, {
        count: getNumberFormat(this.effectiveLocale).format(
          canonicalIdentityList(this.selectedNodeIds).length +
            canonicalIdentityList(this.selectedLinkIds).length
        ),
      });
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // no-op today, but a future shared mixin under LyraElement must still run
    this.setAttribute('aria-busy', String(this.loading));

    const announceGraphText =
      this.graphAnnouncementsReady &&
      changed.has('graphLiveText') &&
      this.graphLiveText !== '';
    if (!this.loading && !this.loadFailed) this.graphAnnouncementsReady = true;
    if (announceGraphText)
      this.politeAnnouncementSink?.announce(this.graphLiveText);
    if (
      changed.has('loadFailed') &&
      changed.get('loadFailed') !== undefined &&
      this.loadFailed
    ) {
      this.assertiveAnnouncementSink?.announce(
        this.localize('graphMissingLibrary')
      );
    }

    if (!this.d3) return;
    if (
      !changed.has('nodes') &&
      !changed.has('links') &&
      !changed.has('hiddenTypes')
    ) {
      // These two branches are independent (not else-if): a consumer can set
      // width/height and chargeStrength/linkDistance in the same reactive
      // update batch, and both retunes must apply — not just whichever branch
      // happens to come first.
      if (changed.has('width') || changed.has('height')) {
        this.simulation?.force(
          'center',
          this.d3.forceCenter(this.safeWidth / 2, this.safeHeight / 2)
        );
        this.simulation?.alpha(0.1).restart();
      }
      if (changed.has('chargeStrength') || changed.has('linkDistance')) {
        // Without this branch, chargeStrength/linkDistance only took effect
        // the next time nodes/links also changed (rebuildSimulation() reads
        // them fresh) — retune the already-created force objects in place
        // instead of rebuilding the whole simulation.
        if (changed.has('chargeStrength'))
          this.chargeForce?.strength(this.safeChargeStrength);
        if (changed.has('linkDistance'))
          this.linkForce?.distance(this.safeLinkDistance);
        this.simulation?.alpha(0.3).restart();
      }
    }
    // simNodes/simLinks only ever change once per structural rebuild (see
    // rebuildSimulation()'s doc comment) — never on a tick — so gating the
    // node/link querySelectorAll scan on that is equivalent to "structurally
    // changed" without needing a separate flag.
    this.applyInteractions(changed);
    this.applyCanvasInteractions();
    if (this.focusNodeId == null) {
      this.lastAppliedFocusNodeId = null;
    } else if (
      this.focusNodeId !== this.lastAppliedFocusNodeId &&
      this.simNodes.some((n) => n.id === this.focusNodeId)
    ) {
      this.lastAppliedFocusNodeId = this.focusNodeId;
      void this.focusNode(this.focusNodeId);
    }
    this.updateFocusHalo();
    const pendingFocus = this.pendingGraphItemFocus;
    if (pendingFocus !== undefined) {
      this.pendingGraphItemFocus = undefined;
      if (pendingFocus === 'base') {
        (
          this.renderRoot.querySelector('[part="canvas"], [part="svg"]') as
            | HTMLElement
            | SVGElement
            | null
        )?.focus();
      } else {
        this.focusGraphItemElement(pendingFocus);
      }
    }
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
      this.canvasHover = undefined;
      this.zoomedEl = svgEl;
      // Both queries always find a match here: the outer <g> and the focus-halo <circle> are
      // unconditional parts of the same svg template that just produced svgEl above, not
      // conditionally rendered.
      this.gEl = this.renderRoot.querySelector('g') as SVGGElement;
      this.focusHaloEl = this.renderRoot.querySelector(
        '[part="focus-halo"]'
      ) as SVGCircleElement;
      const bounds = this.effectiveZoomBounds;
      const zoomBehavior = this.d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([bounds.min, bounds.max])
        .on('start', () => {
          // A camera tween writes a transform on every frame via applyZoomTransform(), which
          // itself synchronously replays this same 'start' handler -- ignore that self-triggered
          // echo so a tween doesn't cancel itself on its own first frame.
          if (this.isApplyingZoomTransform) return;
          this.isPanning = true;
          this.cancelCameraTween();
        })
        .on('zoom', (event) => {
          this.gEl?.setAttribute('transform', event.transform.toString());
          this.updateHitAreaZoomScale(event.transform.k);
          this.updateEdgeLabelZoomGate(event.transform.k);
          this.scheduleViewportChange();
        })
        .on('end', () => {
          this.isPanning = false;
        });
      this.zoomBehavior = zoomBehavior as unknown as typeof this.zoomBehavior;
      this.d3.select<SVGSVGElement, unknown>(svgEl).call(zoomBehavior);
      // `.call(zoomBehavior)` does not synchronously fire the 'zoom' handler above (only a real
      // user gesture or an explicit `.transform()` call does, and nothing in this component ever
      // calls `.transform()`) -- so the initial transform right here is always d3-zoom's own
      // identity transform, k=1. Apply the edge-label zoom gate against that known value now, or
      // it stays unset (edge labels wrongly visible) until the user's first pan/zoom, regardless
      // of what edgeLabelMinZoom actually is.
      this.updateHitAreaZoomScale(1);
      this.updateEdgeLabelZoomGate(1);
    } else if (
      this.zoomBehavior &&
      (changed.has('minZoom') || changed.has('maxZoom'))
    ) {
      const bounds = this.effectiveZoomBounds;
      this.zoomBehavior.scaleExtent([bounds.min, bounds.max]);
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

    const nodeEls = Array.from(
      this.renderRoot.querySelectorAll('[part="node"]')
    ) as SVGElement[];
    this.nodeEls = nodeEls;
    this.nodeHitEls = Array.from(
      this.renderRoot.querySelectorAll('[data-hit-area="node"]')
    ) as SVGLineElement[];
    this.nodeLabelEls = nodeEls.map(
      (el) =>
        (el.parentElement?.querySelector(
          '[part="label"]'
        ) as SVGTextElement | null) ?? null
    );
    this.expandIndicatorEls = nodeEls.map(
      (el) =>
        (el.parentElement?.querySelector(
          '[part="expand-indicator"]'
        ) as SVGGElement | null) ?? null
    );
    // Dangling stubs also carry part="link" (so they inherit the same themeable styling as a
    // real edge) -- excluded here explicitly so `linkEls` stays index-aligned with `simLinks`
    // rather than relying on stubs always sorting after real links in template/DOM order.
    this.linkEls = Array.from(
      this.renderRoot.querySelectorAll('[part="link"]:not([data-dangling])')
    ) as SVGLineElement[];
    this.linkHitEls = Array.from(
      this.renderRoot.querySelectorAll('[data-hit-area="link"]')
    ) as SVGLineElement[];
    this.linkLabelEls = this.linkEls.map(
      (el) =>
        (el.parentElement?.querySelector(
          '[part="link-label"]'
        ) as SVGTextElement | null) ?? null
    );
    this.linkLabelHiddenByLength = [];
    this.danglingLinkEls = Array.from(
      this.renderRoot.querySelectorAll('[part="link"][data-dangling]')
    ) as SVGLineElement[];
    this.communityHullEls = Array.from(
      this.renderRoot.querySelectorAll('[part="hull"]')
    ) as SVGPathElement[];
    this.communityHullHitEls = Array.from(
      this.renderRoot.querySelectorAll('[data-hit-area="hull"]')
    ) as SVGPathElement[];
    this.communityLabelEls = Array.from(
      this.renderRoot.querySelectorAll('[part="community-label"]')
    ) as SVGTextElement[];

    if (this.layout !== 'layered') {
      nodeEls.forEach((el, i) => {
        const n = this.simNodes[i];
        if (!n) return;
        for (const dragTarget of [el, this.nodeHitEls[i]]) {
          if (!dragTarget || this.boundNodeEls.has(dragTarget)) continue;
          this.boundNodeEls.add(dragTarget);
          this.d3!.select<Element, SimNode>(dragTarget).call(
            this.d3!.drag<Element, SimNode>()
              .on('start', (event) => {
                this.isDragging = true;
                // Keep a node drag from also triggering the svg's own pan gesture.
                (event.sourceEvent as Event | undefined)?.stopPropagation();
                if (!event.active) this.simulation?.alphaTarget(0.3).restart();
                n.fx = n.x;
                n.fy = n.y;
              })
              .on('drag', (event) => {
                n.fx = event.x;
                n.fy = event.y;
              })
              .on('end', (event) => {
                this.isDragging = false;
                if (!event.active) this.simulation?.alphaTarget(0);
                n.fx = null;
                n.fy = null;
              })
          );
        }
      });
    }
  }

  /**
   * Keeps SVG pointer strokes at their tokenized screen-space size. WebKit computes
   * `vector-effect: non-scaling-stroke` correctly but still hit-tests the pre-vector-effect,
   * transformed width, so explicit inverse zoom is required for the interactive geometry.
   */
  private updateHitAreaZoomScale(zoom: number): void {
    const safeZoom = finiteRange(zoom, 1, Number.EPSILON);
    this.gEl?.style.setProperty(
      '--_lr-graph-hit-area-scale',
      String(1 / safeZoom)
    );
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
    const bounds = this.effectiveZoomBounds;
    this.zoomBehavior?.scaleExtent([bounds.min, bounds.max]);
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
      if (n.x != null && n.y != null)
        this.lastPositionById.set(n.id, { x: n.x, y: n.y });
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
      const hit = this.nodeHitEls[i];
      if (hit) {
        hit.setAttribute('x1', String((n.x ?? 0) - NODE_HIT_SEGMENT_HALF));
        hit.setAttribute('y1', String(n.y ?? 0));
        hit.setAttribute('x2', String((n.x ?? 0) + NODE_HIT_SEGMENT_HALF));
        hit.setAttribute('y2', String(n.y ?? 0));
      }
      const label = this.nodeLabelEls[i];
      if (label) {
        label.setAttribute('x', String((n.x ?? 0) + this.nodeRadius(n) + 2));
        label.setAttribute('y', String(n.y ?? 0));
      }
    });
    this.simLinks.forEach((l, i) => {
      const line = this.linkEls[i];
      const coordinates = this.linkCoordinates(l);
      for (const target of [line, this.linkHitEls[i]]) {
        if (!target) continue;
        target.setAttribute('x1', String(coordinates.x1));
        target.setAttribute('y1', String(coordinates.y1));
        target.setAttribute('x2', String(coordinates.x2));
        target.setAttribute('y2', String(coordinates.y2));
      }
    });
    if (this.showEdgeLabels) {
      this.simLinks.forEach((l, i) => {
        const labelEl = this.linkLabelEls[i];
        if (!labelEl) return;
        const label = ownGraphText(l, 'label');
        const pos = this.edgeLabelPosition(l);
        labelEl.setAttribute('x', String(pos.x));
        labelEl.setAttribute('y', String(pos.y));
        const { x1, y1, x2, y2 } = this.linkCoordinates(l);
        const edgeLength = Math.hypot(x2 - x1, y2 - y1);
        const tooLong =
          this.edgeLabelWidth(label ?? '') >
          edgeLength * EDGE_LABEL_LENGTH_GATE_RATIO;
        if (this.linkLabelHiddenByLength[i] !== tooLong) {
          this.linkLabelHiddenByLength[i] = tooLong;
          labelEl.setAttribute('visibility', tooLong ? 'hidden' : 'visible');
        }
      });
    }
    this.simNodes.forEach((n, i) => {
      const indicator = this.expandIndicatorEls[i];
      if (indicator)
        indicator.setAttribute(
          'transform',
          `translate(${n.x ?? 0},${n.y ?? 0})`
        );
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
      const hullHitEl = this.communityHullHitEls[i];
      const labelEl = this.communityLabelEls[i];
      if (!hullEl && !hullHitEl && !labelEl) return;
      const hull = this.communityHull(entry.members);
      if (hullEl) hullEl.setAttribute('d', hullPathD(hull));
      if (hullHitEl) hullHitEl.setAttribute('d', hullPathD(hull));
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
    const liveIds = new Set(this.graphModel.nodes.map((n) => n.id));
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
    const { resolved: resolvedLinks, dangling: danglingLinks } =
      this.resolveLinksAgainst(byId);
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
        return (
          (source.id === n.id && target.x != null) ||
          (target.id === n.id && source.x != null)
        );
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

    this.linkForce = this.d3
      .forceLink<SimNode, SimLink>(links)
      .distance(this.safeLinkDistance);
    this.chargeForce = this.d3
      .forceManyBody<SimNode>()
      .strength(this.safeChargeStrength);

    const simulation = this.d3
      .forceSimulation<SimNode, SimLink>(nodes)
      .force('link', this.linkForce)
      .force('charge', this.chargeForce)
      .force(
        'center',
        this.d3.forceCenter(this.safeWidth / 2, this.safeHeight / 2)
      )
      .force(
        'collide',
        this.d3
          .forceCollide<SimNode>()
          .radius((n: SimNode) => this.nodeRadius(n) + 10)
      )
      .on('tick', () => this.onTick());
    this.simulation = simulation;

    if (prefersReducedMotion(this.ownerWindow) || this.safeSeed != null) {
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
        const hadKnownPosition =
          prevById.has(n.id) || this.lastPositionById.has(n.id);
        if (
          hadKnownPosition &&
          n.x != null &&
          n.y != null &&
          n.fx == null &&
          n.fy == null
        ) {
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
      if (n.x != null && n.y != null)
        this.lastPositionById.set(n.id, { x: n.x, y: n.y });
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
    const totalNodeCount = this.graphModel.nodes.length;
    const hiddenNodeCount = totalNodeCount - visibleNodeCount;
    if (
      totalNodeCount > 0 &&
      (hiddenNodeCount > 0 || this.lastHiddenNodeCount > 0)
    ) {
      this.graphLiveText = this.localize('graphNodesHidden', undefined, {
        hidden: getNumberFormat(this.effectiveLocale).format(hiddenNodeCount),
        total: getNumberFormat(this.effectiveLocale).format(totalNodeCount),
      });
    }
    this.lastHiddenNodeCount = hiddenNodeCount;
  }

  /** The `layout="layered"` path: computes final positions synchronously via the shared
   *  `layeredLayout()` util (2r x 2r boxes, `gapY = linkDistance`, `gapX = 12`), centers the
   *  drawing in `width` x `height`, and skips forceSimulation() entirely -- no `this.simulation`,
   *  no ticking, no `prevById` carry-over (deterministic input -> output makes it unnecessary; a
   *  structural change simply recomputes wholesale). `lr-graph` never passes `fixedPositions`. */
  private rebuildLayeredLayout(visible: readonly LyraGraphNode[]): void {
    const boxes = visible.map((n) => {
      const r = this.nodeRadius(n);
      return { id: n.id, width: r * 2, height: r * 2 };
    });
    const visibleIds = new Set(visible.map((n) => n.id));
    const edges = this.graphModel.links
      .filter((l) => visibleIds.has(l.source) && visibleIds.has(l.target))
      .map((l) => ({ source: l.source, target: l.target }));
    const { positions: raw } = layeredLayout({
      nodes: boxes,
      edges,
      options: { gapX: 12, gapY: this.safeLinkDistance },
    });

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
    const offsetX = raw.size
      ? this.safeWidth / 2 - (minX + (maxX - minX) / 2)
      : this.safeWidth / 2;
    const offsetY = raw.size
      ? this.safeHeight / 2 - (minY + (maxY - minY) / 2)
      : this.safeHeight / 2;

    const nodes: SimNode[] = visible.map((n) => {
      // layeredLayout() (above) assigns a position for every node id in its `nodes` input, and
      // `boxes` (built from this same `visible` array) is exactly that input, so raw.get(n.id)
      // always finds a match here.
      const p = raw.get(n.id)!;
      return { ...n, x: p.x + offsetX, y: p.y + offsetY };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const { resolved, dangling } = this.resolveLinksAgainst(byId);
    this.danglingLinks = dangling;
    this.simulation = undefined;
    this.simNodes = nodes;
    this.simLinks = resolved;
    for (const n of nodes) {
      if (n.x != null && n.y != null)
        this.lastPositionById.set(n.id, { x: n.x, y: n.y });
    }
    this.announceHiddenNodeCount(nodes.length);
  }

  private onNodeClick(node: SimNode, e?: MouseEvent | KeyboardEvent): void {
    this.emit('lr-node-click', {
      nodeId: node.id,
      x: node.x ?? 0,
      y: node.y ?? 0,
    });
    this.emitSelectionIntent('node', node.id, !!(e?.ctrlKey || e?.metaKey));
  }

  /** Returns a node's current position in the graph's local drawing space. */
  getNodePosition(id: string): { x: number; y: number } | undefined {
    const node = this.simNodes.find((candidate) => candidate.id === id);
    if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y))
      return undefined;
    return { x: node.x!, y: node.y! };
  }

  private onLinkClick(link: SimLink, e?: MouseEvent | KeyboardEvent): void {
    const source =
      typeof link.source === 'object'
        ? (link.source as SimNode).id
        : String(link.source);
    const target =
      typeof link.target === 'object'
        ? (link.target as SimNode).id
        : String(link.target);
    this.emit('lr-link-click', {
      sourceNodeId: source,
      targetNodeId: target,
      ...(link.id ? { linkId: link.id } : {}),
    });
    this.emitSelectionIntent(
      'link',
      this.linkKey(link),
      !!(e?.ctrlKey || e?.metaKey)
    );
  }

  private onNodeEnter(node: SimNode, e: MouseEvent): void {
    if (this.isDragging || this.isPanning || this.isCameraTweening) return;
    (e.currentTarget as SVGElement).setAttribute('data-hovered', '');
    this.emit('lr-node-enter', { nodeId: node.id });
  }

  private onNodeLeave(node: SimNode, e: MouseEvent): void {
    if (this.isDragging || this.isPanning || this.isCameraTweening) return;
    (e.currentTarget as SVGElement).removeAttribute('data-hovered');
    this.emit('lr-node-leave', { nodeId: node.id });
  }

  private onNodeDblClick(node: SimNode, e: MouseEvent): void {
    // Stops the dblclick from also reaching the svg's own d3-zoom double-click-to-zoom-in
    // listener -- background double-click (not on a node) keeps that default behavior.
    e.stopPropagation();
    this.emit('lr-node-expand', { nodeId: node.id });
  }

  private onLinkEnter(link: SimLink, e: MouseEvent): void {
    if (this.isDragging || this.isPanning || this.isCameraTweening) return;
    (e.currentTarget as SVGElement).setAttribute('data-hovered', '');
    this.emit('lr-link-enter', this.linkHoverDetail(link));
  }

  private linkHoverDetail(
    link: SimLink
  ): LyraGraphEventMap['lr-link-enter']['detail'] {
    const source =
      typeof link.source === 'object'
        ? (link.source as SimNode).id
        : String(link.source);
    const target =
      typeof link.target === 'object'
        ? (link.target as SimNode).id
        : String(link.target);
    return {
      sourceNodeId: source,
      targetNodeId: target,
      ...(link.id ? { linkId: link.id } : {}),
    };
  }

  private onLinkLeave(link: SimLink, e: MouseEvent): void {
    if (this.isDragging || this.isPanning || this.isCameraTweening) return;
    (e.currentTarget as SVGElement).removeAttribute('data-hovered');
    this.emit('lr-link-leave', this.linkHoverDetail(link));
  }

  private nodeAccessibleText(node: LyraGraphNode): string {
    let text =
      ownGraphText(node, 'accessibleLabel') ||
      ownGraphText(node, 'label') ||
      node.id;
    const type = this.resolveNodeType(node);
    const typeLabel = type ? ownGraphText(type, 'label') : undefined;
    if (typeLabel !== undefined)
      text = this.localize('graphTypedNode', undefined, {
        label: text,
        type: typeLabel,
      });
    if (node.expandable)
      text = this.localize('graphExpandableItem', undefined, { item: text });
    return text;
  }

  /** One bounded tooltip/content-summary model shared by SVG, canvas and live announcements. */
  private boundedGraphText(value: unknown): string {
    if (typeof value !== 'string') return '';
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > 512
      ? `${normalized.slice(0, 512)}…`
      : normalized;
  }

  private nodeTooltipText(node: LyraGraphNode): string {
    return this.boundedGraphText(
      ownGraphText(node, 'description') ||
        ownGraphText(node, 'label') ||
        ownGraphText(node, 'accessibleLabel') ||
        node.id
    );
  }

  private linkAccessibleText(link: SimLink): string {
    const accessibleLabel = ownGraphText(link, 'accessibleLabel');
    if (accessibleLabel) return accessibleLabel;
    const sourceValue = ownGraphValue(link, 'source');
    const targetValue = ownGraphValue(link, 'target');
    const source =
      sourceValue !== null && typeof sourceValue === 'object'
        ? this.nodeAccessibleText(sourceValue as SimNode)
        : typeof sourceValue === 'string'
        ? sourceValue
        : '';
    const target =
      targetValue !== null && typeof targetValue === 'object'
        ? this.nodeAccessibleText(targetValue as SimNode)
        : typeof targetValue === 'string'
        ? targetValue
        : '';
    return (
      ownGraphText(link, 'label') ||
      this.localize('graphLink', undefined, { source, target })
    );
  }

  private linkTooltipText(link: SimLink): string {
    return this.boundedGraphText(
      ownGraphText(link, 'description') ||
        ownGraphText(link, 'label') ||
        ownGraphText(link, 'accessibleLabel') ||
        this.linkAccessibleText(link)
    );
  }

  private linkCoordinates(link: SimLink): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } {
    const source = link.source as SimNode;
    const target = link.target as SimNode;
    const x1 = source.x ?? 0;
    const y1 = source.y ?? 0;
    const targetX = target.x ?? 0;
    const targetY = target.y ?? 0;
    if (!link.directed || link.dangling)
      return { x1, y1, x2: targetX, y2: targetY };
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

  /** The edge-label font size in used pixels: `--lr-font-size-2xs` resolved against the live root
   *  (rem) or own (em) font size through the shared `resolveCssLength()`, so canvas text matches
   *  what the same token paints in CSS on a page that isn't at the default 16px root size. A token
   *  in a unit that has no used pixel length here (`ch`, `pt`, `calc()`) falls back to
   *  DEFAULT_EDGE_LABEL_FONT_PX rather than being measured as raw pixels. */
  private edgeLabelFontPx(): number {
    const raw = this.computedStyle()
      .getPropertyValue('--lr-font-size-2xs')
      .trim();
    return resolveCssLength(raw, { host: this }) ?? DEFAULT_EDGE_LABEL_FONT_PX;
  }

  private edgeLabelContext(): CanvasRenderingContext2D | null {
    if (this.edgeLabelMeasureCanvas?.ownerDocument !== this.ownerDocument) {
      this.edgeLabelMeasureCanvas = this.ownerDocument.createElement('canvas');
      this.edgeLabelMeasureCtx = this.edgeLabelMeasureCanvas.getContext('2d');
    }
    return this.edgeLabelMeasureCtx ?? null;
  }

  private edgeLabelWidth(text: string): number {
    const cached = this.edgeLabelWidthCache.get(text);
    if (cached != null) return cached;
    const ctx = this.edgeLabelContext();
    let width: number;
    if (ctx) {
      const fontFamily =
        this.computedStyle().getPropertyValue('--lr-font').trim() ||
        'sans-serif';
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
    if (k < this.safeEdgeLabelMinZoom)
      this.gEl.setAttribute('data-edge-labels-hidden', '');
    else this.gEl.removeAttribute('data-edge-labels-hidden');
  }

  /** The roving-tabindex/keyboard-cursor index space concatenates three item kinds in one order:
   *  nodes, then links, then community hulls. These two helpers are the single definition of where
   *  each later segment starts. Every consumer -- the total count, the identity/text
   *  decompositions, the reverse lookup, and both render branches' offscreen cursor items --
   *  derives from them, so adding a fourth kind or reordering the three is one edit instead of six
   *  that can silently fall out of step and point keyboard focus at the wrong item. */
  private linkIndexBase(): number {
    return this.simNodes.length;
  }

  private communityIndexBase(): number {
    return this.linkIndexBase() + this.navigableLinks().length;
  }

  private graphItemCount(): number {
    return this.communityIndexBase() + this.visibleCommunities().length;
  }

  private normalizedGraphItem(index = this.activeGraphItem): number {
    const count = this.graphItemCount();
    return count ? Math.min(Math.max(index, 0), count - 1) : -1;
  }

  private graphItemIdentity(index: number): GraphItemIdentity | undefined {
    if (index < 0) return undefined;
    if (index < this.linkIndexBase()) {
      const node = this.simNodes[index];
      return node ? { kind: 'node', id: node.id } : undefined;
    }
    if (index < this.communityIndexBase()) {
      const link = this.navigableLinks()[index - this.linkIndexBase()];
      return link ? { kind: 'link', id: this.linkKey(link) } : undefined;
    }
    const community =
      this.visibleCommunities()[index - this.communityIndexBase()]?.community;
    return community ? { kind: 'community', id: community.id } : undefined;
  }

  private graphItemIndex(identity: GraphItemIdentity): number {
    if (identity.kind === 'node')
      return this.simNodes.findIndex((node) => node.id === identity.id);
    if (identity.kind === 'link') {
      const index = this.navigableLinks().findIndex(
        (link) => this.linkKey(link) === identity.id
      );
      return index < 0 ? -1 : this.linkIndexBase() + index;
    }
    const index = this.visibleCommunities().findIndex(
      (entry) => entry.community.id === identity.id
    );
    return index < 0 ? -1 : this.communityIndexBase() + index;
  }

  private communityText(community: LyraGraphCommunity): string {
    return ownGraphText(community, 'label') ?? community.id;
  }

  private graphItemText(index: number): string {
    if (index < this.linkIndexBase()) {
      const node = this.simNodes[index];
      return node
        ? this.localize('graphNode', undefined, {
            label: this.nodeTooltipText(node),
          })
        : '';
    }
    if (index < this.communityIndexBase()) {
      const link = this.navigableLinks()[index - this.linkIndexBase()];
      return link ? this.linkTooltipText(link) : '';
    }
    const entry = this.visibleCommunities()[index - this.communityIndexBase()];
    return entry
      ? this.localize('graphCommunity', undefined, {
          label: this.communityText(entry.community),
          count: getNumberFormat(this.effectiveLocale).format(
            entry.members.length
          ),
        })
      : '';
  }

  private graphItemAnnouncement(index: number): string {
    return this.localize('graphItemAnnouncement', undefined, {
      item: this.graphItemText(index),
      index: getNumberFormat(this.effectiveLocale).format(index + 1),
      total: getNumberFormat(this.effectiveLocale).format(
        this.graphItemCount()
      ),
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
    void this.updateComplete.then(() => this.focusGraphItemElement(normalized));
  }

  private focusGraphItemElement(index: number): void {
    // renderer="canvas" has no [part="node"]/[part="link"]/[part="hull"] elements at all -- the
    // roving tab stop lives on the offscreen [part="cursor-item"] buttons instead (see render()),
    // in the same flat nodes-then-links-then-hulls order.
    // SVG keeps nonoperable links in the DOM without tabindex, matching navigableLinks()'s
    // exclusion from the logical index space used by both renderers.
    const items = (
      this.renderer === 'canvas'
        ? Array.from(this.renderRoot.querySelectorAll('[part="cursor-item"]'))
        : [
            ...Array.from(this.renderRoot.querySelectorAll('[part="node"]')),
            ...Array.from(
              this.renderRoot.querySelectorAll('[part="link"][tabindex]')
            ),
            ...Array.from(this.renderRoot.querySelectorAll('[part="hull"]')),
          ]
    ) as HTMLElement[];
    items[index]?.focus();
  }

  /**
   * The forward physical arrow key (`ArrowRight` in LTR, `ArrowLeft` under
   * `dir="rtl"` — see `isRtl()`) moves to the next roving-tabindex item, the
   * backward one to the previous, in flat array order (`simNodes` then
   * `simLinks`) — the same `forwardKey`/`backwardKey` swap this library's
   * other "physical arrow key drives sequential previous/next" components
   * (`<lr-tab-group>`, `<lr-slider>`, `<lr-segmented>`) apply under RTL.
   * `ArrowDown`/`ArrowUp` always mean next/previous regardless of direction.
   */
  private onGraphKeyDown(
    e: KeyboardEvent,
    index: number,
    activate: (e: KeyboardEvent) => void
  ): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.onGraphItemFocus(index);
      activate(e);
      if (index < this.simNodes.length) {
        const now = this.ownerWindow?.performance.now() ?? 0;
        if (
          this.lastKeyActivateIndex === index &&
          now - this.lastKeyActivateTime <= EXPAND_KEY_INTERVAL_MS
        ) {
          const node = this.simNodes[index];
          if (node) this.emit('lr-node-expand', { nodeId: node.id });
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
    if (e.key === forwardKey || e.key === 'ArrowDown')
      next = Math.min(count - 1, index + 1);
    else if (e.key === backwardKey || e.key === 'ArrowUp')
      next = Math.max(0, index - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    else return;
    e.preventDefault();
    this.focusGraphItem(next);
  }

  override render(): TemplateResult {
    if (this.loading) {
      return html`
        <div part="base">
          <lr-skeleton
            shape="rect"
            .announce=${false}
            style=${`--lr-skeleton-w:${this.safeWidth}px;--lr-skeleton-h:${this.safeHeight}px`}
          ></lr-skeleton>
          <span class="sr-only loading-label">${this.localize('loading')}</span>
        </div>
      `;
    }
    if (this.loadFailed) {
      return html`<div part="base">
        <div part="error">${this.localize('graphMissingLibrary')}</div>
      </div>`;
    }
    if (!this.graphModel.nodes.length) {
      return html`<div part="base">
        <div part="empty">${this.localize('noData')}</div>
      </div>`;
    }
    if (this.renderer === 'canvas') {
      const hostOwnsGraphSemantics = this.hostOwnsGraphSemantics();
      return html`
        <div part="base">
          <canvas
            part="canvas"
            role=${hostOwnsGraphSemantics ? nothing : 'group'}
            aria-label=${hostOwnsGraphSemantics
              ? nothing
              : this.accessibleLabel ??
                this.localize('graphDiagram', undefined, {
                  nodeCount: getNumberFormat(this.effectiveLocale).format(
                    this.simNodes.length
                  ),
                  linkCount: getNumberFormat(this.effectiveLocale).format(
                    this.simLinks.length
                  ),
                })}
            tabindex=${this.graphItemCount() ? '-1' : '0'}
          ></canvas>
          <div part="tooltip" hidden></div>
          <div part="live-region" class="sr-only" aria-hidden="true">
            ${this.graphLiveText ||
            (this.normalizedGraphItem() >= 0
              ? this.graphItemAnnouncement(this.normalizedGraphItem())
              : '')}
          </div>
          <ul
            part="data-list"
            class="sr-only"
            aria-label=${this.localize('graphDataList')}
          >
            ${this.simNodes.map(
              (node) =>
                html`<li>
                  ${this.localize('graphNode', undefined, {
                    label: this.nodeTooltipText(node),
                  })}
                </li>`
            )}
            ${this.simLinks.map(
              (link) => html`<li>${this.linkTooltipText(link)}</li>`
            )}
            ${this.visibleCommunities().map(
              (entry) =>
                html`<li>
                  ${this.localize('graphCommunity', undefined, {
                    label: this.communityText(entry.community),
                    count: getNumberFormat(this.effectiveLocale).format(
                      entry.members.length
                    ),
                  })}
                </li>`
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
                  aria-pressed=${this.selectionMode !== 'none'
                    ? String(this.isSelected('node', n.id))
                    : nothing}
                  @focus=${() => this.onGraphItemFocus(i)}
                  @keydown=${(e: KeyboardEvent) =>
                    this.onGraphKeyDown(e, i, (ev) => this.onNodeClick(n, ev))}
                  @click=${(e: MouseEvent) => this.onNodeClick(n, e)}
                ></button>
              `
            )}
            ${this.navigableLinks().map((l, li) => {
              const i = this.linkIndexBase() + li;
              return html`
                <!-- hit-area-exempt: see the node cursor-item above -- same offscreen
                     sr-only virtual-cursor button, no visible/pointer-clickable box. -->
                <button
                  part="cursor-item"
                  tabindex=${this.normalizedGraphItem() === i ? '0' : '-1'}
                  aria-label=${this.linkAccessibleText(l)}
                  aria-pressed=${this.selectionMode !== 'none'
                    ? String(this.isSelected('link', this.linkKey(l)))
                    : nothing}
                  @focus=${() => this.onGraphItemFocus(i)}
                  @keydown=${(e: KeyboardEvent) =>
                    this.onGraphKeyDown(e, i, (ev) => this.onLinkClick(l, ev))}
                  @click=${(e: MouseEvent) => this.onLinkClick(l, e)}
                ></button>
              `;
            })}
            ${this.visibleCommunities().map((entry, hi) => {
              const i = this.communityIndexBase() + hi;
              const label = this.localize('graphCommunity', undefined, {
                label: this.communityText(entry.community),
                count: getNumberFormat(this.effectiveLocale).format(
                  entry.members.length
                ),
              });
              return html`
                <!-- hit-area-exempt: see the node cursor-item above -- same offscreen
                     sr-only virtual-cursor button, no visible/pointer-clickable box. -->
                <button
                  part="cursor-item"
                  tabindex=${this.normalizedGraphItem() === i ? '0' : '-1'}
                  aria-label=${label}
                  @focus=${() => this.onGraphItemFocus(i)}
                  @keydown=${(e: KeyboardEvent) =>
                    this.onGraphKeyDown(e, i, () =>
                      this.onCommunityClick(entry.community)
                    )}
                  @click=${() => this.onCommunityClick(entry.community)}
                ></button>
              `;
            })}
          </div>
        </div>
      `;
    }
    const navigableLinks = this.navigableLinks();
    const hostOwnsGraphSemantics = this.hostOwnsGraphSemantics();
    return html`
      <div part="base">
        <svg
          part="svg"
          role=${hostOwnsGraphSemantics ? nothing : 'group'}
          aria-label=${hostOwnsGraphSemantics
            ? nothing
            : this.accessibleLabel ??
              this.localize('graphDiagram', undefined, {
                nodeCount: getNumberFormat(this.effectiveLocale).format(
                  this.simNodes.length
                ),
                linkCount: getNumberFormat(this.effectiveLocale).format(
                  this.simLinks.length
                ),
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
              const itemIndex = this.communityIndexBase() + hullIndex;
              const hull = this.communityHull(entry.members);
              const fill = sanitizeNodeColor(entry.community.color);
              const label = this.localize('graphCommunity', undefined, {
                label: this.communityText(entry.community),
                count: getNumberFormat(this.effectiveLocale).format(
                  entry.members.length
                ),
              });
              return svg`<g>
                <path
                  data-hit-area="hull"
                  aria-hidden="true"
                  focusable="false"
                  d=${hullPathD(hull)}
                  @click=${() => this.onCommunityClick(entry.community)}
                ></path>
                <path
                  part="hull"
                  role="button"
                  tabindex=${
                    this.normalizedGraphItem() === itemIndex ? '0' : '-1'
                  }
                  aria-label=${label}
                  d=${hullPathD(hull)}
                  style=${styleMap(
                    fill ? { '--lr-graph-hull-fill': fill } : {}
                  )}
                  @click=${() => this.onCommunityClick(entry.community)}
                  @focus=${() => this.onGraphItemFocus(itemIndex)}
                  @keydown=${(e: KeyboardEvent) =>
                    this.onGraphKeyDown(e, itemIndex, () =>
                      this.onCommunityClick(entry.community)
                    )}
                ></path>
                <text part="community-label" aria-hidden="true" x=${hullCentroidX(
                  hull
                )} y=${hullTopY(hull) - HULL_PADDING}>${this.communityText(
                entry.community
              )}</text>
              </g>`;
            })}
            ${this.simLinks.map((l) => {
              const navigableIndex = navigableLinks.indexOf(l);
              const interactive = navigableIndex >= 0;
              const itemIndex = interactive
                ? this.linkIndexBase() + navigableIndex
                : -1;
              const coordinates = this.linkCoordinates(l);
              const color = sanitizeNodeColor(l.color);
              const dash = normalizeLinkDash(l.dash);
              const visibleLabel = ownGraphText(l, 'label');
              const labelPos =
                this.showEdgeLabels && visibleLabel
                  ? this.edgeLabelPosition(l)
                  : undefined;
              const hitLineEl = svg`<line
                  data-hit-area="link"
                  ?data-inert=${!interactive}
                  aria-hidden="true"
                  focusable="false"
                  x1=${coordinates.x1}
                  y1=${coordinates.y1}
                  x2=${coordinates.x2}
                  y2=${coordinates.y2}
                  @click=${
                    interactive
                      ? (e: MouseEvent) => this.onLinkClick(l, e)
                      : nothing
                  }
                ></line>`;
              const lineEl = svg`<line
                  part="link"
                  role=${interactive ? 'button' : nothing}
                  tabindex=${
                    interactive
                      ? this.normalizedGraphItem() === itemIndex
                        ? '0'
                        : '-1'
                      : nothing
                  }
                  aria-label=${
                    interactive ? this.linkAccessibleText(l) : nothing
                  }
                  aria-hidden=${interactive ? nothing : 'true'}
                  aria-pressed=${
                    this.selectionMode !== 'none'
                      ? String(this.isSelected('link', this.linkKey(l)))
                      : nothing
                  }
                  ?data-selected=${this.isSelected('link', this.linkKey(l))}
                  ?data-dimmed=${this.isDimmed('link', this.linkKey(l))}
                  stroke-width=${this.safeLinkWidth(l)}
                  stroke-dasharray=${dash ?? nothing}
                  marker-end=${
                    l.directed ? `url(#${this.arrowMarkerId})` : nothing
                  }
                  style=${styleMap(color ? { '--lr-link-color': color } : {})}
                  x1=${coordinates.x1}
                  y1=${coordinates.y1}
                  x2=${coordinates.x2}
                  y2=${coordinates.y2}
                  @click=${
                    interactive
                      ? (e: MouseEvent) => this.onLinkClick(l, e)
                      : nothing
                  }
                  @focus=${
                    interactive
                      ? () => this.onGraphItemFocus(itemIndex)
                      : nothing
                  }
                  @keydown=${
                    interactive
                      ? (e: KeyboardEvent) =>
                          this.onGraphKeyDown(e, itemIndex, (ev) =>
                            this.onLinkClick(l, ev)
                          )
                      : nothing
                  }
                  @mouseenter=${
                    interactive
                      ? (e: MouseEvent) => this.onLinkEnter(l, e)
                      : nothing
                  }
                  @mouseleave=${
                    interactive
                      ? (e: MouseEvent) => this.onLinkLeave(l, e)
                      : nothing
                  }
                ><title>${this.linkTooltipText(l)}</title></line>`;
              // Only wrap in a <g> when a label will actually be drawn. The internal hit line can
              // remain a sibling, so an unlabeled public <line part="link"> keeps the same parent
              // and consumer-facing part geometry it had before the expanded target was added.
              return labelPos
                ? svg`<g>${hitLineEl}${lineEl}<text part="link-label" aria-hidden="true" text-anchor="middle" x=${labelPos.x} y=${labelPos.y}>${visibleLabel}</text></g>`
                : svg`${hitLineEl}${lineEl}`;
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
              const tabindex =
                this.normalizedGraphItem() === itemIndex ? '0' : '-1';
              const label = this.nodeAccessibleText(n);
              const visibleLabel = ownGraphText(n, 'label');
              // Unlike link styling below (which always renders style=${styleMap(...)}, even as
              // an empty string), an untyped/unknown-type node must render with NO style
              // attribute at all -- not just an empty one -- so hasAttribute('style') distinguishes
              // "no fill override" from "fill override present" for consumers/tests probing the DOM.
              const style = fill
                ? styleMap({ '--lr-node-fill': fill })
                : nothing;
              const title = svg`<title>${this.nodeTooltipText(n)}</title>`;
              const hitEl = svg`<line
                data-hit-area="node"
                aria-hidden="true"
                focusable="false"
                x1=${(n.x ?? 0) - NODE_HIT_SEGMENT_HALF}
                y1=${n.y ?? 0}
                x2=${(n.x ?? 0) + NODE_HIT_SEGMENT_HALF}
                y2=${n.y ?? 0}
                @click=${(e: MouseEvent) => this.onNodeClick(n, e)}
                @dblclick=${(e: MouseEvent) => this.onNodeDblClick(n, e)}
              ></line>`;
              const shapeEl =
                shape === 'circle'
                  ? svg`<circle
                      part="node"
                      role="button"
                      tabindex=${tabindex}
                      aria-label=${label}
                      aria-pressed=${
                        this.selectionMode !== 'none'
                          ? String(this.isSelected('node', n.id))
                          : nothing
                      }
                      ?data-selected=${this.isSelected('node', n.id)}
                      ?data-dimmed=${this.isDimmed('node', n.id)}
                      r=${this.nodeRadius(n)}
                      cx=${n.x ?? 0}
                      cy=${n.y ?? 0}
                      style=${style}
                      @click=${(e: MouseEvent) => this.onNodeClick(n, e)}
                      @dblclick=${(e: MouseEvent) => this.onNodeDblClick(n, e)}
                      @focus=${() => this.onGraphItemFocus(itemIndex)}
                      @keydown=${(e: KeyboardEvent) =>
                        this.onGraphKeyDown(e, itemIndex, (ev) =>
                          this.onNodeClick(n, ev)
                        )}
                      @mouseenter=${(e: MouseEvent) => this.onNodeEnter(n, e)}
                      @mouseleave=${(e: MouseEvent) => this.onNodeLeave(n, e)}
                    >${title}</circle>`
                  : svg`<path
                      part="node"
                      role="button"
                      tabindex=${tabindex}
                      aria-label=${label}
                      aria-pressed=${
                        this.selectionMode !== 'none'
                          ? String(this.isSelected('node', n.id))
                          : nothing
                      }
                      ?data-selected=${this.isSelected('node', n.id)}
                      ?data-dimmed=${this.isDimmed('node', n.id)}
                      d=${
                        shape === 'square'
                          ? squarePath(this.nodeRadius(n))
                          : diamondPath(this.nodeRadius(n))
                      }
                      transform="translate(${n.x ?? 0},${n.y ?? 0})"
                      style=${style}
                      @click=${(e: MouseEvent) => this.onNodeClick(n, e)}
                      @dblclick=${(e: MouseEvent) => this.onNodeDblClick(n, e)}
                      @focus=${() => this.onGraphItemFocus(itemIndex)}
                      @keydown=${(e: KeyboardEvent) =>
                        this.onGraphKeyDown(e, itemIndex, (ev) =>
                          this.onNodeClick(n, ev)
                        )}
                      @mouseenter=${(e: MouseEvent) => this.onNodeEnter(n, e)}
                      @mouseleave=${(e: MouseEvent) => this.onNodeLeave(n, e)}
                    >${title}</path>`;
              return svg`<g>
                ${hitEl}
                ${shapeEl}
                ${
                  visibleLabel
                    ? svg`<text part="label" aria-hidden="true" x=${
                        (n.x ?? 0) + this.nodeRadius(n) + 2
                      } y=${n.y ?? 0}>${visibleLabel}</text>`
                    : ''
                }
                ${
                  n.expandable
                    ? svg`<g part="expand-indicator" aria-hidden="true" transform="translate(${
                        n.x ?? 0
                      },${n.y ?? 0})">
                      <circle r=${EXPAND_BADGE_R} cx=${
                        this.nodeRadius(n) * EXPAND_BADGE_OFFSET
                      } cy=${
                        -this.nodeRadius(n) * EXPAND_BADGE_OFFSET
                      }></circle>
                      <path d="M ${
                        this.nodeRadius(n) * EXPAND_BADGE_OFFSET -
                        EXPAND_BADGE_R / 2
                      } ${-this.nodeRadius(n) * EXPAND_BADGE_OFFSET} L ${
                        this.nodeRadius(n) * EXPAND_BADGE_OFFSET +
                        EXPAND_BADGE_R / 2
                      } ${-this.nodeRadius(n) * EXPAND_BADGE_OFFSET} M ${
                        this.nodeRadius(n) * EXPAND_BADGE_OFFSET
                      } ${
                        -this.nodeRadius(n) * EXPAND_BADGE_OFFSET -
                        EXPAND_BADGE_R / 2
                      } L ${this.nodeRadius(n) * EXPAND_BADGE_OFFSET} ${
                        -this.nodeRadius(n) * EXPAND_BADGE_OFFSET +
                        EXPAND_BADGE_R / 2
                      }"></path>
                    </g>`
                    : ''
                }
              </g>`;
            })}
            <circle
              part="focus-halo"
              aria-hidden="true"
              hidden
              r="0"
              cx="0"
              cy="0"
            ></circle>
          </g>
        </svg>
        <div part="live-region" class="sr-only" aria-hidden="true">
          ${this.graphLiveText ||
          (this.normalizedGraphItem() >= 0
            ? this.graphItemAnnouncement(this.normalizedGraphItem())
            : '')}
        </div>
        <ul
          part="data-list"
          class="sr-only"
          aria-label=${this.localize('graphDataList')}
        >
          ${this.simNodes.map(
            (node) =>
              html`<li>
                ${this.localize('graphNode', undefined, {
                  label: this.nodeTooltipText(node),
                })}
              </li>`
          )}
          ${this.simLinks.map(
            (link) => html`<li>${this.linkTooltipText(link)}</li>`
          )}
          ${this.visibleCommunities().map(
            (entry) =>
              html`<li>
                ${this.localize('graphCommunity', undefined, {
                  label: this.communityText(entry.community),
                  count: getNumberFormat(this.effectiveLocale).format(
                    entry.members.length
                  ),
                })}
              </li>`
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
