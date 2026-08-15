import {
  html,
  nothing,
  svg,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { isRtl } from '../../../internal/rtl.js';
import { finiteCount } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import {
  layoutMindMap,
  type LyraTopic,
  type MindMapLayoutResult,
  type PlacedTopic,
} from './mind-map-layout.js';
import { styles } from './mind-map.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import {
  LYRA_DEFAULT_mindMapCollapsed,
  LYRA_DEFAULT_mindMapExpanded,
  LYRA_DEFAULT_mindMapLabel,
  LYRA_DEFAULT_mindMapLeafStatus,
  LYRA_DEFAULT_mindMapTopicStatus,
  LYRA_DEFAULT_noData,
} from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { LyraTopic };

export interface LyraMindMapEventMap {
  'lr-topic-select': CustomEvent<{ topicId: string }>;
  'lr-topic-toggle': CustomEvent<{ topicId: string; expanded: boolean }>;
}

const DEFAULT_RING_GAP_PX = 96; // 6rem at the default 16px root font size
const NAV_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'Enter',
  ' ',
]);

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
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-mind-map
 * @event lr-topic-select - A *leaf* topic was activated. `detail: { topicId }`.
 * @event lr-topic-toggle - A parent topic was activated (or auto-expanded by keyboard descent).
 * `detail: { topicId, expanded }`.
 * @csspart base - The wrapper.
 * @csspart svg - The single-tab-stop SVG focus target.
 * @csspart node - A topic node group.
 * @csspart node-label - A topic's label text.
 * @csspart link - A parent-child connector.
 * @csspart focus-ring - The keyboard focus ring, drawn from the moment the svg takes focus (the
 * first placed topic is seeded as the keyboard cursor) rather than only after the first arrow key.
 * @csspart live-region - The visually hidden announcement region.
 * @csspart empty - The empty-state message, shown when `topics` is empty.
 * @cssprop [--lr-mind-map-ring-gap=6rem] - Radius step per depth ring.
 * @cssprop [--lr-mind-map-node-hover-halo=var(--lr-color-brand-quiet)] - Stroke color of the
 * hover halo drawn around a topic node's dot, giving mouse users the same "this is clickable"
 * feedback keyboard users get from the drawn focus ring.
 * @status stable
 * @since 4.0.0
 */
export class LyraMindMap extends LyraElement<LyraMindMapEventMap> {
  protected static override readonly ownedCollectionProperties = Object.freeze([
    'topics',
  ]);

  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> =
    {
      ...super.defaultStrings,
      mindMapCollapsed: LYRA_DEFAULT_mindMapCollapsed,
      mindMapExpanded: LYRA_DEFAULT_mindMapExpanded,
      mindMapLabel: LYRA_DEFAULT_mindMapLabel,
      mindMapLeafStatus: LYRA_DEFAULT_mindMapLeafStatus,
      mindMapTopicStatus: LYRA_DEFAULT_mindMapTopicStatus,
      noData: LYRA_DEFAULT_noData,
    };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];
  static override get observedAttributes(): string[] {
    return [...new Set([...super.observedAttributes, 'dir', 'lang'])];
  }

  /** A single root sits at the center; multiple roots hang off an implicit center hub whose
   *  visible text is `label`. */
  @property({ attribute: false }) topics: readonly LyraTopic[] = [];
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

  private cachedLayout: MindMapLayoutResult = {
    placed: [],
    links: [],
    width: 0,
    height: 0,
    centerX: 0,
    centerY: 0,
  };
  private resizeObserver?: ResizeObserver;
  private resizeObserverDocument?: Document;
  private resizeRafId?: number;
  private resizeRafOwner?: Window;
  private resizeRafDocument?: Document;
  private ownerRealmGeneration = 0;
  private observedSize = '';
  private layoutInvalidated = true;
  private layoutContext = '';
  private announcementSink?: AnnouncementSink;

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcementSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    this.layoutInvalidated = true;
    this.armResizeObserver();
  }

  private armResizeObserver(): void {
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!this.isConnected || !ownerWindow?.ResizeObserver) return;
    if (this.resizeObserver && this.resizeObserverDocument === ownerDocument)
      return;
    this.resetResizeWork();
    const generation = this.ownerRealmGeneration;
    const observer = new ownerWindow.ResizeObserver((entries) => {
      if (
        this.resizeObserver !== observer ||
        this.resizeObserverDocument !== ownerDocument ||
        this.ownerRealmGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      const rect = entries[0]?.contentRect;
      const size = rect ? `${rect.width}:${rect.height}` : '';
      if (size && size === this.observedSize) return;
      this.observedSize = size;
      if (this.resizeRafId != null)
        this.resizeRafOwner?.cancelAnimationFrame(this.resizeRafId);
      const handle = ownerWindow.requestAnimationFrame(() => {
        if (
          this.resizeRafId !== handle ||
          this.resizeRafOwner !== ownerWindow ||
          this.resizeRafDocument !== ownerDocument ||
          this.ownerRealmGeneration !== generation ||
          !this.isConnected ||
          this.ownerDocument !== ownerDocument
        ) {
          return;
        }
        this.resizeRafId = undefined;
        this.resizeRafOwner = undefined;
        this.resizeRafDocument = undefined;
        this.layoutInvalidated = true;
        this.requestUpdate();
      });
      this.resizeRafId = handle;
      this.resizeRafOwner = ownerWindow;
      this.resizeRafDocument = ownerDocument;
    });
    this.resizeObserver = observer;
    this.resizeObserverDocument = ownerDocument;
    observer.observe(this);
  }

  override disconnectedCallback(): void {
    this.resetResizeWork();
    this.announcementSink?.release();
    this.announcementSink = undefined;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetResizeWork();
    this.announcementSink?.release();
    this.announcementSink = undefined;
  }

  private resetResizeWork(): void {
    this.ownerRealmGeneration += 1;
    if (this.resizeRafId != null)
      this.resizeRafOwner?.cancelAnimationFrame(this.resizeRafId);
    this.resizeRafId = undefined;
    this.resizeRafOwner = undefined;
    this.resizeRafDocument = undefined;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.resizeObserverDocument = undefined;
    this.observedSize = '';
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    value: string | null
  ): void {
    super.attributeChangedCallback(name, oldValue, value);
    if ((name === 'dir' || name === 'lang') && oldValue !== value) {
      this.layoutInvalidated = true;
      this.requestUpdate();
    }
  }

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

  /** Resolves `--lr-mind-map-ring-gap` to a real used pixel value for whatever unit it carries --
   *  a live root/host font-size read for rem/em, matching `lr-table`'s own `minimumResizeWidth()`
   *  fix for the identical problem (a hardcoded `* 16` gets ring spacing wrong on any page whose
   *  root font-size isn't the browser default 16px). */
  private ringGapPx(): number {
    const ownerWindow = this.ownerDocument.defaultView;
    const hostStyle = ownerWindow?.getComputedStyle(this) ?? this.style;
    const raw =
      hostStyle.getPropertyValue('--lr-mind-map-ring-gap').trim() ||
      hostStyle.getPropertyValue('--_lr-mind-map-ring-gap').trim();
    if (!raw) return DEFAULT_RING_GAP_PX;
    const value = parseFloat(raw);
    if (!Number.isFinite(value)) return DEFAULT_RING_GAP_PX;
    if (raw.endsWith('rem')) {
      const rootStyle =
        ownerWindow?.getComputedStyle(this.ownerDocument.documentElement) ??
        this.ownerDocument.documentElement.style;
      const rootFontSize = Number.parseFloat(rootStyle.fontSize);
      return Number.isFinite(rootFontSize)
        ? value * rootFontSize
        : DEFAULT_RING_GAP_PX;
    }
    if (raw.endsWith('em')) {
      const hostFontSize = Number.parseFloat(hostStyle.fontSize);
      return Number.isFinite(hostFontSize)
        ? value * hostFontSize
        : DEFAULT_RING_GAP_PX;
    }
    return value;
  }

  private relayout(): void {
    const hubLabel = this.label || this.localize('mindMapLabel');
    this.cachedLayout = layoutMindMap(this.topics, hubLabel, {
      ringGap: this.ringGapPx(),
      rtl: isRtl(this),
      isExpanded: (id, depth) => this.isExpanded(id, depth),
    });
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const hubLabel = this.label || this.localize('mindMapLabel');
    const context = `${hubLabel}\u0000${
      isRtl(this) ? 'rtl' : 'ltr'
    }\u0000${this.ringGapPx()}`;
    const structuralChange =
      changed.has('topics') ||
      changed.has('expandDepth') ||
      changed.has('expandedOverrides') ||
      changed.has('label') ||
      changed.has('strings') ||
      changed.has('locale');
    if (
      this.layoutInvalidated ||
      structuralChange ||
      context !== this.layoutContext
    ) {
      this.relayout();
      this.layoutContext = context;
      this.layoutInvalidated = false;
      if (
        this.focusedId &&
        !this.cachedLayout.placed.some((topic) => topic.id === this.focusedId)
      ) {
        this.focusedId = this.cachedLayout.placed[0]?.id ?? null;
      }
    }
  }

  private setAnnouncement(text: string): void {
    this.liveText = text;
    this.announcementSink?.announce(text);
  }

  private toggle(node: PlacedTopic, announce = true): void {
    const expanded = !this.isExpanded(node.id, node.depth);
    const next = new Map(this.expandedOverrides);
    next.set(node.id, expanded);
    this.expandedOverrides = next;
    this.emit('lr-topic-toggle', { topicId: node.id, expanded });
    if (announce) {
      this.setAnnouncement(
        this.localize(
          expanded ? 'mindMapExpanded' : 'mindMapCollapsed',
          undefined,
          { label: node.label }
        )
      );
    }
  }

  private activate(node: PlacedTopic): void {
    if (node.hasChildren) this.toggle(node);
    else this.emit('lr-topic-select', { topicId: node.id });
  }

  private siblingsOf(node: PlacedTopic): PlacedTopic[] {
    return this.cachedLayout.placed.filter((p) => p.parentId === node.parentId);
  }

  private childrenOf(id: string): PlacedTopic[] {
    return this.cachedLayout.placed.filter((p) => p.parentId === id);
  }

  private announce(node: PlacedTopic): void {
    const numberFormat = getNumberFormat(this.effectiveLocale);
    this.setAnnouncement(
      node.hasChildren
        ? this.localize('mindMapTopicStatus', undefined, {
            label: node.label,
            level: numberFormat.format(node.depth + 1),
            count: numberFormat.format(this.childrenOf(node.id).length),
          })
        : this.localize('mindMapLeafStatus', undefined, {
            label: node.label,
            level: numberFormat.format(node.depth + 1),
          })
    );
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
      // The destination topic status is the useful announcement for this single gesture. The old
      // shadow live region batched the intermediate expansion text away in the same Lit update.
      if (!this.isExpanded(current.id, current.depth))
        this.toggle(current, false);
      const child = this.childrenOf(current.id)[0];
      if (child) this.focusNodeById(child.id);
      return;
    }
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (
      e.key === forwardKey ||
      e.key === backwardKey ||
      e.key === 'Home' ||
      e.key === 'End'
    ) {
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

  // Tabbing into the single-tab-stop svg has to show something: the drawn focus ring only renders
  // once focusedId is non-null, and the svg's own outline is suppressed, so a bare Tab used to land
  // with no visible focus state at all until the first arrow press. Seeding the first placed topic
  // here draws the ring immediately. Native "focus" does not bubble, so it can never be caught by a
  // delegated listener -- "focusin" does, and covers focus landing on the svg or on anything the
  // layout ever nests inside it.
  private onFocusIn = (): void => {
    if (this.focusedId !== null) return;
    const first = this.cachedLayout.placed[0];
    if (first) this.focusedId = first.id;
  };

  private onNodeClick(node: PlacedTopic): void {
    this.focusedId = node.id;
    this.svgEl?.focus();
    // A parent activation ends in its expanded/collapsed state; a leaf has no toggle text, so its
    // positional status remains the announcement. This preserves the old single-update behavior.
    if (!node.hasChildren) this.announce(node);
    this.activate(node);
  }

  private connectorControlPoint(
    from: PlacedTopic,
    to: PlacedTopic
  ): { x: number; y: number } {
    const layout = this.cachedLayout;
    const parentR = Math.hypot(
      from.x - layout.centerX,
      from.y - layout.centerY
    );
    const dir = isRtl(this) ? -1 : 1;
    return {
      x: layout.centerX + dir * parentR * Math.sin(to.angle),
      y: layout.centerY - parentR * Math.cos(to.angle),
    };
  }

  private renderSemanticNode(
    node: PlacedTopic,
    childrenByParent: Map<string | null, PlacedTopic[]>
  ): TemplateResult {
    const children = childrenByParent.get(node.id) ?? [];
    return html`
      <div
        role="treeitem"
        aria-level=${node.depth + 1}
        aria-expanded=${node.hasChildren
          ? node.expanded
            ? 'true'
            : 'false'
          : nothing}
      >
        <span>${node.label}</span>
        ${children.length
          ? html`<div role="group">
              ${children.map((child) =>
                this.renderSemanticNode(child, childrenByParent)
              )}
            </div>`
          : nothing}
      </div>
    `;
  }

  override render(): TemplateResult {
    const layout = this.cachedLayout;
    if (layout.placed.length === 0) {
      return html`<div part="base">
        <div part="empty">${this.localize('noData')}</div>
      </div>`;
    }
    // A host aria-label names the complete component. The interactive SVG keeps
    // a purpose-specific name and the parallel semantic tree is unnamed so each
    // representation has one distinct semantic owner.
    const ariaLabel = this.label || this.localize('mindMapLabel');
    const byId = new Map(layout.placed.map((p) => [p.id, p]));
    const childrenByParent = new Map<string | null, PlacedTopic[]>();
    for (const topic of layout.placed) {
      const siblings = childrenByParent.get(topic.parentId);
      if (siblings) siblings.push(topic);
      else childrenByParent.set(topic.parentId, [topic]);
    }
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
          @focusin=${this.onFocusIn}
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
              <g part="node" style=${`transform: translate(${node.x}px, ${node.y}px)`} @click=${() =>
              this.onNodeClick(node)}>
                <line
                  class="node-hit"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="0"
                  aria-hidden="true"
                  focusable="false"
                  vector-effect="non-scaling-stroke"
                ></line>
                <circle r="4" aria-hidden="true"></circle>
                <text part="node-label" aria-hidden="true" text-anchor="middle" dy="-8">${
                  node.label
                }</text>
              </g>
            `
          )}
          ${focused
            ? svg`<circle part="focus-ring" cx=${focused.x} cy=${focused.y} r="10"></circle>`
            : nothing}
        </svg>
        <div class="sr-only" role="tree">
          ${(childrenByParent.get(null) ?? []).map((topic) =>
            this.renderSemanticNode(topic, childrenByParent)
          )}
        </div>
        <div id="mind-map-live" part="live-region" class="sr-only">
          ${this.liveText}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-mind-map': LyraMindMap;
  }
}
