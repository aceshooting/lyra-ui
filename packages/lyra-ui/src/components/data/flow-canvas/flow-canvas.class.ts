import type { LyraGraphSource, LyraGraphScene, LyraGraphSourceQuery, LyraGraphSourceSummary, LyraGraphOverview, LyraSourceRecord, LyraSourceBounds } from '../../../data-sources.js';
import { SourcePageController } from '../../../internal/source-page-controller.js';
import { SourceRequestController, sourceCount, sourceRevision } from '../../../internal/source-request-controller.js';
import { GraphSceneController, SceneReader } from '../../../internal/graph-scene-controller.js';
import { flowSceneDomain } from '../../../internal/flow-scene-envelope.js';
import { flowSourceRows, flowSourceSummary, flowSourceOverview, sameFlowBounds, type FlowSourceValue } from './flow-source.js';
import { html, nothing, svg, type TemplateResult, type SVGTemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { fitTransform } from '../../../internal/fit-transform.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import {
  AnnouncementSinkController,
  Announcer,
} from '../../../internal/announcer.js';
import { isRtl } from '../../../internal/rtl.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { observeReducedMotion } from '../../../internal/motion-observer.js';
import { layeredLayout } from '../../../internal/layered-layout.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteNumber, finiteRange, finiteInteger } from '../../../internal/numbers.js';
import { isActionableElement } from '../../../internal/focus-navigation.js';
import { isNativeTopLayerElement } from '../../../internal/fixed-containing-block.js';
import { isHtmlElement } from '../../../internal/dom-guards.js';
import { resolveCssTokenLength } from '../../../internal/css-token-length.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraOrientation, LyraToolStatus } from '../../../internal/shared-unions.js';
import type { LyraVariant } from '../../../internal/variants.js';
import {
  DEFAULT_FLOW_INPUTS,
  DEFAULT_FLOW_OUTPUTS,
  snapshotFlowDecorations,
  snapshotFlowEdges,
  snapshotFlowNodes,
  MAX_FLOW_COLLECTION_ENTRIES,
} from './flow-model.js';
import {
  FLOW_PALETTE_MIME_TYPE,
  type FlowEdge,
  type FlowHandle,
  type FlowLayoutChangeDetail,
  type FlowNode,
  type FlowRunDecorations,
  type FlowStructureSnapshot,
} from './flow-types.js';
import { styles } from './flow-canvas.styles.js';
import { FlowViewportIndex, type FlowViewportBounds } from './flow-viewport-index.js';
import { composedParentElement, deepActiveElementIn } from '../../../internal/active-element.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_flowCanvasInputLimit, LYRA_DEFAULT_flowCanvasLabel, LYRA_DEFAULT_flowCanvasLayoutLimit, LYRA_DEFAULT_flowCanvasSummary, LYRA_DEFAULT_flowConnectCancelled, LYRA_DEFAULT_flowConnectCommitted, LYRA_DEFAULT_flowConnectStarted, LYRA_DEFAULT_flowConnectTarget, LYRA_DEFAULT_flowEdge, LYRA_DEFAULT_flowEdgeList, LYRA_DEFAULT_flowEdgeWithLabel, LYRA_DEFAULT_flowNode, LYRA_DEFAULT_flowNodeDeselected, LYRA_DEFAULT_flowNodeMoved, LYRA_DEFAULT_flowNodeSelected, LYRA_DEFAULT_flowSelectionCleared, LYRA_DEFAULT_paginationPage } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_flowItemAnnouncement, LYRA_DEFAULT_graphSourceAllRecords, LYRA_DEFAULT_graphSourceBothDirections, LYRA_DEFAULT_graphSourceCoverageAggregate, LYRA_DEFAULT_graphSourceCoverageComplete, LYRA_DEFAULT_graphSourceCoverageNeighborhood, LYRA_DEFAULT_graphSourceDirection, LYRA_DEFAULT_graphSourceEdges, LYRA_DEFAULT_graphSourceIncidentEdges, LYRA_DEFAULT_graphSourceNodes, LYRA_DEFAULT_graphSourceRecordMissing, LYRA_DEFAULT_graphSourceRecords, LYRA_DEFAULT_graphSourceRecordsError, LYRA_DEFAULT_graphSourceSceneError, LYRA_DEFAULT_graphSourceTotals, LYRA_DEFAULT_loading, LYRA_DEFAULT_neighborDirectionIn, LYRA_DEFAULT_neighborDirectionOut, LYRA_DEFAULT_next, LYRA_DEFAULT_noData, LYRA_DEFAULT_previous, LYRA_DEFAULT_retry, LYRA_DEFAULT_search } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END
export * from './flow-types.js';
export type FlowCanvasSource = LyraGraphSource<FlowNode, FlowEdge>;
const EMPTY_FLOW_QUERY: LyraGraphSourceQuery = Object.freeze({ kind: 'nodes', search: '', centerKey: null, direction: 'both', nodeTypes: Object.freeze([]) });
const EMPTY_FLOW_NODES: readonly FlowNode[] = Object.freeze([]);
const EMPTY_FLOW_EDGES: readonly FlowEdge[] = Object.freeze([]);


const FLOW_EDGE_TONES: readonly LyraVariant[] = [
  'neutral',
  'brand',
  'success',
  'warning',
  'danger',
];

const CONNECT_OFFSET_MIN = 24;
const CONNECT_OFFSET_MAX = 120;
const ZOOM_MULTIPLIER = 1.2;
const DEFAULT_FIT_PADDING = 24;
const KEYBOARD_PAN_STEP = 32;
const UNMATCHED_AUTHORED_CARD_WARNING = 'lyra-flow-canvas-unmatched-authored-card';

function toggledSelection(list: readonly string[], id: string): readonly string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

const nodeMaps = new WeakMap<readonly FlowNode[], ReadonlyMap<string, FlowNode>>();

function nodeById(nodes: readonly FlowNode[], id: string): FlowNode | undefined {
  let map = nodeMaps.get(nodes);
  if (!map) nodeMaps.set(nodes, (map = new Map(nodes.map((node) => [node.id, node]))));
  return map.get(id);
}

interface ResolvedFlowNode {
  node: FlowNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RovingItem {
  kind: 'node' | 'edge';
  id: string;
  disabled?: boolean;
}

function nodeTypePart(type: string | undefined): string | null {
  if (!type) return null;
  const normalized = type
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized) return null;
  return `node-type-${/^\d/.test(normalized) ? `type-${normalized}` : normalized}`;
}

/** One incident edge of the node being dragged, with its records and SVG elements resolved
 *  up-front -- see `buildDragEdgeRefs()`. */
interface DragEdgeRef {
  edge: FlowEdge;
  sourceNode: FlowNode;
  targetNode: FlowNode;
  pathEl: SVGPathElement | null;
  labelEl: Element | null;
}

export interface LyraFlowCanvasEventMap {
  'lr-node-activate': CustomEvent<Readonly<{ nodeId: string }>>;
  'lr-edge-activate': CustomEvent<Readonly<{
    edgeId: string;
    sourceNodeId: string;
    targetNodeId: string;
    /** @deprecated Use `sourceNodeId`; it carries the same node id. */
    source: string;
    /** @deprecated Use `targetNodeId`; it carries the same node id. */
    target: string;
  }>>;
  'lr-selection-change': CustomEvent<
    Readonly<{ selectedNodeIds: readonly string[]; selectedEdgeIds: readonly string[] }>
  >;
  'lr-node-move': CustomEvent<Readonly<{
    readonly nodeId: string;
    readonly position: Readonly<{ x: number; y: number }>;
    readonly previous: Readonly<{ x: number; y: number }>;
  }>>;
  'lr-connect': CustomEvent<Readonly<{
    source: string;
    target: string;
    sourceHandle: string;
    targetHandle: string;
  }>>;
  'lr-node-add': CustomEvent<Readonly<{
    type: string;
    position: Readonly<{ x: number; y: number }>;
  }>>;
  'lr-selection-delete': CustomEvent<
    Readonly<{ nodeIds: readonly string[]; edgeIds: readonly string[] }>
  >;
  'lr-viewport-change': CustomEvent<Readonly<{ x: number; y: number; zoom: number }>>;
  'lr-layout-change': CustomEvent<FlowLayoutChangeDetail>;
}

/** A consumer-authored card assigned to a node's generated named slot — a structural type, not an
 *  import of `LyraFlowNode`, so this module never depends on the `flow-node` component module load
 *  order. */
interface FlowNodeCardEl extends HTMLElement {
  nodeId: string;
  flowType: string;
  heading: string;
  orientation: LyraOrientation;
  status: LyraToolStatus | null;
  progress: number | null;
  statusDetail: string;
  durationMs: number | null;
  selected: boolean;
  inputs: readonly FlowHandle[];
  outputs: readonly FlowHandle[];
}

/** The author-owned slot value and the last lease value this canvas assigned to one direct card. */
interface AuthoredCardSlotLease {
  authoredSlot: string | null;
  appliedSlot: string | null;
  authorOwnsSlot: boolean;
}

interface OwnedAnimationFrame {
  handle: number;
  owner: Window;
}

/**
 * `<lr-flow-canvas>` — a pannable/zoomable DAG workflow canvas: positions HTML node cards, draws
 * SVG edges between their handles, runs a shared layered auto-layout for unpositioned nodes, and owns
 * all selection/drag/connect interaction. A viewer by default; opt into editor gestures
 * individually via `nodes-draggable`, `connectable`, `droppable`. `nodes` and `edges` remain
 * controlled and are never mutated internally. Node cards and edges outside the viewport are
 * culled, while active/selected nodes, connection targets and their incident edges remain
 * available. Keyboard navigation retains the complete model order and reveals its destination;
 * companions receive the complete admitted geometry. Selection is an internally applied interaction
 * state: `selectedNodeIds`/`selectedEdgeIds` can seed or replace it, and node/edge activation
 * updates those arrays before emitting `lr-selection-change`. Interaction announcements are
 * flushed to the document's shared light-DOM polite sink; mount is silent and repeated identical
 * messages remain separate announcements. `[part="live-region"]` is only an aria-hidden mirror.
 * Turning on `readonly` is a live safety boundary: active pan, node-drag, connect, and palette-drop
 * previews are canceled and their window listeners are retired before later pointer events can
 * commit. Viewport-mutating imperative methods, including `focusNode()`, are inert while readonly.
 * Replacing the controlled `nodes` model similarly retires node-drag and connect gestures before
 * their captured ids can outlive that model; background pan remains independent. Node and edge
 * collections reject blank ids and later duplicates at assignment, so the first valid occurrence
 * owns layout, focus, selection, gestures, companion snapshots, and emitted identity. Re-assigning
 * the identical array or record to a model or selection property is a no-op.
 *
 * A `FlowNode` may also set `disabled`, marking it non-actionable: it keeps its position and card
 * content but cannot be selected or activated by click or keyboard, roving-tabindex navigation
 * (arrow keys, Home/End) steps past it instead of landing on it, it cannot be dragged even while
 * `nodes-draggable`, and it is excluded from starting or receiving a new connection while
 * `connectable` -- an edge that already touches a since-disabled node is left alone. Omitted or
 * `false` renders the node exactly as before this field existed.
 *
 * Anchored Lyra overlays in a node's slotted content (a node menu, a tooltip) default to the
 * `fixed` strategy, because a node is translated inside a scaled, clipped world where an `absolute`
 * overlay could never extend past the canvas; a trapped `fixed` overlay opens in the browser top
 * layer where the native Popover API exists. An authored `positioning-strategy`, an ancestor's
 * `--lr-positioning-strategy`, or `::part(node) { --lr-positioning-strategy: absolute }` still
 * wins. Wheel and pointer gestures that start inside such an open overlay stay its own: they
 * neither zoom the canvas nor drag the node.
 *
 * @customElement lr-flow-canvas
 * @slot - Consumer-authored node cards matched by `node-id`. Each matching card is assigned to the
 *   generated `node-{id}` slot; a declarative `lr-flow-node` fallback remains in shadow DOM and no
 *   light-DOM nodes are created or removed. Non-matching children are ignored with a warning.
 * @slot top-start - Floating start-side content in the wrapping top overlay rail (e.g. `lr-flow-run-status`).
 * @slot top-end - Floating end-side content in the wrapping top overlay rail.
 * @slot bottom-start - Floating start-side content in the wrapping bottom overlay rail (e.g. `lr-flow-controls`).
 * @slot bottom-end - Floating end-side content in the wrapping bottom overlay rail (e.g. `lr-flow-minimap`).
 * @event lr-node-activate - `detail: { nodeId }`.
 * @event lr-edge-activate - `detail: { edgeId, sourceNodeId, targetNodeId, source, target }`.
 *   `sourceNodeId` and `targetNodeId` are canonical; `source` and `target` remain deprecated aliases.
 * @event lr-selection-change - `detail: { selectedNodeIds, selectedEdgeIds }`.
 * @event lr-node-move - `detail: { nodeId, position, previous }`.
 * @event lr-connect - `detail: { source, target, sourceHandle, targetHandle }`.
 * @event lr-node-add - `detail: { type, position }`.
 * @event lr-selection-delete - `detail: { nodeIds, edgeIds }`.
 * @event lr-viewport-change - `detail: { x, y, zoom }`.
 * @event lr-layout-change - `detail: { positions, truncated }`.
 * @csspart base - The root wrapper.
 * @csspart source-navigator - Complete source records and paging controls.
 * @csspart source-controls - Source query and page controls.
 * @csspart source-records - The bounded current records page.
 * @csspart source-record - A record and its scope or endpoint actions.
 * @csspart source-status - Source loading, failure, and total status.
 * @csspart source-coverage - Exact scene coverage relative to complete source totals.
 * @csspart viewport - The focusable pan/zoom surface.
 * @csspart background - The dotted background grid.
 * @csspart edges - The edges SVG.
 * @csspart edge - A single edge path.
 * @csspart edge-label - An edge's drawn label.
 * @csspart arrowhead - A tone-matched directed-edge arrowhead marker.
 * @csspart stub - A dangling-edge stub line.
 * @csspart connection-line - The in-progress connect-gesture path.
 * @csspart node - A node's positioned wrapper. Carries `data-selected` while selected, and
 *   `aria-disabled="true"` while its `FlowNode.disabled` is set.
 * @csspart node-control - The visually hidden, roving selection button for a node. Renders a
 *   genuine `disabled` `<button>` while `FlowNode.disabled` is set.
 * @csspart node-card - The declarative fallback card.
 * @csspart node-card-base - The fallback `lr-flow-node` handle/card row.
 * @csspart node-card-surface - The fallback card's bordered surface.
 * @csspart node-card-header - The fallback card's header row.
 * @csspart node-card-heading - The fallback card's heading.
 * @csspart node-card-status - The fallback card's visible status.
 * @csspart node-card-progress - The fallback card's determinate progress bar.
 * @csspart node-card-body - The fallback card's body.
 * @csspart node-card-toolbar - The fallback card's toolbar.
 * @csspart node-card-handle - Every fallback card handle.
 * @csspart node-card-handle-input - A fallback card input handle.
 * @csspart node-card-handle-output - A fallback card output handle.
 * Fallback cards additionally expose a normalized `node-type-<type>` part derived from
 * `FlowNode.type`; wildcard part names are described here rather than published as literal CEM
 * members.
 * @csspart edge-hit-area - The transparent wide pointer target behind an edge.
 * @csspart empty - The `lr-empty` shown when `nodes` is empty.
 * @csspart input-limit - A localized notice when nodes, edges, or node data exceed an input safety boundary.
 * @csspart layout-limit - A visible localized notice shown when layered layout reaches its bounded
 *   edge-ordering work limit. Its announcement is sent through the shared light-DOM polite sink.
 * @csspart live-region - An aria-hidden shadow mirror of the current item/gesture announcement;
 *   the actual announcement uses the shared light-DOM polite sink.
 * @csspart edge-list - A visually hidden list of dangling or otherwise unrenderable edges.
 * @csspart overlay-rail - A top or bottom wrapping rail that prevents opposite-corner companions
 *   from overlapping in narrow allocations.
 * @cssprop [--lr-canvas-reserved-height=var(--lr-size-24rem)] - Default host block size, shared
 *   with the pre-upgrade reservation stylesheet. An explicit outer `block-size` still wins.
 * @cssprop [--lr-flow-canvas-grid-size=var(--lr-size-0-5rem)] - Dotted background spacing. The
 *   `grid` property supplies the fallback when this hook is unset; an element or ancestor hook
 *   takes precedence.
 * @cssprop [--lr-flow-canvas-edge-neutral-color=var(--lr-color-border)] - Neutral edge and arrowhead color.
 * @cssprop [--lr-flow-canvas-edge-brand-color=var(--lr-color-brand)] - Brand edge and arrowhead color.
 * @cssprop [--lr-flow-canvas-connection-line-color=var(--lr-color-brand)] - Stroke color of
 *   `[part="connection-line"]`, the in-progress connect-gesture path drawn while dragging a new
 *   connection, independent of a finished edge's own `--lr-flow-canvas-edge-*-color`.
 * @cssprop [--lr-flow-canvas-edge-success-color=var(--lr-color-success)] - Success edge and arrowhead color.
 * @cssprop [--lr-flow-canvas-edge-warning-color=var(--lr-color-warning)] - Warning edge and arrowhead color.
 * @cssprop [--lr-flow-canvas-edge-danger-color=var(--lr-color-danger)] - Danger edge and arrowhead color.
 * @cssprop [--lr-flow-canvas-march-duration=var(--lr-duration-ambient)] - Running-edge march animation duration.
 * @cssprop [--lr-flow-canvas-node-selected-outline-color=var(--lr-color-brand)] - Outline color of a selected node; the
 *   canvas's ring replaces an `lr-flow-node` card's own selected ring.
 * @cssprop [--lr-flow-canvas-node-connect-invalid-outline-color=var(--lr-color-danger)] - Outline color
 *   of a node that is an invalid connect-gesture drop target. Same `::part()` attribute-selector
 *   restriction as `--lr-flow-canvas-node-selected-outline-color` above.
 * @cssprop [--lr-flow-canvas-node-connect-target-outline-color=var(--lr-color-brand)] - Outline color of
 *   a node that is a valid connect-gesture drop target.
 * @cssprop [--lr-flow-canvas-drop-active-outline-color=var(--lr-color-brand)] - Outline color of the
 *   viewport while a palette item is dragged over it (`droppable`).
 * @cssprop [--lr-flow-canvas-node-hover-outline-color=var(--lr-color-border-strong)] - Outline color
 *   of a node's mouse-hover preview of its own `:focus-visible` ring. Unlike the four state-scoped
 *   colors above this one is `:hover`-gated rather than attribute-gated, so a `::part(node):hover`
 *   override would lose to this rule's own higher internal specificity rather than to the
 *   `::part()[attr]` restriction those four work around. Set to `transparent` to opt out.
 * @cssprop [--lr-flow-canvas-node-disabled-opacity=var(--lr-opacity-disabled)] - Opacity of a node whose `FlowNode` entry
 *   sets `disabled`.
 * @cssprop [--lr-flow-canvas-node-fallback-inline-size=calc(var(--lr-size-10rem) + var(--lr-size-1rem))] - Card
 *   inline size assumed for layout and fitting before a node is measured.
 * @cssprop [--lr-flow-canvas-node-fallback-block-size=var(--lr-size-4rem)] - Card block size assumed
 *   for layout and fitting before a node is measured.
 * @status stable
 * @since 4.0.0
 */
export class LyraFlowCanvas extends LyraElement<LyraFlowCanvasEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    flowCanvasInputLimit: LYRA_DEFAULT_flowCanvasInputLimit,
    flowCanvasLabel: LYRA_DEFAULT_flowCanvasLabel,
    flowCanvasLayoutLimit: LYRA_DEFAULT_flowCanvasLayoutLimit,
    flowCanvasSummary: LYRA_DEFAULT_flowCanvasSummary,
    flowConnectCancelled: LYRA_DEFAULT_flowConnectCancelled,
    flowConnectCommitted: LYRA_DEFAULT_flowConnectCommitted,
    flowConnectStarted: LYRA_DEFAULT_flowConnectStarted,
    flowConnectTarget: LYRA_DEFAULT_flowConnectTarget,
    flowEdge: LYRA_DEFAULT_flowEdge,
    flowEdgeList: LYRA_DEFAULT_flowEdgeList,
    flowEdgeWithLabel: LYRA_DEFAULT_flowEdgeWithLabel,
    flowItemAnnouncement: LYRA_DEFAULT_flowItemAnnouncement,
    flowNode: LYRA_DEFAULT_flowNode,
    flowNodeDeselected: LYRA_DEFAULT_flowNodeDeselected,
    flowNodeMoved: LYRA_DEFAULT_flowNodeMoved,
    flowNodeSelected: LYRA_DEFAULT_flowNodeSelected,
    flowSelectionCleared: LYRA_DEFAULT_flowSelectionCleared,
    graphSourceAllRecords: LYRA_DEFAULT_graphSourceAllRecords,
    graphSourceBothDirections: LYRA_DEFAULT_graphSourceBothDirections,
    graphSourceCoverageAggregate: LYRA_DEFAULT_graphSourceCoverageAggregate,
    graphSourceCoverageComplete: LYRA_DEFAULT_graphSourceCoverageComplete,
    graphSourceCoverageNeighborhood: LYRA_DEFAULT_graphSourceCoverageNeighborhood,
    graphSourceDirection: LYRA_DEFAULT_graphSourceDirection,
    graphSourceEdges: LYRA_DEFAULT_graphSourceEdges,
    graphSourceIncidentEdges: LYRA_DEFAULT_graphSourceIncidentEdges,
    graphSourceNodes: LYRA_DEFAULT_graphSourceNodes,
    graphSourceRecordMissing: LYRA_DEFAULT_graphSourceRecordMissing,
    graphSourceRecords: LYRA_DEFAULT_graphSourceRecords,
    graphSourceRecordsError: LYRA_DEFAULT_graphSourceRecordsError,
    graphSourceSceneError: LYRA_DEFAULT_graphSourceSceneError,
    graphSourceTotals: LYRA_DEFAULT_graphSourceTotals,
    loading: LYRA_DEFAULT_loading,
    neighborDirectionIn: LYRA_DEFAULT_neighborDirectionIn,
    neighborDirectionOut: LYRA_DEFAULT_neighborDirectionOut,
    next: LYRA_DEFAULT_next,
    noData: LYRA_DEFAULT_noData,
    paginationPage: LYRA_DEFAULT_paginationPage,
    previous: LYRA_DEFAULT_previous,
    retry: LYRA_DEFAULT_retry,
    search: LYRA_DEFAULT_search,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  private _graphSource?: FlowCanvasSource;
  private sourceEpoch = 0;
  private sourceIntent = 0;
  private sourceSyncing = false;
  private sourceInputs?: readonly unknown[];
  private sourcePageInputs?: readonly unknown[];
  private sourcePagePromise: Promise<boolean> = Promise.resolve(false);
  private sourceSceneInputs = '';
  private sourceQuery = EMPTY_FLOW_QUERY;
  private sourceError?: unknown;
  private sourceSceneFailure = false;
  private sourceMissing = false;
  private sourceNodes = EMPTY_FLOW_NODES;
  private sourceEdges = EMPTY_FLOW_EDGES;
  private sourceAcceptedScene?: LyraGraphScene<FlowNode, FlowEdge>;
  private sourceWorld?: LyraSourceBounds;
  private sourceOverview: LyraGraphOverview | null = null;
  private sourceOverviewEpoch = -1;
  private sourceOverviewRunning = false;
  private sourceOverviewQueued?: () => Promise<void>;
  @state() private sourceState = 0;
  private readonly sourceOverviewRequests = new SourceRequestController(this, { channels: ['overview'] });
  private readonly sourcePages = new SourcePageController<FlowSourceValue, LyraGraphSourceQuery, LyraGraphSourceSummary>(this, {
    normalizeRecord: record => record as LyraSourceRecord<FlowSourceValue>,
    normalizeSummary: raw => flowSourceSummary(raw, new SceneReader(() => true)),
    validateMetadata: (result, query) => {
      const total = result.summary[query.kind];
      if (result.total > total || (!query.search && query.centerKey === null && result.total !== total) ||
        result.rows.some(row => row.value.kind !== (query.kind === 'nodes' ? 'node' : 'edge'))) throw new TypeError('Invalid flow record total');
      const scene = this.sourceAcceptedScene;
      if (scene && (scene.total.nodes !== result.summary.nodes || scene.total.edges !== result.summary.edges)) throw new TypeError('Inconsistent flow totals');
    },
    onChange: () => {
      if (!this.sourceMode) return;
      const state = this.sourcePages.state;
      if (state.result && !state.pending && !state.error) {
        this._sourcePage = state.page;
        this.sourcePageInputs = [this.sourceQuery, state.page, state.pageSize];
      }
      this.sourceState++;
    },
  });
  private readonly sourceScene = new GraphSceneController<FlowNode, FlowEdge>(this, {
    domain: flowSceneDomain,
    onChange: () => {
      if (!this.sourceMode) return;
      const scene = this.sourceScene.state.scene;
      if (this.sourceScene.state.error) {
        this.sourceNodes = EMPTY_FLOW_NODES; this.sourceEdges = EMPTY_FLOW_EDGES;
        this.rovingCache = undefined; this.renderResolved = undefined; this.companionStructure = undefined;
        this.pruneNodeCaches(); this.scheduleCompanionNotify();
      }
      if (scene && scene !== this.sourceAcceptedScene) {
        const previousScene = this.sourceAcceptedScene;
        const summary = this.sourcePages.state.result?.summary;
        this.sourceSceneFailure = !scene.worldBounds || Boolean(this.sourceWorld && !sameFlowBounds(this.sourceWorld, scene.worldBounds)) ||
          Boolean(summary && (summary.nodes !== scene.total.nodes || summary.edges !== scene.total.edges)) ||
          Boolean(previousScene && (previousScene.total.nodes !== scene.total.nodes || previousScene.total.edges !== scene.total.edges));
        this.sourceNodes = this.sourceSceneFailure ? EMPTY_FLOW_NODES : Object.freeze(scene.nodes.map(node => node.value));
        this.sourceEdges = this.sourceSceneFailure ? EMPTY_FLOW_EDGES : Object.freeze(scene.edges.map(edge => edge.value));
        if (!this.sourceSceneFailure) { this.sourceAcceptedScene = scene; this.sourceWorld ??= scene.worldBounds!; }
        this.rovingCache = undefined; this.renderResolved = undefined; this.companionStructure = undefined;
        this.pruneNodeCaches(); this.scheduleCompanionNotify();
      }
      this.sourceState++;
    },
  });

  /** Complete source records and separately bounded positioned viewport scenes. Defined sources
   * override legacy nodes/edges, preserve offscene selection and disable model editing only.
   * Reassign the source (including the same reference) or requestUpdate() after revision changes.
   * Unset restores the latest legacy inputs. @default undefined */
  @property({ attribute: false })
  get graphSource(): FlowCanvasSource | undefined { return this._graphSource; }
  set graphSource(value: FlowCanvasSource | undefined) {
    const old = this._graphSource; this._graphSource = value;
    this.resetFlowSource(); this.requestUpdate('graphSource', old);
  }
  private _sourcePage = 0;
  /** Zero-based global record page, normalized against sourcePageSize. */
  @property({ type: Number, attribute: 'source-page' })
  get sourcePage(): number { return this._sourcePage; }
  set sourcePage(value: number) {
    const old = this._sourcePage; this._sourcePage = value;
    if (!this.sourceSyncing) this.sourceIntent++;
    this.syncFlowSource(); this.requestUpdate('sourcePage', old);
  }
  private _sourcePageSize = 100;
  /** Source records per page, normalized to 1–500. */
  @property({ type: Number, attribute: 'source-page-size' })
  get sourcePageSize(): number { return this._sourcePageSize; }
  set sourcePageSize(value: number) {
    const old = this._sourcePageSize; this._sourcePageSize = value; this._sourcePage = 0;
    this.sourceIntent++; this.syncFlowSource(); this.requestUpdate('sourcePageSize', old);
  }
  /** Exact active record-query total; null when unavailable. */
  get sourceTotal(): number | null { return this.graphSource === undefined || this.sourceError ? null : this.sourcePages.state.result?.total ?? null; }
  private get modelNodes(): readonly FlowNode[] { return this.graphSource === undefined ? this._nodes : this.sourceNodes; }
  private get modelEdges(): readonly FlowEdge[] { return this.graphSource === undefined ? this._edges : this.sourceEdges; }
  private get sourceMode(): boolean { return this.graphSource !== undefined; }

  private resetFlowSource(): void {
    this.sourceEpoch++; this.sourceIntent++; this.sourceInputs = undefined; this.sourcePageInputs = undefined;
    this.sourceSceneInputs = ''; this.sourceQuery = EMPTY_FLOW_QUERY; this._sourcePage = 0;
    this.sourceError = undefined; this.sourceMissing = false; this.sourceSceneFailure = false;
    this.sourceNodes = EMPTY_FLOW_NODES; this.sourceEdges = EMPTY_FLOW_EDGES; this.sourceAcceptedScene = undefined;
    this.sourceWorld = undefined; this.sourceOverview = null; this.sourceOverviewEpoch = -1; this.sourceOverviewQueued = undefined;
    this.sourcePages?.bind(undefined); this.sourceScene?.bind(undefined); this.sourceOverviewRequests?.setSource(undefined, undefined);
    this.cancelModelBoundGestures(); this.autoPositions.clear(); this.measuredSizes.clear();
    this.renderResolved = undefined; this.rovingCache = undefined; this.companionStructure = undefined;
    this._selectedNodeIds = this.sourceMode ? this._requestedSelectedNodeIds : this.snapshotSelectedIds(this._requestedSelectedNodeIds, new Set(this._nodes.map(node => node.id)));
    this._selectedEdgeIds = this.sourceMode ? this._requestedSelectedEdgeIds : this.snapshotSelectedIds(this._requestedSelectedEdgeIds, new Set(this._edges.map(edge => edge.id)));
    this.sourceState++;
  }
  private sourceAuthority(): () => boolean {
    const source = this.graphSource, epoch = this.sourceEpoch, owner = this.ownerDocument;
    const owned = () => this.isConnected && this.graphSource === source && this.sourceEpoch === epoch && this.ownerDocument === owner;
    if (!source) return owned;
    let revision: unknown;
    try { revision = source.revision; } catch { return () => false; }
    if (!owned()) return () => false;
    return () => {
      if (!owned()) return false;
      try { const currentRevision = source.revision; return owned() && currentRevision === revision; } catch { return false; }
    };
  }
  private syncFlowSource(): void {
    if (!this.isConnected || !this.sourceMode || this.sourceSyncing || this.sourceError || !this.sourcePages) return;
    this.sourceSyncing = true;
    const source = this.graphSource!, epoch = this.sourceEpoch, owner = this.ownerDocument;
    const owned = () => this.graphSource === source && this.sourceEpoch === epoch && this.isConnected && this.ownerDocument === owner;
    try {
      const revision = sourceRevision(source.revision); if (!owned()) return;
      const records = source.records; if (!owned()) return;
      if (sourceRevision(records.revision) !== revision) throw new TypeError('Invalid flow records revision');
      if (!owned()) return;
      const inputs = [source, records, revision, epoch, this.effectiveLocale];
      if (!this.sourceInputs || inputs.some((value, index) => value !== this.sourceInputs![index])) {
        const current = () => {
          if (!owned()) return false;
          const nextRevision = source.revision; if (!owned() || nextRevision !== revision) return false;
          const nextRecords = source.records; if (!owned() || nextRecords !== records) return false;
          const recordRevision = records.revision; return owned() && recordRevision === revision;
        };
        const checked = (signal: AbortSignal) => () => !signal.aborted && current();
        const wrapped: FlowCanvasSource['records'] = { revision,
          query: async request => {
            const reader = new SceneReader(checked(request.signal)); reader.check(); const query = records.query; reader.check();
            const raw = await Reflect.apply(query, records, [request]); reader.check();
            if (reader.field(raw, 'groups') !== undefined || reader.field(raw, 'tags') !== undefined) throw new TypeError('Unexpected flow metadata');
            return { rows: flowSourceRows(reader.field(raw, 'rows'), request.pageSize, reader), total: sourceCount(reader.field(raw, 'total')), summary: flowSourceSummary(reader.field(raw, 'summary'), reader) };
          },
          // The flow canvas never selects records by key (selection lives in `selectedNodeIds`), so
          // the page controller has no use for a lookup; reject it instead of reaching the source.
          lookup: () => Promise.reject(new TypeError('Flow records are not looked up by key')),
          locate: async (key, query, context) => {
            const reader = new SceneReader(checked(context.signal)); reader.check(); const locate = records.locate; reader.check();
            const index = await Reflect.apply(locate, records, [key, query, context]); reader.check(); return index;
          },
        };
        this.sourceError = undefined; this.sourceSceneFailure = false;
        this.sourcePages.bind({ source: wrapped, revision, epoch, locale: this.effectiveLocale }); if (!owned()) return;
        if (!this.sourceScene.bind({ source, epoch, locale: this.effectiveLocale }) || !owned()) throw new TypeError('Invalid flow scene source');
        this.sourceOverviewRequests.setSource(source, revision); if (!owned()) return;
        this.sourceInputs = inputs; this.sourcePageInputs = undefined; this.sourceSceneInputs = '';
      }
      const size = finiteInteger(this.sourcePageSize, 100, 1, 500), page = finiteInteger(this.sourcePage, 0, 0, Math.floor(Number.MAX_SAFE_INTEGER / size));
      const pageInputs = [this.sourceQuery, page, size];
      if (!this.sourcePageInputs || pageInputs.some((value, index) => value !== this.sourcePageInputs![index])) {
        this.sourcePageInputs = pageInputs; this.sourceMissing = false;
        this.sourcePagePromise = this.sourcePages.request(this.sourceQuery, page, size);
      }
    } catch (error) {
      if (owned()) { this.sourceError = error; this.sourcePages.bind(undefined); this.sourceScene.bind(undefined); this.sourceInputs = undefined; }
    } finally { this.sourceSyncing = false; }
  }
  private sourceViewportBounds(): LyraSourceBounds {
    const rect = this.viewportEl?.getBoundingClientRect() ?? this.getBoundingClientRect();
    const clamp = (value: number) => Math.max(-1_000_000, Math.min(1_000_000, value));
    const x = clamp(-this.panX / this.zoomLevel), y = clamp(-this.panY / this.zoomLevel);
    return Object.freeze({ x, y, width: Math.max(0, clamp((rect.width - this.panX) / this.zoomLevel) - x), height: Math.max(0, clamp((rect.height - this.panY) / this.zoomLevel) - y) });
  }
  private requestSourceScene(extraKey?: string): Promise<boolean> {
    if (!this.sourceMode || !this.sourceInputs || this.sourceError) return Promise.resolve(false);
    const keys = new Set<string>();
    if (extraKey) keys.add(extraKey);
    for (const [prefix, ids] of [['node', this.selectedNodeIds], ['edge', this.selectedEdgeIds]] as const)
      for (const id of ids) { if (keys.size >= 32) break; if (id.length + 5 <= 65_536) keys.add(`${prefix}:${id}`); }
    const bounds = this.sourceViewportBounds(), includeKeys = Object.freeze([...keys]);
    const signature = JSON.stringify([this.sourceEpoch, bounds, includeKeys]);
    if (!extraKey && signature === this.sourceSceneInputs) return Promise.resolve(!this.sourceScene.state.error);
    this.sourceSceneInputs = signature;
    return this.sourceScene.request({ mode: 'viewport', centerKey: null, bounds, includeKeys });
  }
  private requestSourceOverview(): void {
    const source = this.graphSource, scene = this.sourceAcceptedScene, world = this.sourceWorld;
    if (!source || !scene || !world || this.sourceSceneFailure || this.sourceOverviewEpoch === this.sourceEpoch) return;
    this.sourceOverviewEpoch = this.sourceEpoch;
    const lease = this.sourceOverviewRequests.begin('overview', this.effectiveLocale), authority = this.sourceAuthority();
    if (!lease) return;
    const current = () => lease.isCurrent() && authority() && this.sourceWorld === world && !this.sourceSceneFailure;
    this.sourceOverviewQueued = async () => {
      try {
        if (!current()) return; const overview = source.overview; if (!current() || !overview) return;
        const raw = await Reflect.apply(overview, source, [{ ...lease.context, limit: 1024 }]);
        if (!current()) return;
        const result = flowSourceOverview(raw, world, scene.total.nodes, current);
        if (current()) { this.sourceOverview = result; this.sourceState++; this.scheduleCompanionNotify(false); }
      } catch { if (current()) { this.sourceOverview = null; this.sourceState++; this.scheduleCompanionNotify(false); } }
    };
    this.pumpSourceOverview();
  }
  private pumpSourceOverview(): void {
    if (this.sourceOverviewRunning || !this.sourceOverviewQueued) return;
    const run = this.sourceOverviewQueued; this.sourceOverviewQueued = undefined; this.sourceOverviewRunning = true;
    void run().finally(() => { this.sourceOverviewRunning = false; this.pumpSourceOverview(); });
  }
  private setSourceQuery(query: LyraGraphSourceQuery): void {
    this.sourceIntent++; this.sourceQuery = Object.freeze(query); this._sourcePage = 0; this.sourcePageInputs = undefined;
    this.syncFlowSource(); this.sourceState++;
  }
  /** Reveal a canonical node:<id> or edge:<id> in the complete records navigator, clearing scope. */
  async revealSourceKey(key: string): Promise<boolean> {
    if (!this.sourceMode || typeof key !== 'string' || key.length > 65_536 || !/^(node|edge):.+/s.test(key)) return false;
    this.setSourceQuery({ ...EMPTY_FLOW_QUERY, kind: key.startsWith('node:') ? 'nodes' : 'edges' });
    const authority = this.sourceAuthority(), intent = this.sourceIntent, current = () => authority() && intent === this.sourceIntent;
    await this.sourcePagePromise; if (!current()) return false;
    const index = await this.sourcePages.locate(key); if (!current()) return false;
    if (index === null) { this.sourceMissing = true; this.sourceState++; return false; }
    this._sourcePage = Math.floor(index / finiteInteger(this.sourcePageSize, 100, 1, 500));
    this.syncFlowSource(); await this.sourcePagePromise; if (!current()) return false;
    this.sourceState++; await this.updateComplete; if (!current()) return false;
    const target = [...this.renderRoot.querySelectorAll<HTMLElement>('[data-source-key]')].find(row => row.dataset['sourceKey'] === key);
    if (!target) return false;
    target.scrollIntoView({ block: 'nearest' }); if (!current()) return false; target.focus(); return current();
  }
  private async focusSourceRecord(index: number): Promise<void> {
    const query = this.sourceQuery, authority = this.sourceAuthority();
    const size = finiteInteger(this.sourcePageSize, 100, 1, 500);
    this.sourcePage = Math.floor(index / size);
    const intent = this.sourceIntent;
    const current = () => authority() && this.sourceIntent === intent && this.sourceQuery === query;
    await this.sourcePagePromise;
    if (!current()) return;
    await this.updateComplete;
    if (!current()) return;
    const key = this.sourcePages.state.result?.rows[index % size]?.key;
    const target = [...this.renderRoot.querySelectorAll<HTMLButtonElement>('[data-source-key]')]
      .find(button => button.dataset['sourceKey'] === key);
    if (!target || target.disabled) return;
    target.scrollIntoView({ block: 'nearest' });
    if (current()) target.focus();
  }
  private renderSourceNavigator(): TemplateResult {
    const state = this.sourcePages.state, query = this.sourceQuery, authority = this.sourceAuthority(), error = this.sourceError;
    const current = () => authority() && this.sourcePages.state === state && this.sourceQuery === query && this.sourceError === error;
    const size = finiteInteger(this.sourcePageSize, 100, 1, 500), page = finiteInteger(this.sourcePage, 0, 0), total = this.sourceTotal;
    const changePage = (next: number) => { if (current()) this.sourcePage = next; };
    return html`<section part="source-navigator" aria-label=${this.localize('graphSourceRecords')} aria-busy=${String(state.pending)}>
      <div part="source-controls"><label>${this.localize('graphSourceRecords')}<select data-source-kind .value=${query.kind} @change=${(event: Event) => { if (current()) this.setSourceQuery({ ...EMPTY_FLOW_QUERY, kind: (event.target as HTMLSelectElement).value === 'edges' ? 'edges' : 'nodes' }); }}>
        <option value="nodes">${this.localize('graphSourceNodes')}</option><option value="edges">${this.localize('graphSourceEdges')}</option></select></label>
        <label>${this.localize('search')}<input data-source-search type="search" maxlength="65536" .value=${query.search} @input=${(event: Event) => { if (current()) this.setSourceQuery({ ...query, search: (event.target as HTMLInputElement).value }); }}></label>
        ${query.centerKey ? html`<button type="button" @click=${() => { if (current()) this.setSourceQuery({ ...EMPTY_FLOW_QUERY, kind: query.kind }); }}>${this.localize('graphSourceAllRecords')}</button>
          <label>${this.localize('graphSourceDirection')}<select .value=${query.direction} @change=${(event: Event) => { if (current()) this.setSourceQuery({ ...query, direction: (event.target as HTMLSelectElement).value as 'in' | 'out' | 'both' }); }}><option value="both">${this.localize('graphSourceBothDirections')}</option><option value="in">${this.localize('neighborDirectionIn')}</option><option value="out">${this.localize('neighborDirectionOut')}</option></select></label>` : nothing}
      </div>
      <p part="source-status">${state.pending ? this.localize('loading') : state.error || error ? this.localize('graphSourceRecordsError') : this.sourceMissing ? this.localize('graphSourceRecordMissing') : total === 0 ? this.localize('noData') : this.localize('graphSourceTotals', undefined, { nodes: this.formatNumber(state.result?.summary.nodes ?? 0), edges: this.formatNumber(state.result?.summary.edges ?? 0) })}
        ${(state.error || error) && !state.pending ? html`<button type="button" @click=${() => { if (current() && (state.error || error)) this.requestUpdate(); }}>${this.localize('retry')}</button>` : nothing}</p>
      ${this.sourceScene.state.scene && !this.sourceSceneFailure ? html`<p part="source-coverage">${this.localize(this.sourceScene.state.scene.coverage === 'complete' ? 'graphSourceCoverageComplete' : this.sourceScene.state.scene.coverage === 'aggregate' ? 'graphSourceCoverageAggregate' : 'graphSourceCoverageNeighborhood', undefined, {
        shownNodes: this.formatNumber(this.sourceNodes.length), shownEdges: this.formatNumber(this.sourceEdges.length),
        nodes: this.formatNumber(this.sourceScene.state.scene.total.nodes), edges: this.formatNumber(this.sourceScene.state.scene.total.edges),
      })}</p>` : nothing}
      <div part="source-records">${state.result?.rows.map(row => {
        const value = row.value, rowCurrent = () => current() && !state.pending && !state.error && state.result?.rows.includes(row);
        return html`<div part="source-record"><button type="button" data-source-key=${row.key} ?disabled=${value.kind === 'node' && value.value.disabled}
          @keydown=${(event: KeyboardEvent) => {
            if (!rowCurrent() || total === null || total === 0) return;
            const index = page * size + state.result!.rows.indexOf(row);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? total - 1 :
              event.key === 'ArrowDown' ? Math.min(total - 1, index + 1) : event.key === 'ArrowUp' ? Math.max(0, index - 1) : null;
            if (next !== null) { event.preventDefault(); void this.focusSourceRecord(next); }
          }}
          @click=${(event: MouseEvent) => { if (!rowCurrent()) return; if (value.kind === 'node') this.onNodeActivate(value.value, event.ctrlKey || event.metaKey); else this.onEdgeActivate(value.value, event.ctrlKey || event.metaKey); }}>${value.kind === 'node' ? this.nodeAccessibleText(value.value) : this.edgeAccessibleText(value.value)}</button>
          ${value.kind === 'node' ? html`<button type="button" @click=${() => { if (rowCurrent()) this.setSourceQuery({ ...EMPTY_FLOW_QUERY, kind: 'edges', centerKey: row.key }); }}>${this.localize('graphSourceIncidentEdges', undefined, { label: this.nodeAccessibleText(value.value as FlowNode) })}</button>` : html`<button type="button" @click=${() => { if (rowCurrent()) void this.revealSourceKey(`node:${value.value.source}`); }}>${value.value.source}</button><button type="button" @click=${() => { if (rowCurrent()) void this.revealSourceKey(`node:${value.value.target}`); }}>${value.value.target}</button>`}</div>`;
      })}</div>
      <div part="source-controls"><button type="button" ?disabled=${state.pending || page === 0} @click=${() => changePage(page - 1)}>${this.localize('previous')}</button>
        <label>${this.localize('paginationPage')}<input data-source-page type="number" min="1" .value=${String(page + 1)} @change=${(event: Event) => changePage(finiteInteger(Number((event.target as HTMLInputElement).value) - 1, 0, 0))}></label>
        <button type="button" ?disabled=${state.pending || total === null || (page + 1) * size >= total} @click=${() => changePage(page + 1)}>${this.localize('next')}</button></div>
    </section>`;
  }

  private _nodes: readonly FlowNode[] = Object.freeze([]);
  private nodesSource?: readonly FlowNode[];
  private nodesInputTruncated = false;
  private edgesInputTruncated = false;
  /** Controlled node model, deeply snapshotted and frozen at assignment, bounded to the first
   * 10,000 source nodes and a shared 50,000-position nested-data inspection budget per assignment.
   * Metadata copies preserve shared references across nodes. Each record inspects at most 10,000
   * own keys and at most 16 descendant levels; input-limit reports omitted input. Blank ids and later duplicates are omitted
   * first-wins. Assign a new array to update; replacing it cancels active node-drag and pointer/keyboard
   * connect gestures and prunes selected ids that no longer exist. */
  @property({ attribute: false })
  get nodes(): readonly FlowNode[] {
    return this._nodes;
  }
  set nodes(value: readonly FlowNode[]) {
    if (value === this.nodesSource || value === this._nodes) return;
    const previous = this._nodes;
    this.nodesSource = value;
    this.nodesInputTruncated = false;
    this._nodes = snapshotFlowNodes(value, () => { this.nodesInputTruncated = true; });
    this.rovingCache = undefined;
    this.requestUpdate('nodes', previous);
  }

  private _edges: readonly FlowEdge[] = Object.freeze([]);
  private edgesSource?: readonly FlowEdge[];
  /** Controlled edge model, deeply snapshotted and frozen at assignment, bounded to the first
   * 10,000 source edges and a finite nested-data budget. Blank ids and later duplicates are omitted
   * first-wins before every render, action, focus, selection, snapshot, and event path. Assign a
   * new collection to update. */
  @property({ attribute: false })
  get edges(): readonly FlowEdge[] {
    return this._edges;
  }
  set edges(value: readonly FlowEdge[]) {
    if (value === this.edgesSource || value === this._edges) return;
    const previous = this._edges;
    this.edgesSource = value;
    this.edgesInputTruncated = false;
    this._edges = snapshotFlowEdges(value, () => { this.edgesInputTruncated = true; });
    this.rovingCache = undefined;
    this.requestUpdate('edges', previous);
  }

  private _orientation: LyraOrientation = 'horizontal';
  /** Downstream layout and handle axis. Horizontal RTL reflects model coordinates while authored,
   * generated and portable fallback cards retain readable content. Invalid runtime/attribute
   * values normalize to horizontal. */
  @property({ reflect: true })
  get orientation(): LyraOrientation {
    return this._orientation;
  }
  set orientation(value: LyraOrientation) {
    const previous = this._orientation;
    const next: LyraOrientation = value === 'vertical' ? 'vertical' : 'horizontal';
    this._orientation = next;
    this.rovingCache = undefined;
    if (next !== previous || value !== next) this.requestUpdate('orientation', previous);
  }
  /** Lets pointer and Ctrl/Cmd+arrow gestures move nodes, emitting `lr-node-move`. */
  @property({ type: Boolean, attribute: 'nodes-draggable' }) nodesDraggable = false;
  /** Lets output-handle drags and the `c` key create connections, emitting `lr-connect`. */
  @property({ type: Boolean }) connectable = false;
  /** Accepts `lr-node-palette` drops, emitting `lr-node-add`. */
  @property({ type: Boolean }) droppable = false;
  /** Freezes pan/zoom/edit gestures and viewport-mutating methods. Enabling it live cancels and
   * rolls back every active gesture before retiring its global listeners. */
  @property({ type: Boolean, reflect: true }) readonly = false;

  private _selectedNodeIds: readonly string[] = Object.freeze([]);
  /** The last-assigned candidate ids, syntactically sanitized (capped/deduped/nonblank) but not
   *  yet filtered against `nodes` -- kept separately so a selection assigned before its
   *  referenced nodes exist can still resolve once `nodes` catches up, instead of being
   *  permanently discarded by a filter that ran against the stale (still-empty) node set. */
  private _requestedSelectedNodeIds: readonly string[] = Object.freeze([]);
  private selectedNodeIdsSource?: readonly string[];
  /** Frozen, unique snapshot of at most the first 10,000 valid nonblank node ids. */
  @property({ attribute: false })
  get selectedNodeIds(): readonly string[] {
    return this._selectedNodeIds;
  }
  set selectedNodeIds(value: readonly string[]) {
    if (value === this.selectedNodeIdsSource || value === this._selectedNodeIds) return;
    const previous = this._selectedNodeIds;
    this.selectedNodeIdsSource = value;
    this._requestedSelectedNodeIds = this.sanitizeSelectionCandidates(value);
    this._selectedNodeIds = this.sourceMode ? this._requestedSelectedNodeIds : this.snapshotSelectedIds(
      this._requestedSelectedNodeIds,
      new Set(this.modelNodes.map((node) => node.id)),
    );
    this.requestUpdate('selectedNodeIds', previous);
  }

  private _selectedEdgeIds: readonly string[] = Object.freeze([]);
  /** The last-assigned candidate ids, syntactically sanitized but not yet filtered against
   *  `edges` -- see `_requestedSelectedNodeIds`. */
  private _requestedSelectedEdgeIds: readonly string[] = Object.freeze([]);
  private selectedEdgeIdsSource?: readonly string[];
  /** Frozen, unique snapshot of at most the first 10,000 valid nonblank edge ids. */
  @property({ attribute: false })
  get selectedEdgeIds(): readonly string[] {
    return this._selectedEdgeIds;
  }
  set selectedEdgeIds(value: readonly string[]) {
    if (value === this.selectedEdgeIdsSource || value === this._selectedEdgeIds) return;
    const previous = this._selectedEdgeIds;
    this.selectedEdgeIdsSource = value;
    this._requestedSelectedEdgeIds = this.sanitizeSelectionCandidates(value);
    this._selectedEdgeIds = this.sourceMode ? this._requestedSelectedEdgeIds : this.snapshotSelectedIds(
      this._requestedSelectedEdgeIds,
      new Set(this.modelEdges.map((edge) => edge.id)),
    );
    this.requestUpdate('selectedEdgeIds', previous);
  }

  /** Caps, dedupes, and drops non-string/blank candidates. Existence against the current
   *  node/edge set is intentionally NOT applied here -- see `_requestedSelectedNodeIds`. */
  private sanitizeSelectionCandidates(value: unknown): readonly string[] {
    if (!Array.isArray(value)) return Object.freeze([]);
    const selected: string[] = [];
    const seen = new Set<string>();
    for (const candidate of value.slice(0, MAX_FLOW_COLLECTION_ENTRIES)) {
      if (
        typeof candidate !== 'string' ||
        candidate.trim().length === 0 ||
        seen.has(candidate)
      ) continue;
      seen.add(candidate);
      selected.push(candidate);
    }
    return Object.freeze(selected);
  }

  private snapshotSelectedIds(
    value: readonly string[],
    validIds: ReadonlySet<string>,
  ): readonly string[] {
    const selected = value.filter((candidate) => validIds.has(candidate));
    return selected.length === value.length ? value : Object.freeze(selected);
  }
  /** Lowest zoom; invalid values fall back to 0.25 and reversed bounds are sorted. */
  @property({ type: Number, attribute: 'min-zoom' }) minZoom = 0.25;
  /** Highest zoom; invalid values fall back to 2 and reversed bounds are sorted. */
  @property({ type: Number, attribute: 'max-zoom' }) maxZoom = 2;
  /** Snap step, in content px, for drags/nudges/drop positions; `0` disables snapping. Also the
   *  dotted background's base spacing. */
  @property({ type: Number }) grid = 8;
  /** Auto-layout spacing between layers, in content px. */
  @property({ type: Number, attribute: 'layer-gap' }) layerGap = 64;
  /** Auto-layout spacing between siblings in a layer, in content px. */
  @property({ type: Number, attribute: 'node-gap' }) nodeGap = 24;
  private _decorations: FlowRunDecorations | null = null;
  private decorationsSource?: FlowRunDecorations | null;
  /** Deeply snapshotted, frozen run decorations, bounded to 10,000 keys and a finite nested-data
   * budget. Invalid statuses and records with unreadable nested fields are omitted independently,
   * retaining valid neighbors. Assign a new record to update. */
  @property({ attribute: false })
  get decorations(): FlowRunDecorations | null {
    return this._decorations;
  }
  set decorations(value: FlowRunDecorations | null) {
    if (value === this.decorationsSource || value === this._decorations) return;
    const previous = this._decorations;
    this.decorationsSource = value;
    this._decorations = value == null ? null : snapshotFlowDecorations(value);
    this.requestUpdate('decorations', previous);
  }
  /** Accessible name of the canvas region and viewport; defaults to a localized summary. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** `minZoom`/`maxZoom` normalized to finite, positive scale bounds before ever reaching
   *  `clampZoom()`'s `Math.min`/`Math.max` — an invalid attribute value would otherwise poison
   *  every zoom/pan computation (`viewport.zoom`, the world layer's `scale(...)` transform) with
   *  `NaN`, which the browser silently drops as invalid CSS rather than surfacing as an error. */
  private get safeMinZoom(): number {
    return finiteRange(this.minZoom, 0.25, 0.001, 1000);
  }
  private get safeMaxZoom(): number {
    return finiteRange(this.maxZoom, 2, 0.001, 1000);
  }

  private get effectiveZoomBounds(): { min: number; max: number } {
    return {
      min: Math.min(this.safeMinZoom, this.safeMaxZoom),
      max: Math.max(this.safeMinZoom, this.safeMaxZoom),
    };
  }

  /** `grid` normalized to a finite, non-negative snap increment — `0` still means "no snapping"
   *  (see `snap()`), but a negative/non-finite value can no longer reach the `value / this.grid`
   *  division in `snap()`/`nudgeNode()`, nor the `--lr-flow-canvas-grid-size` custom property. */
  private get safeGrid(): number {
    return finiteRange(this.grid, 8, 0);
  }

  /** `layerGap`/`nodeGap` normalized to finite, non-negative pixel gaps before reaching
   *  `layeredLayout()`'s `gapY`/`gapX` — an invalid value would otherwise flow into every
   *  auto-laid-out node's computed position, producing a `NaN` `translate(...)` that silently
   *  renders the card nowhere instead of at a real position. */
  private get safeLayerGap(): number {
    return finiteRange(this.layerGap, 64, 0);
  }
  private get safeNodeGap(): number {
    return finiteRange(this.nodeGap, 24, 0);
  }

  private readonly arrowMarkerIds: Readonly<Record<LyraVariant, string>> = {
    neutral: nextId('flow-canvas-arrow-neutral'),
    brand: nextId('flow-canvas-arrow-brand'),
    success: nextId('flow-canvas-arrow-success'),
    warning: nextId('flow-canvas-arrow-warning'),
    danger: nextId('flow-canvas-arrow-danger'),
  };
  private readonly liveRegionId = nextId('flow-canvas-live');
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private readonly announcer = new Announcer({
    onFlush: (text) => {
      this.mirrorAnnouncement(text);
      this.announcements.announcePolite(text);
    },
  });
  @state() private activeItemIndex = 0;
  @state() private viewportRevision = 0;
  private explicitRefresh = false;
  private renderEpoch = 0;
  private renderResolved?: Map<string, ResolvedFlowNode>;
  private visibleGeometry?: Map<string, ResolvedFlowNode>;
  private visibleViewport = -1;
  private geometryRtl = false;
  private hasUnpositionedNodes = false;
  private readonly nodeModelOrder = new Map<string, number>();
  private readonly edgeModelOrder = new Map<string, number>();
  private nodeViewportIndex?: FlowViewportIndex<FlowNode>;
  private edgeViewportIndex?: FlowViewportIndex<FlowEdge>;
  private baseVisibleNodes: FlowNode[] = [];
  private baseVisibleEdges: FlowEdge[] = [];
  private renderedNodes: FlowNode[] = [];
  private renderedEdges: FlowEdge[] = [];
  private activeControl?: HTMLElement | SVGElement;
  private renderedConnectTargetId?: string;
  private indexItems?: readonly RovingItem[];
  private indexes?: { nodeIndex: Map<string, number>; edgeIndex: Map<string, number> };

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (args[0] === undefined) { this.explicitRefresh = true; if (this._graphSource !== undefined) this.resetFlowSource(); }
    super.requestUpdate(...args);
  }

  @state() private connecting = false;
  @state() private layoutTruncated = false;
  private hasConnectedLayoutBaseline = false;
  private layoutLimitAnnouncementPending = false;
  @state() private keyboardConnectSourceId: string | null = null;
  @state() private keyboardConnectTargetIndex = 0;

  /** Auto-layout-assigned positions for nodes lacking an explicit `position`. Empty until the first
   *  layout pass runs; `nodePosition()` reads from it. */
  private autoPositions = new Map<string, { x: number; y: number }>();
  /** Per-node measured wrapper size (`ResizeObserver`-driven) — plain map, not reactive state, read
   *  by every geometry helper below. */
  private measuredSizes = new Map<string, { width: number; height: number }>();
  private readonly nodeWrappers = new Map<string, HTMLElement>();
  private readonly edgeWrappers = new Map<string, SVGElement>();
  private readonly fallbackSizes = new Map<Element, { width: number; height: number }>();
  private fallbackPassDepth = 0;
  private withFallbackSizes<T>(read: () => T): T {
    this.fallbackPassDepth++;
    try { return read(); }
    finally { if (--this.fallbackPassDepth === 0) this.fallbackSizes.clear(); }
  }
  private indexedNodes?: readonly FlowNode[];
  private indexedEdges?: readonly FlowEdge[];
  private readonly nodesById = new Map<string, FlowNode>();
  private readonly edgesById = new Map<string, FlowEdge>();
  private readonly outgoingTargets = new Map<string, Set<string>>();
  private connectTargets?: { source: string; nodes: readonly FlowNode[]; edges: readonly FlowEdge[]; targets: FlowNode[] };
  private fallbackEdges: FlowEdge[] = [];

  private ensureModelIndexes(): void {
    const changed = this.indexedNodes !== this.modelNodes || this.indexedEdges !== this.modelEdges;
    if (this.indexedNodes !== this.modelNodes) {
      this.indexedNodes = this.modelNodes; this.nodesById.clear();
      this.nodeModelOrder.clear();
      this.modelNodes.forEach((node, index) => this.nodeModelOrder.set(node.id, index));
      this.hasUnpositionedNodes = this.modelNodes.some(node => !node.position);
      for (const node of this.modelNodes) if (!this.nodesById.has(node.id)) this.nodesById.set(node.id, node);
    }
    if (this.indexedEdges !== this.modelEdges) {
      this.indexedEdges = this.modelEdges; this.edgesById.clear(); this.outgoingTargets.clear();
      this.edgeModelOrder.clear();
      this.modelEdges.forEach((edge, index) => this.edgeModelOrder.set(edge.id, index));
      this.rebuildIncidentEdgesIndex();
      for (const edge of this.modelEdges) {
        if (!this.edgesById.has(edge.id)) this.edgesById.set(edge.id, edge);
        let targets = this.outgoingTargets.get(edge.source);
        if (!targets) this.outgoingTargets.set(edge.source, targets = new Set());
        targets.add(edge.target);
      }
    }
    if (changed) this.fallbackEdges = this.modelEdges.filter(edge => !this.nodesById.has(edge.source) || !this.nodesById.has(edge.target));
  }

  private bindNodeWrapper(id: string, element: Element | undefined): void {
    const previous = this.nodeWrappers.get(id);
    if (previous && previous !== element) {
      this.resizeObserver?.unobserve(previous); this.observedNodeEls.delete(previous);
      this.nodeWrappers.delete(id); this.fallbackSizes.delete(previous);
    }
    if (element) {
      this.nodeWrappers.set(id, element as HTMLElement);
      if (!this.observedNodeEls.has(element)) {
        this.resizeObserver?.observe(element); this.observedNodeEls.add(element);
      }
    }
  }


  private resizeObserver?: ResizeObserver;
  private readonly observedNodeEls = new Set<Element>();
  private authoredCardObserver?: MutationObserver;
  private authoredCardObserverDocument?: Document;
  private authoredCardObserverGeneration = 0;
  private authoredCardSyncQueued = false;
  private readonly authoredCardSlotLeases = new Map<Element, AuthoredCardSlotLease>();
  private layoutRaf: OwnedAnimationFrame | null = null;
  private geometryRaf: OwnedAnimationFrame | null = null;
  private connectedWindow?: Window;

  private panX = 0;
  private panY = 0;
  private zoomLevel = 1;
  private viewportEl?: HTMLElement;
  private worldEl?: HTMLElement;
  private viewportChangeRaf: OwnedAnimationFrame | null = null;
  private hasFitOnce = false;
  private rovingCache?: readonly RovingItem[];
  private companionStructure?: Pick<FlowStructureSnapshot, 'nodes' | 'edges'>;
  private wheelMeasure: { rect: DOMRect; rtl: boolean } | null = null;
  private wheelMeasureRaf: OwnedAnimationFrame | null = null;
  private panDrag?: {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    rtlFlip: number;
  };

  private nodeDrag?: {
    pointerId: number;
    nodeId: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    currentX?: number;
    currentY?: number;
    wrapper: HTMLElement;
    rtlFlip: number;
  };
  private nodeIncidentEdges = new Map<string, string[]>();
  /** Per-drag snapshot of the dragged node's incident edges -- edge/node records and shadow-DOM
   *  element refs resolved once at drag start, so the per-pointermove path rewrite does no
   *  per-edge array scans or shadow-root-wide `querySelector` calls. */
  private dragEdgeRefs?: DragEdgeRef[];

  private connectState?: {
    sourceId: string;
    sourceHandle: string;
    startPt: { x: number; y: number };
    /** Viewport rect and RTL resolution measured once at gesture start -- `getBoundingClientRect`
     *  and `getComputedStyle` per pointermove would force layout on every move. */
    rect: DOMRect | null;
    rtl: boolean;
  };
  private connectionLineEl?: SVGPathElement;
  private connectInvalidNodeId: string | null = null;

  private companionCallbacks = new Set<(snapshot: FlowStructureSnapshot) => void>();
  private companionRaf: OwnedAnimationFrame | null = null;
  private stopMotionWatch?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.stopMotionWatch = observeReducedMotion(this, () => this.sourceMode ? this.requestUpdate('motion', false) : this.requestUpdate());
    const ownerWindow = this.ownerDocument.defaultView;
    this.connectedWindow = ownerWindow ?? undefined;
    if (ownerWindow) this.announcer.setTimerHost(ownerWindow);
    const ResizeObserverCtor = ownerWindow?.ResizeObserver;
    this.resizeObserver = ResizeObserverCtor
      ? new ResizeObserverCtor((entries) => this.onNodesResized(entries))
      : undefined;
    this.bindAuthoredCardObserver();
    this.syncAuthoredCards();
    this.pushCardPropsAll();
    this.scheduleCompanionNotify();
    // updated() only runs on renders -- a disconnect/reconnect (e.g. a reparenting move) that
    // changes no reactive property never triggers one, which would leave every already-rendered
    // wrapper unwatched by the freshly created observer above, so re-observe directly here.
    if (this.hasUpdated) {
      this.observeNodeWrappers();
      if (this.viewportEl) this.resizeObserver?.observe(this.viewportEl);
      if (this.modelNodes.length > 0) this.scheduleLayoutPass();
    }
  }

  override disconnectedCallback(): void {
    if (this.sourceMode) this.resetFlowSource();
    super.disconnectedCallback();
    this.stopMotionWatch?.();
    this.stopMotionWatch = undefined;
    this.resetAuthoredCardObserver();
    this.restoreAuthoredCardSlots();
    this.hasConnectedLayoutBaseline = false;
    this.layoutLimitAnnouncementPending = false;
    this.announcer.cancel();
    this.mirrorAnnouncement('');
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.observedNodeEls.clear();
    if (this.geometryRaf != null) {
      this.cancelOwnerAnimationFrame(this.geometryRaf);
      this.geometryRaf = null;
    }
    if (this.layoutRaf != null) {
      this.cancelOwnerAnimationFrame(this.layoutRaf);
      this.layoutRaf = null;
    }
    if (this.companionRaf != null) {
      this.cancelOwnerAnimationFrame(this.companionRaf);
      this.companionRaf = null;
    }
    if (this.viewportChangeRaf != null) {
      this.cancelOwnerAnimationFrame(this.viewportChangeRaf);
      this.viewportChangeRaf = null;
    }
    if (this.wheelMeasureRaf != null) {
      this.cancelOwnerAnimationFrame(this.wheelMeasureRaf);
      this.wheelMeasureRaf = null;
      this.wheelMeasure = null;
    }
    // An in-flight pan/node-drag/connect gesture holds window-level listeners; if the element is
    // removed mid-gesture nothing else ever detaches them, and a later unrelated pointerup would
    // fire against a detached tree with stale gesture state.
    this.panDrag = undefined;
    this.connectedWindow?.removeEventListener('pointermove', this.onBackgroundPointerMove);
    this.connectedWindow?.removeEventListener('pointerup', this.onBackgroundPointerUp);
    this.connectedWindow?.removeEventListener('pointercancel', this.onBackgroundPointerUp);
    this.connectedWindow?.removeEventListener('lostpointercapture', this.onBackgroundPointerUp);
    this.nodeDrag = undefined;
    this.dragEdgeRefs = undefined;
    this.connectedWindow?.removeEventListener('pointermove', this.onNodePointerMove);
    this.connectedWindow?.removeEventListener('pointerup', this.onNodePointerUp);
    this.connectedWindow?.removeEventListener('pointercancel', this.onNodePointerUp);
    this.connectedWindow?.removeEventListener('lostpointercapture', this.onNodePointerUp);
    this.connectState = undefined;
    this.connecting = false;
    this.connectInvalidNodeId = null;
    this.keyboardConnectSourceId = null;
    this.keyboardConnectTargetIndex = 0;
    this.connectedWindow?.removeEventListener('pointermove', this.onConnectPointerMove);
    this.connectedWindow?.removeEventListener('pointerup', this.onConnectPointerUp);
    this.connectedWindow?.removeEventListener('pointercancel', this.onConnectPointerCancel);
    this.connectedWindow?.removeEventListener('lostpointercapture', this.onConnectPointerCancel);
    this.connectedWindow = undefined;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    if (this.sourceMode) this.resetFlowSource();
    this.announcements.adopted();
    this.resetAuthoredCardObserver();
    this.restoreAuthoredCardSlots();
    this.hasConnectedLayoutBaseline = false;
    this.layoutLimitAnnouncementPending = false;
    const ownerWindow = this.ownerDocument.defaultView;
    if (ownerWindow) this.announcer.setTimerHost(ownerWindow);
    if (this.isConnected) {
      this.bindAuthoredCardObserver();
      this.scheduleAuthoredCardReconciliation();
      if (this.modelNodes.length > 0) this.scheduleLayoutPass();
    }
  }

  private requestOwnerAnimationFrame(callback: FrameRequestCallback): OwnedAnimationFrame | null {
    const owner = this.ownerDocument.defaultView;
    if (!owner) return null;
    return { owner, handle: owner.requestAnimationFrame(callback) };
  }

  private cancelOwnerAnimationFrame(frame: OwnedAnimationFrame): void {
    frame.owner.cancelAnimationFrame(frame.handle);
  }

  private mirrorAnnouncement(text: string): void {
    (this.renderRoot as ParentNode | undefined)?.querySelector('[part="live-region"]')?.replaceChildren(text);
  }

  private resetAuthoredCardObserver(): void {
    this.authoredCardObserverGeneration += 1;
    this.authoredCardObserver?.disconnect();
    this.authoredCardObserver = undefined;
    this.authoredCardObserverDocument = undefined;
    this.authoredCardSyncQueued = false;
  }

  /** Direct-child insertion/removal and direct `node-id` changes are the only light-DOM changes
   * that can alter card ownership. The observer is constructed from the element's owner realm so
   * adoption does not retain an old document's callback. */
  private bindAuthoredCardObserver(): void {
    const ownerDocument = this.ownerDocument;
    if (
      !this.isConnected ||
      (this.authoredCardObserver && this.authoredCardObserverDocument === ownerDocument)
    ) {
      return;
    }
    this.resetAuthoredCardObserver();
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    const generation = this.authoredCardObserverGeneration;
    const observer = new MutationObserverCtor((records) => {
      if (
        this.authoredCardObserver !== observer ||
        this.authoredCardObserverDocument !== ownerDocument ||
        this.authoredCardObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      const directlyRelevant = records.some((record) =>
        record.type === 'childList'
          ? record.target === this
          : record.type === 'attributes' &&
            record.attributeName === 'node-id' &&
            record.target.parentNode === this,
      );
      if (directlyRelevant) this.scheduleAuthoredCardReconciliation();
    });
    observer.observe(this, {
      childList: true,
      attributes: true,
      attributeFilter: ['node-id'],
      subtree: true,
    });
    this.authoredCardObserver = observer;
    this.authoredCardObserverDocument = ownerDocument;
  }

  private scheduleAuthoredCardReconciliation(): void {
    const generation = this.authoredCardObserverGeneration;
    const ownerDocument = this.authoredCardObserverDocument ?? this.ownerDocument;
    if (!this.isConnected || this.authoredCardSyncQueued) return;
    this.authoredCardSyncQueued = true;
    queueMicrotask(() => {
      if (
        this.authoredCardObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.authoredCardSyncQueued = false;
      this.syncAuthoredCards();
      this.pushCardPropsAll();
    });
  }

  /** Observes every node wrapper not yet tracked by the current `ResizeObserver` instance. The
   *  tracking set is cleared alongside the observer itself in `disconnectedCallback()`, so a
   *  reconnect re-observes each wrapper with the freshly created observer instead of treating it
   *  as already watched. */
  private observeNodeWrappers(): void {
    for (const el of this.nodeWrappers.values()) {
      if (!this.observedNodeEls.has(el)) {
        this.observedNodeEls.add(el);
        this.resizeObserver?.observe(el);
      }
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.syncFlowSource();
    if (this.hasUpdated && ((changed.has('nodes') && this.nodesInputTruncated) ||
      (changed.has('edges') && this.edgesInputTruncated)))
      this.announcements.announcePolite(this.localize('flowCanvasInputLimit'));
    this.ensureModelIndexes();
    const transient = !this.explicitRefresh && [...changed.keys()].every(key =>
      ['activeItemIndex', 'viewportRevision', 'connecting', 'keyboardConnectSourceId', 'keyboardConnectTargetIndex'].includes(String(key)));
    const geometryStable = !this.explicitRefresh && [...changed.keys()].every(key =>
      ['activeItemIndex', 'viewportRevision', 'connecting', 'keyboardConnectSourceId', 'keyboardConnectTargetIndex',
        'selectedNodeIds', 'selectedEdgeIds', 'decorations', 'minZoom', 'maxZoom', 'readonly'].includes(String(key)));
    if (!geometryStable) {
      this.fallbackSizes.clear(); this.renderResolved = undefined;
      this.rovingCache = undefined;
    }
    if (!transient) this.companionStructure = undefined;
    const templateStable = !this.explicitRefresh && [...changed.keys()].every(key =>
      ['activeItemIndex', 'viewportRevision', 'connecting', 'keyboardConnectSourceId', 'keyboardConnectTargetIndex',
        'selectedNodeIds', 'selectedEdgeIds', 'decorations'].includes(String(key)));
    if (!templateStable) this.renderEpoch++;
    this.explicitRefresh = false;
    if (changed.has('nodes') || changed.has('graphSource') || changed.has('sourceState')) {
      this.cancelModelBoundGestures();
      this.pruneNodeCaches();
      this.syncAuthoredCards();
      const nodeIds = new Set(this.modelNodes.map((node) => node.id));
      this._selectedNodeIds = this.sourceMode ? this._requestedSelectedNodeIds : this.snapshotSelectedIds(this._requestedSelectedNodeIds, nodeIds);
    }
    if (changed.has('edges')) {
      this.cancelModelBoundGestures();
      const edgeIds = new Set(this.modelEdges.map((edge) => edge.id));
      this._selectedEdgeIds = this.sourceMode ? this._requestedSelectedEdgeIds : this.snapshotSelectedIds(this._requestedSelectedEdgeIds, edgeIds);
    }
    if (
      (changed.has('readonly') && this.readonly) ||
      changed.has('orientation')
    ) {
      this.cancelActiveGestures();
    }
    if (changed.has('nodesDraggable') && !this.nodesDraggable) this.endNodeDrag(false);
    if (changed.has('connectable') && !this.connectable) {
      this.onConnectPointerCancel();
      this.keyboardConnectSourceId = null;
      this.keyboardConnectTargetIndex = 0;
    }
    if (changed.has('droppable') && !this.droppable) {
      this.viewportEl?.removeAttribute('data-drop-active');
    }
    if (changed.has('grid')) this.endNodeDrag(false);
    if (
      changed.has('nodes') ||
      changed.has('edges') ||
      changed.has('orientation') ||
      changed.has('layerGap') ||
      changed.has('nodeGap')
    ) {
      for (const node of this.modelNodes) {
        if (!node.position) this.autoPositions.delete(node.id);
      }
    }
    if (
      changed.has('nodes') ||
      changed.has('selectedNodeIds') ||
      changed.has('decorations') ||
      changed.has('orientation')
    ) {
      this.pushCardPropsAll(changed);
    }
  }

  private pruneNodeCaches(): void {
    const nodeIds = new Set(this.modelNodes.map((node) => node.id));
    for (const id of this.autoPositions.keys()) {
      if (!nodeIds.has(id)) this.autoPositions.delete(id);
    }
    for (const id of this.measuredSizes.keys()) {
      if (!nodeIds.has(id)) this.measuredSizes.delete(id);
    }
    for (const element of this.observedNodeEls) {
      const id = (element as HTMLElement).dataset['nodeId'];
      if (id && nodeIds.has(id)) continue;
      this.resizeObserver?.unobserve(element);
      this.observedNodeEls.delete(element);
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const item = this.rovingItems()[this.normalizedItemIndex()];
    const next = item?.kind === 'node'
      ? this.nodeWrappers.get(item.id)?.querySelector<HTMLElement>('[part="node-control"]')
      : item ? this.edgeWrappers.get(item.id)?.querySelector<SVGElement>('[part="edge"]') : undefined;
    if (this.activeControl !== next) this.activeControl?.setAttribute('tabindex', '-1');
    next?.setAttribute('tabindex', '0'); this.activeControl = next ?? undefined;
    if (changed.has('layoutTruncated') && this.layoutLimitAnnouncementPending) {
      this.layoutLimitAnnouncementPending = false;
      if (this.isConnected && this.layoutTruncated) {
        this.announcer.announce(this.localize('flowCanvasLayoutLimit'));
      }
    }
    this.observeNodeWrappers();
    if (
      changed.has('nodes') ||
      changed.has('edges') ||
      changed.has('orientation') ||
      changed.has('layerGap') ||
      changed.has('nodeGap')
    ) {
      this.scheduleLayoutPass();
    }
    if (
      changed.has('nodes') ||
      changed.has('edges') ||
      changed.has('decorations') ||
      changed.has('minZoom') ||
      changed.has('maxZoom') ||
      changed.has('readonly') ||
      changed.has('orientation') ||
      changed.has('layerGap') ||
      changed.has('nodeGap')
    ) {
      this.scheduleCompanionNotify();
    }
    const viewportEl = this.renderRoot.querySelector('[part="viewport"]') as HTMLElement | null;
    if (viewportEl && viewportEl !== this.viewportEl) {
      this.viewportEl = viewportEl;
      this.resizeObserver?.observe(viewportEl);
      this.worldEl = this.renderRoot.querySelector('.world') as HTMLElement | undefined;
      viewportEl.addEventListener('wheel', this.onWheel, { passive: false });
      viewportEl.addEventListener('keydown', this.onViewportKeyDown);
      viewportEl.addEventListener('dragover', this.onViewportDragOver);
      viewportEl.addEventListener('dragleave', this.onViewportDragLeave);
      viewportEl.addEventListener('drop', this.onViewportDrop);
      this.applyWorldTransform(false);
      this.scheduleGeometryRefresh();
    }
    if (this.sourceMode) { void this.requestSourceScene(); this.requestSourceOverview(); }
  }

  // ---------------------------------------------------------------------
  // Card adoption / prop-push
  // ---------------------------------------------------------------------

  /** Reconciles only consumer-authored direct children. Default cards remain declarative named-slot
   * fallback content in `renderNodes()`, so SSR and hydration never synthesize or remove light-DOM
   * cards. A lease restores the last author-owned slot only if the canvas still owns its last
   * assignment; a later author write always wins. */
  private syncAuthoredCards(): void {
    const ids = new Set(this.modelNodes.map((node) => node.id));
    const adopted = new Set<Element>();
    for (const child of Array.from(this.children)) {
      const nodeId = child.getAttribute('node-id');
      if (nodeId && ids.has(nodeId)) {
        this.leaseAuthoredCardSlot(child, nodeId);
        adopted.add(child);
        continue;
      }
      this.releaseAuthoredCardSlot(child);
      if (nodeId) {
        devWarnOnce(
          UNMATCHED_AUTHORED_CARD_WARNING,
          '<lr-flow-canvas> has a direct child with a node-id that matches no node; it will not render.',
        );
      }
    }
    for (const child of [...this.authoredCardSlotLeases.keys()]) {
      if (!adopted.has(child)) this.releaseAuthoredCardSlot(child);
    }
  }

  private leaseAuthoredCardSlot(child: Element, nodeId: string): void {
    let lease = this.authoredCardSlotLeases.get(child);
    if (!lease) {
      const slot = child.getAttribute('slot');
      lease = { authoredSlot: slot, appliedSlot: slot, authorOwnsSlot: false };
      this.authoredCardSlotLeases.set(child, lease);
    }
    if (lease.authorOwnsSlot || child.getAttribute('slot') !== lease.appliedSlot) {
      lease.authorOwnsSlot = true;
      return;
    }
    const slot = `node-${nodeId}`;
    if (child.getAttribute('slot') !== slot) child.setAttribute('slot', slot);
    lease.appliedSlot = child.getAttribute('slot');
  }

  private releaseAuthoredCardSlot(child: Element): void {
    const lease = this.authoredCardSlotLeases.get(child);
    if (!lease) return;
    if (!lease.authorOwnsSlot && child.getAttribute('slot') === lease.appliedSlot) {
      if (lease.authoredSlot === null) child.removeAttribute('slot');
      else child.setAttribute('slot', lease.authoredSlot);
    }
    this.authoredCardSlotLeases.delete(child);
  }

  private restoreAuthoredCardSlots(): void {
    for (const child of [...this.authoredCardSlotLeases.keys()]) {
      this.releaseAuthoredCardSlot(child);
    }
  }

  /** Pushes changed node/selection/decoration state onto every currently leased direct card. A
   * card's property setter is consumer code, so one rejected projection cannot stop later cards. */
  private pushCardPropsAll(changed?: PropertyValues): void {
    const nodesChanged = changed?.has('nodes') ?? true;
    const selectionChanged = nodesChanged || changed?.has('selectedNodeIds') === true;
    const decorationsChanged = nodesChanged || changed?.has('decorations') === true;
    const orientationChanged = nodesChanged || changed?.has('orientation') === true;
    const cardsByNodeId = new Map<string, FlowNodeCardEl>();
    for (const child of Array.from(this.children)) {
      const nodeId = child.getAttribute('node-id');
      if (nodeId && this.authoredCardSlotLeases.has(child)) {
        cardsByNodeId.set(nodeId, child as FlowNodeCardEl);
      }
    }
    const selectedNodeIds = selectionChanged ? new Set(this.selectedNodeIds) : null;

    for (const node of this.modelNodes) {
      const card = cardsByNodeId.get(node.id);
      if (!card) continue;
      if (nodesChanged) {
        this.setCardProperty(card, 'inputs', node.inputs ?? DEFAULT_FLOW_INPUTS);
        this.setCardProperty(card, 'outputs', node.outputs ?? DEFAULT_FLOW_OUTPUTS);
        this.setCardProperty(card, 'flowType', node.type ?? '');
      }
      if (orientationChanged) this.setCardProperty(card, 'orientation', this.orientation);
      if (selectedNodeIds) this.setCardProperty(card, 'selected', selectedNodeIds.has(node.id));
      if (decorationsChanged) {
        const decoration = this.decorations?.[node.id];
        this.setCardProperty(card, 'status', decoration?.status ?? null);
        this.setCardProperty(card, 'progress', decoration?.progress ?? null);
        this.setCardProperty(card, 'statusDetail', decoration?.detail ?? '');
        this.setCardProperty(card, 'durationMs', decoration?.durationMs ?? null);
      }
    }
  }

  private setCardProperty(
    card: FlowNodeCardEl,
    property:
      | 'inputs'
      | 'outputs'
      | 'flowType'
      | 'orientation'
      | 'selected'
      | 'status'
      | 'progress'
      | 'statusDetail'
      | 'durationMs',
    value: unknown,
  ): void {
    try {
      (card as unknown as Record<string, unknown>)[property] = value;
    } catch {
      // A consumer card can reject one optional projection without interrupting its siblings.
    }
  }

  // ---------------------------------------------------------------------
  // Geometry helpers
  // ---------------------------------------------------------------------

  private nodePosition(node: FlowNode): { x: number; y: number } {
    const position = node.position ?? this.autoPositions.get(node.id) ?? { x: 0, y: 0 };
    return { x: finiteNumber(position.x, 0), y: finiteNumber(position.y, 0) };
  }

  private nodeSize(id: string): { width: number; height: number } {
    const measured = this.measuredSizes.get(id);
    if (measured) return measured;
    const ownerWindow = this.ownerDocument?.defaultView;
    const host = this.renderedNodeById(id) ?? this;
    const cached = this.fallbackPassDepth ? this.fallbackSizes.get(host) : undefined;
    if (cached) return cached;
    const computed = ownerWindow?.getComputedStyle(host);
    const customWidth = resolveCssTokenLength(
      computed?.getPropertyValue('--lr-flow-canvas-node-fallback-inline-size').trim(),
      { host },
    );
    const customHeight = resolveCssTokenLength(
      computed?.getPropertyValue('--lr-flow-canvas-node-fallback-block-size').trim(),
      { host },
    );
    // Resolve live rem/em values once per fallback host in this geometry pass. There is no fixed `* 16` assumption:
    // a custom root font size or an em-based consumer override participates before ResizeObserver
    // is available, while ownerless SSR uses zero geometry (there is no layout viewport to fit).
    const width =
      customWidth ??
      (resolveCssTokenLength(
        computed?.getPropertyValue('--lr-size-10rem').trim() || '10rem',
        { host },
      ) ?? 0) +
        (resolveCssTokenLength(
          computed?.getPropertyValue('--lr-size-1rem').trim() || '1rem',
          { host },
        ) ?? 0);
    const height =
      customHeight ??
      resolveCssTokenLength(
        computed?.getPropertyValue('--lr-size-4rem').trim() || '4rem',
        { host },
      ) ??
      0;
    const size = { width, height };
    if (this.fallbackPassDepth) this.fallbackSizes.set(host, size);
    return size;
  }

  private resolvedNode(node: FlowNode): ResolvedFlowNode {
    const pos = this.nodePosition(node);
    const size = this.nodeSize(node.id);
    return { node, x: pos.x, y: pos.y, width: size.width, height: size.height };
  }

  /** Evenly distributes `count` handles along a `span`-px edge (index 0-based) — matches
   *  `justify-content: space-around` so `lr-flow-node`'s handle-column CSS lines up with this
   *  exactly. */
  private handleOffset(count: number, index: number, span: number): number {
    return count <= 1 ? span / 2 : (span * (index + 0.5)) / count;
  }

  private handlePoint(
    resolved: ResolvedFlowNode,
    kind: 'input' | 'output',
    handleId: string,
  ): { x: number; y: number } {
    const handles = kind === 'input' ? (resolved.node.inputs ?? DEFAULT_FLOW_INPUTS) : (resolved.node.outputs ?? DEFAULT_FLOW_OUTPUTS);
    const index = handles.findIndex((h) => h.id === handleId);
    const horizontal = this.orientation === 'horizontal';
    const edgeSpan = horizontal ? resolved.height : resolved.width;
    const offset = index >= 0 ? this.handleOffset(handles.length, index, edgeSpan) : edgeSpan / 2;
    if (horizontal) {
      const x = kind === 'input' ? resolved.x : resolved.x + resolved.width;
      return { x, y: resolved.y + offset };
    }
    const y = kind === 'input' ? resolved.y : resolved.y + resolved.height;
    return { x: resolved.x + offset, y };
  }

  private edgePathD(sourcePt: { x: number; y: number }, targetPt: { x: number; y: number }): string {
    const dx = targetPt.x - sourcePt.x;
    const dy = targetPt.y - sourcePt.y;
    const distance = Math.hypot(dx, dy);
    const offset = Math.min(CONNECT_OFFSET_MAX, Math.max(CONNECT_OFFSET_MIN, distance / 2));
    const horizontal = this.orientation === 'horizontal';
    const c1x = sourcePt.x + (horizontal ? offset : 0);
    const c1y = sourcePt.y + (horizontal ? 0 : offset);
    const c2x = targetPt.x - (horizontal ? offset : 0);
    const c2y = targetPt.y - (horizontal ? 0 : offset);
    return `M ${sourcePt.x} ${sourcePt.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${targetPt.x} ${targetPt.y}`;
  }

  private nodeAccessibleText(node: FlowNode): string {
    if (node.accessibleLabel) return node.accessibleLabel;
    const label = typeof node.data?.['label'] === 'string' ? node.data['label'] : node.id;
    return this.localize('flowNode', undefined, { label });
  }

  private edgeAccessibleText(edge: FlowEdge): string {
    this.ensureModelIndexes();
    const sourceNode = this.nodesById.get(edge.source);
    const targetNode = this.nodesById.get(edge.target);
    const source = sourceNode ? this.nodeAccessibleText(sourceNode) : edge.source;
    const target = targetNode ? this.nodeAccessibleText(targetNode) : edge.target;
    return edge.label
      ? this.localize('flowEdgeWithLabel', undefined, { label: edge.label, source, target })
      : this.localize('flowEdge', undefined, { source, target });
  }

  // ---------------------------------------------------------------------
  // Auto-layout
  // ---------------------------------------------------------------------

  private onNodesResized(entries: ResizeObserverEntry[]): void {
    const changedIds: string[] = [];
    if (!this.sourceMode && !this.hasFitOnce && this.viewportEl?.clientWidth && this.viewportEl.clientHeight)
      this.scheduleLayoutPass();
    for (const entry of entries) {
      if (entry.target === this.viewportEl) {
        if (this.sourceMode) void this.requestSourceScene();
        this.scheduleGeometryRefresh();
        this.scheduleCompanionNotify(false);
        continue;
      }
      if ((entry.target as HTMLElement).checkVisibility?.({ contentVisibilityAuto: true }) === false) continue;
      const id = (entry.target as HTMLElement).dataset['nodeId'];
      if (!id) continue;
      const box = entry.borderBoxSize?.[0];
      const width = box ? box.inlineSize : entry.contentRect.width;
      const height = box ? box.blockSize : entry.contentRect.height;
      const prev = this.measuredSizes.get(id);
      if (!prev || prev.width !== width || prev.height !== height) {
        this.measuredSizes.set(id, { width, height });
        (entry.target as HTMLElement).style.containIntrinsicSize = `auto ${width}px auto ${height}px`;
        changedIds.push(id);
      }
    }
    if (changedIds.length > 0) {
      if (!this.hasUnpositionedNodes && this.renderResolved && this.nodeViewportIndex && this.edgeViewportIndex) {
        const edges = new Set<string>();
        for (const id of changedIds) {
          const node = this.nodesById.get(id);
          if (!node) continue;
          const resolved = this.resolvedNode(node);
          this.renderResolved.set(id, resolved);
          this.nodeViewportIndex.update(node, this.nodeViewportBounds(resolved));
          for (const edge of this.nodeIncidentEdges.get(id) ?? []) edges.add(edge);
        }
        for (const id of edges) {
          const edge = this.edgesById.get(id);
          const bounds = edge && this.edgeViewportBounds(edge, this.renderResolved);
          if (edge && bounds) this.edgeViewportIndex.update(edge, bounds);
        }
        this.scheduleGeometryRefresh();
      } else this.scheduleLayoutPass();
      this.scheduleCompanionNotify();
    }
  }

  private scheduleGeometryRefresh(): void {
    if (!this.isConnected || this.geometryRaf != null) return;
    this.geometryRaf = this.requestOwnerAnimationFrame(() => {
      this.geometryRaf = null;
      if (this.isConnected) this.viewportRevision++;
    });
  }

  /** Captures rendered wrapper boxes before the first layout request. This is also the no-
   * ResizeObserver path, so a controlled host never receives a preliminary 16px-assumed layout. */
  private measureNodeWrappers(): void {
    const wrappers = [...this.nodeWrappers.values()];
    const visibility = wrappers.map(wrapper => wrapper.style.contentVisibility);
    for (const wrapper of wrappers) wrapper.style.contentVisibility = 'visible';
    try {
      for (const wrapper of wrappers) {
        const id = wrapper.dataset['nodeId'];
        if (!id) continue;
        const rect = wrapper.getBoundingClientRect();
        const width = wrapper.offsetWidth || rect.width / Math.max(this.zoomLevel, Number.EPSILON);
        const height = wrapper.offsetHeight || rect.height / Math.max(this.zoomLevel, Number.EPSILON);
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
          this.measuredSizes.set(id, { width, height });
          wrapper.style.containIntrinsicSize = `auto ${width}px auto ${height}px`;
        }
      }
    } finally { wrappers.forEach((wrapper, index) => { wrapper.style.contentVisibility = visibility[index]!; }); }
  }

  private scheduleLayoutPass(): void {
    if (this.sourceMode) { this.scheduleGeometryRefresh(); return; }
    if (!this.isConnected || this.layoutRaf != null) return;
    this.layoutRaf = this.requestOwnerAnimationFrame(() => {
      this.layoutRaf = null;
      if (!this.isConnected) return;
      this.measureNodeWrappers();
      this.runAutoLayoutIfNeeded();
      this.requestUpdate();
      if (!this.hasFitOnce) this.hasFitOnce = this.applyFit();
    });
  }

  /** The first completed connected layout establishes the live-region baseline. A visible limit
   * notice and `lr-layout-change` still report that result; only subsequent false-to-true changes
   * are announcements. */
  private setLayoutTruncated(truncated: boolean): void {
    const previous = this.layoutTruncated;
    this.layoutTruncated = truncated;
    if (!truncated) this.layoutLimitAnnouncementPending = false;
    if (!this.isConnected || this.modelNodes.length === 0) return;
    if (!this.hasConnectedLayoutBaseline) {
      this.hasConnectedLayoutBaseline = true;
      return;
    }
    if (!previous && truncated) this.layoutLimitAnnouncementPending = true;
  }

  /** Lays out every node currently missing an explicit `position`, leaving explicitly-positioned
   *  nodes exactly as given (routed through as `fixedPositions` so the shared util lays out around
   *  them). A no-op when every node already has a `position`.
   *
   *  Axis mapping: `../../internal/layered-layout.ts` assigns coordinates top -> bottom (block
   *  axis), left -> right within a layer -- i.e. its `y` is the layer/downstream axis and its `x`
   *  is the in-layer sibling axis. `swap` below reconciles that frame with this canvas's: canvas
   *  `orientation="vertical"` (downstream = y) already matches the util's native frame directly,
   *  so only `orientation="horizontal"` (downstream = x) needs both axes swapped when talking to
   *  the util, and `gapX`/`gapY` are always passed as `nodeGap`/`layerGap` respectively (never
   *  swapped) since those map to the util's own fixed sibling/layer axes regardless of how the
   *  *result* is later remapped into canvas space. The util also returns raw box centers, whereas
   *  this canvas's own `position` convention (see `render()`'s `translate(x,y)` and
   *  `[part='node']`'s `inset-block-start/inline-start: 0`) is a top-left corner -- `nodeSize()`
   *  is used to convert between the two in both directions (`fixedPositions` in, the returned map
   *  out). Negative or larger-than-safe-integer centers stay caller-controlled/rendered but are
   *  omitted from the bounded layout utility's fixed-anchor input. */
  private runAutoLayoutIfNeeded(): void {
    return this.withFallbackSizes(() => {
    if (this.sourceMode) return;
    this.fallbackSizes.clear();
    const unpositioned = this.modelNodes.filter((n) => !n.position);
    if (unpositioned.length === 0) {
      this.setLayoutTruncated(false);
      return;
    }
    const swap = this.orientation === 'horizontal';
    const graphNodes = this.modelNodes.map((n) => {
      const size = this.nodeSize(n.id);
      return { id: n.id, width: swap ? size.height : size.width, height: swap ? size.width : size.height };
    });
    const nodeIds = new Set(this.modelNodes.map((n) => n.id));
    const graphEdges = this.modelEdges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));
    const fixedPositions = new Map<string, { x: number; y: number }>();
    for (const n of this.modelNodes) {
      if (!n.position) continue;
      if (n.position.x < 0 || n.position.y < 0) continue;
      const size = this.nodeSize(n.id);
      const center = { x: n.position.x + size.width / 2, y: n.position.y + size.height / 2 };
      if (
        !Number.isSafeInteger(Math.trunc(center.x)) ||
        !Number.isSafeInteger(Math.trunc(center.y))
      ) continue;
      fixedPositions.set(n.id, swap ? { x: center.y, y: center.x } : center);
    }
    const result = layeredLayout({
      nodes: graphNodes,
      edges: graphEdges,
      options: { gapX: this.safeNodeGap, gapY: this.safeLayerGap, fixedPositions },
    });
    const positions: Record<string, { x: number; y: number }> = {};
    for (const n of unpositioned) {
      const raw = result.positions.get(n.id);
      if (!raw) continue;
      const center = swap ? { x: raw.y, y: raw.x } : { x: raw.x, y: raw.y };
      const size = this.nodeSize(n.id);
      const resolved = { x: center.x - size.width / 2, y: center.y - size.height / 2 };
      this.autoPositions.set(n.id, resolved);
      positions[n.id] = Object.freeze(resolved);
    }
    this.rovingCache = undefined;
    this.setLayoutTruncated(result.truncated);
    if (Object.keys(positions).length > 0) {
      this.emit(
        'lr-layout-change',
        Object.freeze({ positions: Object.freeze(positions), truncated: result.truncated }),
      );
    }
    });
  }

  // ---------------------------------------------------------------------
  // Pan / zoom / viewport
  // ---------------------------------------------------------------------

  get viewport(): Readonly<{ x: number; y: number; zoom: number }> {
    return Object.freeze({ x: this.panX, y: this.panY, zoom: this.zoomLevel });
  }
  /**
   * Read-only, derived from the live layout — {@link setViewport} is the mutator. The setter
   * exists and is a documented no-op because this getter's return shape is exactly
   * `setViewport()`'s input shape, which invites `.viewport=${next}` in a Lit template. A
   * getter-only accessor makes that binding throw from inside lit-html's property commit on a
   * *later* render, blaming framework internals rather than the offending line; degrading to a
   * silent ignore is the kinder failure. Mirrors `LyraChart`'s `chartArea`.
   */
  set viewport(_value: Readonly<{ x: number; y: number; zoom: number }>) {
    /* read-only, derived from the live layout; direct writes are silently ignored */
  }

  setViewport(next: { x: number; y: number; zoom: number }): void {
    if (this.readonly) return;
    this.panX = finiteNumber(next.x, this.panX);
    this.panY = finiteNumber(next.y, this.panY);
    this.zoomLevel = this.clampZoom(next.zoom);
    this.applyWorldTransform();
    this.emit(
      'lr-viewport-change',
      Object.freeze({ x: this.panX, y: this.panY, zoom: this.zoomLevel }),
    );
  }

  /** Increase viewport zoom around the canvas center, clamped to the effective zoom bounds. */
  zoomIn(): void {
    if (this.readonly) return;
    this.zoomAtCenter(this.zoomLevel * ZOOM_MULTIPLIER);
  }

  /** Decrease viewport zoom around the canvas center, clamped to the effective zoom bounds. */
  zoomOut(): void {
    if (this.readonly) return;
    this.zoomAtCenter(this.zoomLevel / ZOOM_MULTIPLIER);
  }

  /** Restore zoom to 1 while preserving the current pan coordinates. */
  resetZoom(): void {
    if (this.readonly) return;
    this.setViewport({ x: this.panX, y: this.panY, zoom: 1 });
  }

  fit(options?: { padding?: number }): void {
    if (!this.readonly) this.applyFit(options?.padding);
  }

  /** Frames every node; false while there is nothing to frame or no rendered viewport. */
  private applyFit(requestedPadding = DEFAULT_FIT_PADDING): boolean {
    return this.withFallbackSizes(() => {
    this.fallbackSizes.clear();
    const rect = this.viewportEl?.getBoundingClientRect();
    if ((!this.sourceMode && this.modelNodes.length === 0) || !rect?.width || !rect.height) return false;
    if (this.sourceMode && !this.sourceWorld) return false;
    const padding = finiteRange(requestedPadding, DEFAULT_FIT_PADDING, 0);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of this.modelNodes) {
      const resolved = this.resolvedNode(node);
      minX = Math.min(minX, resolved.x);
      minY = Math.min(minY, resolved.y);
      maxX = Math.max(maxX, resolved.x + resolved.width);
      maxY = Math.max(maxY, resolved.y + resolved.height);
    }
    if (this.sourceMode && this.sourceWorld) { minX = this.sourceWorld.x; minY = this.sourceWorld.y; maxX = minX + this.sourceWorld.width; maxY = minY + this.sourceWorld.height; }
    const viewW = rect.width;
    const viewH = rect.height;
    const transform = fitTransform(
      { minX, minY, maxX, maxY },
      { width: viewW, height: viewH },
      padding,
      this.effectiveZoomBounds,
      { minimumAvailableSize: 0, invalidZoomFallback: 1, centerWithMinimumExtent: true },
    );
    this.panX = transform.x;
    this.panY = transform.y;
    this.zoomLevel = transform.zoom;
    this.applyWorldTransform();
    this.scheduleViewportChange();
    return true;
    });
  }

  focusNode(id: string, options?: { zoom?: number }): void {
    if (this.readonly) return;
    const node = this.modelNodes.find((n) => n.id === id);
    if (!node) return;
    const resolved = this.resolvedNode(node);
    const rect = this.viewportEl?.getBoundingClientRect();
    const viewW = rect?.width ?? 0;
    const viewH = rect?.height ?? 0;
    const zoom = options?.zoom != null ? this.clampZoom(options.zoom) : this.zoomLevel;
    this.panX = viewW / 2 - (resolved.x + resolved.width / 2) * zoom;
    this.panY = viewH / 2 - (resolved.y + resolved.height / 2) * zoom;
    this.zoomLevel = zoom;
    this.applyWorldTransform();
    this.scheduleViewportChange();
    this.focusActiveItem(this.spatialItemIndex('node', id));
  }

  toContentPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.viewportEl?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const localX = this.localWorldX(clientX, rect);
    const localY = clientY - rect.top;
    return { x: (localX - this.panX) / this.zoomLevel, y: (localY - this.panY) / this.zoomLevel };
  }

  /** Subscribes to rAF-coalesced structure/viewport snapshots. The viewport includes the finite,
   * sorted `minZoom`/`maxZoom` bounds actually used by canvas zoom operations. */
  registerCompanion(cb: (snapshot: FlowStructureSnapshot) => void): () => void {
    this.companionCallbacks.add(cb);
    this.scheduleCompanionNotify();
    return () => {
      this.companionCallbacks.delete(cb);
    };
  }

  private scheduleCompanionNotify(structural = true): void {
    if (structural) this.companionStructure = undefined;
    if (!this.isConnected || this.companionRaf != null || this.companionCallbacks.size === 0) return;
    const request = this.requestOwnerAnimationFrame(() => {
      if (this.companionRaf !== request) return;
      this.companionRaf = null;
      if (!this.isConnected || this.ownerDocument.defaultView !== request?.owner) return;
      // Each observer receives its own frozen snapshot; the deeply frozen nodes/edges are shared.
      for (const cb of this.companionCallbacks) cb(this.buildSnapshot());
    });
    this.companionRaf = request;
  }

  private buildSnapshot(): FlowStructureSnapshot {
    return this.withFallbackSizes(() => {
    this.fallbackSizes.clear();
    const rect = this.viewportEl?.getBoundingClientRect();
    const bounds = this.effectiveZoomBounds;
    this.companionStructure ??= {
      nodes: Object.freeze(this.modelNodes.map((n) => {
        const resolved = this.renderResolved?.get(n.id) ?? this.resolvedNode(n);
        return Object.freeze({
          id: n.id,
          x: resolved.x,
          y: resolved.y,
          width: resolved.width,
          height: resolved.height,
          status: this.decorations?.[n.id]?.status,
        });
      })),
      edges: Object.freeze(this.modelEdges.map((e) => Object.freeze({
        id: e.id,
        source: e.source,
        target: e.target,
        status: this.decorations?.[e.id]?.status,
      }))),
    };
    return Object.freeze({
      ...this.companionStructure,
      ...(this.sourceMode && this.sourceWorld && this.sourceAcceptedScene ? { source: Object.freeze({
        coverage: this.sourceAcceptedScene.coverage, total: this.sourceAcceptedScene.total,
        worldBounds: this.sourceWorld, overview: this.sourceOverview,
      }) } : {}),
      viewport: Object.freeze({
        x: this.panX,
        y: this.panY,
        zoom: this.zoomLevel,
        width: rect?.width ?? 0,
        height: rect?.height ?? 0,
        minZoom: bounds.min,
        maxZoom: bounds.max,
      }),
      locked: this.readonly,
      orientation: this.orientation,
      layerGap: this.safeLayerGap,
      nodeGap: this.safeNodeGap,
    });
    });
  }

  private clampZoom(z: number): number {
    const { min, max } = this.effectiveZoomBounds;
    return finiteRange(z, 1, min, max);
  }

  private applyWorldTransform(invalidateViewport = true): void {
    if (this.worldEl) this.worldEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
    this.scheduleCompanionNotify(false);
    if (invalidateViewport) this.viewportRevision++;
  }

  private scheduleViewportChange(): void {
    if (this.sourceMode) void this.requestSourceScene();
    if (this.viewportChangeRaf != null) return;
    this.viewportChangeRaf = this.requestOwnerAnimationFrame(() => {
      this.viewportChangeRaf = null;
      this.emit(
        'lr-viewport-change',
        Object.freeze({ x: this.panX, y: this.panY, zoom: this.zoomLevel }),
      );
    });
  }

  private zoomAtCenter(nextZoom: number): void {
    const rect = this.viewportEl?.getBoundingClientRect();
    this.zoomAtPoint(rect ? rect.width / 2 : 0, rect ? rect.height / 2 : 0, nextZoom);
  }

  /** Keeps the content point currently under `(localX, localY)` stationary on screen while zooming
   *  -- `localX`/`localY` are already pre-mirror world-local coordinates (see `localWorldX()`). */
  private zoomAtPoint(localX: number, localY: number, nextZoom: number): void {
    const clamped = this.clampZoom(nextZoom);
    if (clamped === this.zoomLevel) return;
    const contentX = (localX - this.panX) / this.zoomLevel;
    const contentY = (localY - this.panY) / this.zoomLevel;
    this.panX = localX - contentX * clamped;
    this.panY = localY - contentY * clamped;
    this.zoomLevel = clamped;
    this.applyWorldTransform();
    this.scheduleViewportChange();
  }

  /** The one place RTL needs consulting for pan/zoom: converts a raw pointer `clientX` to this
   *  canvas's pre-mirror world-local X. Every other pan/zoom/drag calculation stays in plain
   *  physical coordinates because `[part='viewport']`'s own CSS mirrors the whole `.world` layer
   *  under RTL; panning/zoom math never needs to know about RTL beyond this one conversion. */
  private localWorldX(clientX: number, rect: DOMRect, rtl = isRtl(this)): number {
    const local = clientX - rect.left;
    return this.orientation === 'horizontal' && rtl ? rect.width - local : local;
  }

  /**
   * True when the event started inside a surface shown in the browser top layer -- a node menu the
   * anchored-overlay escape promoted, or a consumer's own open popover -- between the target and
   * `boundary`. Such a surface paints outside the node and the canvas, but it is still a DOM
   * descendant, so its wheel and pointer gestures must stay its own: scrolling a long menu must
   * not zoom the canvas, and pressing on its chrome must not drag the node.
   */
  private isFromTopLayerSurface(e: Event, boundary: EventTarget | null | undefined): boolean {
    for (const entry of e.composedPath()) {
      if (entry === boundary) break;
      if (
        entry instanceof Element &&
        (entry.hasAttribute('data-lr-top-layer') || isNativeTopLayerElement(entry))
      ) {
        return true;
      }
    }
    return false;
  }

  private onWheel = (e: WheelEvent): void => {
    if (this.readonly || !this.viewportEl) return;
    if (this.isFromTopLayerSurface(e, this.viewportEl)) return;
    e.preventDefault();
    // Wheel events arrive in dense bursts; neither the viewport's rect nor the resolved text
    // direction can change within a single frame, so both are measured at most once per frame
    // instead of forcing a layout/style recalc on every event.
    if (!this.wheelMeasure) {
      this.wheelMeasure = { rect: this.viewportEl.getBoundingClientRect(), rtl: isRtl(this) };
      this.wheelMeasureRaf = this.requestOwnerAnimationFrame(() => {
        this.wheelMeasure = null;
        this.wheelMeasureRaf = null;
      });
    }
    const { rect, rtl } = this.wheelMeasure;
    const localX = this.localWorldX(e.clientX, rect, rtl);
    const localY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? ZOOM_MULTIPLIER : 1 / ZOOM_MULTIPLIER;
    this.zoomAtPoint(localX, localY, this.zoomLevel * factor);
  };

  private onBackgroundPointerDown = (e: PointerEvent): void => {
    if (this.readonly) return;
    if (this.isFromTopLayerSurface(e, this.viewportEl)) return;
    this.panDrag = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: this.panX,
      startPanY: this.panY,
      // Resolved once per gesture: isRtl() reads getComputedStyle, too costly per pointermove.
      rtlFlip: this.orientation === 'horizontal' && isRtl(this) ? -1 : 1,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.viewportEl?.setAttribute('data-panning', '');
    this.connectedWindow?.addEventListener('pointermove', this.onBackgroundPointerMove);
    this.connectedWindow?.addEventListener('pointerup', this.onBackgroundPointerUp);
    this.connectedWindow?.addEventListener('pointercancel', this.onBackgroundPointerUp);
    this.connectedWindow?.addEventListener('lostpointercapture', this.onBackgroundPointerUp);
  };

  private onBackgroundPointerMove = (e: PointerEvent): void => {
    const drag = this.panDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (this.readonly) {
      this.endBackgroundPan(true);
      return;
    }
    // Panning tracks the pointer's *physical* direction, so under the RTL ancestor mirror the
    // stored panX delta must be negated to still visually follow the cursor.
    this.panX = drag.startPanX + (e.clientX - drag.startClientX) * drag.rtlFlip;
    this.panY = drag.startPanY + (e.clientY - drag.startClientY);
    this.applyWorldTransform();
    this.scheduleViewportChange();
  };

  private onBackgroundPointerUp = (e: PointerEvent): void => {
    if (!this.panDrag || e.pointerId !== this.panDrag.pointerId) return;
    this.endBackgroundPan(this.readonly || e.type !== 'pointerup');
  };

  private endBackgroundPan(rollback: boolean): void {
    const drag = this.panDrag;
    if (!drag) return;
    this.panDrag = undefined;
    this.viewportEl?.removeAttribute('data-panning');
    this.connectedWindow?.removeEventListener('pointermove', this.onBackgroundPointerMove);
    this.connectedWindow?.removeEventListener('pointerup', this.onBackgroundPointerUp);
    this.connectedWindow?.removeEventListener('pointercancel', this.onBackgroundPointerUp);
    this.connectedWindow?.removeEventListener('lostpointercapture', this.onBackgroundPointerUp);
    if (rollback && (this.panX !== drag.startPanX || this.panY !== drag.startPanY)) {
      this.panX = drag.startPanX;
      this.panY = drag.startPanY;
      this.applyWorldTransform();
      this.scheduleViewportChange();
    }
  }

  private onViewportKeyDown = (e: KeyboardEvent): void => {
    // Roving node/edge navigation is bound on each item individually and stops propagation, so
    // this only ever fires when the viewport region itself has focus.
    if (e.target !== this.viewportEl || this.readonly) return;
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      this.zoomIn();
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      this.zoomOut();
    } else if (e.key === '0') {
      e.preventDefault();
      this.resetZoom();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      // Physical Left/Right must agree with the mouse-drag pan direction, which already
      // compensates for the `[part='viewport']` RTL mirror -- see onBackgroundPointerDown's
      // `rtlFlip` and nudgeNode's identical pattern.
      const rtlFlip = this.orientation === 'horizontal' && isRtl(this) ? -1 : 1;
      this.panBy(-KEYBOARD_PAN_STEP * rtlFlip, 0);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const rtlFlip = this.orientation === 'horizontal' && isRtl(this) ? -1 : 1;
      this.panBy(KEYBOARD_PAN_STEP * rtlFlip, 0);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.panBy(0, -KEYBOARD_PAN_STEP);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.panBy(0, KEYBOARD_PAN_STEP);
    }
  };

  private panBy(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
    this.applyWorldTransform();
    this.scheduleViewportChange();
  }

  // ---------------------------------------------------------------------
  // Droppable (palette drop handshake)
  // ---------------------------------------------------------------------

  private onViewportDragOver = (e: DragEvent): void => {
    if (this.sourceMode || !this.droppable || this.readonly) return;
    if (!e.dataTransfer?.types.includes(FLOW_PALETTE_MIME_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    this.viewportEl?.setAttribute('data-drop-active', '');
  };

  private onViewportDragLeave = (): void => {
    this.viewportEl?.removeAttribute('data-drop-active');
  };

  private onViewportDrop = (e: DragEvent): void => {
    this.viewportEl?.removeAttribute('data-drop-active');
    if (this.sourceMode || !this.droppable || this.readonly) return;
    const raw = e.dataTransfer?.getData(FLOW_PALETTE_MIME_TYPE);
    if (!raw) return;
    e.preventDefault();
    // Reject before synchronous parsing. The fast code-unit check avoids encoding an obviously
    // oversized string; the byte check then catches multibyte input within that first ceiling.
    const maxPayloadBytes = 4096;
    if (raw.length > maxPayloadBytes) return;
    const TextEncoderCtor = this.ownerDocument.defaultView?.TextEncoder ?? globalThis.TextEncoder;
    if (TextEncoderCtor && new TextEncoderCtor().encode(raw).byteLength > maxPayloadBytes) return;
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload) ||
      (Object.getPrototypeOf(payload) !== Object.prototype && Object.getPrototypeOf(payload) !== null)
    ) {
      return;
    }
    const rawType = (payload as Record<string, unknown>)['type'];
    if (typeof rawType !== 'string') return;
    const type = rawType.trim();
    if (!type || type.length > 128) return;
    const contentPoint = this.toContentPoint(e.clientX, e.clientY);
    this.emit(
      'lr-node-add',
      Object.freeze({
        type,
        position: Object.freeze({
          x: this.snap(contentPoint.x),
          y: this.snap(contentPoint.y),
        }),
      }),
    );
  };

  // ---------------------------------------------------------------------
  // Selection, activation, roving focus
  // ---------------------------------------------------------------------

  /** Edges `renderEdges()` actually draws a focusable `[part="edge"]` path for -- a missing source
   *  node drops the edge entirely and a missing target renders a non-focusable dangling stub, so
   *  neither has a roving-nav element to land on. Excluding both here keeps roving indices/count in
   *  sync with what's really focusable in the DOM. */
  private focusableEdges(): FlowEdge[] {
    const nodeIds = new Set(this.modelNodes.map((n) => n.id));
    return this.modelEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  }

  /** Spatially ordered nodes, then focusable edges; memoized until the next update or model write. */
  private rovingItems(): readonly RovingItem[] {
    if (this.rovingCache) return this.rovingCache;
    const horizontal = this.orientation === 'horizontal';
    const keyed = this.modelNodes.map((node) => {
      const { x, y } = this.nodePosition(node);
      return { node, main: horizontal ? x : y, cross: horizontal ? y : x };
    });
    keyed.sort((a, b) => a.main - b.main || a.cross - b.cross);
    return (this.rovingCache = [
      ...keyed.map(({ node }) => ({ kind: 'node' as const, id: node.id, disabled: node.disabled === true })),
      ...this.focusableEdges().map((e) => ({ kind: 'edge' as const, id: e.id })),
    ]);
  }

  private itemCount(): number {
    return this.rovingItems().length;
  }

  /** Only a `kind: 'node'` roving item can be non-actionable; an edge item is never excluded. */
  private isRovingItemDisabled(item: RovingItem): boolean {
    return item.disabled === true;
  }

  /** Clamps to the nearest enabled roving stop, preferring forward then backward. */
  private normalizedItemIndex(index = this.activeItemIndex): number {
    const items = this.rovingItems();
    const count = items.length;
    if (!count) return -1;
    const clamped = Math.min(Math.max(index, 0), count - 1);
    if (!this.isRovingItemDisabled(items[clamped]!)) return clamped;
    for (let forward = clamped + 1; forward < count; forward += 1) {
      if (!this.isRovingItemDisabled(items[forward]!)) return forward;
    }
    for (let backward = clamped - 1; backward >= 0; backward -= 1) {
      if (!this.isRovingItemDisabled(items[backward]!)) return backward;
    }
    return -1;
  }

  /** Steps by one roving position in `direction`, skipping disabled nodes without wrapping. */
  private nextEnabledItemIndex(from: number, direction: 1 | -1): number {
    const items = this.rovingItems();
    const count = items.length;
    if (!count) return -1;
    let index = Math.min(Math.max(from + direction, 0), count - 1);
    for (let steps = 0; steps < count; steps += 1) {
      if (!this.isRovingItemDisabled(items[index]!)) return index;
      index += direction;
      if (index < 0 || index >= count) break;
    }
    return from >= 0 && from < count && !this.isRovingItemDisabled(items[from]!) ? from : -1;
  }

  private firstEnabledItemIndex(): number {
    return this.rovingItems().findIndex((item) => !this.isRovingItemDisabled(item));
  }

  private lastEnabledItemIndex(): number {
    const items = this.rovingItems();
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (!this.isRovingItemDisabled(items[index]!)) return index;
    }
    return -1;
  }

  private itemAccessibleText(item: { kind: 'node' | 'edge'; id: string }): string {
    this.ensureModelIndexes();
    if (item.kind === 'node') {
      const node = this.nodesById.get(item.id);
      return node ? this.nodeAccessibleText(node) : '';
    }
    const edge = this.edgesById.get(item.id);
    return edge ? this.edgeAccessibleText(edge) : '';
  }

  private spatialItemIndex(kind: 'node' | 'edge', id: string): number {
    return this.rovingItems().findIndex((it) => it.kind === kind && it.id === id);
  }

  private announceItem(index: number): void {
    const item = this.rovingItems()[index];
    if (!item) return;
    this.announcer.announce(
      this.localize('flowItemAnnouncement', undefined, {
        item: this.itemAccessibleText(item),
        index: this.formatNumber(index + 1),
        total: this.formatNumber(this.itemCount()),
      }),
    );
  }

  private formatNumber(value: number): string {
    return getNumberFormat(this.effectiveLocale).format(value);
  }

  private onItemFocus(index: number): void {
    if (this.normalizedItemIndex(index) < 0) return;
    this.activeItemIndex = index;
    this.announceItem(index);
  }

  private renderedElementByDataId(
    attribute: 'data-node-id' | 'data-edge-id',
    id: string,
  ): Element | null {
    return (attribute === 'data-node-id' ? this.nodeWrappers.get(id) : this.edgeWrappers.get(id)) ?? null;
  }

  private renderedNodeById(id: string): HTMLElement | null {
    return this.renderedElementByDataId('data-node-id', id) as HTMLElement | null;
  }

  private renderedEdgeById(id: string): SVGElement | null {
    return this.renderedElementByDataId('data-edge-id', id) as SVGElement | null;
  }

  private focusActiveItem(index = this.activeItemIndex): void {
    const normalized = this.normalizedItemIndex(index);
    if (normalized < 0) return;
    this.activeItemIndex = normalized;
    this.announceItem(normalized);
    // `rovingItems()` is spatially ordered, but node wrappers render in `nodes` array order (see
    // `renderNodes()`'s `repeat()`) and don't generally match -- resolving the target element BY ID
    // instead of by its position in a DOM-order query keeps the focused element in sync with the
    // announced one even when `nodes`/`edges` aren't pre-sorted spatially.
    const item = this.rovingItems()[normalized];
    if (!item) return;
    this.revealItem(item);
    void this.updateComplete.then(() => {
      const el =
        item.kind === 'node'
          ? this.renderedNodeById(item.id)?.querySelector('[part="node-control"]')
          : this.renderedEdgeById(item.id)?.querySelector('[part="edge"]');
      (el as HTMLElement | null)?.focus();
    });
  }

  private revealItem(item: RovingItem): void {
    const node = item.kind === 'node' ? this.nodesById.get(item.id) : undefined;
    const edge = item.kind === 'edge' ? this.edgesById.get(item.id) : undefined;
    const source = node ?? (edge ? this.nodesById.get(edge.source) : undefined);
    if (!source || !this.viewportEl) return;
    const box = this.resolvedNode(source);
    const target = edge && this.nodesById.get(edge.target);
    const targetBox = target ? this.resolvedNode(target) : box;
    let x = (box.x + box.width / 2 + targetBox.x + targetBox.width / 2) / 2;
    if (node && this.geometryRtl) x = this.viewportEl.clientWidth + box.x - box.width / 2;
    const y = (box.y + box.height / 2 + targetBox.y + targetBox.height / 2) / 2;
    const width = this.viewportEl.clientWidth, height = this.viewportEl.clientHeight;
    if (x * this.zoomLevel + this.panX < 0 || x * this.zoomLevel + this.panX > width ||
      y * this.zoomLevel + this.panY < 0 || y * this.zoomLevel + this.panY > height) {
      this.panX = width / 2 - x * this.zoomLevel;
      this.panY = height / 2 - y * this.zoomLevel;
      this.applyWorldTransform();
      this.scheduleViewportChange();
    }
  }

  private applySelection(kind: 'node' | 'edge', id: string, additive: boolean): void {
    const current = this.sourceAuthority();
    if (!current()) return;
    if (kind === 'node') {
      this.selectedNodeIds = additive ? toggledSelection(this.selectedNodeIds, id) : [id];
      if (!additive) this.selectedEdgeIds = [];
    } else {
      this.selectedEdgeIds = additive ? toggledSelection(this.selectedEdgeIds, id) : [id];
      if (!additive) this.selectedNodeIds = [];
    }
    this.emit(
      'lr-selection-change',
      Object.freeze({
        selectedNodeIds: Object.freeze([...this.selectedNodeIds]),
        selectedEdgeIds: Object.freeze([...this.selectedEdgeIds]),
      }),
    );
    if (!current()) return;
    const selected = kind === 'node' ? this.selectedNodeIds.includes(id) : this.selectedEdgeIds.includes(id);
    const label = this.itemAccessibleText({ kind, id });
    this.announcer.announce(this.localize(selected ? 'flowNodeSelected' : 'flowNodeDeselected', undefined, { label }));
  }

  private clearSelection(): void {
    if (this.selectedNodeIds.length === 0 && this.selectedEdgeIds.length === 0) return;
    this.selectedNodeIds = [];
    this.selectedEdgeIds = [];
    this.emit(
      'lr-selection-change',
      Object.freeze({ selectedNodeIds: Object.freeze([]), selectedEdgeIds: Object.freeze([]) }),
    );
    this.announcer.announce(this.localize('flowSelectionCleared'));
  }

  private deleteSelection(): void {
    if (this.sourceMode) return;
    if (!this.nodesDraggable && !this.connectable && !this.droppable) return;
    if (this.selectedNodeIds.length === 0 && this.selectedEdgeIds.length === 0) return;
    this.emit(
      'lr-selection-delete',
      Object.freeze({
        nodeIds: Object.freeze([...this.selectedNodeIds]),
        edgeIds: Object.freeze([...this.selectedEdgeIds]),
      }),
    );
  }

  /** A `disabled` node is non-actionable: activating it -- by click on its card, its hidden
   *  `node-control` button, or Enter/Space while roving-focused -- emits nothing and changes no
   *  selection state, matching every other declared-non-actionable entry in this library. */
  private onNodeActivate(node: FlowNode, additive: boolean): void {
    if (node.disabled) return;
    const current = this.sourceAuthority();
    if (!current()) return;
    this.emit('lr-node-activate', Object.freeze({ nodeId: node.id }));
    if (current()) this.applySelection('node', node.id, additive);
  }

  /** Whether `event` started on an actionable element inside `boundary`, slotted content included. */
  private startedOnAction(event: Event, boundary: EventTarget | null): boolean {
    for (const entry of event.composedPath()) {
      if (entry === boundary) break;
      if ((entry as Node).nodeType === 1 && isActionableElement(entry as Element)) return true;
    }
    return false;
  }

  private onNodeClick(event: MouseEvent, node: FlowNode): void {
    if (this.startedOnAction(event, event.currentTarget)) {
      event.stopPropagation();
      return;
    }
    this.onNodeActivate(node, event.ctrlKey || event.metaKey);
  }

  private onEdgeActivate(edge: FlowEdge, additive: boolean): void {
    const current = this.sourceAuthority();
    if (!current()) return;
    this.emit(
      'lr-edge-activate',
      Object.freeze({
        edgeId: edge.id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        source: edge.source,
        target: edge.target,
      }),
    );
    if (current()) this.applySelection('edge', edge.id, additive);
  }

  private onItemKeyDown(e: KeyboardEvent, index: number, activate: (additive: boolean) => void): void {
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!this.sourceMode && this.nodesDraggable && !this.readonly && (e.ctrlKey || e.metaKey) && arrowKeys.includes(e.key)) {
      const item = this.rovingItems()[index];
      if (item?.kind === 'node') {
        e.preventDefault();
        this.nudgeNode(item.id, e.key);
        return;
      }
    }
    if (this.keyboardConnectSourceId) {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelKeyboardConnect();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        this.commitKeyboardConnect();
        return;
      }
      const rtlForConnect = isRtl(this);
      const forwardConnectKey = rtlForConnect ? 'ArrowLeft' : 'ArrowRight';
      const backwardConnectKey = rtlForConnect ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === forwardConnectKey || e.key === 'ArrowDown') {
        e.preventDefault();
        this.cycleKeyboardConnectTarget(1);
        return;
      }
      if (e.key === backwardConnectKey || e.key === 'ArrowUp') {
        e.preventDefault();
        this.cycleKeyboardConnectTarget(-1);
        return;
      }
      return;
    }
    if (!this.sourceMode && this.connectable && !this.readonly && e.key === 'c' && e.target === e.currentTarget) {
      const item = this.rovingItems()[index];
      if (item?.kind === 'node') {
        e.preventDefault();
        this.startKeyboardConnect(item.id);
        return;
      }
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.setActiveItemQuiet(index);
      activate(e.ctrlKey || e.metaKey);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (e.target !== e.currentTarget) (e.currentTarget as HTMLElement).focus();
      else this.clearSelection();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && e.target === e.currentTarget) {
      e.preventDefault();
      this.deleteSelection();
      return;
    }
    const count = this.itemCount();
    if (!count) return;
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next: number;
    if (e.key === forwardKey || e.key === 'ArrowDown') next = this.nextEnabledItemIndex(index, 1);
    else if (e.key === backwardKey || e.key === 'ArrowUp') next = this.nextEnabledItemIndex(index, -1);
    else if (e.key === 'Home') next = this.firstEnabledItemIndex();
    else if (e.key === 'End') next = this.lastEnabledItemIndex();
    else return;
    e.preventDefault();
    if (next >= 0) this.focusActiveItem(next);
  }

  private setActiveItemQuiet(index: number): void {
    const normalized = this.normalizedItemIndex(index);
    if (normalized >= 0) this.activeItemIndex = normalized;
  }

  private itemIndexMaps(): { nodeIndex: Map<string, number>; edgeIndex: Map<string, number> } {
    const items = this.rovingItems();
    if (this.indexItems === items && this.indexes) return this.indexes;
    this.indexItems = items;
    const nodeIndex = new Map<string, number>();
    const edgeIndex = new Map<string, number>();
    items.forEach((item, i) => {
      if (item.kind === 'node') nodeIndex.set(item.id, i);
      else edgeIndex.set(item.id, i - nodeIndex.size);
    });
    return this.indexes = { nodeIndex, edgeIndex };
  }

  // ---------------------------------------------------------------------
  // Node drag / keyboard nudge
  // ---------------------------------------------------------------------

  private snap(value: number): number {
    const grid = this.safeGrid;
    return grid > 0 ? Math.round(value / grid) * grid : value;
  }

  private rebuildIncidentEdgesIndex(): void {
    const map = new Map<string, string[]>();
    for (const edge of this.modelEdges) {
      (map.get(edge.source) ?? map.set(edge.source, []).get(edge.source)!).push(edge.id);
      if (edge.target !== edge.source) {
        (map.get(edge.target) ?? map.set(edge.target, []).get(edge.target)!).push(edge.id);
      }
    }
    this.nodeIncidentEdges = map;
  }

  /** Resolves the dragged node's incident edge records and their SVG elements once, so
   *  `updateIncidentEdges()` -- called on every drag pointermove -- touches only prefetched
   *  references. */
  private buildDragEdgeRefs(nodeId: string): DragEdgeRef[] {
    const refs: DragEdgeRef[] = [];
    this.ensureModelIndexes();
    for (const edgeId of this.nodeIncidentEdges.get(nodeId) ?? []) {
      const edge = this.edgesById.get(edgeId);
      const sourceNode = edge && this.nodesById.get(edge.source);
      const targetNode = edge && this.nodesById.get(edge.target);
      if (!edge || !sourceNode || !targetNode) continue;
      const group = this.renderedEdgeById(edgeId);
      refs.push({
        edge,
        sourceNode,
        targetNode,
        pathEl: (group?.querySelector('[part="edge"]') as SVGPathElement | null) ?? null,
        labelEl: group?.querySelector('[part="edge-label"]') ?? null,
      });
    }
    return refs;
  }

  private updateIncidentEdges(nodeId: string, x: number, y: number, rtlFlip = this.nodeDrag?.rtlFlip ?? 1): void {
    for (const { edge, sourceNode, targetNode, pathEl, labelEl } of this.dragEdgeRefs ?? []) {
      const sourceResolved = edge.source === nodeId ? { ...this.resolvedNode(sourceNode), x, y } : this.resolvedNode(sourceNode);
      const targetResolved = edge.target === nodeId ? { ...this.resolvedNode(targetNode), x, y } : this.resolvedNode(targetNode);
      const sourcePt = this.handlePoint(sourceResolved, 'output', edge.sourceHandle ?? 'out');
      const targetPt = this.handlePoint(targetResolved, 'input', edge.targetHandle ?? 'in');
      pathEl?.setAttribute('d', this.edgePathD(sourcePt, targetPt));
      if (labelEl) {
        const midX = (sourcePt.x + targetPt.x) / 2;
        labelEl.setAttribute('x', String(midX));
        labelEl.setAttribute('y', String((sourcePt.y + targetPt.y) / 2));
        if (this.orientation === 'horizontal' && rtlFlip < 0) {
          labelEl.setAttribute('transform', `translate(${2 * midX} 0) scale(-1 1)`);
        } else {
          labelEl.removeAttribute('transform');
        }
      }
    }
  }

  private onNodePointerDown(e: PointerEvent, node: FlowNode): void {
    if (this.sourceMode || !this.nodesDraggable || this.readonly || node.disabled) return;
    const wrapper = e.currentTarget as HTMLElement;
    if (this.isFromTopLayerSurface(e, wrapper) || this.startedOnAction(e, wrapper)) return;
    e.stopPropagation();
    const start = this.nodePosition(node);
    this.nodeDrag = {
      pointerId: e.pointerId,
      nodeId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: start.x,
      startY: start.y,
      wrapper,
      // Resolved once per gesture: isRtl() reads getComputedStyle, too costly per pointermove.
      rtlFlip: this.orientation === 'horizontal' && isRtl(this) ? -1 : 1,
    };
    this.dragEdgeRefs = this.buildDragEdgeRefs(node.id);
    wrapper.setPointerCapture?.(e.pointerId);
    this.connectedWindow?.addEventListener('pointermove', this.onNodePointerMove);
    this.connectedWindow?.addEventListener('pointerup', this.onNodePointerUp);
    this.connectedWindow?.addEventListener('pointercancel', this.onNodePointerUp);
    this.connectedWindow?.addEventListener('lostpointercapture', this.onNodePointerUp);
  }

  private onNodePointerMove = (e: PointerEvent): void => {
    const drag = this.nodeDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (this.sourceMode || this.readonly || !this.nodesDraggable) {
      this.endNodeDrag(false);
      return;
    }
    const dx = ((e.clientX - drag.startClientX) * drag.rtlFlip) / this.zoomLevel;
    const dy = (e.clientY - drag.startClientY) / this.zoomLevel;
    const x = this.snap(drag.startX + dx);
    const y = this.snap(drag.startY + dy);
    drag.wrapper.style.transform = `translate(${x}px, ${y}px)`;
    this.updateIncidentEdges(drag.nodeId, x, y);
    drag.currentX = x;
    drag.currentY = y;
  };

  private onNodePointerUp = (e: PointerEvent): void => {
    const drag = this.nodeDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    this.endNodeDrag(!this.sourceMode && !this.readonly && e.type === 'pointerup');
  };

  private endNodeDrag(commit: boolean): void {
    const drag = this.nodeDrag;
    if (!drag) return;
    this.nodeDrag = undefined;
    this.connectedWindow?.removeEventListener('pointermove', this.onNodePointerMove);
    this.connectedWindow?.removeEventListener('pointerup', this.onNodePointerUp);
    this.connectedWindow?.removeEventListener('pointercancel', this.onNodePointerUp);
    this.connectedWindow?.removeEventListener('lostpointercapture', this.onNodePointerUp);
    const previous = { x: drag.startX, y: drag.startY };
    const position = { x: drag.currentX ?? drag.startX, y: drag.currentY ?? drag.startY };
    if (
      commit &&
      !this.sourceMode && this.nodesDraggable &&
      this.modelNodes.some((node) => node.id === drag.nodeId) &&
      (position.x !== previous.x || position.y !== previous.y)
    ) {
      this.emit(
        'lr-node-move',
        Object.freeze({
          nodeId: drag.nodeId,
          position: Object.freeze(position),
          previous: Object.freeze(previous),
        }),
      );
    }
    // `requestUpdate()` alone cannot snap the wrapper back when the host doesn't apply the move
    // (or applies the identical position) -- Lit's AttributePart dirty-checks the *interpolated
    // string* against what Lit itself last committed, and that string is unchanged from the
    // pre-drag render (the imperative `drag.wrapper.style.transform = ...` writes during the drag
    // never went through Lit, so Lit's cached value was never invalidated). A re-render therefore
    // skips rewriting this exact attribute, leaving the mid-drag transform stuck. Writing the
    // reset transform directly (looked up fresh by id, in case a synchronous host listener already
    // applied a new position) fixes the visible state immediately regardless of Lit's diffing.
    const resetNode = this.modelNodes.find((n) => n.id === drag.nodeId);
    const resetPos = resetNode ? this.nodePosition(resetNode) : previous;
    drag.wrapper.style.transform = `translate(${resetPos.x}px, ${resetPos.y}px)`;
    this.updateIncidentEdges(drag.nodeId, resetPos.x, resetPos.y, drag.rtlFlip);
    this.dragEdgeRefs = undefined;
    if (this.sourceMode) this.requestUpdate('gesture', false); else this.requestUpdate();
  }

  private nudgeNode(nodeId: string, key: string): void {
    if (this.sourceMode) return;
    const node = this.modelNodes.find((n) => n.id === nodeId);
    if (!node) return;
    const current = this.nodePosition(node);
    const step = this.safeGrid > 0 ? this.safeGrid : 1;
    const rtlFlip = this.orientation === 'horizontal' && isRtl(this) ? -1 : 1;
    let dx = 0;
    let dy = 0;
    if (key === 'ArrowRight') dx = step * rtlFlip;
    else if (key === 'ArrowLeft') dx = -step * rtlFlip;
    else if (key === 'ArrowDown') dy = step;
    else if (key === 'ArrowUp') dy = -step;
    const position = { x: current.x + dx, y: current.y + dy };
    this.emit(
      'lr-node-move',
      Object.freeze({
        nodeId,
        position: Object.freeze(position),
        previous: Object.freeze(current),
      }),
    );
    this.announcer.announce(
      this.localize('flowNodeMoved', undefined, {
        label: this.nodeAccessibleText(node),
        x: this.formatNumber(position.x),
        y: this.formatNumber(position.y),
      }),
    );
    this.requestUpdate();
  }

  // ---------------------------------------------------------------------
  // Connect gesture (pointer + keyboard)
  // ---------------------------------------------------------------------

  private nodeIdFromComposedPath(path: EventTarget[]): string | null {
    for (const el of path) {
      if (isHtmlElement(el) && el.getAttribute('part') === 'node' && el.dataset['nodeId']) {
        return el.dataset['nodeId'];
      }
    }
    return null;
  }

  /** Simplified duplicate check: an edge already existing from this gesture's source to the hovered
   *  node counts as a duplicate target, regardless of which handles it uses -- checked in the
   *  source -> target direction only, since edges are directed and a reverse edge (hovered -> source)
   *  represents a different relationship, not a duplicate of this one. Matches
   *  `eligibleConnectTargets()`'s equivalent one-directional rule for the keyboard connect flow, and
   *  the same function's `disabled` exclusion: a disabled node is never a valid drop target either. */
  private isInvalidConnectTarget(hoveredId: string): boolean {
    return this.connectState ? this.isInvalidConnectTargetFor(this.connectState, hoveredId) : false;
  }

  private onWorldPointerDown = (e: PointerEvent): void => {
    if (this.sourceMode || !this.connectable || this.readonly || this.connectState) return;
    if (this.isFromTopLayerSurface(e, this.viewportEl)) return;
    const path = e.composedPath();
    const handleEl = path.find((el) => isHtmlElement(el) && el.dataset['handleKind'] === 'output') as
      | HTMLElement
      | undefined;
    if (!handleEl) return;
    const nodeId = this.nodeIdFromComposedPath(path);
    const handleId = handleEl.dataset['handleId'];
    if (!nodeId || !handleId) return;
    e.stopPropagation();
    this.startConnectGesture(nodeId, handleId, e.clientX, e.clientY);
  };

  private startConnectGesture(nodeId: string, handleId: string, clientX: number, clientY: number): void {
    if (this.sourceMode) return;
    const sourceNode = this.modelNodes.find((n) => n.id === nodeId);
    if (!sourceNode || sourceNode.disabled) return;
    const startPt = this.handlePoint(this.resolvedNode(sourceNode), 'output', handleId);
    this.connectState = {
      sourceId: nodeId,
      sourceHandle: handleId,
      startPt,
      rect: this.viewportEl?.getBoundingClientRect() ?? null,
      rtl: isRtl(this),
    };
    this.connecting = true;
    this.announcer.announce(this.localize('flowConnectStarted', undefined, { label: this.nodeAccessibleText(sourceNode) }));
    void this.updateComplete.then(() => {
      this.connectionLineEl = (this.renderRoot.querySelector('[part="connection-line"]') as SVGPathElement) ?? undefined;
      this.connectionLineEl?.setAttribute('d', this.edgePathD(startPt, this.connectContentPoint(clientX, clientY)));
    });
    this.connectedWindow?.addEventListener('pointermove', this.onConnectPointerMove);
    this.connectedWindow?.addEventListener('pointerup', this.onConnectPointerUp);
    // A touch scroll takeover or the browser reclaiming the pointer (e.g. alt-tab) fires
    // `pointercancel` instead of `pointerup`, and losing capture fires `lostpointercapture` --
    // without these the ghost connection line and both window listeners would outlive the
    // gesture, and a later unrelated pointerup could commit against the stale connect state.
    this.connectedWindow?.addEventListener('pointercancel', this.onConnectPointerCancel);
    this.connectedWindow?.addEventListener('lostpointercapture', this.onConnectPointerCancel);
  }

  /** `toContentPoint()` against the viewport rect and RTL resolution snapshotted at
   *  connect-gesture start, so each pointermove avoids a fresh layout/style measurement. */
  private connectContentPoint(clientX: number, clientY: number): { x: number; y: number } {
    const state = this.connectState;
    if (!state?.rect) return { x: 0, y: 0 };
    const localX = this.localWorldX(clientX, state.rect, state.rtl);
    const localY = clientY - state.rect.top;
    return { x: (localX - this.panX) / this.zoomLevel, y: (localY - this.panY) / this.zoomLevel };
  }

  private onConnectPointerMove = (e: PointerEvent): void => {
    if (!this.connectState) return;
    if (this.sourceMode || this.readonly || !this.connectable) {
      this.onConnectPointerCancel();
      return;
    }
    const targetPt = this.connectContentPoint(e.clientX, e.clientY);
    this.connectionLineEl?.setAttribute('d', this.edgePathD(this.connectState.startPt, targetPt));
    const hoveredId = this.nodeIdFromComposedPath(e.composedPath());
    const invalid = hoveredId != null && this.isInvalidConnectTarget(hoveredId);
    if (this.connectInvalidNodeId && this.connectInvalidNodeId !== (invalid ? hoveredId : null)) {
      this.renderedNodeById(this.connectInvalidNodeId)?.removeAttribute('data-connect-invalid');
    }
    this.connectInvalidNodeId = invalid ? (hoveredId as string) : null;
    if (invalid) {
      this.renderedNodeById(hoveredId as string)?.setAttribute('data-connect-invalid', '');
    }
  };

  private onConnectPointerUp = (e: PointerEvent): void => {
    if (!this.connectState) return;
    if (this.sourceMode || this.readonly || !this.connectable) {
      this.onConnectPointerCancel();
      return;
    }
    const state = this.connectState;
    const path = e.composedPath();
    const targetNodeId = this.nodeIdFromComposedPath(path);
    this.endConnectGesture();
    if (!targetNodeId || this.isInvalidConnectTargetFor(state, targetNodeId)) {
      this.announcer.announce(this.localize('flowConnectCancelled'));
      return;
    }
    const handleEl = path.find((el) => isHtmlElement(el) && el.dataset['handleKind'] === 'input') as
      | HTMLElement
      | undefined;
    const targetHandle = handleEl?.dataset['handleId'] ?? 'in';
    this.emit(
      'lr-connect',
      Object.freeze({
        source: state.sourceId,
        target: targetNodeId,
        sourceHandle: state.sourceHandle,
        targetHandle,
      }),
    );
    const sourceNode = this.modelNodes.find((node) => node.id === state.sourceId);
    const targetNode = this.modelNodes.find((node) => node.id === targetNodeId);
    this.announcer.announce(
      this.localize('flowConnectCommitted', undefined, {
        source: sourceNode ? this.nodeAccessibleText(sourceNode) : state.sourceId,
        target: targetNode ? this.nodeAccessibleText(targetNode) : targetNodeId,
      }),
    );
  };

  /** Same rule as `isInvalidConnectTarget()`, callable after `connectState` has already been
   *  cleared by `endConnectGesture()` -- takes the snapshotted state explicitly instead. */
  private isInvalidConnectTargetFor(state: { sourceId: string }, hoveredId: string): boolean {
    this.ensureModelIndexes();
    return hoveredId === state.sourceId || this.nodesById.get(hoveredId)?.disabled === true ||
      this.outgoingTargets.get(state.sourceId)?.has(hoveredId) === true;
  }

  /** Ends the gesture without committing -- pointercancel/lostpointercapture mean the pointer
   *  stream is gone, so there is no release target to connect to. */
  private onConnectPointerCancel = (): void => {
    if (!this.connectState) return;
    this.endConnectGesture();
    this.announcer.announce(this.localize('flowConnectCancelled'));
  };

  private endConnectGesture(): void {
    if (this.connectInvalidNodeId) {
      this.renderedNodeById(this.connectInvalidNodeId)?.removeAttribute('data-connect-invalid');
      this.connectInvalidNodeId = null;
    }
    this.connectState = undefined;
    this.connecting = false;
    this.connectedWindow?.removeEventListener('pointermove', this.onConnectPointerMove);
    this.connectedWindow?.removeEventListener('pointerup', this.onConnectPointerUp);
    this.connectedWindow?.removeEventListener('pointercancel', this.onConnectPointerCancel);
    this.connectedWindow?.removeEventListener('lostpointercapture', this.onConnectPointerCancel);
  }

  private cancelActiveGestures(): void {
    this.endBackgroundPan(true);
    this.cancelModelBoundGestures();
    this.viewportEl?.removeAttribute('data-drop-active');
  }

  private cancelModelBoundGestures(): void {
    this.endNodeDrag(false);
    this.onConnectPointerCancel();
    this.keyboardConnectSourceId = null;
    this.keyboardConnectTargetIndex = 0;
  }

  /** A disabled node is excluded on both ends: it never appears as an eligible target (a
   *  non-actionable node should not gain a new incoming connection either), and the caller-side
   *  guards below refuse it as a source. An edge that already touches a since-disabled node is left
   *  alone -- disabling only prevents new interactions, never retracts existing model state. */
  private eligibleConnectTargets(sourceId: string): FlowNode[] {
    this.ensureModelIndexes();
    if (this.connectTargets?.source === sourceId && this.connectTargets.nodes === this.modelNodes && this.connectTargets.edges === this.modelEdges)
      return this.connectTargets.targets;
    const linked = this.outgoingTargets.get(sourceId);
    const targets = this.modelNodes.filter(node => node.id !== sourceId && !node.disabled && !linked?.has(node.id));
    this.connectTargets = { source: sourceId, nodes: this.modelNodes, edges: this.modelEdges, targets };
    return targets;
  }

  private startKeyboardConnect(sourceId: string): void {
    if (this.sourceMode) return;
    const sourceNode = this.modelNodes.find((n) => n.id === sourceId);
    if (!sourceNode || sourceNode.disabled) return;
    const targets = this.eligibleConnectTargets(sourceId);
    if (targets.length === 0) return;
    this.keyboardConnectSourceId = sourceId;
    this.keyboardConnectTargetIndex = 0;
    if (sourceNode) this.announceKeyboardConnectTarget();
  }

  private cycleKeyboardConnectTarget(direction: 1 | -1): void {
    if (!this.keyboardConnectSourceId) return;
    const targets = this.eligibleConnectTargets(this.keyboardConnectSourceId);
    if (targets.length === 0) return;
    this.keyboardConnectTargetIndex = (this.keyboardConnectTargetIndex + direction + targets.length) % targets.length;
    this.announceKeyboardConnectTarget();
  }

  private announceKeyboardConnectTarget(): void {
    const sourceId = this.keyboardConnectSourceId;
    if (!sourceId) return;
    const source = this.modelNodes.find((node) => node.id === sourceId);
    const targets = this.eligibleConnectTargets(sourceId);
    const target = targets[this.keyboardConnectTargetIndex];
    if (!source || !target) return;
    this.announcer.announce(
      this.localize('flowConnectTarget', undefined, {
        source: this.nodeAccessibleText(source),
        target: this.nodeAccessibleText(target),
        index: this.formatNumber(this.keyboardConnectTargetIndex + 1),
        total: this.formatNumber(targets.length),
      }),
    );
  }

  private commitKeyboardConnect(): void {
    if (this.sourceMode) return;
    const sourceId = this.keyboardConnectSourceId;
    if (!sourceId) return;
    const targets = this.eligibleConnectTargets(sourceId);
    const target = targets[this.keyboardConnectTargetIndex];
    this.keyboardConnectSourceId = null;
    if (!target) return;
    const sourceOutputs = nodeById(this.modelNodes, sourceId)?.outputs ?? DEFAULT_FLOW_OUTPUTS;
    const targetInputs = target.inputs ?? DEFAULT_FLOW_INPUTS;
    if (this.sourceMode || !this.connectable || this.readonly) return;
    this.emit(
      'lr-connect',
      Object.freeze({
        source: sourceId,
        target: target.id,
        sourceHandle: sourceOutputs[0]?.id ?? 'out',
        targetHandle: targetInputs[0]?.id ?? 'in',
      }),
    );
    const source = this.modelNodes.find((node) => node.id === sourceId);
    this.announcer.announce(
      this.localize('flowConnectCommitted', undefined, {
        source: source ? this.nodeAccessibleText(source) : sourceId,
        target: this.nodeAccessibleText(target),
      }),
    );
  }

  private cancelKeyboardConnect(): void {
    if (!this.keyboardConnectSourceId) return;
    this.keyboardConnectSourceId = null;
    this.announcer.announce(this.localize('flowConnectCancelled'));
  }

  // ---------------------------------------------------------------------
  // Decoration paint
  // ---------------------------------------------------------------------

  private statusTone(status: LyraToolStatus): LyraVariant {
    if (status === 'running') return 'brand';
    if (status === 'success') return 'success';
    if (status === 'error') return 'danger';
    if (status === 'denied') return 'warning';
    return 'neutral';
  }

  private edgeTone(edge: FlowEdge): LyraVariant {
    const decoration = this.decorations?.[edge.id];
    return decoration ? this.statusTone(decoration.status) : edge.tone ?? 'neutral';
  }

  private edgeIsRunning(edge: FlowEdge): boolean {
    return this.decorations?.[edge.id]?.status === 'running';
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  private renderEdges(
    resolvedById: ReadonlyMap<string, ResolvedFlowNode>,
    nodeIndex: Map<string, number>,
    edgeIndex: Map<string, number>,
    activeIndex: number,
  ): SVGTemplateResult {
    const authority = this.sourceAuthority(), edges = this.modelEdges;
    const current = () => authority() && this.modelEdges === edges;
    const selectedEdges = new Set(this.selectedEdgeIds);
    const ownerWindow = this.ownerDocument?.defaultView;
    const reducedMotion = !ownerWindow || prefersReducedMotion(this);
    const counterMirrorLabels =
      this.orientation === 'horizontal' && !!this.ownerDocument?.defaultView && isRtl(this);
    return svg`${repeat(this.renderedEdges, edge => edge.id, edge => guard([
      edge, resolvedById.get(edge.source), resolvedById.get(edge.target), nodeIndex, edgeIndex,
      selectedEdges.has(edge.id), this.decorations?.[edge.id], reducedMotion, counterMirrorLabels, this.renderEpoch,
    ], () => {
      const sourceResolved = resolvedById.get(edge.source);
      if (!sourceResolved) return nothing; // no position to draw from -- dropped entirely
      const targetResolved = resolvedById.get(edge.target);
      const sourcePt = this.handlePoint(sourceResolved, 'output', edge.sourceHandle ?? 'out');
      if (!targetResolved) {
        const stubPt = { x: sourcePt.x + 14, y: sourcePt.y + 14 };
        return svg`<line
          part="stub"
          aria-hidden="true"
          x1=${sourcePt.x} y1=${sourcePt.y}
          x2=${stubPt.x} y2=${stubPt.y}
        ></line>`;
      }
      const targetPt = this.handlePoint(targetResolved, 'input', edge.targetHandle ?? 'in');
      const midX = (sourcePt.x + targetPt.x) / 2;
      const midY = (sourcePt.y + targetPt.y) / 2;
      const index = nodeIndex.size + (edgeIndex.get(edge.id) ?? 0);
      const active = activeIndex === index;
      const selected = selectedEdges.has(edge.id);
      const path = this.edgePathD(sourcePt, targetPt);
      const tone = this.edgeTone(edge);
      return svg`<g data-edge-id=${edge.id} ${ref(element => { if (element) this.edgeWrappers.set(edge.id, element as SVGElement); else this.edgeWrappers.delete(edge.id); })}>
        <path
          part="edge-hit-area"
          aria-hidden="true"
          tabindex="-1"
          d=${path}
          @click=${(e: MouseEvent) => { if (current()) this.onEdgeActivate(edge, e.ctrlKey || e.metaKey); }}
        ></path>
        <path
          part="edge"
          role="button"
          tabindex=${active ? '0' : '-1'}
          aria-label=${this.edgeAccessibleText(edge)}
          aria-pressed=${selected ? 'true' : 'false'}
          d=${path}
          marker-end="url(#${this.arrowMarkerIds[tone]})"
          data-tone=${tone}
          data-running=${this.edgeIsRunning(edge) && !reducedMotion ? '' : nothing}
          data-running-static=${this.edgeIsRunning(edge) && reducedMotion ? '' : nothing}
          @click=${(e: MouseEvent) => { if (current()) this.onEdgeActivate(edge, e.ctrlKey || e.metaKey); }}
          @focus=${() => { if (current()) this.onItemFocus(index); }}
          @keydown=${(e: KeyboardEvent) =>
            current() && this.onItemKeyDown(e, index, (additive) => { if (current()) this.onEdgeActivate(edge, additive); })}
        ></path>
        ${edge.label
          ? svg`<text
              part="edge-label"
              x=${midX}
              y=${midY}
              transform=${counterMirrorLabels
                ? `translate(${2 * midX} 0) scale(-1 1)`
                : nothing}
              paint-order="stroke"
            >${edge.label}</text>`
          : ''}
      </g>`;
    }))}`;
  }

  private renderNodes(
    resolvedById: ReadonlyMap<string, ResolvedFlowNode>,
    nodeIndex: Map<string, number>,
    activeIndex: number,
  ): TemplateResult {
    const authority = this.sourceAuthority(), nodes = this.modelNodes;
    const current = () => authority() && this.modelNodes === nodes;
    const selectedNodes = new Set(this.selectedNodeIds);
    const connectTargetId = this.renderedConnectTargetId;
    const ownerRegistry = this.ownerDocument?.defaultView?.customElements;
    // Same-origin documents have independent custom-element registries. A canvas adopted into an
    // iframe must not instantiate a main-realm `lr-flow-node` whose constructed stylesheets cannot
    // be shared with that document. Keep SSR on the canonical declarative tag, but use equivalent
    // native fallback markup in a live owner realm where the granular node definition is absent.
    const canRenderFlowNode = !ownerRegistry || !!ownerRegistry.get(tag('flow-node'));
    return html`${repeat(
      this.renderedNodes,
      (node) => node.id,
      (node) => {
        const resolved = resolvedById.get(node.id)!;
        const index = nodeIndex.get(node.id) ?? 0;
        const active = activeIndex === index;
        const selected = selectedNodes.has(node.id);
        const heading = typeof node.data?.['label'] === 'string' ? node.data['label'] : node.id;
        const description =
          typeof node.data?.['description'] === 'string' ? node.data['description'] : '';
        const decoration = this.decorations?.[node.id];
        const typePart = nodeTypePart(node.type);
        return guard([node, resolved, index, selected, decoration, this.orientation, connectTargetId === node.id, this.renderEpoch], () => html`<div
          part="node"
          data-node-id=${node.id}
          ${ref(element => this.bindNodeWrapper(node.id, element))}
          data-type=${node.type ?? nothing}
          data-connect-target=${node.id === connectTargetId ? '' : nothing}
          data-selected=${selected ? '' : nothing}
          role="group"
          aria-label=${this.nodeAccessibleText(node)}
          aria-disabled=${node.disabled ? 'true' : nothing}
          style="transform:translate(${resolved.x}px,${resolved.y}px)"
          @click=${(e: MouseEvent) => { if (current()) this.onNodeClick(e, node); }}
          @pointerdown=${(e: PointerEvent) => { if (current()) this.onNodePointerDown(e, node); }}
        >
          <button
            part="node-control"
            class="sr-only"
            type="button"
            ?disabled=${node.disabled === true}
            tabindex=${active ? '0' : '-1'}
            aria-label=${this.nodeAccessibleText(node)}
            aria-pressed=${selected ? 'true' : 'false'}
            @click=${(e: MouseEvent) => {
              e.stopPropagation();
              if (current()) this.onNodeActivate(node, e.ctrlKey || e.metaKey);
            }}
            @focus=${() => { if (current()) this.onItemFocus(index); }}
            @keydown=${(e: KeyboardEvent) =>
              current() && this.onItemKeyDown(e, index, (additive) => { if (current()) this.onNodeActivate(node, additive); })}
          ></button>
          <slot name=${`node-${node.id}`}>
            ${canRenderFlowNode
              ? html`<lr-flow-node
                  part=${typePart ? `node-card ${typePart}` : 'node-card'}
                  exportparts="base:node-card-base,card:node-card-surface,header:node-card-header,heading:node-card-heading,status:node-card-status,progress:node-card-progress,body:node-card-body,toolbar:node-card-toolbar,handle:node-card-handle,handle-input:node-card-handle-input,handle-output:node-card-handle-output"
                  data-flow-canvas-default-card
                  .nodeId=${node.id}
                  .flowType=${node.type ?? ''}
                  .heading=${heading}
                  .orientation=${this.orientation}
                  .status=${decoration?.status ?? null}
                  .progress=${decoration?.progress ?? null}
                  .statusDetail=${decoration?.detail ?? ''}
                  .durationMs=${decoration?.durationMs ?? null}
                  .selected=${selected}
                  .inputs=${node.inputs ?? DEFAULT_FLOW_INPUTS}
                  .outputs=${node.outputs ?? DEFAULT_FLOW_OUTPUTS}
                >${description ? html`<span>${description}</span>` : nothing}</lr-flow-node>`
              : html`<div
                  part=${typePart
                    ? `node-card node-card-surface ${typePart}`
                    : 'node-card node-card-surface'}
                  class="portable-node-card"
                  data-flow-canvas-default-card
                  data-node-type=${node.type ?? nothing}
                >
                  <div class="portable-handles" data-kind="input">
                    ${(node.inputs ?? DEFAULT_FLOW_INPUTS).map(
                      (handle) => html`<span
                        part="node-card-handle node-card-handle-input"
                        data-handle-kind="input"
                        data-handle-id=${handle.id}
                      ></span>`,
                    )}
                  </div>
                  <div class="portable-node-content">
                    <strong part="node-card-heading">${heading}</strong>
                    ${description ? html`<span>${description}</span>` : nothing}
                  </div>
                  <div class="portable-handles" data-kind="output">
                    ${(node.outputs ?? DEFAULT_FLOW_OUTPUTS).map(
                      (handle) => html`<span
                        part="node-card-handle node-card-handle-output"
                        data-handle-kind="output"
                        data-handle-id=${handle.id}
                      ></span>`,
                    )}
                  </div>
                </div>`}
          </slot>
        </div>`);
      },
    )}`;
  }

  private nodeViewportBounds(box: ResolvedFlowNode): FlowViewportBounds {
    return { left: this.geometryRtl ? box.x - box.width : box.x, top: box.y,
      right: this.geometryRtl ? box.x : box.x + box.width, bottom: box.y + box.height };
  }

  private edgeViewportBounds(edge: FlowEdge, resolved: ReadonlyMap<string, ResolvedFlowNode>): FlowViewportBounds | undefined {
    const source = resolved.get(edge.source), target = resolved.get(edge.target);
    if (!source) return undefined;
    const end = target ?? source;
    return { left: Math.min(source.x, end.x) - CONNECT_OFFSET_MAX,
      top: Math.min(source.y, end.y) - CONNECT_OFFSET_MAX,
      right: Math.max(source.x + source.width, end.x + end.width) + CONNECT_OFFSET_MAX,
      bottom: Math.max(source.y + source.height, end.y + end.height) + CONNECT_OFFSET_MAX };
  }

  private focusedNodeId(): string | undefined {
    for (let element = deepActiveElementIn(this.ownerDocument); element && element !== this; element = composedParentElement(element)) {
      const id = element.getAttribute('data-node-id');
      if (id && this.nodeWrappers.get(id) === element) return id;
      if (element.parentNode === this) return element.getAttribute('node-id') ?? undefined;
    }
    return undefined;
  }

  private selectRenderedGeometry(resolved: Map<string, ResolvedFlowNode>): void {
    this.renderedConnectTargetId = this.keyboardConnectSourceId
      ? this.eligibleConnectTargets(this.keyboardConnectSourceId)[this.keyboardConnectTargetIndex]?.id
      : undefined;
    if (this.visibleGeometry !== resolved) {
      this.visibleGeometry = resolved;
      this.visibleViewport = -1;
      this.geometryRtl = this.effectiveDirection === 'rtl';
      this.nodeViewportIndex = new FlowViewportIndex(this.modelNodes.map(node => ({
        value: node, bounds: this.nodeViewportBounds(resolved.get(node.id)!),
      })));
      this.edgeViewportIndex = new FlowViewportIndex(this.modelEdges.flatMap(edge => {
        const bounds = this.edgeViewportBounds(edge, resolved);
        return bounds ? [{ value: edge, bounds }] : [];
      }));
    }
    if (this.visibleViewport !== this.viewportRevision) {
      this.visibleViewport = this.viewportRevision;
      const width = this.viewportEl?.clientWidth || this.clientWidth;
      const height = this.viewportEl?.clientHeight || this.clientHeight;
      const left = -this.panX / this.zoomLevel, top = -this.panY / this.zoomLevel;
      const bounds = { left, top, right: left + width / this.zoomLevel, bottom: top + height / this.zoomLevel };
      this.baseVisibleNodes = width && height ? this.nodeViewportIndex!.query(this.geometryRtl ? { ...bounds, left: bounds.left - width, right: bounds.right - width } : bounds) : [...this.modelNodes];
      this.baseVisibleEdges = width && height ? this.edgeViewportIndex!.query(bounds) : [...this.modelEdges];
    }
    const nodeIds = new Set(this.baseVisibleNodes.map(node => node.id));
    const edgeIds = new Set(this.baseVisibleEdges.map(edge => edge.id));
    const reserved = new Set(this.selectedNodeIds);
    const focused = this.focusedNodeId();
    if (focused) reserved.add(focused);
    const item = this.rovingItems()[this.normalizedItemIndex()];
    if (item?.kind === 'node') reserved.add(item.id);
    if (item?.kind === 'edge') edgeIds.add(item.id);
    for (const id of this.selectedEdgeIds) edgeIds.add(id);
    for (const id of [...this.selectedEdgeIds, ...(item?.kind === 'edge' ? [item.id] : [])]) {
      const edge = this.edgesById.get(id);
      if (edge) { reserved.add(edge.source); reserved.add(edge.target); }
    }
    if (this.nodeDrag) reserved.add(this.nodeDrag.nodeId);
    if (this.connectState) reserved.add(this.connectState.sourceId);
    if (this.keyboardConnectSourceId) {
      reserved.add(this.keyboardConnectSourceId);
      if (this.renderedConnectTargetId) reserved.add(this.renderedConnectTargetId);
    }
    for (const id of reserved) {
      nodeIds.add(id);
      for (const edge of this.nodeIncidentEdges.get(id) ?? []) edgeIds.add(edge);
    }
    this.renderedNodes = [...nodeIds].flatMap(id => this.nodesById.get(id) ?? [])
      .sort((a, b) => this.nodeModelOrder.get(a.id)! - this.nodeModelOrder.get(b.id)!);
    this.renderedEdges = [...edgeIds].flatMap(id => this.edgesById.get(id) ?? [])
      .sort((a, b) => this.edgeModelOrder.get(a.id)! - this.edgeModelOrder.get(b.id)!);
  }

  override render(): TemplateResult {
    return this.withFallbackSizes(() => {
    const isEmpty = this.modelNodes.length === 0;
    const { nodeIndex, edgeIndex } = this.itemIndexMaps();
    const activeIndex = this.normalizedItemIndex();
    const resolvedById = this.renderResolved ??= new Map(this.modelNodes.map((n) => [n.id, this.resolvedNode(n)]));
    this.selectRenderedGeometry(resolvedById);
    const fallbackEdges = this.fallbackEdges;
    const state = this.sourceScene.state, current = this.sourceAuthority();
    return html`<div part="base" class=${this.sourceMode ? 'source-mode' : ''} role="region" aria-label=${this.accessibleLabel ?? this.localize('flowCanvasLabel')}>
      <div
        part="viewport"
        ?data-empty=${isEmpty}
        role="group"
        tabindex="0"
        aria-label=${this.accessibleLabel ??
        this.localize('flowCanvasSummary', undefined, {
          nodeCount: this.formatNumber(this.modelNodes.length),
          edgeCount: this.formatNumber(this.modelEdges.length),
        })}
        @pointerdown=${isEmpty ? this.onBackgroundPointerDown : undefined}
      >
        <div class="world" @pointerdown=${this.onWorldPointerDown}>
          <div
            part="background"
            style="--_lr-flow-canvas-grid-size:${this.safeGrid > 0 ? this.safeGrid : 8}px"
            @pointerdown=${this.onBackgroundPointerDown}
          ></div>
          <svg part="edges">
            <defs>
              ${FLOW_EDGE_TONES.map((tone) => svg`
                <marker
                  id=${this.arrowMarkerIds[tone]}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                  markerUnits="strokeWidth"
                >
                  <path part="arrowhead" data-tone=${tone} d="M 0 0 L 10 5 L 0 10 z"></path>
                </marker>
              `)}
            </defs>
            ${this.renderEdges(resolvedById, nodeIndex, edgeIndex, activeIndex)}
            ${this.connecting ? svg`<path part="connection-line" d=""></path>` : ''}
          </svg>
          ${isEmpty ? nothing : this.renderNodes(resolvedById, nodeIndex, activeIndex)}
        </div>
        ${isEmpty && !this.sourceMode
          ? html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`
          : nothing}
      </div>
      ${this.sourceMode ? this.renderSourceNavigator() : nothing}
      ${this.sourceMode && (state.pending || state.error || this.sourceError || this.sourceSceneFailure) ? html`<div part="source-status" class="source-scene-status">${this.localize(state.pending ? 'loading' : 'graphSourceSceneError')}${!state.pending ? html`<button type="button" @click=${() => { if (current() && this.sourceScene.state === state && (state.error || this.sourceError || this.sourceSceneFailure)) this.requestUpdate(); }}>${this.localize('retry')}</button>` : nothing}</div>` : nothing}
      ${!this.sourceMode && (this.nodesInputTruncated || this.edgesInputTruncated || this.layoutTruncated)
        ? html`<div class="limits">
            ${this.nodesInputTruncated || this.edgesInputTruncated
              ? html`<div part="input-limit" role="note">${this.localize('flowCanvasInputLimit')}</div>`
              : nothing}
            ${this.layoutTruncated
              ? html`<div part="layout-limit">${this.localize('flowCanvasLayoutLimit')}</div>`
              : nothing}
          </div>`
        : nothing}
      ${isEmpty
        ? nothing
        : html`
            <div part="live-region" class="sr-only" aria-hidden="true" id=${this.liveRegionId}></div>
            ${fallbackEdges.length > 0
              ? html`<ul part="edge-list" class="sr-only" aria-label=${this.localize('flowEdgeList')}>
                  ${guard([fallbackEdges, this.renderEpoch], () => fallbackEdges.map((edge) => html`<li>${this.edgeAccessibleText(edge)}</li>`))}
                </ul>`
              : nothing}
          `}
      <div part="overlay-rail" data-edge="top">
        <div class="overlay-group" data-align="start"><slot name="top-start"></slot></div>
        <div class="overlay-group" data-align="end"><slot name="top-end"></slot></div>
      </div>
      <div part="overlay-rail" data-edge="bottom">
        <div class="overlay-group" data-align="start"><slot name="bottom-start"></slot></div>
        <div class="overlay-group" data-align="end"><slot name="bottom-end"></slot></div>
      </div>
    </div>`;
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-flow-canvas': LyraFlowCanvas;
  }
}
