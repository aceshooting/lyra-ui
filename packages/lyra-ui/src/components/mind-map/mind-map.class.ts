import { html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { srOnly } from '../../internal/a11y.js';
import { isRtl } from '../../internal/rtl.js';
import { finiteCount } from '../../internal/numbers.js';
import { layoutMindMap, type LyraTopic, type MindMapLayoutResult, type PlacedTopic } from './mind-map-layout.js';
import { styles } from './mind-map.styles.js';

export type { LyraTopic };

export interface LyraMindMapEventMap {
  'lr-topic-select': CustomEvent<{ id: string }>;
  'lr-topic-toggle': CustomEvent<{ id: string; expanded: boolean }>;
}

const DEFAULT_RING_GAP_PX = 96; // 6rem at the default 16px root font size
const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' ']);

/**
 * `<lr-mind-map>` — a radial expandable topic tree (NotebookLM Mind Maps): a spatial overview of
 * a topic hierarchy where activating a topic drills in or hands the topic to the chat. Hierarchy,
 * not network — no cross-links, no force simulation, no communities, no edge labels (that's
 * `lr-graph`). Zero-dependency SVG; the radial layout is closed-form arithmetic, in its own
 * `mind-map-layout.ts` module, mirroring `lr-word-cloud`'s dependency-free precedent.
 *
 * Node-position transitions use `--lr-transition-base`, which already collapses to near-zero
 * under `prefers-reduced-motion: reduce` globally (`tokens.styles.ts`), so expansion snaps rather
 * than tweening for a reduced-motion user with no extra branching in this component.
 *
 * @customElement lr-mind-map
 * @event lr-topic-select - A *leaf* topic was activated. `detail: { id }`.
 * @event lr-topic-toggle - A parent topic was activated (or auto-expanded by keyboard descent).
 * `detail: { id, expanded }`.
 * @csspart base - The wrapper.
 * @csspart svg - The single-tab-stop SVG focus target.
 * @csspart node - A topic node group.
 * @csspart node-label - A topic's label text.
 * @csspart link - A parent-child connector.
 * @csspart focus-ring - The keyboard focus ring.
 * @csspart live-region - The visually hidden announcement region.
 * @csspart empty - The empty-state message, shown when `topics` is empty.
 * @cssprop [--lr-mind-map-ring-gap=6rem] - Radius step per depth ring.
 */
export class LyraMindMap extends LyraElement<LyraMindMapEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

  /** A single root sits at the center; multiple roots hang off an implicit center hub whose
   *  visible text is `label`. */
  @property({ attribute: false }) topics: LyraTopic[] = [];
  /** Accessible name for the SVG group *and* the implicit hub's text; falls back to the localized
   *  `mindMapLabel`. */
  @property() label = '';
  /** Initial expansion depth (root + first ring). Expansion state is component-managed
   *  afterward, keyed by topic id, and survives `topics` reassignment. */
  @property({ type: Number, attribute: 'expand-depth' }) expandDepth = 1;

  @query('[part="svg"]') private svgEl?: SVGSVGElement;

  /** Explicit user overrides only -- the default (`depth < expandDepth`) is computed at read time
   *  in `isExpanded()`, so a user can override in either direction without losing the override on
   *  a later `topics` reassignment that reintroduces the same id. */
  @state() private expandedOverrides = new Map<string, boolean>();
  @state() private focusedId: string | null = null;
  @state() private liveText = '';

  private cachedLayout: MindMapLayoutResult = { placed: [], links: [], width: 0, height: 0, centerX: 0, centerY: 0 };

  /** `expandDepth`, normalized to a finite non-negative integer (falling back to the property's own
   *  default of `1`) -- a raw `NaN` (e.g. an invalid `expand-depth` attribute) would otherwise make
   *  every `depth < expandDepth` comparison false, silently collapsing every ring instead of just
   *  falling back to the default. */
  private get effectiveExpandDepth(): number {
    return finiteCount(this.expandDepth, 1);
  }

  private isExpanded(id: string, depth: number): boolean {
    return this.expandedOverrides.get(id) ?? depth < this.effectiveExpandDepth;
  }

  private ringGapPx(): number {
    const raw = getComputedStyle(this).getPropertyValue('--lr-mind-map-ring-gap').trim();
    if (!raw) return DEFAULT_RING_GAP_PX;
    const value = parseFloat(raw);
    if (!Number.isFinite(value)) return DEFAULT_RING_GAP_PX;
    return raw.includes('rem') ? value * 16 : value;
  }

  private relayout(): void {
    const hubLabel = this.getAttribute('aria-label') || this.label || this.localize('mindMapLabel');
    this.cachedLayout = layoutMindMap(this.topics, hubLabel, {
      ringGap: this.ringGapPx(),
      rtl: isRtl(this),
      isExpanded: (id, depth) => this.isExpanded(id, depth),
    });
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('topics') || changed.has('expandDepth') || changed.has('expandedOverrides') || changed.has('label')) {
      this.relayout();
    }
  }

  private toggle(node: PlacedTopic): void {
    const expanded = !this.isExpanded(node.id, node.depth);
    const next = new Map(this.expandedOverrides);
    next.set(node.id, expanded);
    this.expandedOverrides = next;
    this.emit('lr-topic-toggle', { id: node.id, expanded });
    this.liveText = this.localize(expanded ? 'mindMapExpanded' : 'mindMapCollapsed', undefined, { label: node.label });
  }

  private activate(node: PlacedTopic): void {
    if (node.hasChildren) this.toggle(node);
    else this.emit('lr-topic-select', { id: node.id });
  }

  private siblingsOf(node: PlacedTopic): PlacedTopic[] {
    return this.cachedLayout.placed.filter((p) => p.parentId === node.parentId);
  }

  private childrenOf(id: string): PlacedTopic[] {
    return this.cachedLayout.placed.filter((p) => p.parentId === id);
  }

  private announce(node: PlacedTopic): void {
    this.liveText = node.hasChildren
      ? this.localize('mindMapTopicStatus', undefined, { label: node.label, level: node.depth + 1, count: this.childrenOf(node.id).length })
      : this.localize('mindMapLeafStatus', undefined, { label: node.label, level: node.depth + 1 });
  }

  private focusNodeById(id: string): void {
    this.focusedId = id;
    const node = this.cachedLayout.placed.find((p) => p.id === id);
    if (node) this.announce(node);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const placed = this.cachedLayout.placed;
    if (placed.length === 0 || !NAV_KEYS.has(e.key)) return;
    e.preventDefault();
    if (this.focusedId === null) {
      this.focusNodeById(placed[0]!.id);
      return;
    }
    const current = placed.find((p) => p.id === this.focusedId);
    if (!current) return;

    if (e.key === 'Enter' || e.key === ' ') {
      this.activate(current);
      return;
    }
    if (e.key === 'ArrowUp') {
      if (current.parentId) this.focusNodeById(current.parentId);
      return;
    }
    if (e.key === 'ArrowDown') {
      if (!current.hasChildren) return;
      if (!this.isExpanded(current.id, current.depth)) this.toggle(current);
      const child = this.childrenOf(current.id)[0];
      if (child) this.focusNodeById(child.id);
      return;
    }
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === forwardKey || e.key === backwardKey || e.key === 'Home' || e.key === 'End') {
      const siblings = this.siblingsOf(current);
      const index = siblings.findIndex((s) => s.id === current.id);
      let next = index;
      if (e.key === forwardKey) next = Math.min(siblings.length - 1, index + 1);
      else if (e.key === backwardKey) next = Math.max(0, index - 1);
      else if (e.key === 'Home') next = 0;
      else next = siblings.length - 1;
      const target = siblings[next];
      if (target) this.focusNodeById(target.id);
    }
  };

  private onNodeClick(node: PlacedTopic): void {
    this.focusedId = node.id;
    this.announce(node);
    this.svgEl?.focus();
    this.activate(node);
  }

  private connectorControlPoint(from: PlacedTopic, to: PlacedTopic): { x: number; y: number } {
    const layout = this.cachedLayout;
    const parentR = Math.hypot(from.x - layout.centerX, from.y - layout.centerY);
    const dir = isRtl(this) ? -1 : 1;
    return {
      x: layout.centerX + dir * parentR * Math.sin(to.angle),
      y: layout.centerY - parentR * Math.cos(to.angle),
    };
  }

  render(): TemplateResult {
    const layout = this.cachedLayout;
    if (layout.placed.length === 0) {
      return html`<div part="base"><div part="empty">${this.localize('noData')}</div></div>`;
    }
    const ariaLabel = this.getAttribute('aria-label') || this.label || this.localize('mindMapLabel');
    const byId = new Map(layout.placed.map((p) => [p.id, p]));
    const focused = this.focusedId ? byId.get(this.focusedId) : undefined;
    return html`
      <div part="base">
        <svg
          part="svg"
          role="group"
          aria-label=${ariaLabel}
          aria-describedby="mind-map-live"
          tabindex="0"
          viewBox="0 0 ${layout.width} ${layout.height}"
          @keydown=${this.onKeyDown}
        >
          ${layout.links.map((link) => {
            const from = byId.get(link.fromId);
            const to = byId.get(link.toId);
            if (!from || !to) return nothing;
            const control = this.connectorControlPoint(from, to);
            return svg`<path part="link" d="M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}" fill="none"></path>`;
          })}
          ${layout.placed.map(
            (node) => svg`
              <g part="node" style=${`transform: translate(${node.x}px, ${node.y}px)`} @click=${() => this.onNodeClick(node)}>
                <circle r="4" aria-hidden="true"></circle>
                <text part="node-label" aria-hidden="true" text-anchor="middle" dy="-8">${node.label}</text>
              </g>
            `,
          )}
          ${focused ? svg`<circle part="focus-ring" cx=${focused.x} cy=${focused.y} r="10"></circle>` : nothing}
        </svg>
        <div id="mind-map-live" part="live-region" class="sr-only" role="status" aria-live="polite">${this.liveText}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-mind-map': LyraMindMap;
  }
}
