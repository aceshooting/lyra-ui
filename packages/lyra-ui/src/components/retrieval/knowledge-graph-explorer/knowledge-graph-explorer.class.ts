import { ENGINE_3D_PREFERENCE, type Engine3dPreference, type Engine3dFallbackDetail } from '../../../internal/engine-3d.js';
import { ref } from 'lit/directives/ref.js';
import { setGraphSourceComposition, resolveGraphSourceComposition, focusGraphSourceComposition, type GraphSourceCompositionSnapshot } from '../graph/graph-source-composition.js';
import type { GraphSource } from '../graph/graph.class.js';
export type KnowledgeGraphExplorerSource = GraphSource;
const EMPTY_SOURCE_NODES: readonly LyraGraphNode[] = Object.freeze([]);
const EMPTY_SOURCE_EDGES: readonly LyraGraphEdge[] = Object.freeze([]);
import { collectionSupport, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteInteger, finiteRange } from '../../../internal/numbers.js';
import { srOnly } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
export type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
import { styles } from './knowledge-graph-explorer.styles.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
import type {
  LyraGraphCamera,
  LyraGraphView,
  LyraGraphCommunity,
  LyraGraphFit,
  LyraGraphNodeLabelsMode,
  LyraGraphRenderer,
  LyraGraph,
  LyraGraphEdge,
  LyraGraphNode,
} from '../graph/graph.class.js';
import {
  graphLengthConverter,
  graphLinkIdentity,
  normalizeGraphModel,
  type NormalizedGraphModel,
} from '../graph/graph-model.js';
import {
  canonicalIdentityList,
  isNonBlankIdentity,
} from '../retrieval-identity.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
import type { LyraNeighborRow, LyraNeighborList } from '../neighbor-list/neighbor-list.class.js';
import type { LyraPathElement } from '../path-strip/path-strip.class.js';
export type { LyraPathElement } from '../path-strip/path-strip.class.js';
import type { LyraPopover } from '../../overlays/overlay/popover.class.js';
import '../graph/graph.class.js';
import '../graph-legend/graph-legend.class.js';
import '../entity-card/entity-card.class.js';
import '../neighbor-list/neighbor-list.class.js';
import '../../overlays/overlay/popover.class.js';
import '../../forms/input/input.class.js';
import '../../forms/button/button.class.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_graphDataListLimit, LYRA_DEFAULT_graphEdgeLimit, LYRA_DEFAULT_graphExplorerAllTypesHidden, LYRA_DEFAULT_graphExplorerClearTypes, LYRA_DEFAULT_graphExplorerFindPath, LYRA_DEFAULT_graphExplorerLabel, LYRA_DEFAULT_graphExplorerPin, LYRA_DEFAULT_graphExplorerPinned, LYRA_DEFAULT_graphExplorerPinnedHeading, LYRA_DEFAULT_graphExplorerSearchLimit, LYRA_DEFAULT_graphExplorerSearchPlaceholder, LYRA_DEFAULT_graphExplorerSearchResultsLabel, LYRA_DEFAULT_graphExplorerUnpin, LYRA_DEFAULT_graphExplorerUnpinned, LYRA_DEFAULT_graphNodeLimit } from '../../../internal/default-strings/retrieval.generated.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_engine3dContextLost, LYRA_DEFAULT_engine3dError, LYRA_DEFAULT_engine3dLoading, LYRA_DEFAULT_engine3dShowingBuiltin, LYRA_DEFAULT_engine3dShowingList, LYRA_DEFAULT_engine3dSoftwareRendering, LYRA_DEFAULT_engine3dUnavailable, LYRA_DEFAULT_engine3dUnsupported, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_largeDataInvalid, LYRA_DEFAULT_largeDataLimit, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_restore, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_statusError, LYRA_DEFAULT_viewerSearchMatchCount, LYRA_DEFAULT_viewerSearchNoMatches } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Search results rendered at once; the match count still covers every match. */
const SEARCH_RESULT_LIMIT = 50;

function isElementNode(value: EventTarget): value is Element {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Element> & { nodeType?: unknown };
  return (
    candidate.nodeType === 1 &&
    typeof candidate.matches === 'function' &&
    typeof candidate.getBoundingClientRect === 'function'
  );
}

/** Extra `LyraEntity` fields a plain `LyraGraphNode` doesn't carry -- merged in by node id to build
 *  the entity shown in the details popover and neighbor rows. A node with no entry here still
 *  renders fine: `degree` falls back to a live count derived from `edges`, `description`/
 *  `properties` are simply omitted. */
export type LyraKnowledgeGraphEntityDetails = Pick<
  LyraEntity,
  'description' | 'properties' | 'degree'
>;

/** What drives `<lr-knowledge-graph-explorer>`'s own `dimmedNodeIds`/`dimmedEdgeIds` forwarding, on
 *  top of the always-active search-match dimming -- see `highlight`'s own doc comment. */
export type KnowledgeGraphHighlight = 'selection' | 'hover' | 'none';

export interface LyraKnowledgeGraphExplorerEventMap {
  /** The explorer changed its self-managed selection. Fires after `selectedNodeId` is updated for
   *  search, graph, neighbor, path, entity-card, invalidation, and popover-close paths. Direct
   *  host assignments remain silent. */
  'lr-selection-change': CustomEvent<
    LyraEventDetailSnapshot<{
      selectedNodeId: string | null;
      selectedNodeIds: string[];
      selectedEdgeIds: string[];
    }>
  >;
  /** The user asked to find a path between the two currently pinned nodes (the "Find path" action,
   *  only rendered once exactly two nodes are pinned). `detail: { sourceNodeId, targetNodeId }` -- this
   *  component has no graph-traversal algorithm of its own (client-side, backend call, whatever the
   *  host prefers); it only requests one. The host computes/fetches the path and assigns the result
   *  back through `path`. */
  'lr-path-request': CustomEvent<{
    sourceNodeId: string;
    targetNodeId: string;
  }>;
  /** A node's pinned state changed by user interaction. `detail: { pinnedNodeIds }` -- the complete
   *  updated array. This component already toggles its own `pinnedNodeIds` copy before emitting
   *  (the same self-toggle-then-emit contract `lr-graph-legend`'s `hiddenTypes`/`lr-visibility-
   *  change` already establishes), so reassigning it back is optional -- useful only for a host
   *  that wants to persist or observe pins elsewhere. */
  'lr-pin-change': CustomEvent<
    LyraEventDetailSnapshot<{ pinnedNodeIds: string[] }>
  >;
  /** The user typed in the toolbar's search box. `detail: LyraSearchChangeDetail`
   *  -- `query` is the canonical `LyraSearchChangeDetail` field name
   *  (`internal/text-viewer-target.ts`). `matchCount` is the same live node-filter total the
   *  search-result list and its own live-region announcement already compute (`0` while `query`
   *  is empty). `matchCountExact` is always `true`: unlike a paginated text-search viewer, this
   *  component's node filter has no ceiling, so it can never truncate. This is a live node
   *  FILTER, not a cursor-based text search, so `activeIndex` is always `-1`. The component
   *  has already applied the query to its own `query` before
   *  emitting, the same self-toggle-then-emit contract `lr-pin-change` follows, so reassigning it
   *  back is optional and a direct host assignment stays silent. */
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
  /** A node type's visibility changed via the composed legend. `detail: { hiddenTypes }` -- the
   *  complete updated array. This component already applies it to its own `hiddenTypes` before
   *  emitting, the same self-toggle-then-emit contract `lr-pin-change`/`lr-search-change` follow,
   *  so reassigning it back is optional and a direct host assignment stays silent. */
  'lr-hidden-types-change': CustomEvent<
    LyraEventDetailSnapshot<{ hiddenTypes: string[] }>
  >;
  'lr-node-activate': CustomEvent<{ nodeId: string; x: number; y: number; z?: number }>;
  'lr-engine-fallback': CustomEvent<Engine3dFallbackDetail>;
  'lr-camera-change': CustomEvent<{ camera: LyraGraphCamera }>;
  'lr-view-change': CustomEvent<{ view: LyraGraphView }>;
  'lr-edge-activate': CustomEvent<{ sourceNodeId: string; targetNodeId: string; edgeId?: string }>;
  'lr-node-expand': CustomEvent<{ nodeId: string }>;
  /** Bubbles unchanged from the composed `lr-graph`. */
  'lr-community-activate': CustomEvent<{ communityId: string }>;
  'lr-relation-activate': CustomEvent<{
    relation: string;
    sourceNodeId?: string;
    targetNodeId?: string;
    occurrenceIndex: number;
  }>;
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
 * `view="3d"` forwards true spatial positions and camera controls; `view="list"` provides the
 * visible accessible fallback. Neither requires d3. The default remains `view="2d"`. In 3D,
 * details use `getNodeScreenPosition()` and follow `lr-camera-change`, including search-driven
 * selection. The coordinates are CSS pixels relative to the composed graph's border box.
 *
 * **How the 2D details popover finds its viewport position.** `lr-graph.getNodePosition()` and the
 * `lr-node-activate` event's `{ x, y }` are in the graph's own *local drawing space* (pre pan/zoom),
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
 * schedules no continuous popover-polling loop of its own, unlike an idle popover polling the DOM
 * every frame regardless of whether anything actually moved. Selecting a node any other
 * way -- a search result, a neighbor row, a path-strip element, keyboard Enter/Space on a graph
 * node (which never dispatches a native `click`) -- has no click event to read a rect from, so it
 * instead calls the public `lr-graph.focusNode(id)` (which centers that node in the viewport) and
 * then anchors the popover at the graph element's own `getBoundingClientRect()` center once that
 * settles; no continuous tracking applies to that path.
 *
 * **Controlled vs. self-managed state.** `nodes`/`edges`/`nodeTypes`/`communities`/`entityDetails`/
 * `path` are purely host-supplied data, rendered as given. `hiddenTypes`/`selectedNodeId`/
 * `query`/`pinnedNodeIds` are this component's own genuinely new contribution: it wires them
 * into `lr-graph`'s existing controlled props (`hiddenTypes`, `selectedNodeIds`, `dimmedNodeIds`,
 * `dimmedEdgeIds`) itself, toggling its own copy on interaction (the same self-toggle-then-emit
 * contract `lr-graph-legend` already uses) so every feature works with zero host wiring, while
 * still being presettable/observable properties and emitting events (`lr-selection-change`,
 * `lr-pin-change`, `lr-path-request`, plus every composed primitive's own event bubbling straight through
 * unmodified) for a host that wants to persist or react to them.
 * Hidden node types are excluded from both search matches and selected-entity neighbor rows, and
 * activation requests for a hidden node are ignored before selection changes.
 *
 * `highlight` controls what drives that dimming, on top of the always-active search-match
 * dimming: `'selection'` (the default) dims by the selected node's immediate neighborhood;
 * `'hover'` also dims by whichever node is currently pointer-hovered (falling back to the selected
 * node's neighborhood while nothing is hovered); `'none'` turns this component's own dimming off
 * entirely, forwarding empty `dimmedNodeIds`/`dimmedEdgeIds` regardless of search/selection state
 * -- for a host that wants to drive `lr-graph`'s dimming through a different composition instead.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-knowledge-graph-explorer
 * @slot details - Overrides the details popover's default content (an `lr-entity-card` with a
 *   nested `lr-neighbor-list` and a pin toggle). Receives no data -- a consumer overriding this
 *   slot reads the selected entity from `selectedNodeId`/`nodes` itself. Replaces the default
 *   card entirely, including `detail-body`/`detail-actions` below.
 * @slot detail-body - Additive content appended inside the default `lr-entity-card`'s body,
 *   alongside its `lr-neighbor-list`. No effect while `details` is overridden.
 * @slot detail-actions - Additive content appended into the default `lr-entity-card`'s `actions`
 *   slot, beside its built-in pin toggle. No effect while `details` is overridden.
 * @event lr-selection-change - The explorer changed its self-managed selection. `detail:
 *   { selectedNodeId, selectedNodeIds, selectedEdgeIds }`, the last two in `lr-graph`'s shape.
 *   Direct host assignments do not emit.
 * @event lr-path-request - `detail: { sourceNodeId, targetNodeId }`. See the class doc above.
 * @event lr-pin-change - `detail: { pinnedNodeIds }`. See the class doc above.
 * @event lr-search-change - The user typed in the toolbar's search box. `detail:
 *   { query, matchCount, matchCountExact, activeIndex }`. `query` is the canonical `LyraSearchChangeDetail`
 *   name; `matchCountExact` is always `true` since this component's node filter has no truncating
 *   ceiling. `activeIndex` is always `-1` because this is a live node filter.
 *   Direct host assignments do not emit.
 * @event lr-hidden-types-change - A node type's visibility changed via the composed legend.
 *   `detail: { hiddenTypes }`. See the class doc above. Direct host assignments do not emit.
 * @event lr-node-activate - Bubbles unchanged with `{ nodeId, x, y, z? }`; spatial activation
 *   includes world z, while 2D retains its existing local x/y coordinates.
 * @event lr-engine-fallback - Bubbles unchanged from the composed graph with `{ from, to, reason }`.
 * @event lr-camera-change - Bubbles unchanged from the composed graph with `{ camera }`.
 *   Spatial detail popovers follow the newly projected node position.
 * @event lr-view-change - Bubbles from the graph toolbar with `{ view }`; the explorer updates
 *   its own view before the event reaches consumers. Property assignments are silent.
 * @event lr-edge-activate - Bubbles unchanged from the composed graph with `{ sourceNodeId, targetNodeId, edgeId? }`.
 * @event lr-node-expand - Bubbles straight through from `lr-graph` and/or `lr-neighbor-list` (the
 *   same event name/detail shape from either source) -- this component never appends neighbors
 *   itself, only forwards the request; a host fetches/generates the expansion and assigns updated
 *   `nodes`/`edges` back.
 * @event lr-community-activate - Bubbles straight through from the composed `lr-graph`, unmodified.
 *   `detail: { communityId }`.
 * @event lr-relation-activate - Bubbles straight through from the composed `lr-path-strip`, unmodified.
 * @csspart base - The root wrapper. It owns `role="group"` and the fallback name unless a
 *   non-empty host `aria-label` makes the host the sole overall owner.
 * @csspart toolbar - The row wrapping the search input and the type-filter legend.
 * @csspart search - The composed `lr-entity-card` search `lr-input`.
 * @csspart legend - The composed `lr-graph-legend`.
 * @csspart search-results - The search-match list, only rendered while `query` is non-empty: at most
 *   50 rows sharing one tab stop (ArrowUp/ArrowDown/Home/End); the announced count covers every match.
 * @csspart search-result - One search-match row (`role="listitem"`, wrapping a `<button>`).
 * @csspart search-empty - The "no matches" message, shown when `query` is non-empty but no node matches.
 * @csspart input-limit - Localized retained/source counts for nodes and links omitted at assignment.
 * @csspart details-limit - Localized shown/total notice when `entityDetails` holds more entries than the shared boundary keeps.
 * @csspart search-limit - Localized shown/total notice when search matches exceed the 50-row list.
 * @csspart pinned - The pinned-nodes row, only rendered while `pinnedNodeIds` is non-empty.
 * @csspart pinned-heading - The pinned-nodes row's leading label.
 * @csspart path - The composed `lr-path-strip`, or its loading/error status, while `path` is non-empty.
 *   Path registration loads on first use; `updateComplete` waits for registration and rendering.
 * @csspart source-status - Source filter error or all-types-hidden status.
 * @csspart source-clear - Restores unfiltered source navigation.
 * @csspart detail-neighbors - The details neighborhood, source-bound only while details are open.
 * @csspart graph - The composed `lr-graph`.
 * @csspart detail-popover - The composed `lr-popover` hosting the details overlay.
 * @csspart detail-card - The default-content `lr-entity-card`, only present while `selectedNodeId` resolves to a node.
 * @cssprop [--lr-canvas-reserved-height=var(--lr-size-24rem)] - Default block size of both this
 *   host and the composed `lr-graph`, shared with the pre-upgrade reservation stylesheet. Below
 *   this in the fallback chain, the composed `lr-graph`'s own normalized `height` (forwarded from
 *   this component's own `height`) sizes it instead; an explicit outer `block-size` still wins over
 *   both.
 * @status stable
 * @since 4.1.0
 */
export class LyraKnowledgeGraphExplorer extends LyraElement<LyraKnowledgeGraphExplorerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    copy: LYRA_DEFAULT_copy,
    date: LYRA_DEFAULT_date,
    details: LYRA_DEFAULT_details,
    engine3dContextLost: LYRA_DEFAULT_engine3dContextLost,
    engine3dError: LYRA_DEFAULT_engine3dError,
    engine3dLoading: LYRA_DEFAULT_engine3dLoading,
    engine3dShowingBuiltin: LYRA_DEFAULT_engine3dShowingBuiltin,
    engine3dShowingList: LYRA_DEFAULT_engine3dShowingList,
    engine3dSoftwareRendering: LYRA_DEFAULT_engine3dSoftwareRendering,
    engine3dUnavailable: LYRA_DEFAULT_engine3dUnavailable,
    engine3dUnsupported: LYRA_DEFAULT_engine3dUnsupported,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    graphDataListLimit: LYRA_DEFAULT_graphDataListLimit,
    graphEdgeLimit: LYRA_DEFAULT_graphEdgeLimit,
    graphExplorerAllTypesHidden: LYRA_DEFAULT_graphExplorerAllTypesHidden,
    graphExplorerClearTypes: LYRA_DEFAULT_graphExplorerClearTypes,
    graphExplorerFindPath: LYRA_DEFAULT_graphExplorerFindPath,
    graphExplorerLabel: LYRA_DEFAULT_graphExplorerLabel,
    graphExplorerPin: LYRA_DEFAULT_graphExplorerPin,
    graphExplorerPinned: LYRA_DEFAULT_graphExplorerPinned,
    graphExplorerPinnedHeading: LYRA_DEFAULT_graphExplorerPinnedHeading,
    graphExplorerSearchLimit: LYRA_DEFAULT_graphExplorerSearchLimit,
    graphExplorerSearchPlaceholder: LYRA_DEFAULT_graphExplorerSearchPlaceholder,
    graphExplorerSearchResultsLabel: LYRA_DEFAULT_graphExplorerSearchResultsLabel,
    graphExplorerUnpin: LYRA_DEFAULT_graphExplorerUnpin,
    graphExplorerUnpinned: LYRA_DEFAULT_graphExplorerUnpinned,
    graphNodeLimit: LYRA_DEFAULT_graphNodeLimit,
    largeDataInvalid: LYRA_DEFAULT_largeDataInvalid,
    largeDataLimit: LYRA_DEFAULT_largeDataLimit,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    progress: LYRA_DEFAULT_progress,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    statusError: LYRA_DEFAULT_statusError,
    viewerSearchMatchCount: LYRA_DEFAULT_viewerSearchMatchCount,
    viewerSearchNoMatches: LYRA_DEFAULT_viewerSearchNoMatches,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'nodes',
    'edges',
    'nodeTypes',
    'communities',
    'entityDetails',
    'pinnedNodeIds',
    'path',
    'hiddenTypes',
  ]);

  static override styles = [LyraElement.styles, styles, srOnly];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-selection-change',
    'lr-pin-change',
    'lr-hidden-types-change',
  ]);

  private _graphSource?: KnowledgeGraphExplorerSource;
  private sourceEpoch = 0;
  private sourceSearchVersion = 0;
  private sourceSearchIntent?: { readonly query: string; readonly version: number; readonly epoch: number };
  private sourceAssigned = false;
  private sourceClosing = false;
  private sourceChildBinding?: readonly unknown[];
  private sourceChild?: LyraGraph;
  private sourceInspect?: readonly unknown[];
  @state() private sourceEntity?: LyraGraphNode;
  @state() private sourceDetailsOpen = false;
  @state() private sourcePaint = 0;
  /** Full graph provider, passed unchanged to the child graph. Same-source assignment and
   * requestUpdate() refresh it. Unset restores legacy arrays. Controlled source selection is
   * resolved without moving the page or opening details; user activation opens details.
   * When hiddenTypes is used, at most500 nodeTypes (2,000,000 total ID units) must declare the provider's complete type catalog.
   * Unfiltered navigation includes provider types outside that catalog. */
  @property({ attribute: false, noAccessor: true, hasChanged: () => true })
  get graphSource(): KnowledgeGraphExplorerSource | undefined { return this._graphSource; }
  set graphSource(value: KnowledgeGraphExplorerSource | undefined) {
    const previous = this._graphSource; this._graphSource = value;
    this.requestUpdate('graphSource', previous);
  }
  private _sourcePage = 0;
  /** Zero-based page of the sole child-owned global record navigator. */
  @property({ type: Number, attribute: 'source-page', noAccessor: true })
  get sourcePage(): number { return this._sourcePage; }
  set sourcePage(value: number) {
    const old = this._sourcePage; this._sourcePage = value;
    const size = finiteInteger(this.sourcePageSize, 100, 1, 500), page = finiteInteger(value, 0, 0, Math.floor(Number.MAX_SAFE_INTEGER / size));
    if (this.sourceChild && this.sourceChild.sourcePage !== page) this.sourceChild.sourcePage = page;
    this.requestUpdate('sourcePage', old);
  }
  private _sourcePageSize = 100;
  /** Records per page, default 100 and normalized 1–500 by the child. */
  @property({ type: Number, attribute: 'source-page-size', noAccessor: true })
  get sourcePageSize(): number { return this._sourcePageSize; }
  set sourcePageSize(value: number) {
    const old = this._sourcePageSize; this._sourcePageSize = value;
    if (!Object.is(old, value)) this.sourcePage = 0;
    const size = finiteInteger(value, 100, 1, 500);
    if (this.sourceChild && this.sourceChild.sourcePageSize !== size) this.sourceChild.sourcePageSize = size;
    this.requestUpdate('sourcePageSize', old);
  }
  /** Exact active filtered node/edge total, distinct from full-source graph totals. */
  get sourceTotal(): number | null { return this.graphSource === undefined || this.sourceFilter.invalid ? null : this.sourceFilter.empty ? 0 : this.sourceChild?.graphSource === this.graphSource ? this.sourceChild.sourceTotal : null; }
  private get sourceFilter(): { readonly nodeTypes: readonly string[]; readonly empty: boolean; readonly invalid: boolean } {
    const hidden = this.canonicalHiddenTypes;
    if (!hidden.length) return { nodeTypes: [], empty: false, invalid: false };
    const catalog = canonicalIdentityList(this.nodeTypes.map(type => type.id));
    let units = 0;
    if (catalog.length > 500 || catalog.some(type => type.length > 65_536 || (units += type.length) > 2_000_000)) return { nodeTypes: [], empty: true, invalid: true };
    const types = catalog.filter(type => !hidden.includes(type));
    return { nodeTypes: types, empty: types.length === 0, invalid: false };
  }
  private sourceCurrent(): () => boolean {
    const source = this.graphSource, epoch = this.sourceEpoch, generation = this.activationGeneration, owner = this.ownerDocument;
    let revision: unknown;
    try { revision = source?.revision; } catch { return () => false; }
    return () => { try { return source?.revision === revision && this.graphSource === source && this.sourceEpoch === epoch && this.activationGeneration === generation && this.isConnected && this.ownerDocument === owner; } catch { return false; } };
  }
  private readonly sourceAccepted = (snapshot: GraphSourceCompositionSnapshot): void => {
    if (!snapshot.current() || this.graphSource === undefined || this.sourceChild?.graphSource !== this.graphSource) return;
    if (this.sourcePage !== snapshot.page) this.sourcePage = snapshot.page;
    this.sourcePaint++;
    const intent = this.sourceSearchIntent;
    if (!this.sourceFilter.invalid && intent && intent.epoch === this.sourceEpoch && intent.version === this.sourceSearchVersion && intent.query === this.query && snapshot.query.kind === 'nodes' && snapshot.query.centerKey === null && snapshot.query.search === intent.query && snapshot.total !== null && snapshot.current()) {
      this.sourceSearchIntent = undefined;
      const detail = { query: intent.query, matchCount: intent.query.trim() ? snapshot.total : 0, matchCountExact: true, activeIndex: -1 };
      if (snapshot.current()) this.emit('lr-search-change', detail);
    }
    if (snapshot.current()) this.inspectSourceSelection();
  };
  private readonly bindSourceChild = (element?: Element): void => {
    const graph = element as LyraGraph | undefined;
    if (!graph) {
      if (this.sourceChild) setGraphSourceComposition(this.sourceChild, undefined);
      this.sourceChild = undefined; this.sourceChildBinding = undefined; return;
    }
    this.sourceChild = graph;
    const size = finiteInteger(this.sourcePageSize, 100, 1, 500), page = finiteInteger(this.sourcePage, 0, 0, Math.floor(Number.MAX_SAFE_INTEGER / size));
    if (graph.sourcePageSize !== size) graph.sourcePageSize = size;
    if (graph.sourcePage !== page) graph.sourcePage = page;
    if (this.graphSource === undefined) {
      setGraphSourceComposition(graph, undefined);
      if (graph.graphSource !== undefined) graph.graphSource = undefined;
      this.sourceChildBinding = undefined; return;
    }
    const filter = this.sourceFilter;
    setGraphSourceComposition(graph, { search: (this.query ?? '').slice(0, 65_536), nodeTypes: filter.nodeTypes, empty: filter.empty, accepted: this.sourceAccepted });
    const binding = [graph, this.graphSource, this.sourceEpoch];
    if (!this.sourceChildBinding || binding.some((value, index) => value !== this.sourceChildBinding![index])) {
      this.sourceChildBinding = binding; graph.graphSource = this.graphSource;
    }
    this.inspectSourceSelection();
  };
  private inspectSourceSelection(): void {
    const graph = this.sourceChild, id = this.selectedNodeId;
    if (!graph || this.graphSource === undefined || this.sourceFilter.empty || !id) return;
    const signature = [graph, this.graphSource, this.sourceEpoch, id];
    if (this.sourceInspect && signature.every((value, index) => value === this.sourceInspect![index])) return;
    this.sourceInspect = signature;
    const current = this.sourceCurrent();
    void resolveGraphSourceComposition(graph, [`node:${id}`]).then(result => {
      if (!result || !result.current() || !current() || this.selectedNodeId !== id) { if (this.sourceInspect === signature) this.sourceInspect = undefined; return; }
      const record = result.records.find(row => row.key === `node:${id}`);
      if (!record || record.value.kind !== 'node') { this.selectedNodeId = null; return; }
      this.sourceEntity = record.value.value;
    });
  }
  /** Reveals and focuses a global node or edge without activation. Clears toolbar filters. */
  async revealSourceKey(key: string): Promise<boolean> {
    if (this.graphSource === undefined) return false;
    this.query = ''; this.hiddenTypes = [];
    const current = this.sourceCurrent();
    await this.updateComplete;
    if (!current()) return false;
    const revealed = await this.sourceChild?.revealSourceKey(key);
    return current() && revealed === true;
  }
  private closeSourceDetails(closePopover = true): void {
    this.sourceDetailsOpen = false;
    const neighbors = this.renderRoot?.querySelector<LyraNeighborList>('[part="detail-neighbors"]');
    if (neighbors?.graphSource !== undefined) neighbors.graphSource = undefined;
    if (closePopover && this.popoverEl?.open) { this.sourceClosing = true; this.popoverEl.open = false; }
  }
  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    const name = args[0];
    if (this.sourceEpoch !== undefined && (name === 'graphSource' || name === undefined)) {
      this.sourceEpoch++; this.sourceInspect = undefined; this.sourceEntity = undefined; this.closeSourceDetails(); this.sourceSearchIntent = undefined;
      this.internalSelectionAssignment = undefined; this.invalidateActivation();
      if (this.sourceChild?.graphSource !== undefined) this.sourceChild.graphSource = undefined;
    }
    if (name === 'query') { this.sourceSearchVersion = (this.sourceSearchVersion ?? 0) + 1; this.sourceSearchIntent = undefined; }
    if (this.graphSource !== undefined && (name === 'hiddenTypes' || name === 'nodeTypes' || (name === 'selectedNodeId' && !this.sourceAssigned))) {
      this.invalidateActivation(); this.sourceInspect = undefined; this.closeSourceDetails();
      if (name === 'selectedNodeId') { this.sourceEntity = undefined; this.internalSelectionAssignment = undefined; }
    }
    if (this.graphSource !== undefined && this.sourceChild && ['query', 'hiddenTypes', 'nodeTypes'].includes(String(name))) this.bindSourceChild(this.sourceChild);
    super.requestUpdate(...args);
  }
  private async activateSourceEntity(id: string): Promise<void> {
    if (!isNonBlankIdentity(id) || id.length + 5 > 65_536 || this.sourceFilter.empty) return;
    const graph = this.sourceChild; if (!graph) return;
    const mounted = graph.view === 'list' && [...graph.renderRoot.querySelectorAll<HTMLElement>('[data-source-key]')].some(row => row.dataset['sourceKey'] === `node:${id}`);
    if (graph.view === 'list' && !mounted) {
      this.query = ''; this.hiddenTypes = [];
    }
    this.invalidateActivation(); const current = this.sourceCurrent();
    await this.updateComplete;
    if (!current() || this.sourceChild !== graph) return;
    const result = await resolveGraphSourceComposition(graph, [`node:${id}`]);
    if (!current() || !result?.current()) return;
    const record = result.records.find(row => row.key === `node:${id}`);
    if (!record || record.value.kind !== 'node') return;
    this.sourceEntity = record.value.value;
    this.sourceInspect = [graph, this.graphSource, this.sourceEpoch, id];
    this.setInternalSelectedNodeId(id);
    if (!current() || this.selectedNodeId !== id) return;
    const focused = await focusGraphSourceComposition(graph, `node:${id}`);
    await graph.updateComplete;
    if (!current() || !focused?.() || this.selectedNodeId !== id) return;
    const target = graph.view === 'list' ? [...graph.renderRoot.querySelectorAll<HTMLElement>('[data-source-key]')].find(row => row.dataset['sourceKey'] === `node:${id}`) : undefined;
    const position = graph.view !== 'list' ? graph.getNodeScreenPosition(id) : undefined;
    const bounds = target?.getBoundingClientRect() ?? graph.getBoundingClientRect();
    if (!current() || !focused() || (graph.view === 'list' ? !target : !position)) return;
    this.openDetailAt(id, { x: bounds.left + (position?.x ?? bounds.width / 2), y: bounds.top + (position?.y ?? bounds.height / 2), width: 0, height: 0 });
    if (current() && focused() && this.popoverEl?.open) this.sourceDetailsOpen = true;
  }

  /** Nodes forwarded to the composed graph and search experience. */
  @property({ attribute: false }) nodes: readonly LyraGraphNode[] = [];
  /** Edges forwarded to the composed graph and path interactions. */
  @property({ attribute: false }) edges: readonly LyraGraphEdge[] = [];
  /** Labels, colors, and shapes for the graph's node-type vocabulary. */
  @property({ attribute: false }) nodeTypes: readonly LyraNodeTypeStyle[] = [];
  /** Community hull definitions forwarded to the graph. */
  @property({ attribute: false }) communities: readonly LyraGraphCommunity[] =
    [];
  /** Extra dossier fields, keyed by node id -- see `LyraKnowledgeGraphEntityDetails`. */
  @property({ attribute: false }) entityDetails: Readonly<
    Record<string, Readonly<LyraKnowledgeGraphEntityDetails>>
  > = {};
  /** Currently-pinned node ids. Self-toggled by the pin action in the details popover and by a
   *  pinned chip's remove button (see the class doc's "controlled vs. self-managed" note); still
   *  presettable/overridable like any other property. Exactly two pinned nodes reveals the "Find
   *  path" action. */
  @property({ attribute: false }) pinnedNodeIds: readonly string[] = [];
  /** Host-supplied path-finding result, rendered via `lr-path-strip`. Empty (the default) renders
   *  no path strip. See `lr-path-request`. */
  @property({ attribute: false }) path: readonly LyraPathElement[] = [];
  /** Currently-hidden `LyraGraphNode.type` values, forwarded to both `lr-graph.hiddenTypes` and
   *  `lr-graph-legend.hiddenTypes`. Self-toggled by the composed legend; still presettable. */
  @property({ attribute: false }) hiddenTypes: readonly string[] = [];
  /** The currently-selected node id, driving both the details popover and `lr-graph`'s
   *  `selectedNodeIds` visual state. Presettable (e.g. to deep-link to a specific entity) as well
   *  as self-managed on every selection interaction. `null` (the default) shows no selection and
   *  keeps the details popover closed. */
  @property({ attribute: 'selected-node-id' }) selectedNodeId: string | null =
    null;
  /** Forwarded to `lr-graph.renderer`. `renderer="canvas"` has no per-node DOM element, which
   *  narrows how the node-detail popover anchors and disables its pan/zoom tracking -- see the
   *  class doc's anchoring note. */
  @property() renderer: LyraGraphRenderer = 'svg';
  /** Forwarded to lr-graph.view. '2d' preserves the default; '3d' uses real x/y/z positions and
   * an orbit camera; 'list' exposes all graph items through visible pagination. Spatial/list
   * views work without optional d3 peers. Toolbar changes also update this property. */
  @property() view: LyraGraphView = '2d';
  private _engine: Engine3dPreference = 'builtin';
  /** Optional 3D graph renderer preference, forwarded to the composed graph. */
  @property({ converter: ENGINE_3D_PREFERENCE })
  get engine(): Engine3dPreference { return this._engine; }
  set engine(value: Engine3dPreference) { const old = this._engine; this._engine = ENGINE_3D_PREFERENCE.normalize(value); this.requestUpdate('engine', old); }
  /** Optional orbit-camera input forwarded to lr-graph.camera; camera changes bubble as
   * lr-camera-change. Angles use radians, distance and target use graph units. */
  @property({ attribute: false }) camera?: LyraGraphCamera;
  /** Forwarded to `lr-graph.nodeLabels`. Unset (the default) leaves the composed `lr-graph` to
   *  apply its own per-renderer default -- see that property's own doc. */
  @property({ attribute: 'node-labels' }) nodeLabels?: LyraGraphNodeLabelsMode;
  /** Forwarded to `lr-graph.fitTo`. `'container'` makes the composed graph draw at exactly the
   *  pane this component's own layout gave it -- the reservation minus whatever the toolbar,
   *  search results, pinned row and path strip take, which is not derivable from `height` -- and
   *  follow it live as the explorer is resized. `'none'` (the default) keeps forwarding the
   *  numeric `width`/`height` below unchanged. */
  @property({ attribute: 'fit-to' }) fitTo: LyraGraphFit = 'none';
  /** Requested width of the composed graph viewport: a number of CSS pixels, or a CSS length in
   *  `px`, `rem`, `em`, `vw` or `vh` that the composed graph resolves to pixels. Any other value
   *  uses the 800px default. Ignored by the composed graph while `fitTo === 'container'`. */
  @property({ converter: graphLengthConverter }) width: number | string = 800;
  /** Requested height of the composed graph viewport, in the same forms as `width` (any other
   *  value uses the 600px default). Also sizes the rendered `[part="graph"]`/host (see
   *  `--lr-canvas-reserved-height`'s doc) whenever neither that nor an explicit outer `block-size`
   *  overrides it. */
  @property({ converter: graphLengthConverter }) height: number | string = 600;
  /** Fallback name for the root group; defaults to localized `graphExplorerLabel`. A non-empty
   *  host `aria-label` makes the host the sole overall owner; an explicitly empty host label stays
   *  empty on the group, and so does an explicitly empty `label`. */
  @property() label?: string;
  /** What drives this component's own `dimmedNodeIds`/`dimmedEdgeIds` forwarding, on top of the
   *  always-active search-match dimming -- see the class doc's dedicated paragraph. */
  @property() highlight: KnowledgeGraphHighlight = 'selection';

  /** The search filter applied to the visible node set. A node matches when the query appears in
   *  any name it can be known by -- its `id`, its `label` or its `accessibleLabel` -- each folded
   *  with the active locale, so a node named only through `accessibleLabel` is findable by the
   *  very name the results, chips and popover display for it. Presettable (e.g. to restore a query
   *  from a URL on load) as well as self-managed on every keystroke in the toolbar's search box.
   *  `''` (the default) renders no search-result list at all and applies no search dimming.
   *  Removing the attribute uses this empty-filter behavior while retaining null property
   *  readback. */
  // Source mode delegates matching to the provider; user search events wait for its exact total.
  @property() query = '';
  @state() private pinLiveText = '';
  /** Currently pointer-hovered node id, set only while `highlight === 'hover'` (see
   *  `onGraphNodeEnter`/`onGraphNodeLeave`) -- read by `computedDimmedNodeIds`. */
  @state() private hoveredNodeId: string | null = null;
  /** The search result holding the list's single tab stop. */
  @state() private activeResult = 0;

  @query('[part="graph"]') private graphEl?: LyraGraph;
  @query('[part="detail-popover"]') private popoverEl?: LyraPopover;

  /** Set by `onGraphNodeClick` and consumed either synchronously by the native `click` that
   *  follows it on the same user gesture (a real pointer click), or, failing that, by a queued
   *  microtask fallback (a keyboard Enter/Space activation, which -- unlike a native `<button>` --
   *  never dispatches a synthetic `click` on a `role="button"` SVG/canvas element). */
  private pendingNodeId?: string;
  /** Invalidates focus work when a newer activation, direct selection, close, or disconnect wins. */
  private activationGeneration = 0;
  private internalSelectionAssignment?: { value: string | null };
  /** The exact rendered `[part="node"]` element resolved for the currently-open popover
   *  (`renderer="svg"`, direct-click path only) -- re-read on every `lr-viewport-change` so the
   *  popover keeps tracking a pan/zoom gesture or simulation tick while it stays open. */
  private trackedNodeEl?: Element;
  private nodeById = new Map<string, LyraGraphNode>();
  private linksByNodeId = new Map<string, LyraGraphEdge[]>();
  private degreeByNodeId = new Map<string, number>();
  private communityLabelById = new Map<string, string | undefined>();
  /** Query, locale, model, hidden types and their matches: one filter pass per change. */
  private matchesMemo?: [string, string, NormalizedGraphModel, readonly string[], LyraGraphNode[] | undefined];
  private normalizedGraphModel?: NormalizedGraphModel;
  private normalizedGraphSources?: readonly [
    readonly LyraGraphNode[],
    readonly LyraGraphEdge[],
    readonly LyraNodeTypeStyle[],
    readonly LyraGraphCommunity[]
  ];
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private activationFrameId?: number;
  private activationFrameOwner?: Window;
  private activationFrameDocument?: Document;
  private activationFrameResolve?: (ready: boolean) => void;
  private activationFramePageHide?: () => void;

  private get graphModel(): NormalizedGraphModel {
    const nodes = this.graphSource === undefined ? this.nodes : EMPTY_SOURCE_NODES;
    const edges = this.graphSource === undefined ? this.edges : EMPTY_SOURCE_EDGES;
    const sources = this.normalizedGraphSources;
    if (
      !sources ||
      sources[0] !== nodes ||
      sources[1] !== edges ||
      sources[2] !== this.nodeTypes ||
      sources[3] !== this.communities
    ) {
      this.normalizedGraphSources = [
        nodes,
        edges,
        this.nodeTypes,
        this.communities,
      ];
      this.normalizedGraphModel = normalizeGraphModel(
        nodes,
        edges,
        this.nodeTypes,
        this.communities
      );
    }
    return this.normalizedGraphModel!;
  }

  private get canonicalPinnedNodeIds(): readonly string[] {
    return canonicalIdentityList(this.pinnedNodeIds);
  }

  private get canonicalHiddenTypes(): readonly string[] {
    return canonicalIdentityList(this.hiddenTypes);
  }

  private optionalRequest = false;
  private optionalGeneration = 0;
  private optionalPending?: Promise<void>;
  private pathReady = false;
  private optionalFailed = false;
  private async loadOptionalPath(): Promise<void> {
    await import('../path-strip/path-strip.js');
  }
  private ensureOptionalChildren(): void {
    const path = this.path.length > 0;
    const request = path;
    if (request === this.optionalRequest) return;
    this.optionalRequest = request;
    const generation = ++this.optionalGeneration;
    this.optionalPending = undefined;
    this.optionalFailed = false;
    if (!path || this.pathReady) return;
    if (this.hasUpdated) this.announcements.announcePolite(this.localize('loading'));
    const pending = this.loadOptionalPath()
      .then(() => {
        if (!this.isConnected || generation !== this.optionalGeneration) return;
        this.pathReady ||= path;
      }, () => {
        if (!this.isConnected || generation !== this.optionalGeneration) return;
        this.optionalFailed = true;
        this.announcements.announcePolite(this.localize('statusError'));
      }).then(() => {
        if (!this.isConnected || generation !== this.optionalGeneration) return;
        this.optionalPending = undefined;
        this.requestUpdate();
      });
    this.optionalPending = pending;
  }
  protected override async getUpdateComplete(): Promise<boolean> {
    const complete = await super.getUpdateComplete();
    const pending = this.optionalPending;
    if (!pending) return complete;
    await pending;
    return this.getUpdateComplete();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) { this.resumePresetActivation(); this.requestUpdate(); }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (this.hasUpdated && (changed.has('nodes') || changed.has('edges'))) {
      const messages = this.inputLimitMessages((['nodes', 'edges'] as const).filter(property => changed.has(property)));
      if (messages.length) this.announcements.announcePolite(messages.join(' '));
    }
    this.ensureOptionalChildren();
    if (this.graphSource !== undefined) return;
    if (
      changed.has('nodes') ||
      changed.has('edges') ||
      changed.has('communities') || changed.has('graphSource')
    ) {
      this.rebuildDerivedCollections();
    }
    if (this.hoveredNodeId && !this.isVisibleNode(this.hoveredNodeId))
      this.hoveredNodeId = null;
    // A node removed from `nodes` (or `hiddenTypes` hiding its whole type) shouldn't leave a
    // dangling selection/popover pointed at nothing. `entityFor()` intentionally still resolves
    // hidden nodes for neighbor/path data, so visibility must be checked separately here.
    if (
      (changed.has('nodes') || changed.has('hiddenTypes') || changed.has('graphSource')) &&
      this.selectedNodeId &&
      !this.isVisibleNode(this.selectedNodeId)
    ) {
      this.invalidateActivation();
      this.setInternalSelectedNodeId(null);
      if (this.popoverEl) this.popoverEl.open = false;
    }
    // `changed.has('query')` is already `true` on the very first `willUpdate()` whenever a
    // preset `query` attribute reached the element before its first render -- there is no
    // user action behind that transition, so it must not announce (mirrors `<lr-chat-message>`/
    // `<lr-branch-picker>`'s identical "don't announce on mount" gate). Those two run their own
    // announcement from `updated()`, where `this.hasUpdated` is already `true` on the very first
    // pass, so they carry a dedicated `isMounting` field instead; this block runs from
    // `willUpdate()`, which always executes *before* `hasUpdated` flips, so `hasUpdated` itself is
    // already the "provably false pre-mount" comparison and needs no separate field here --
    // `connectedCallback()`/`canActivateNode()` above already gate on it the same way.
    if (
      this.hasUpdated &&
      (this.query ?? '').trim() &&
      (changed.has('query') ||
        changed.has('nodes') ||
        changed.has('hiddenTypes') ||
        changed.has('locale') ||
        changed.has('strings'))
    ) {
    this.announcements.announcePolite(this.searchResultAnnouncement());
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.graphSource !== undefined) { this.bindSourceChild(this.graphEl); return; }
    if (changed.has('camera') && this.view === '3d' && this.graphEl) {
      void this.reanchorAfterCameraUpdate(this.graphEl, this.camera);
    }
    if (!changed.has('selectedNodeId')) return;
    const internallyAssigned =
      this.internalSelectionAssignment !== undefined &&
      Object.is(this.internalSelectionAssignment.value, this.selectedNodeId);
    this.internalSelectionAssignment = undefined;
    if (internallyAssigned) return;
    const generation = this.invalidateActivation();
    const id = this.selectedNodeId;
    if (!isNonBlankIdentity(id)) {
      if (id !== null) this.selectedNodeId = null;
      if (this.popoverEl) this.popoverEl.open = false;
      return;
    }
    const graph = this.graphEl;
    if (graph && this.isVisibleNode(id)) {
      void this.activatePresetWhenGraphReady(id, graph, generation);
    }
  }

  private async reanchorAfterCameraUpdate(graph: LyraGraph, camera: LyraGraphCamera | undefined): Promise<void> {
    await graph.updateComplete;
    if (this.isConnected && this.graphEl === graph && this.camera === camera && this.view === '3d')
      this.onGraphViewportChange();
  }

  private async activatePresetWhenGraphReady(
    id: string,
    graph: LyraGraph,
    generation: number
  ): Promise<void> {
    await graph.updateComplete;
    while (
      generation === this.activationGeneration &&
      this.isConnected &&
      graph.isConnected &&
      this.selectedNodeId === id &&
      graph.shadowRoot?.querySelector(tag('skeleton'))
    ) {
      if (!(await this.waitForActivationFrame(generation))) return;
    }
    if (
      generation === this.activationGeneration &&
      this.isConnected &&
      this.selectedNodeId === id &&
      this.isVisibleNode(id)
    ) {
      await this.activateEntity(id);
    }
  }

  private waitForActivationFrame(generation: number): Promise<boolean> {
    this.cancelActivationFrame();
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (
      !ownerWindow ||
      !this.isConnected ||
      generation !== this.activationGeneration
    ) {
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (ready: boolean): void => {
        if (settled) return;
        settled = true;
        resolve(ready);
      };
      let handle: number;
      const onPageHide = (): void => {
        if (
          this.activationFrameOwner === ownerWindow &&
          this.activationFrameDocument === ownerDocument &&
          this.activationFrameResolve === settle
        ) {
          this.cancelActivationFrame();
        }
      };
      try {
        handle = ownerWindow.requestAnimationFrame(() => {
          const current =
            this.activationFrameId === handle &&
            this.activationFrameOwner === ownerWindow &&
            this.activationFrameDocument === ownerDocument &&
            this.activationFrameResolve === settle &&
            generation === this.activationGeneration &&
            this.isConnected &&
            this.ownerDocument === ownerDocument;
          if (current) this.clearActivationFrameRecord();
          settle(current);
        });
      } catch {
        settle(false);
        return;
      }
      this.activationFrameId = handle;
      this.activationFrameOwner = ownerWindow;
      this.activationFrameDocument = ownerDocument;
      this.activationFrameResolve = settle;
      this.activationFramePageHide = onPageHide;
      ownerWindow.addEventListener('pagehide', onPageHide, { once: true });
    });
  }

  private clearActivationFrameRecord(): void {
    if (this.activationFramePageHide) {
      this.activationFrameOwner?.removeEventListener(
        'pagehide',
        this.activationFramePageHide
      );
    }
    this.activationFrameId = undefined;
    this.activationFrameOwner = undefined;
    this.activationFrameDocument = undefined;
    this.activationFrameResolve = undefined;
    this.activationFramePageHide = undefined;
  }

  private cancelActivationFrame(): void {
    const handle = this.activationFrameId;
    const ownerWindow = this.activationFrameOwner;
    const settle = this.activationFrameResolve;
    this.clearActivationFrameRecord();
    try {
      if (handle !== undefined) ownerWindow?.cancelAnimationFrame(handle);
    } finally {
      settle?.(false);
    }
  }

  private invalidateActivation(): number {
    this.activationGeneration += 1;
    this.cancelActivationFrame();
    return this.activationGeneration;
  }

  private resumePresetActivation(): void {
    if (this.graphSource !== undefined) { this.sourceInspect = undefined; return; }
    const id = this.selectedNodeId;
    const graph = this.graphEl;
    if (!id || !graph || !this.isVisibleNode(id)) return;
    const generation = this.invalidateActivation();
    void this.activatePresetWhenGraphReady(id, graph, generation);
  }

  private setInternalSelectedNodeId(value: string | null): void {
    if (Object.is(this.selectedNodeId, value)) return;
    this.internalSelectionAssignment = { value };
    this.sourceAssigned = true; this.selectedNodeId = value; this.sourceAssigned = false;
    this.emit('lr-selection-change', {
      selectedNodeId: value,
      selectedNodeIds: value ? [value] : [],
      selectedEdgeIds: [],
    });
  }

  override disconnectedCallback(): void {
    this.sourceEpoch++; this.sourceInspect = undefined; this.sourceDetailsOpen = false; this.sourceSearchIntent = undefined; this.internalSelectionAssignment = undefined;
    if (this.sourceChild) setGraphSourceComposition(this.sourceChild, undefined);
    this.sourceChildBinding = undefined;
    ++this.optionalGeneration;
    this.optionalRequest = false;
    this.optionalPending = undefined;
    this.invalidateActivation();
    this.pendingNodeId = undefined;
    this.trackedNodeEl = undefined;
    this.hoveredNodeId = null;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    ++this.optionalGeneration;
    this.optionalRequest = false;
    this.optionalPending = undefined;
    this.invalidateActivation();
    this.announcements.adopted();
    this.sourceEpoch++; this.sourceInspect = undefined; this.sourceDetailsOpen = false; this.sourceChildBinding = undefined;
    if (this.isConnected) this.resumePresetActivation();
  }

  private rebuildDerivedCollections(): void {
    const model = this.graphModel;
    this.nodeById = new Map(model.nodes.map((node) => [node.id, node]));
    this.communityLabelById = new Map(
      model.communities.map((community) => [community.id, community.label])
    );
    const linksByNodeId = new Map<string, LyraGraphEdge[]>();
    const degrees = new Map<string, number>();
    for (const link of model.links) {
      for (const id of new Set([link.source, link.target])) {
        const adjacent = linksByNodeId.get(id);
        if (adjacent) adjacent.push(link);
        else linksByNodeId.set(id, [link]);
        degrees.set(id, (degrees.get(id) ?? 0) + 1);
      }
    }
    this.linksByNodeId = linksByNodeId;
    this.degreeByNodeId = degrees;
  }

  private isVisibleGraphNode(node: LyraGraphNode): boolean {
    return node.type == null || !this.canonicalHiddenTypes.includes(node.type);
  }

  private isVisibleNode(id: string): boolean {
    const node = this.nodeById.get(id);
    return !!node && this.isVisibleGraphNode(node);
  }

  private canActivateNode(id: string): boolean {
    const node = this.nodeById.get(id);
    if (node) return this.isVisibleGraphNode(node);
    return !this.hasUpdated && this.graphModel.nodes.length === 0;
  }

  /** `label` beats `accessibleLabel` beats a bare fallback to `id` -- the same precedence
   *  `entityFor()`'s own `label` field and the search-result list use, so every derived node name
   *  agrees. */
  private nodeLabel(id: string): string {
    const node = this.graphSource !== undefined ? (this.sourceEntity?.id === id ? this.sourceEntity : undefined) : this.nodeById.get(id);
    return node?.label || node?.accessibleLabel || id;
  }

  private degreeOf(id: string): number {
    return this.degreeByNodeId.get(id) ?? 0;
  }

  private entityFor(id: string): LyraEntity | undefined {
    const node = this.graphSource !== undefined ? (this.sourceEntity?.id === id ? this.sourceEntity : undefined) : this.nodeById.get(id);
    if (!node) return undefined;
    const details = this.entityDetails[id];
    return {
      id: node.id,
      label: node.label || node.accessibleLabel || node.id,
      type: node.type,
      communityId: node.communityId,
      description: details?.description,
      properties: details?.properties,
      degree: details?.degree ?? (this.graphSource === undefined ? this.degreeOf(node.id) : undefined),
    };
  }

  private communityLabelFor(communityId: string | undefined): string {
    if (!communityId) return '';
    return this.communityLabelById.get(communityId) ?? communityId;
  }

  private neighborRowsFor(id: string): LyraNeighborRow[] {
    const rows: LyraNeighborRow[] = [];
    for (const link of this.linksByNodeId.get(id) ?? []) {
      if (link.source === id) {
        const node = this.entityFor(link.target);
        if (node && this.isVisibleNode(link.target)) {
          rows.push({ relation: link.label ?? '', direction: 'out', node });
        }
      } else if (link.target === id) {
        const node = this.entityFor(link.source);
        if (node && this.isVisibleNode(link.source)) {
          rows.push({ relation: link.label ?? '', direction: 'in', node });
        }
      }
    }
    return rows;
  }

  /** Every name a node can be known by, ordered to match `nodeLabel()`'s own precedence
   *  (`label`, then `accessibleLabel`, then `id`) so `[0]` is the displayed name for any future
   *  caller that wants one -- this caller only asks whether ANY of them matches, and the order is
   *  irrelevant to that. `id` is included even when it is not what gets rendered (it has always
   *  been searchable), and so is `accessibleLabel`: a node named only through it renders that name
   *  in the search results, the pinned chips and the popover, so typing that same name has to find
   *  it. A node carrying both matches either -- `accessibleLabel` is documented as the richer
   *  spoken form of the very same node, not a different one, so matching it can never surface
   *  something unrelated. */
  private searchableNamesOf(node: LyraGraphNode): string[] {
    return [node.label, node.accessibleLabel, node.id].filter(
      (name): name is string => typeof name === 'string' && name !== ''
    );
  }

  private matchingNodes(): LyraGraphNode[] | undefined {
    if (this.graphSource !== undefined) return undefined;
    const query = this.query ?? '';
    const locale = this.effectiveLocale;
    const model = this.graphModel;
    const hidden = this.canonicalHiddenTypes;
    const memo = this.matchesMemo;
    if (memo?.[0] === query && memo[1] === locale && memo[2] === model && memo[3] === hidden)
      return memo[4];
    const q = query.trim().toLocaleLowerCase(locale);
    let matches: LyraGraphNode[] | undefined;
    if (q) {
      const hiddenTypes = new Set(hidden);
      matches = model.nodes.filter(
        (node) =>
          (node.type == null || !hiddenTypes.has(node.type)) &&
          this.searchableNamesOf(node).some((name) =>
            name.toLocaleLowerCase(locale).includes(q)
          )
      );
    }
    this.matchesMemo = [query, locale, model, hidden, matches];
    return matches;
  }

  private searchResultAnnouncement(matches = this.matchingNodes()): string {
    if (!matches) return '';
    return matches.length === 0
      ? this.localize('viewerSearchNoMatches')
      : this.localize('viewerSearchMatchCount', undefined, {
          count: getNumberFormat(this.effectiveLocale).format(matches.length),
          pluralCount: matches.length,
        });
  }

  private neighborIdsOf(id: string): Set<string> {
    const ids = new Set<string>();
    for (const link of this.linksByNodeId.get(id) ?? []) {
      if (link.source === id) ids.add(link.target);
      else if (link.target === id) ids.add(link.source);
    }
    return ids;
  }

  /** The same key derivation `lr-graph`'s own (private) `linkKey()` uses for `dimmedEdgeIds` --
   *  an explicit `id` when the link has one, else `source->target`. */
  private linkKey(link: LyraGraphEdge): string {
    return graphLinkIdentity(link);
  }

  /** Non-matching nodes while searching; otherwise everything outside the focus node's immediate
   *  neighborhood (the selected node, or -- while `highlight === 'hover'` -- the hovered node when
   *  nothing is selected); otherwise nothing while `highlight === 'none'`. Wires the search/
   *  selection/hover state this component owns into `lr-graph`'s existing `dimmedNodeIds` contract
   *  instead of introducing a parallel highlighting mechanism. */
  private dimmingMemo?: { key: readonly unknown[]; nodes: string[]; links: string[] };
  private dimmingProjection(): { nodes: string[]; links: string[] } {
    if (this.graphSource !== undefined) return { nodes: [], links: [] };
    const model = this.graphModel;
    const matches = this.matchingNodes();
    const focus = matches ? null : this.selectedNodeId ?? (this.highlight === 'hover' ? this.hoveredNodeId : null);
    const key = [model, this.highlight, matches, focus];
    if (this.dimmingMemo && key.every((value, index) => value === this.dimmingMemo!.key[index])) return this.dimmingMemo;
    let nodes: string[] = [];
    if (this.highlight !== 'none') {
      const keep = matches ? new Set(matches.map(node => node.id)) : focus ? this.neighborIdsOf(focus) : undefined;
      if (focus) keep!.add(focus);
      if (keep) nodes = model.nodes.filter(node => !keep.has(node.id)).map(node => node.id);
    }
    const dimmed = new Set(nodes);
    const links = dimmed.size ? model.links
      .filter(link => dimmed.has(link.source) || dimmed.has(link.target))
      .map(link => this.linkKey(link)) : [];
    this.dimmingMemo = { key, nodes, links };
    return this.dimmingMemo;
  }
  private get computedDimmedNodeIds(): string[] { return this.dimmingProjection().nodes; }
  private get computedDimmedLinkIds(): string[] { return this.dimmingProjection().links; }

  private togglePin(id: string): void {
    if (!isNonBlankIdentity(id)) return;
    const pinnedNodeIds = this.canonicalPinnedNodeIds;
    const wasPinned = pinnedNodeIds.includes(id);
    const next = wasPinned
      ? pinnedNodeIds.filter((existing) => existing !== id)
      : [...pinnedNodeIds, id];
    this.pinnedNodeIds = next;
    this.pinLiveText = this.localize(
      wasPinned ? 'graphExplorerUnpinned' : 'graphExplorerPinned',
      undefined,
      {
        label: this.nodeLabel(id),
      }
    );
    this.announcements.announcePolite(this.pinLiveText);
    this.emit('lr-pin-change', { pinnedNodeIds: next });
  }

  private requestPath(): void {
    const pinnedNodeIds = this.canonicalPinnedNodeIds;
    if (pinnedNodeIds.length !== 2) return;
    const [sourceNodeId, targetNodeId] = pinnedNodeIds as [string, string];
    this.emit('lr-path-request', { sourceNodeId, targetNodeId });
  }

  private onVisibilityChange = (
    event: CustomEvent<{ hiddenTypes: string[] }>
  ): void => {
    event.stopPropagation();
    this.hiddenTypes = event.detail.hiddenTypes;
    // Same self-toggle-then-emit contract as setInternalSelectedNodeId()/togglePin()/
    // onSearchInput(): only a component-initiated change announces itself, so a host that assigns
    // the property back in response cannot start a feedback loop.
    this.emit('lr-hidden-types-change', { hiddenTypes: this.hiddenTypes });
  };

  /** The composed legend owns its cancellable proposal. Contain the canonical request without
   * changing whether its listeners accepted it, so the child can still assign, announce, and send
   * its existing post event. */
  private onVisibilityChangeProposal = (event: Event): void => {
    event.stopPropagation();
  };

  private onSearchInput = (event: CustomEvent<{ value: string }>): void => {
    event.stopPropagation();
    const value = event.detail.value;
    if (this.query === value) return;
    this.query = value;
    if (this.graphSource !== undefined) {
      this.sourceSearchIntent = { query: value, version: this.sourceSearchVersion, epoch: this.sourceEpoch };
      return;
    }
    // Same self-toggle-then-emit contract as setInternalSelectedNodeId()/togglePin(): only a
    // component-initiated change announces itself, so a host that assigns the property back in
    // response cannot start a feedback loop. `matchingNodes()` already reads `this.query`,
    // which was just reassigned above, so it reports the count for the new query, not the old one;
    // it returns `undefined` (not a truncated result) whenever the trimmed query is empty, hence
    // the `?? 0` rather than a truncation-driven `matchCountExact: false`.
    this.emit('lr-search-change', {
      query: value,
      matchCount: this.matchingNodes()?.length ?? 0,
      matchCountExact: true,
      activeIndex: -1,
    });
  };

  /** Handles the composed entity-card/neighbor selection and path-strip entity activation. */
  private onEntityActivate = (
    event: CustomEvent<{ entityId: string }>
  ): void => {
    event.stopPropagation();
    void this.activateEntity(event.detail.entityId);
  };

  /** Frames every visible node in the composed graph's viewport, forwarding to `lr-graph.fit()`.
   *  No-op before the graph has rendered or with no visible nodes. Selection is unaffected. */
  fit(options?: { padding?: number }): void {
    this.graphEl?.fit(options);
  }

  /** Alias of `fit()` with its default padding, named for a "reset view" toolbar action: returns the
   *  camera to the framed-to-fit view of every visible node. Selection and filters are unaffected. */
  resetView(): void {
    this.graphEl?.fit();
  }

  /** Centers the camera on node `id` through the composed graph's `focusNode()`, without selecting
   *  it or opening its details popover. Resolves `false` for an unknown or filtered-out node, or
   *  before the graph has rendered. */
  async focusNode(id: string, options?: { zoom?: number }): Promise<boolean> {
    if (this.graphSource === undefined && !this.isVisibleNode(id)) return false;
    return (await this.graphEl?.focusNode(id, options)) ?? false;
  }

  /** Selects `id` and opens its details popover without a click event to read a rect from --
   *  centers the node via the public `lr-graph.focusNode()`, then anchors at the graph element's
   *  own viewport rect center once that settles. Shared by search results, neighbor rows,
   *  path-strip elements, `lr-entity-card`'s own built-in focus button, and the keyboard-Enter/
   *  Space fallback for a direct graph node activation. */
  private async activateEntity(id: string): Promise<void> {
    if (this.graphSource !== undefined) return this.activateSourceEntity(id);
    if (!this.canActivateNode(id)) return;
    const generation = this.invalidateActivation();
    this.setInternalSelectedNodeId(id);
    this.trackedNodeEl = undefined;
    const graph = this.graphEl;
    const focused = graph ? await graph.focusNode(id) : false;
    if (
      generation !== this.activationGeneration ||
      !this.isConnected ||
      this.selectedNodeId !== id ||
      !this.isVisibleNode(id) ||
      !focused
    ) {
      return;
    }
    const rect = graph?.getBoundingClientRect();
    if (!rect) return;
    const projected = graph?.view === '3d' ? graph.getNodeScreenPosition(id) : undefined;
    this.openDetailAt(id, {
      x: rect.left + (projected?.x ?? rect.width / 2),
      y: rect.top + (projected?.y ?? rect.height / 2),
      width: 0,
      height: 0,
    });
  }

  private openDetailAt(
    id: string,
    rect: { x: number; y: number; width?: number; height?: number }
  ): void {
    const popover = this.popoverEl;
    if (!popover) return;
    popover.accessibleLabel = this.entityFor(id)?.label || '';
    popover.showAt(rect);
  }

  /** Resolves the viewport rect for a direct pointer click on a graph node -- see the class doc's
   *  "how the details popover finds its viewport position" note for the full reasoning. */
  private resolveDirectClickAnchor(event: MouseEvent): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (this.view === '3d') {
      this.trackedNodeEl = undefined;
      const graph = this.graphEl;
      const position = this.selectedNodeId ? graph?.getNodeScreenPosition(this.selectedNodeId) : undefined;
      const rect = graph?.getBoundingClientRect();
      if (position && rect) return { x: rect.left + position.x, y: rect.top + position.y, width: 0, height: 0 };
    }
    if (this.renderer === 'canvas') {
      this.trackedNodeEl = undefined;
      return { x: event.clientX, y: event.clientY, width: 0, height: 0 };
    }
    const nodeEl = event
      .composedPath()
      .find(
        (el): el is Element => isElementNode(el) && el.matches('[part="node"]')
      );
    if (!nodeEl) {
      this.trackedNodeEl = undefined;
      return { x: event.clientX, y: event.clientY, width: 0, height: 0 };
    }
    this.trackedNodeEl = nodeEl;
    const rect = nodeEl.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  private onGraphNodeClick = (
    event: CustomEvent<{ nodeId: string; x: number; y: number }>
  ): void => {
    const id = event.detail.nodeId;
    if (this.graphSource !== undefined) { void this.activateSourceEntity(id); return; }
    if (!this.canActivateNode(id)) return;
    const generation = this.invalidateActivation();
    this.setInternalSelectedNodeId(id);
    if (this.view === '3d') {
      const graph = this.graphEl;
      const point = graph?.getNodeScreenPosition(id);
      const bounds = graph?.getBoundingClientRect();
      if (point && bounds) {
        this.trackedNodeEl = undefined;
        this.openDetailAt(id, { x: bounds.left + point.x, y: bounds.top + point.y, width: 0, height: 0 });
        return;
      }
    }
    this.pendingNodeId = id;
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow) return;
    ownerWindow.queueMicrotask(() => {
      if (
        generation === this.activationGeneration &&
        this.isConnected &&
        this.ownerDocument === ownerDocument &&
        this.pendingNodeId === id
      ) {
        this.pendingNodeId = undefined;
        if (this.selectedNodeId === id && this.isVisibleNode(id))
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
    const graph = this.graphEl;
    if (graph?.view === '3d' && this.selectedNodeId && this.popoverEl?.open) {
      const point = graph.getNodeScreenPosition(this.selectedNodeId);
      if (point) {
        const rect = graph.getBoundingClientRect();
        this.popoverEl.showAt({ x: rect.left + point.x, y: rect.top + point.y, width: 0, height: 0 });
      }
      return;
    }
    const el = this.trackedNodeEl;
    const popover = this.popoverEl;
    if (!el?.isConnected || !popover?.open) return;
    const rect = el.getBoundingClientRect();
    popover.showAt({
      x: rect.left + rect.width / 2,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    });
  };

  private onGraphNodeEnter = (event: CustomEvent<{ nodeId: string }>): void => {
    if (this.highlight === 'hover') this.hoveredNodeId = event.detail.nodeId;
  };

  private onGraphNodeLeave = (event: CustomEvent<{ nodeId: string }>): void => {
    if (
      this.highlight === 'hover' &&
      this.hoveredNodeId === event.detail.nodeId
    )
      this.hoveredNodeId = null;
  };

  private onResultKeyDown = (event: KeyboardEvent): void => {
    const buttons = [
      ...this.renderRoot.querySelectorAll<HTMLButtonElement>('[part="search-result"] button'),
    ];
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    const next = ({ ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: buttons.length - 1 } as Record<string, number>)[event.key];
    if (index < 0 || next === undefined) return;
    event.preventDefault();
    this.activeResult = Math.max(0, Math.min(buttons.length - 1, next));
    buttons[this.activeResult]!.focus();
  };

  private onPopoverHide = (): void => {
    if (this.graphSource !== undefined) this.closeSourceDetails(false);
    else this.sourceDetailsOpen = false;
    if (this.sourceClosing) { this.sourceClosing = false; return; }
    this.invalidateActivation();
    this.trackedNodeEl = undefined;
    this.setInternalSelectedNodeId(null);
  };

  private inputLimitMessages(properties: readonly ('nodes' | 'edges')[] = ['nodes', 'edges']): string[] {
    const messages: string[] = [];
    const format = getNumberFormat(this.effectiveLocale);
    for (const property of properties) {
      const loss = publicCollectionTruncation(this, property);
      if (loss) messages.push(this.localize(property === 'nodes' ? 'graphNodeLimit' : 'graphEdgeLimit', undefined, {
        shown: format.format(loss.retained), total: format.format(loss.source),
      }));
    }
    return messages;
  }

  override render(): TemplateResult {
    const groupLabel = retrievalSemanticLabel(
      this,
      this.label == null ? this.localize('graphExplorerLabel') : this.label
    );
    const groupRole = retrievalSemanticRole(this, 'group');
    const matches = this.matchingNodes();
    const detailsLimit = publicCollectionTruncation(this, 'entityDetails');
    const model = this.graphModel;
    const pinnedNodeIds = this.canonicalPinnedNodeIds;
    const hiddenTypes = this.canonicalHiddenTypes;
    const selectedEntity = this.graphSource !== undefined ? this.sourceEntity : this.selectedNodeId ? this.nodeById.get(this.selectedNodeId) : undefined;
    const isPinned =
      this.selectedNodeId != null &&
      pinnedNodeIds.includes(this.selectedNodeId);
    // Unchanged inputs re-commit nothing, so the composed children skip their rebuilds.
    const dimmedDeps = [this.highlight, matches, this.selectedNodeId, this.hoveredNodeId, model];
    const detailDeps = [this.selectedNodeId, model, hiddenTypes, this.entityDetails, this.sourceEntity];
    const sourceFilter = this.sourceFilter;
    const sourceCurrent = this.sourceCurrent();
    const renderedSource = this.graphSource, renderedEpoch = this.sourceEpoch, renderedOwner = this.ownerDocument;
    const actionCurrent = renderedSource !== undefined ? sourceCurrent : () =>
      this.graphSource === undefined && this.sourceEpoch === renderedEpoch && this.isConnected && this.ownerDocument === renderedOwner;
    return html`
      <div
        part="base"
        role=${groupRole ?? nothing}
        aria-label=${groupLabel ?? nothing}
        @lr-entity-select=${this.onEntityActivate}
      >
        <div part="toolbar">
          <lr-input
            part="search"
            type="search"
            .value=${this.query ?? ''}
            placeholder=${this.localize('graphExplorerSearchPlaceholder')}
            @lr-input=${this.onSearchInput}
          ></lr-input>
          <lr-graph-legend
            part="legend"
            .types=${model.nodeTypes}
            .hiddenTypes=${hiddenTypes}
            @lr-visibility-change-request=${this.onVisibilityChangeProposal}
            @lr-visibility-change=${this.onVisibilityChange}
          ></lr-graph-legend>
        </div>
        ${this.graphSource !== undefined && sourceFilter.empty ? html`<p part="source-status">${this.localize(sourceFilter.invalid ? 'statusError' : 'graphExplorerAllTypesHidden')}</p><button type="button" part="source-clear" data-source-clear-types @click=${() => { if (!sourceCurrent()) return; this.hiddenTypes = []; this.emit('lr-hidden-types-change', { hiddenTypes: this.hiddenTypes }); }}>${this.localize('graphExplorerClearTypes')}</button>` : nothing}
        ${this.inputLimitMessages().map(message => html`<p part="input-limit" role="note">${message}</p>`)}
        ${detailsLimit ? html`<p part="details-limit" role="note">${this.localize('graphDataListLimit', undefined, {
          shown: getNumberFormat(this.effectiveLocale).format(detailsLimit.retained),
          total: getNumberFormat(this.effectiveLocale).format(detailsLimit.source),
        })}</p>` : nothing}
        ${matches
          ? html`
              <div
                part="search-results"
                role="list"
                aria-label=${this.localize('graphExplorerSearchResultsLabel')}
              >
                ${matches.length === 0
                  ? html`<div part="search-empty" role="listitem">
                      ${this.localize('viewerSearchNoMatches')}
                    </div>`
                  : matches.slice(0, SEARCH_RESULT_LIMIT).map(
                      (n, index, shown) => html`
                        <div part="search-result" role="listitem">
                          <button
                            type="button"
                            tabindex=${index === Math.min(this.activeResult, shown.length - 1) ? '0' : '-1'}
                            @click=${() => void this.activateEntity(n.id)}
                            @keydown=${this.onResultKeyDown}
                          >
                            ${n.label || n.accessibleLabel || n.id}
                          </button>
                        </div>
                      `
                    )}
              </div>
              ${matches.length > SEARCH_RESULT_LIMIT ? html`<p part="search-limit" role="note">${this.localize('graphExplorerSearchLimit', undefined, {
                shown: getNumberFormat(this.effectiveLocale).format(SEARCH_RESULT_LIMIT),
                total: getNumberFormat(this.effectiveLocale).format(matches.length),
              })}</p>` : nothing}
              <div class="sr-only" aria-hidden="true">
                ${this.searchResultAnnouncement(matches)}
              </div>
            `
          : nothing}
        ${pinnedNodeIds.length
          ? html`
              <div part="pinned">
                <span part="pinned-heading"
                  >${this.localize('graphExplorerPinnedHeading')}</span
                >
                ${pinnedNodeIds.map(
                  (id) => html`<lr-chip
                    removable
                    @lr-remove=${(event: Event) => {
                      event.stopPropagation();
                      if (actionCurrent()) this.togglePin(id);
                    }}
                    >${this.nodeLabel(id)}</lr-chip
                  >`
                )}
                ${pinnedNodeIds.length === 2
                  ? html`<lr-button size="s" @click=${() => { if (actionCurrent()) this.requestPath(); }}
                      >${this.localize('graphExplorerFindPath')}</lr-button
                    >`
                  : nothing}
              </div>
            `
          : nothing}
        <div class="sr-only" aria-hidden="true">${this.pinLiveText}</div>
        ${this.path.length
          ? this.pathReady ? html`<lr-path-strip
              part="path"
              .path=${this.path}
            ></lr-path-strip>`
            : html`<p part="path">${this.localize(this.optionalFailed ? 'statusError' : 'loading')}</p>`
          : nothing}
        <lr-graph
          part="graph"
          .nodes=${model.nodes}
          .edges=${model.links}
          .nodeTypes=${model.nodeTypes}
          .communities=${model.communities}
          .hiddenTypes=${hiddenTypes}
          .selectedNodeIds=${guard([this.selectedNodeId], () =>
            this.selectedNodeId ? [this.selectedNodeId] : []
          )}
          .dimmedNodeIds=${guard(dimmedDeps, () => this.computedDimmedNodeIds)}
          .dimmedEdgeIds=${guard(dimmedDeps, () => this.computedDimmedLinkIds)}
          renderer=${this.renderer}
          .view=${this.view}
          .engine=${this.engine}
          .camera=${this.camera}
          fit-to=${this.fitTo}
          node-labels=${this.nodeLabels ?? nothing}
          width=${typeof this.width === 'string' ? this.width : finiteRange(this.width, 800, 1)}
          height=${typeof this.height === 'string' ? this.height : finiteRange(this.height, 600, 1)}
          @lr-node-activate=${this.onGraphNodeClick}
          @click=${this.onGraphNativeClick}
          @lr-node-enter=${this.onGraphNodeEnter}
          @lr-node-leave=${this.onGraphNodeLeave}
          @lr-viewport-change=${this.onGraphViewportChange}
          @lr-camera-change=${this.onGraphViewportChange}
          @lr-view-change=${(event: CustomEvent<{ view: LyraGraphView }>) => { this.view = event.detail.view; }}
          ${ref(this.bindSourceChild)}
        ></lr-graph>
        <lr-popover
          part="detail-popover"
          popup-role="dialog"
          @lr-hide=${this.onPopoverHide}
        >
          <slot name="details">
            ${selectedEntity && (this.graphSource === undefined || this.sourceDetailsOpen)
              ? html`
                  <lr-entity-card
                    part="detail-card"
                    .entity=${guard(detailDeps, () => this.selectedNodeId ? this.entityFor(this.selectedNodeId) ?? null : null)}
                    .types=${model.nodeTypes}
                    community-label=${this.communityLabelFor(
                      selectedEntity.communityId
                    )}
                  >
                    <lr-neighbor-list
                      part="detail-neighbors"
                      .graphSource=${this.graphSource}
                      .centerKey=${this.graphSource !== undefined && this.selectedNodeId ? `node:${this.selectedNodeId}` : null}
                      .sourceNodeTypes=${sourceFilter.nodeTypes}
                      .rows=${guard(detailDeps, () =>
                        this.graphSource === undefined ? this.neighborRowsFor(this.selectedNodeId!) : []
                      )}
                      .types=${model.nodeTypes}
                      expandable
                    ></lr-neighbor-list>
                    <slot name="detail-body"></slot>
                    <lr-button
                      slot="actions"
                      size="s"
                      @click=${() =>
                        (actionCurrent()) && this.selectedNodeId &&
                        this.togglePin(this.selectedNodeId)}
                    >
                      ${this.localize(
                        isPinned ? 'graphExplorerUnpin' : 'graphExplorerPin'
                      )}
                    </lr-button>
                    <slot name="detail-actions" slot="actions"></slot>
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
