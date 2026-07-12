import { html, svg, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './graph.styles.js';
import { loadD3, type D3Modules } from './graph-loader.js';
import '../skeleton/skeleton.js';
import type { ForceLink, ForceManyBody, Simulation, SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type { ZoomBehavior } from 'd3-zoom';

export interface GraphNode {
  id: string;
  label?: string;
  radius?: number;
  color?: string;
}
export interface GraphLink {
  source: string;
  target: string;
  width?: number;
}

interface SimNode extends GraphNode, SimulationNodeDatum {}
interface SimLink extends SimulationLinkDatum<SimNode> {
  width?: number;
}

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

/**
 * `<lyra-graph>` — a force-directed node-link diagram with pan/zoom/drag.
 * Requires the optional peer deps `d3-force`/`d3-drag`/`d3-zoom`/`d3-selection`
 * (lazy-loaded; a consumer who never uses this component pays zero d3 cost).
 *
 * Set `seed` for a deterministic layout: node initial positions become
 * reproducible (keyed by node id) and the settle happens synchronously
 * instead of animating, like `prefers-reduced-motion`.
 *
 * @customElement lyra-graph
 * @event lyra-node-click - `detail: { id }`.
 * @event lyra-link-click - `detail: { source, target }`.
 * @csspart base, svg, node, link, label
 */
export class LyraGraph extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) nodes: GraphNode[] = [];
  @property({ attribute: false }) links: GraphLink[] = [];
  @property({ type: Number }) width = 800;
  @property({ type: Number }) height = 600;
  @property({ type: Number, attribute: 'charge-strength' }) chargeStrength = -300;
  @property({ type: Number, attribute: 'link-distance' }) linkDistance = 100;
  @property({ type: Number, attribute: 'min-zoom' }) minZoom = 0.1;
  @property({ type: Number, attribute: 'max-zoom' }) maxZoom = 8;
  /** When set, seeds each node's initial x/y deterministically (keyed by
   *  node id, not array index) instead of forceSimulation()'s own random
   *  start, and settles the simulation synchronously — see rebuildSimulation(). */
  @property({ type: Number }) seed?: number;

  /** True until the lazy-loaded d3 peer dependencies have settled (success or failure). */
  @state() private loading = true;

  @state() private simNodes: SimNode[] = [];
  @state() private simLinks: SimLink[] = [];

  private simulation?: Simulation<SimNode, SimLink>;
  /** The live charge/link force objects, kept so chargeStrength/linkDistance
   *  changes can retune them in place (see updated()) instead of requiring a
   *  full rebuildSimulation(). */
  private chargeForce?: ForceManyBody<SimNode>;
  private linkForce?: ForceLink<SimNode, SimLink>;
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
  private zoomBehavior?: ZoomBehavior<SVGSVGElement, unknown>;
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

  private nodeRadius(n: GraphNode): number {
    return n.radius ?? (MIN_RADIUS + MAX_RADIUS) / 2;
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
        .on('zoom', (event) => {
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
          .on('start', (event) => {
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
      const source = l.source as SimNode;
      const target = l.target as SimNode;
      line.setAttribute('x1', String(source.x ?? 0));
      line.setAttribute('y1', String(source.y ?? 0));
      line.setAttribute('x2', String(target.x ?? 0));
      line.setAttribute('y2', String(target.y ?? 0));
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
    const links: SimLink[] = this.links
      .filter((l) => byId.has(l.source) && byId.has(l.target))
      .map((l) => ({ ...l, source: byId.get(l.source)!, target: byId.get(l.target)! }));

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
        this.d3.forceCollide<SimNode>().radius((n) => this.nodeRadius(n) + 10),
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
    this.emit('lyra-link-click', { source, target });
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
    return html`
      <div part="base">
        <svg
          part="svg"
          role="group"
          aria-label="Node-link diagram with ${this.simNodes.length} nodes and ${this.simLinks.length} links"
          viewBox="0 0 ${this.width} ${this.height}"
        >
          <g transform="">
            ${this.simLinks.map((l) => {
              const source = l.source as SimNode;
              const target = l.target as SimNode;
              return svg`<line
                part="link"
                role="button"
                tabindex="0"
                aria-label="Link from ${source.label ?? source.id} to ${target.label ?? target.id}"
                stroke-width=${l.width ?? 1.5}
                x1=${source.x ?? 0}
                y1=${source.y ?? 0}
                x2=${target.x ?? 0}
                y2=${target.y ?? 0}
                @click=${() => this.onLinkClick(l)}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.onLinkClick(l);
                  }
                }}
              ></line>`;
            })}
            ${this.simNodes.map((n) => {
              const fill = sanitizeNodeColor(n.color);
              return svg`<g>
                <circle
                  part="node"
                  role="button"
                  tabindex="0"
                  aria-label=${n.label ?? n.id}
                  r=${this.nodeRadius(n)}
                  cx=${n.x ?? 0}
                  cy=${n.y ?? 0}
                  style=${styleMap(fill ? { '--lyra-node-fill': fill } : {})}
                  @click=${() => this.onNodeClick(n)}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      this.onNodeClick(n);
                    }
                  }}
                ></circle>
                ${n.label
                  ? svg`<text part="label" aria-hidden="true" x=${(n.x ?? 0) + this.nodeRadius(n) + 2} y=${n.y ?? 0}>${n.label}</text>`
                  : ''}
              </g>`;
            })}
          </g>
        </svg>
      </div>
    `;
  }
}

defineElement('graph', LyraGraph);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-graph': LyraGraph;
  }
}
