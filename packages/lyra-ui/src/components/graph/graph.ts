import { html, svg, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './graph.styles.js';
import '../skeleton/skeleton.js';
import type { Simulation, SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

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

interface D3Modules {
  forceSimulation: typeof import('d3-force').forceSimulation;
  forceLink: typeof import('d3-force').forceLink;
  forceManyBody: typeof import('d3-force').forceManyBody;
  forceCenter: typeof import('d3-force').forceCenter;
  forceCollide: typeof import('d3-force').forceCollide;
  drag: typeof import('d3-drag').drag;
  zoom: typeof import('d3-zoom').zoom;
  select: typeof import('d3-selection').select;
}

let d3Modules: Promise<D3Modules | null> | undefined;

/**
 * Lazily loads the optional peer dependencies `d3-force`/`d3-drag`/`d3-zoom`/
 * `d3-selection` once per page. Resolves to `null` (with a one-time warning)
 * if they aren't installed — mirrors `<lyra-flag>`'s peer-dependency pattern.
 */
function loadD3(): Promise<D3Modules | null> {
  if (!d3Modules) {
    d3Modules = Promise.all([
      import('d3-force'),
      import('d3-drag'),
      import('d3-zoom'),
      import('d3-selection'),
    ])
      .then(([force, dragMod, zoomMod, selectionMod]) => ({
        forceSimulation: force.forceSimulation,
        forceLink: force.forceLink,
        forceManyBody: force.forceManyBody,
        forceCenter: force.forceCenter,
        forceCollide: force.forceCollide,
        drag: dragMod.drag,
        zoom: zoomMod.zoom,
        select: selectionMod.select,
      }))
      .catch(() => {
        console.warn(
          '<lyra-graph> needs the optional peer dependencies `d3-force`, `d3-drag`, ' +
            '`d3-zoom`, and `d3-selection` — install them with `pnpm add d3-force d3-drag d3-zoom d3-selection`.',
        );
        return null;
      });
  }
  return d3Modules;
}

const MIN_RADIUS = 6;
const MAX_RADIUS = 24;

/**
 * `<lyra-graph>` — a force-directed node-link diagram with pan/zoom/drag.
 * Requires the optional peer deps `d3-force`/`d3-drag`/`d3-zoom`/`d3-selection`
 * (lazy-loaded; a consumer who never uses this component pays zero d3 cost).
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

  /** True until the lazy-loaded d3 peer dependencies have settled (success or failure). */
  @state() private loading = true;

  @state() private simNodes: SimNode[] = [];
  @state() private simLinks: SimLink[] = [];
  /** Current pan/zoom transform (SVG `transform` attribute syntax), driven by d3-zoom. */
  @state() private transform = '';

  private simulation?: Simulation<SimNode, SimLink>;
  private d3?: D3Modules;
  /** The `<svg>` currently wired up with d3-zoom (guards a one-time bind). */
  private zoomedEl?: SVGSVGElement;
  /** Node `<circle>`s already wired up with d3-drag; cleared on every simulation rebuild
   *  so DOM elements Lit reuses across a rebuild get rebound to their fresh datum. */
  private boundNodeEls = new WeakSet<Element>();

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

  protected updated(changed: PropertyValues): void {
    if (this.loading) this.setAttribute('aria-busy', 'true');
    else this.removeAttribute('aria-busy');

    if (!this.d3) return;
    if (changed.has('nodes') || changed.has('links')) {
      this.rebuildSimulation();
    } else if (changed.has('width') || changed.has('height')) {
      this.simulation?.force('center', this.d3.forceCenter(this.width / 2, this.height / 2));
      this.simulation?.alpha(0.1).restart();
    }
    this.applyInteractions();
  }

  /**
   * Imperatively wires up d3-zoom (pan/zoom on the `<svg>`) and d3-drag
   * (per-node drag) against the just-rendered DOM. Runs after every render:
   * binding the `<svg>` is a one-time no-op guard (`zoomedEl`), and node
   * `<circle>`s are skipped once bound (`boundNodeEls`) — a WeakSet reset on
   * every `rebuildSimulation()` so DOM nodes Lit reuses across a rebuild get
   * rebound against their new datum instead of a stale one.
   */
  private applyInteractions(): void {
    if (!this.d3) return;

    const svgEl = this.renderRoot.querySelector('svg');
    if (svgEl && svgEl !== this.zoomedEl) {
      this.zoomedEl = svgEl;
      const zoomBehavior = this.d3.zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
        this.transform = event.transform.toString();
      });
      this.d3.select(svgEl).call(zoomBehavior);
    }

    const nodeEls = this.renderRoot.querySelectorAll('[part="node"]');
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

  private rebuildSimulation(): void {
    if (!this.d3) return;
    this.simulation?.stop();
    this.boundNodeEls = new WeakSet();

    const nodes: SimNode[] = this.nodes.map((n) => ({ ...n }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = this.links
      .filter((l) => byId.has(l.source) && byId.has(l.target))
      .map((l) => ({ ...l, source: byId.get(l.source)!, target: byId.get(l.target)! }));

    this.simulation = this.d3
      .forceSimulation(nodes)
      .force(
        'link',
        this.d3.forceLink<SimNode, SimLink>(links).distance(this.linkDistance),
      )
      .force('charge', this.d3.forceManyBody().strength(this.chargeStrength))
      .force('center', this.d3.forceCenter(this.width / 2, this.height / 2))
      .force(
        'collide',
        this.d3.forceCollide<SimNode>().radius((n) => this.nodeRadius(n) + 10),
      )
      .on('tick', () => {
        this.simNodes = [...nodes];
        this.simLinks = [...links];
      });
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
        <svg part="svg" viewBox="0 0 ${this.width} ${this.height}">
          <g transform=${this.transform}>
            ${this.simLinks.map((l) => {
              const source = l.source as SimNode;
              const target = l.target as SimNode;
              return svg`<line
                part="link"
                stroke-width=${l.width ?? 1.5}
                x1=${source.x ?? 0}
                y1=${source.y ?? 0}
                x2=${target.x ?? 0}
                y2=${target.y ?? 0}
                @click=${() => this.onLinkClick(l)}
              ></line>`;
            })}
            ${this.simNodes.map(
              (n) => svg`<g>
                <circle
                  part="node"
                  role="button"
                  tabindex="0"
                  aria-label=${n.label ?? n.id}
                  r=${this.nodeRadius(n)}
                  cx=${n.x ?? 0}
                  cy=${n.y ?? 0}
                  style=${n.color ? `--lyra-node-fill:${n.color}` : ''}
                  @click=${() => this.onNodeClick(n)}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      this.onNodeClick(n);
                    }
                  }}
                ></circle>
                ${n.label
                  ? svg`<text part="label" x=${(n.x ?? 0) + this.nodeRadius(n) + 2} y=${n.y ?? 0}>${n.label}</text>`
                  : ''}
              </g>`,
            )}
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
