import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { styles } from './knowledge-graph-explorer.styles.js';
import type { GraphNode, GraphLink, GraphNodeType, GraphCommunity, GraphRenderer, LyraGraph } from '../graph/graph.class.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
import type { LyraNeighborRow } from '../neighbor-list/neighbor-list.class.js';
import type { LyraPathElement } from '../path-strip/path-strip.class.js';
import type { LyraPopover } from '../../overlays/overlay/popover.class.js';
import '../graph/graph.class.js';
import '../graph-legend/graph-legend.class.js';
import '../entity-card/entity-card.class.js';
import '../neighbor-list/neighbor-list.class.js';
import '../path-strip/path-strip.class.js';
import '../../overlays/overlay/popover.class.js';
import '../../forms/input/input.class.js';
import '../../overlays/chip/chip.class.js';
import '../../forms/button/button.class.js';

/** Extra `LyraEntity` fields a plain `GraphNode` doesn't carry -- merged in by node id to build
 *  the entity shown in the details popover and neighbor rows. A node with no entry here still
 *  renders fine: `degree` falls back to a live count derived from `links`, `description`/
 *  `properties` are simply omitted. */
export type LyraKnowledgeGraphEntityDetails = Pick<LyraEntity, 'description' | 'properties' | 'degree'>;

/** What drives `<lr-knowledge-graph-explorer>`'s own `dimmedNodeIds`/`dimmedLinkIds` forwarding, on
 *  top of the always-active search-match dimming -- see `highlight`'s own doc comment. */
export type KnowledgeGraphHighlight = 'selection' | 'hover' | 'none';

export interface LyraKnowledgeGraphExplorerEventMap {
  /** The user asked to find a path between the two currently pinned nodes (the "Find path" action,
   *  only rendered once exactly two nodes are pinned). `detail: { sourceId, targetId }` -- this
   *  component has no graph-traversal algorithm of its own (client-side, backend call, whatever the
   *  host prefers); it only requests one. The host computes/fetches the path and assigns the result
   *  back through `path`. */
  'lr-path-request': CustomEvent<{ sourceId: string; targetId: string }>;
  /** A node's pinned state changed by user interaction. `detail: { pinnedNodeIds }` -- the complete
   *  updated array. This component already toggles its own `pinnedNodeIds` copy before emitting
   *  (the same self-toggle-then-emit contract `lr-graph-legend`'s `hiddenTypes`/`lr-visibility-
   *  change` already establishes), so reassigning it back is optional -- useful only for a host
   *  that wants to persist or observe pins elsewhere. */
  'lr-pin-change': CustomEvent<{ pinnedNodeIds: string[] }>;
}

/**
 * `<lr-knowledge-graph-explorer>` — an orchestration-level surface for exploring a knowledge
 * graph: the `lr-graph` canvas plus entity search, type filters, neighborhood expansion, pinned
 * nodes, path finding between pins, node selection, and a details overlay. Composes existing
 * primitives rather than re-implementing graph rendering: `lr-graph` (canvas/pan-zoom/selection),
 * `lr-graph-legend` (type filters), `lr-entity-card` (the details popover's default content),
 * `lr-neighbor-list` (the selected entity's relationships), `lr-path-strip` (a found path), and
 * `lr-popover.showAt()` (the details overlay itself).
 *
 * **How the details popover finds its viewport position.** `lr-graph.getNodePosition()` and the
 * `lr-node-click` event's `{ x, y }` are in the graph's own *local drawing space* (pre pan/zoom),
 * never viewport pixels -- passing them straight to `showAt()` would anchor the popover at the
 * wrong place as soon as the graph has panned or zoomed even once. A direct node click resolves
 * the correct viewport rect the way this library's own documented `lr-graph` + `lr-popover.showAt()`
 * composition does: for `renderer="svg"` (the default), `event.composedPath()` (the native `click`
 * that bubbles out of `lr-graph`'s shadow root) locates the actual clicked `[part="node"]` element,
 * whose `getBoundingClientRect()` is already viewport-relative; for `renderer="canvas"` (no
 * per-node DOM element to find), the click event's own `clientX`/`clientY` are used directly, since
 * canvas hit-testing already treats those as viewport coordinates internally. While the popover
 * stays open after an `renderer="svg"` click, this component re-reads that same resolved node
 * element's `getBoundingClientRect()` and re-calls `showAt()` every time the composed `lr-graph`
 * emits its own `lr-viewport-change` (a frame-coalesced pan/zoom/simulation-tick signal) --
 * schedules no `requestAnimationFrame` loop of its own, unlike an idle popover polling the DOM on
 * every frame regardless of whether anything actually moved. Selecting a node any other
 * way -- a search result, a neighbor row, a path-strip element, keyboard Enter/Space on a graph
 * node (which never dispatches a native `click`) -- has no click event to read a rect from, so it
 * instead calls the public `lr-graph.focusNode(id)` (which centers that node in the viewport) and
 * then anchors the popover at the graph element's own `getBoundingClientRect()` center once that
 * settles; no continuous tracking applies to that path.
 *
 * **Controlled vs. self-managed state.** `nodes`/`links`/`nodeTypes`/`communities`/`entityDetails`/
 * `path` are purely host-supplied data, rendered as given. `hiddenTypes`/`selectedNodeId`/
 * `searchQuery`/`pinnedNodeIds` are this component's own genuinely new contribution: it wires them
 * into `lr-graph`'s existing controlled props (`hiddenTypes`, `selectedNodeIds`, `dimmedNodeIds`,
 * `dimmedLinkIds`) itself, toggling its own copy on interaction (the same self-toggle-then-emit
 * contract `lr-graph-legend` already uses) so every feature works with zero host wiring, while
 * still being presettable/observable properties and emitting events (`lr-pin-change`,
 * `lr-path-request`, plus every composed primitive's own event bubbling straight through
 * unmodified) for a host that wants to persist or react to them.
 *
 * `highlight` controls what drives that dimming, on top of the always-active search-match
 * dimming: `'selection'` (the default) dims by the selected node's immediate neighborhood;
 * `'hover'` also dims by whichever node is currently pointer-hovered (falling back to the selected
 * node's neighborhood while nothing is hovered); `'none'` turns this component's own dimming off
 * entirely, forwarding empty `dimmedNodeIds`/`dimmedLinkIds` regardless of search/selection state
 * -- for a host that wants to drive `lr-graph`'s dimming through a different composition instead.
 *
 * @customElement lr-knowledge-graph-explorer
 * @slot details - Overrides the details popover's default content (an `lr-entity-card` with a
 *   nested `lr-neighbor-list` and a pin toggle). Receives no data -- a consumer overriding this
 *   slot reads the selected entity from `selectedNodeId`/`nodes` itself.
 * @event lr-path-request - `detail: { sourceId, targetId }`. See the class doc above.
 * @event lr-pin-change - `detail: { pinnedNodeIds }`. See the class doc above.
 * @event lr-node-click - Bubbles straight through from the composed `lr-graph`, unmodified.
 * @event lr-link-click - Bubbles straight through from the composed `lr-graph`, unmodified.
 * @event lr-node-expand - Bubbles straight through from `lr-graph` and/or `lr-neighbor-list` (the
 *   same event name/detail shape from either source) -- this component never appends neighbors
 *   itself, only forwards the request; a host fetches/generates the expansion and assigns updated
 *   `nodes`/`links` back.
 * @event lr-community-click - Bubbles straight through from the composed `lr-graph`, unmodified.
 * @event lr-relation-activate - Bubbles straight through from the composed `lr-path-strip`, unmodified.
 * @csspart base - The root `role="group"` wrapper.
 * @csspart toolbar - The row wrapping the search input and the type-filter legend.
 * @csspart search - The composed `lr-entity-card` search `lr-input`.
 * @csspart legend - The composed `lr-graph-legend`.
 * @csspart search-results - The search-match list, only rendered while `searchQuery` is non-empty.
 * @csspart search-result - One search-match row (`role="listitem"`, wrapping a `<button>`).
 * @csspart search-empty - The "no matches" message, shown when `searchQuery` is non-empty but no node matches.
 * @csspart pinned - The pinned-nodes row, only rendered while `pinnedNodeIds` is non-empty.
 * @csspart pinned-heading - The pinned-nodes row's leading label.
 * @csspart path - The composed `lr-path-strip`, only rendered while `path` is non-empty.
 * @csspart graph - The composed `lr-graph`.
 * @csspart detail-popover - The composed `lr-popover` hosting the details overlay.
 * @csspart detail-card - The default-content `lr-entity-card`, only present while `selectedNodeId` resolves to a node.
 */
export class LyraKnowledgeGraphExplorer extends LyraElement<LyraKnowledgeGraphExplorerEventMap> {
  static override styles = [LyraElement.styles, styles, srOnly];

  @property({ attribute: false }) nodes: GraphNode[] = [];
  @property({ attribute: false }) links: GraphLink[] = [];
  @property({ attribute: false }) nodeTypes: GraphNodeType[] = [];
  @property({ attribute: false }) communities: GraphCommunity[] = [];
  /** Extra dossier fields, keyed by node id -- see `LyraKnowledgeGraphEntityDetails`. */
  @property({ attribute: false }) entityDetails: Record<string, LyraKnowledgeGraphEntityDetails> = {};
  /** Currently-pinned node ids. Self-toggled by the pin action in the details popover and by a
   *  pinned chip's remove button (see the class doc's "controlled vs. self-managed" note); still
   *  presettable/overridable like any other property. Exactly two pinned nodes reveals the "Find
   *  path" action. */
  @property({ attribute: false }) pinnedNodeIds: string[] = [];
  /** Host-supplied path-finding result, rendered via `lr-path-strip`. Empty (the default) renders
   *  no path strip. See `lr-path-request`. */
  @property({ attribute: false }) path: LyraPathElement[] = [];
  /** Currently-hidden `GraphNode.type` values, forwarded to both `lr-graph.hiddenTypes` and
   *  `lr-graph-legend.hiddenTypes`. Self-toggled by the composed legend; still presettable. */
  @property({ attribute: false }) hiddenTypes: string[] = [];
  /** The currently-selected node id, driving both the details popover and `lr-graph`'s
   *  `selectedNodeIds` visual state. Presettable (e.g. to deep-link to a specific entity) as well
   *  as self-managed on every selection interaction. `null` (the default) shows no selection and
   *  keeps the details popover closed. */
  @property({ attribute: 'selected-node-id' }) selectedNodeId: string | null = null;
  /** Forwarded to `lr-graph.renderer`. `renderer="canvas"` has no per-node DOM element, which
   *  narrows how the node-detail popover anchors and disables its pan/zoom tracking -- see the
   *  class doc's anchoring note. */
  @property() renderer: GraphRenderer = 'svg';
  @property({ type: Number }) width = 800;
  @property({ type: Number }) height = 600;
  /** Accessible name for the root landmark; falls back to the localized `graphExplorerLabel`. */
  @property() label = '';
  /** What drives this component's own `dimmedNodeIds`/`dimmedLinkIds` forwarding, on top of the
   *  always-active search-match dimming -- see the class doc's dedicated paragraph. */
  @property() highlight: KnowledgeGraphHighlight = 'selection';

  @state() private searchQuery = '';
  @state() private pinLiveText = '';
  /** Currently pointer-hovered node id, set only while `highlight === 'hover'` (see
   *  `onGraphNodeEnter`/`onGraphNodeLeave`) -- read by `computedDimmedNodeIds`. */
  @state() private hoveredNodeId: string | null = null;

  @query('[part="graph"]') private graphEl?: LyraGraph;
  @query('[part="detail-popover"]') private popoverEl?: LyraPopover;

  /** Set by `onGraphNodeClick` and consumed either synchronously by the native `click` that
   *  follows it on the same user gesture (a real pointer click), or, failing that, by a queued
   *  microtask fallback (a keyboard Enter/Space activation, which -- unlike a native `<button>` --
   *  never dispatches a synthetic `click` on a `role="button"` SVG/canvas element). */
  private pendingNodeId?: string;
  /** The exact rendered `[part="node"]` element resolved for the currently-open popover
   *  (`renderer="svg"`, direct-click path only) -- re-read on every `lr-viewport-change` so the
   *  popover keeps tracking a pan/zoom gesture or simulation tick while it stays open. */
  private trackedNodeEl?: Element;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // A node removed from `nodes` (or `hiddenTypes` hiding its whole type) shouldn't leave a
    // dangling selection/popover pointed at nothing.
    if ((changed.has('nodes') || changed.has('hiddenTypes')) && this.selectedNodeId && !this.entityFor(this.selectedNodeId)) {
      this.selectedNodeId = null;
      if (this.popoverEl) this.popoverEl.open = false;
    }
  }

  private nodeLabel(id: string): string {
    return this.nodes.find((n) => n.id === id)?.label || id;
  }

  private degreeOf(id: string): number {
    let count = 0;
    for (const link of this.links) {
      if (link.source === id || link.target === id) count++;
    }
    return count;
  }

  private entityFor(id: string): LyraEntity | undefined {
    const node = this.nodes.find((n) => n.id === id);
    if (!node) return undefined;
    const details = this.entityDetails[id];
    return {
      id: node.id,
      label: node.label || node.id,
      type: node.type,
      communityId: node.communityId,
      description: details?.description,
      properties: details?.properties,
      degree: details?.degree ?? this.degreeOf(node.id),
    };
  }

  private communityLabelFor(communityId: string | undefined): string {
    if (!communityId) return '';
    return this.communities.find((c) => c.id === communityId)?.label ?? communityId;
  }

  private neighborRowsFor(id: string): LyraNeighborRow[] {
    const rows: LyraNeighborRow[] = [];
    for (const link of this.links) {
      if (link.source === id) {
        const node = this.entityFor(link.target);
        if (node) rows.push({ relation: link.label ?? '', direction: 'out', node });
      } else if (link.target === id) {
        const node = this.entityFor(link.source);
        if (node) rows.push({ relation: link.label ?? '', direction: 'in', node });
      }
    }
    return rows;
  }

  private matchingNodes(): GraphNode[] | undefined {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return undefined;
    return this.nodes.filter((n) => n.id.toLowerCase().includes(q) || (n.label ?? '').toLowerCase().includes(q));
  }

  private neighborIdsOf(id: string): Set<string> {
    const ids = new Set<string>();
    for (const link of this.links) {
      if (link.source === id) ids.add(link.target);
      else if (link.target === id) ids.add(link.source);
    }
    return ids;
  }

  /** The same key derivation `lr-graph`'s own (private) `linkKey()` uses for `dimmedLinkIds` --
   *  an explicit `id` when the link has one, else `source->target`. */
  private linkKey(link: GraphLink): string {
    return link.id ?? `${link.source}->${link.target}`;
  }

  /** Non-matching nodes while searching; otherwise everything outside the focus node's immediate
   *  neighborhood (the selected node, or -- while `highlight === 'hover'` -- the hovered node when
   *  nothing is selected); otherwise nothing while `highlight === 'none'`. Wires the search/
   *  selection/hover state this component owns into `lr-graph`'s existing `dimmedNodeIds` contract
   *  instead of introducing a parallel highlighting mechanism. */
  private get computedDimmedNodeIds(): string[] {
    if (this.highlight === 'none') return [];
    const matches = this.matchingNodes();
    if (matches) {
      const matchIds = new Set(matches.map((n) => n.id));
      return this.nodes.filter((n) => !matchIds.has(n.id)).map((n) => n.id);
    }
    const focusId = this.selectedNodeId ?? (this.highlight === 'hover' ? this.hoveredNodeId : null);
    if (focusId) {
      const keep = this.neighborIdsOf(focusId);
      keep.add(focusId);
      return this.nodes.filter((n) => !keep.has(n.id)).map((n) => n.id);
    }
    return [];
  }

  /** The link-side mirror of `computedDimmedNodeIds` -- a link is dimmed whenever either endpoint
   *  is, so unrelated edges dim along with unrelated nodes with no extra host wiring. */
  private get computedDimmedLinkIds(): string[] {
    const dimmedNodes = new Set(this.computedDimmedNodeIds);
    if (dimmedNodes.size === 0) return [];
    return this.links
      .filter((l) => dimmedNodes.has(l.source) || dimmedNodes.has(l.target))
      .map((l) => this.linkKey(l));
  }

  private togglePin(id: string): void {
    const wasPinned = this.pinnedNodeIds.includes(id);
    const next = wasPinned ? this.pinnedNodeIds.filter((existing) => existing !== id) : [...this.pinnedNodeIds, id];
    this.pinnedNodeIds = next;
    this.pinLiveText = this.localize(wasPinned ? 'graphExplorerUnpinned' : 'graphExplorerPinned', undefined, {
      label: this.nodeLabel(id),
    });
    this.emit('lr-pin-change', { pinnedNodeIds: next });
  }

  private requestPath(): void {
    if (this.pinnedNodeIds.length !== 2) return;
    const [sourceId, targetId] = this.pinnedNodeIds as [string, string];
    this.emit('lr-path-request', { sourceId, targetId });
  }

  private onVisibilityChange = (event: CustomEvent<{ hiddenTypes: string[] }>): void => {
    this.hiddenTypes = event.detail.hiddenTypes;
  };

  private onSearchInput = (event: CustomEvent<{ value: string }>): void => {
    this.searchQuery = event.detail.value;
  };

  private onEntityActivate = (event: CustomEvent<{ id: string }>): void => {
    void this.activateEntity(event.detail.id);
  };

  /** Selects `id` and opens its details popover without a click event to read a rect from --
   *  centers the node via the public `lr-graph.focusNode()`, then anchors at the graph element's
   *  own viewport rect center once that settles. Shared by search results, neighbor rows,
   *  path-strip elements, `lr-entity-card`'s own built-in focus button, and the keyboard-Enter/
   *  Space fallback for a direct graph node activation. */
  private async activateEntity(id: string): Promise<void> {
    this.selectedNodeId = id;
    this.trackedNodeEl = undefined;
    const graph = this.graphEl;
    if (graph) await graph.focusNode(id);
    const rect = graph?.getBoundingClientRect();
    if (!rect) return;
    this.openDetailAt(id, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: 0, height: 0 });
  }

  private openDetailAt(id: string, rect: { x: number; y: number; width?: number; height?: number }): void {
    const popover = this.popoverEl;
    if (!popover) return;
    popover.accessibleLabel = this.entityFor(id)?.label || '';
    popover.showAt(rect);
  }

  /** Resolves the viewport rect for a direct pointer click on a graph node -- see the class doc's
   *  "how the details popover finds its viewport position" note for the full reasoning. */
  private resolveDirectClickAnchor(event: MouseEvent): { x: number; y: number; width: number; height: number } {
    if (this.renderer === 'canvas') {
      this.trackedNodeEl = undefined;
      return { x: event.clientX, y: event.clientY, width: 0, height: 0 };
    }
    const nodeEl = event
      .composedPath()
      .find((el): el is Element => el instanceof Element && el.matches('[part="node"]'));
    if (!nodeEl) {
      this.trackedNodeEl = undefined;
      return { x: event.clientX, y: event.clientY, width: 0, height: 0 };
    }
    this.trackedNodeEl = nodeEl;
    const rect = nodeEl.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top, width: rect.width, height: rect.height };
  }

  private onGraphNodeClick = (event: CustomEvent<{ id: string; x: number; y: number }>): void => {
    const id = event.detail.id;
    this.selectedNodeId = id;
    this.pendingNodeId = id;
    queueMicrotask(() => {
      if (this.pendingNodeId === id) {
        this.pendingNodeId = undefined;
        void this.activateEntity(id);
      }
    });
  };

  private onGraphNativeClick = (event: MouseEvent): void => {
    const id = this.pendingNodeId;
    if (!id) return;
    this.pendingNodeId = undefined;
    this.openDetailAt(id, this.resolveDirectClickAnchor(event));
  };

  /** Re-anchors the open details popover to `trackedNodeEl`'s current rect -- wired to the
   *  composed `lr-graph`'s `lr-viewport-change` (see the class doc's anchoring note). A no-op
   *  whenever there's nothing to track (`renderer="canvas"`, a non-direct-click selection, or the
   *  popover isn't open), so this never schedules work of its own; it only reacts to `lr-graph`'s
   *  already frame-coalesced signal. */
  private onGraphViewportChange = (): void => {
    const el = this.trackedNodeEl;
    const popover = this.popoverEl;
    if (!el?.isConnected || !popover?.open) return;
    const rect = el.getBoundingClientRect();
    popover.showAt({ x: rect.left + rect.width / 2, y: rect.top, width: rect.width, height: rect.height });
  };

  private onGraphNodeEnter = (event: CustomEvent<{ id: string }>): void => {
    if (this.highlight === 'hover') this.hoveredNodeId = event.detail.id;
  };

  private onGraphNodeLeave = (event: CustomEvent<{ id: string }>): void => {
    if (this.highlight === 'hover' && this.hoveredNodeId === event.detail.id) this.hoveredNodeId = null;
  };

  private onPopoverHide = (): void => {
    this.trackedNodeEl = undefined;
    this.selectedNodeId = null;
  };

  override render(): TemplateResult {
    const groupLabel = this.getAttribute('aria-label') || this.label || this.localize('graphExplorerLabel');
    const matches = this.matchingNodes();
    const selectedEntity = this.selectedNodeId ? (this.entityFor(this.selectedNodeId) ?? null) : null;
    const isPinned = this.selectedNodeId != null && this.pinnedNodeIds.includes(this.selectedNodeId);
    return html`
      <div part="base" role="group" aria-label=${groupLabel} @lr-entity-activate=${this.onEntityActivate}>
        <div part="toolbar">
          <lr-input
            part="search"
            type="search"
            .value=${this.searchQuery}
            placeholder=${this.localize('graphExplorerSearchPlaceholder')}
            @lr-input=${this.onSearchInput}
          ></lr-input>
          <lr-graph-legend
            part="legend"
            .types=${this.nodeTypes}
            .hiddenTypes=${this.hiddenTypes}
            @lr-visibility-change=${this.onVisibilityChange}
          ></lr-graph-legend>
        </div>
        ${matches
          ? html`
              <div part="search-results" role="list" aria-label=${this.localize('graphExplorerSearchResultsLabel')}>
                ${matches.length === 0
                  ? html`<div part="search-empty">${this.localize('viewerSearchNoMatches')}</div>`
                  : matches.map(
                      (n) => html`
                        <div part="search-result" role="listitem">
                          <button type="button" @click=${() => void this.activateEntity(n.id)}>${n.label || n.id}</button>
                        </div>
                      `,
                    )}
              </div>
              <div class="sr-only" role="status" aria-live="polite">
                ${matches.length === 0
                  ? this.localize('viewerSearchNoMatches')
                  : this.localize(matches.length === 1 ? 'viewerSearchMatchCount' : 'viewerSearchMatchCountPlural', undefined, {
                      count: matches.length,
                    })}
              </div>
            `
          : nothing}
        ${this.pinnedNodeIds.length
          ? html`
              <div part="pinned">
                <span part="pinned-heading">${this.localize('graphExplorerPinnedHeading')}</span>
                ${this.pinnedNodeIds.map(
                  (id) => html`<lr-chip removable @lr-remove=${() => this.togglePin(id)}>${this.nodeLabel(id)}</lr-chip>`,
                )}
                ${this.pinnedNodeIds.length === 2
                  ? html`<lr-button size="s" @click=${() => this.requestPath()}>${this.localize('graphExplorerFindPath')}</lr-button>`
                  : nothing}
              </div>
            `
          : nothing}
        <div class="sr-only" role="status" aria-live="polite">${this.pinLiveText}</div>
        ${this.path.length ? html`<lr-path-strip part="path" .path=${this.path}></lr-path-strip>` : nothing}
        <lr-graph
          part="graph"
          .nodes=${this.nodes}
          .links=${this.links}
          .nodeTypes=${this.nodeTypes}
          .communities=${this.communities}
          .hiddenTypes=${this.hiddenTypes}
          .selectedNodeIds=${this.selectedNodeId ? [this.selectedNodeId] : []}
          .dimmedNodeIds=${this.computedDimmedNodeIds}
          .dimmedLinkIds=${this.computedDimmedLinkIds}
          renderer=${this.renderer}
          width=${this.width}
          height=${this.height}
          @lr-node-click=${this.onGraphNodeClick}
          @click=${this.onGraphNativeClick}
          @lr-node-enter=${this.onGraphNodeEnter}
          @lr-node-leave=${this.onGraphNodeLeave}
          @lr-viewport-change=${this.onGraphViewportChange}
        ></lr-graph>
        <lr-popover part="detail-popover" popup-role="dialog" @lr-hide=${this.onPopoverHide}>
          <slot name="details">
            ${selectedEntity
              ? html`
                  <lr-entity-card
                    part="detail-card"
                    .entity=${selectedEntity}
                    .types=${this.nodeTypes}
                    community-label=${this.communityLabelFor(selectedEntity.communityId)}
                  >
                    <lr-neighbor-list
                      .rows=${this.neighborRowsFor(
                        // selectedEntity (this block's guard, computed above) is only ever
                        // non-null when this.selectedNodeId was truthy at that same point in
                        // this render() call, so this can never actually be null here.
                        this.selectedNodeId!,
                      )}
                      expandable
                    ></lr-neighbor-list>
                    <lr-button slot="actions" size="s" @click=${() => this.selectedNodeId && this.togglePin(this.selectedNodeId)}>
                      ${this.localize(isPinned ? 'graphExplorerUnpin' : 'graphExplorerPin')}
                    </lr-button>
                  </lr-entity-card>
                `
              : nothing}
          </slot>
        </lr-popover>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-knowledge-graph-explorer': LyraKnowledgeGraphExplorer;
  }
}
