import { html, nothing, svg, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { nextId, srOnly } from '../../internal/a11y.js';
import { isRtl } from '../../internal/rtl.js';
import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';
import { styles } from './graph.styles.js';
import { loadD3, type D3Modules } from './graph-loader.js';
import '../skeleton/skeleton.class.js';

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
}
/** A link whose `target` id has no matching node renders as a short dashed stub off `source`'s
 *  own position instead of being silently dropped -- e.g. for a wiki-style `[[link]]` reference to
 *  a not-yet-created page. A link whose `source` id has no matching node is still dropped
 *  entirely (there is no position to draw a stub from). */
export interface GraphLink {
  /** Optional stable id returned by `lyra-link-click`. */
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

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
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

/**
 * Rejects a `GraphNode.color` that could break out of the single
 * `--lyra-node-fill` custom-property declaration it's assigned to — `;`,
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

export interface LyraGraphEventMap {
  'lyra-node-click': CustomEvent<{ id: string }>;
  'lyra-link-click': CustomEvent<{ source: string; target: string; id?: string }>;
}
/**
 * `<lyra-graph>` — a force-directed node-link diagram with pan/zoom/drag.
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
 * @customElement lyra-graph
 * @event lyra-node-click - `detail: { id }`.
 * @event lyra-link-click - `detail: { source, target, id? }`.
 * @csspart base - The graph wrapper.
 * @csspart svg - The graph SVG.
 * @csspart node - A graph node.
 * @csspart link - A graph link.
 * @csspart arrowhead - The marker used by directed graph links.
 * @csspart label - A node label.
 * @csspart live-region - The current graph item announcement.
 * @csspart data-list - A visually hidden list alternative for graph data.
 * @csspart empty - The empty-state message, shown when `nodes` is empty.
 */
export class LyraGraph extends LyraElement<LyraGraphEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

  @property({ attribute: false }) nodes: GraphNode[] = [];
  @property({ attribute: false }) links: GraphLink[] = [];
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

  private readonly arrowMarkerId = nextId('graph-arrow');

  /** True until the lazy-loaded d3 peer dependencies have settled (success or failure). */
  @state() private loading = true;

  @state() private simNodes: SimNode[] = [];
  @state() private simLinks: SimLink[] = [];
  private danglingLinks: SimLink[] = [];
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
  /** The `<svg>` currently wired up with d3-zoom (guards a one-time bind). */
  private zoomedEl?: SVGSVGElement;
  /** The pan/zoom `<g>`, cached alongside `zoomedEl` so the zoom handler can
   *  write the transform straight to the DOM (see applyInteractions()) instead
   *  of round-tripping through a Lit reactive property on every pan/zoom event. */
  private gEl?: SVGGElement;
  /** The live zoom behavior, kept so minZoom/maxZoom changes can retune its
   *  scaleExtent in place (see applyInteractions()) instead of requiring the
   *  `<svg>` to be rebound. */
  private zoomBehavior?: import('d3-zoom').ZoomBehavior<SVGSVGElement, unknown>;
  /** Node `<circle>`s already wired up with d3-drag; cleared on every simulation rebuild
   *  so DOM elements Lit reuses across a rebuild get rebound to their fresh datum. */
  private boundNodeEls = new WeakSet<Element>();
  /** Node/link/label DOM elements, index-aligned with simNodes/simLinks, cached
   *  once per structural rebuild and written to directly by onTick() — this is
   *  what lets ticks update positions without going through Lit's reactive
   *  simNodes/simLinks properties (see rebuildSimulation()'s doc comment). */
  private nodeEls: SVGCircleElement[] = [];
  private nodeLabelEls: (SVGTextElement | null)[] = [];
  private linkEls: SVGLineElement[] = [];

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

  protected willUpdate(changed: PropertyValues): void {
    // rebuildSimulation() (re)assigns the simNodes/simLinks reactive
    // properties — doing that from willUpdate() folds them into the render
    // this same update is already about to perform. Doing it from updated()
    // instead would set a reactive property *after* the update completed,
    // which Lit schedules as a whole extra update pass (a dev-mode warning,
    // and pointless work).
    if (this.d3 && (changed.has('nodes') || changed.has('links'))) {
      this.rebuildSimulation();
    }
  }

  protected updated(changed: PropertyValues): void {
    if (this.loading) this.setAttribute('aria-busy', 'true');
    else this.removeAttribute('aria-busy');

    if (!this.d3) return;
    if (!changed.has('nodes') && !changed.has('links')) {
      // These two branches are independent (not else-if): a consumer can set
      // width/height and chargeStrength/linkDistance in the same reactive
      // update batch, and both retunes must apply — not just whichever branch
      // happens to come first.
      if (changed.has('width') || changed.has('height')) {
        this.simulation?.force('center', this.d3.forceCenter(this.width / 2, this.height / 2));
        this.simulation?.alpha(0.1).restart();
      }
      if (changed.has('chargeStrength') || changed.has('linkDistance')) {
        // Without this branch, chargeStrength/linkDistance only took effect
        // the next time nodes/links also changed (rebuildSimulation() reads
        // them fresh) — retune the already-created force objects in place
        // instead of rebuilding the whole simulation.
        if (changed.has('chargeStrength')) this.chargeForce?.strength(this.chargeStrength);
        if (changed.has('linkDistance')) this.linkForce?.distance(this.linkDistance);
        this.simulation?.alpha(0.3).restart();
      }
    }
    // simNodes/simLinks only ever change once per structural rebuild (see
    // rebuildSimulation()'s doc comment) — never on a tick — so gating the
    // node/link querySelectorAll scan on that is equivalent to "structurally
    // changed" without needing a separate flag.
    this.applyInteractions(changed);
  }

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

    const svgEl = this.renderRoot.querySelector('svg');
    if (svgEl && svgEl !== this.zoomedEl) {
      this.zoomedEl = svgEl;
      this.gEl = this.renderRoot.querySelector('g') ?? undefined;
      this.zoomBehavior = this.d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([this.minZoom, this.maxZoom])
        .on('zoom', (event: OptionalPeerApi) => {
          this.gEl?.setAttribute('transform', event.transform.toString());
        });
      this.d3.select(svgEl).call(this.zoomBehavior);
    } else if (this.zoomBehavior && (changed.has('minZoom') || changed.has('maxZoom'))) {
      this.zoomBehavior.scaleExtent([this.minZoom, this.maxZoom]);
    }

    if (!(changed.has('simNodes') || changed.has('simLinks'))) return;

    const nodeEls = Array.from(this.renderRoot.querySelectorAll('[part="node"]')) as SVGCircleElement[];
    this.nodeEls = nodeEls;
    this.nodeLabelEls = nodeEls.map(
      (el) => (el.parentElement?.querySelector('[part="label"]') as SVGTextElement | null) ?? null,
    );
    this.linkEls = Array.from(this.renderRoot.querySelectorAll('[part="link"]')) as SVGLineElement[];

    nodeEls.forEach((el, i) => {
      if (this.boundNodeEls.has(el)) return;
      const n = this.simNodes[i];
      if (!n) return;
      this.boundNodeEls.add(el);
      this.d3!.select<Element, SimNode>(el).call(
        this.d3!.drag<Element, SimNode>()
          .on('start', (event: OptionalPeerApi) => {
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
            if (!event.active) this.simulation?.alphaTarget(0);
            n.fx = null;
            n.fy = null;
          }),
      );
    });
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
    this.simNodes.forEach((n, i) => {
      const circle = this.nodeEls[i];
      if (circle) {
        circle.setAttribute('cx', String(n.x ?? 0));
        circle.setAttribute('cy', String(n.y ?? 0));
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
  }

  private rebuildSimulation(): void {
    if (!this.d3) return;
    this.simulation?.stop();
    this.boundNodeEls = new WeakSet();

    // Carry over each existing SimNode's settled position/velocity (and any
    // in-progress drag fx/fy) by id instead of starting every node fresh —
    // otherwise any structural nodes/links change (e.g. appending one new
    // node to a live/streaming graph) would discard every already-settled
    // node's (x, y) and restart the whole force layout's ~300-tick random-
    // start settle animation from scratch. Only nodes with no previous
    // counterpart (genuinely new ids) get forceSimulation()'s default
    // fresh random start below.
    const prevById = new Map(this.simNodes.map((n) => [n.id, n]));
    const nodes: SimNode[] = this.nodes.map((n) => {
      const prev = prevById.get(n.id);
      return prev ? { ...prev, ...n } : { ...n };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const resolvedLinks: SimLink[] = [];
    const danglingLinks: SimLink[] = [];
    for (const l of this.links) {
      const source = byId.get(l.source);
      if (!source) continue; // no real position to draw a stub from -- stays dropped, unchanged
      const target = byId.get(l.target);
      if (target) {
        resolvedLinks.push({ ...l, source, target });
      } else {
        danglingLinks.push({
          ...l,
          source,
          target: { id: l.target, x: source.x, y: source.y } as SimNode,
          dangling: true,
        });
      }
    }
    const links = resolvedLinks; // stubs never enter d3-force's own simulation input
    this.danglingLinks = danglingLinks;

    // Give brand-new nodes (no carried-over position from prevById above) a
    // deterministic starting x/y, keyed by node id, instead of leaving them
    // for forceSimulation() below to randomize. Nodes that already have a
    // position are left untouched — same "only randomize nodes without x/y"
    // rule forceSimulation() itself follows — so an incremental update to a
    // seeded, already-settled graph doesn't reshuffle existing nodes.
    const seed = this.seed;
    if (seed != null) {
      for (const n of nodes) {
        if (n.x != null && n.y != null) continue;
        const rng = mulberry32(hashNodeSeed(seed, n.id));
        n.x = rng() * this.width;
        n.y = rng() * this.height;
      }
    }

    this.linkForce = this.d3.forceLink<SimNode, SimLink>(links).distance(this.linkDistance);
    this.chargeForce = this.d3.forceManyBody<SimNode>().strength(this.chargeStrength);

    const simulation = this.d3
      .forceSimulation(nodes)
      .force('link', this.linkForce)
      .force('charge', this.chargeForce)
      .force('center', this.d3.forceCenter(this.width / 2, this.height / 2))
      .force(
        'collide',
        this.d3.forceCollide<SimNode>().radius((n: SimNode) => this.nodeRadius(n) + 10),
      )
      .on('tick', () => this.onTick());
    this.simulation = simulation;

    if (prefersReducedMotion() || this.seed != null) {
      // Converge synchronously instead of animating the settle over ~300
      // rendered frames — the simulation is already stopped (alpha at
      // alphaMin) by the time the DOM for this rebuild is first painted.
      // A seed converging synchronously (not just deterministically-seeded)
      // is what makes its end state reproducible: two runs must agree on the
      // exact same number of ticks, not merely start from the same x/y.
      // User-initiated motion (dragging a node) is unaffected.
      simulation.stop();
      while (simulation.alpha() > simulation.alphaMin()) simulation.tick();
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
  }

  private onNodeClick(node: SimNode): void {
    this.emit('lyra-node-click', { id: node.id });
  }

  private onLinkClick(link: SimLink): void {
    const source = typeof link.source === 'object' ? (link.source as SimNode).id : String(link.source);
    const target = typeof link.target === 'object' ? (link.target as SimNode).id : String(link.target);
    this.emit('lyra-link-click', { source, target, ...(link.id ? { id: link.id } : {}) });
  }

  private nodeAccessibleText(node: GraphNode): string {
    return node.accessibleLabel || node.label || node.id;
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

  private graphItemCount(): number {
    return this.simNodes.length + this.simLinks.length;
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
    const link = this.simLinks[index - this.simNodes.length];
    return link ? this.linkAccessibleText(link) : '';
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
      const items = [
        ...Array.from(this.renderRoot.querySelectorAll('[part="node"]')),
        ...Array.from(this.renderRoot.querySelectorAll('[part="link"]')),
      ] as HTMLElement[];
      items[normalized]?.focus();
    });
  }

  /**
   * The forward physical arrow key (`ArrowRight` in LTR, `ArrowLeft` under
   * `dir="rtl"` — see `isRtl()`) moves to the next roving-tabindex item, the
   * backward one to the previous, in flat array order (`simNodes` then
   * `simLinks`) — the same `forwardKey`/`backwardKey` swap this library's
   * other "physical arrow key drives sequential previous/next" components
   * (`<lyra-tabs>`, `<lyra-slider>`, `<lyra-segmented>`) apply under RTL.
   * `ArrowDown`/`ArrowUp` always mean next/previous regardless of direction.
   */
  private onGraphKeyDown(e: KeyboardEvent, index: number, activate: () => void): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.onGraphItemFocus(index);
      activate();
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
          <lyra-skeleton
            variant="rect"
            style=${`--lyra-skeleton-w:${this.width}px;--lyra-skeleton-h:${this.height}px`}
          ></lyra-skeleton>
        </div>
      `;
    }
    if (!this.nodes.length) {
      return html`<div part="base"><div part="empty">${this.localize('noData')}</div></div>`;
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
          viewBox="0 0 ${this.width} ${this.height}"
          tabindex=${this.graphItemCount() ? '-1' : '0'}
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
            ${this.simLinks.map((l, linkIndex) => {
              const itemIndex = this.simNodes.length + linkIndex;
              const coordinates = this.linkCoordinates(l);
              const color = sanitizeNodeColor(l.color);
              const dash = normalizeLinkDash(l.dash);
              return svg`<line
                part="link"
                role="button"
                tabindex=${this.normalizedGraphItem() === itemIndex ? '0' : '-1'}
                aria-label=${this.linkAccessibleText(l)}
                stroke-width=${l.width ?? 1.5}
                stroke-dasharray=${dash ?? nothing}
                marker-end=${l.directed ? `url(#${this.arrowMarkerId})` : nothing}
                style=${styleMap(color ? { '--lyra-link-color': color } : {})}
                x1=${coordinates.x1}
                y1=${coordinates.y1}
                x2=${coordinates.x2}
                y2=${coordinates.y2}
                @click=${() => this.onLinkClick(l)}
                @focus=${() => this.onGraphItemFocus(itemIndex)}
                @keydown=${(e: KeyboardEvent) => this.onGraphKeyDown(e, itemIndex, () => this.onLinkClick(l))}
              >${l.description || l.label ? svg`<title>${l.description || l.label}</title>` : nothing}</line>`;
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
              const fill = sanitizeNodeColor(n.color);
              const itemIndex = nodeIndex;
              return svg`<g>
                <circle
                  part="node"
                  role="button"
                  tabindex=${this.normalizedGraphItem() === itemIndex ? '0' : '-1'}
                  aria-label=${this.nodeAccessibleText(n)}
                  r=${this.nodeRadius(n)}
                  cx=${n.x ?? 0}
                  cy=${n.y ?? 0}
                  style=${styleMap(fill ? { '--lyra-node-fill': fill } : {})}
                  @click=${() => this.onNodeClick(n)}
                  @focus=${() => this.onGraphItemFocus(itemIndex)}
                  @keydown=${(e: KeyboardEvent) => this.onGraphKeyDown(e, itemIndex, () => this.onNodeClick(n))}
                >${n.description ? svg`<title>${n.description}</title>` : nothing}</circle>
                ${n.label
                  ? svg`<text part="label" aria-hidden="true" x=${(n.x ?? 0) + this.nodeRadius(n) + 2} y=${n.y ?? 0}>${n.label}</text>`
                  : ''}
              </g>`;
            })}
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
        </ul>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-graph': LyraGraph;
  }
}
