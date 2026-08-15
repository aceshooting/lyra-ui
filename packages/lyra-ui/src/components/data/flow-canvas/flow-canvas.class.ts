import { html, nothing, svg, type TemplateResult, type SVGTemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import {
  acquireAnnouncementSink,
  Announcer,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import { isRtl } from '../../../internal/rtl.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { layeredLayout } from '../../../internal/layered-layout.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { resolveCssLength } from '../../../internal/css-length.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraOrientation, LyraToolStatus } from '../../../internal/shared-unions.js';
import type { LyraVariant } from '../../../internal/variants.js';
import {
  snapshotFlowDecorations,
  snapshotFlowEdges,
  snapshotFlowNodes,
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
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_flowCanvasLabel, LYRA_DEFAULT_flowCanvasLayoutLimit, LYRA_DEFAULT_flowCanvasSummary, LYRA_DEFAULT_flowConnectCancelled, LYRA_DEFAULT_flowConnectCommitted, LYRA_DEFAULT_flowConnectStarted, LYRA_DEFAULT_flowConnectTarget, LYRA_DEFAULT_flowEdge, LYRA_DEFAULT_flowEdgeList, LYRA_DEFAULT_flowEdgeWithLabel, LYRA_DEFAULT_flowItemAnnouncement, LYRA_DEFAULT_flowNode, LYRA_DEFAULT_flowNodeDeselected, LYRA_DEFAULT_flowNodeMoved, LYRA_DEFAULT_flowNodeSelected, LYRA_DEFAULT_flowSelectionCleared, LYRA_DEFAULT_noData } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END
export * from './flow-types.js';

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

function toggledSelection(list: readonly string[], id: string): readonly string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
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
  'lr-edge-activate': CustomEvent<Readonly<{ edgeId: string; source: string; target: string }>>;
  'lr-selection-change': CustomEvent<
    Readonly<{ nodeIds: readonly string[]; edgeIds: readonly string[] }>
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

interface OwnedAnimationFrame {
  handle: number;
  owner: Window;
}

function isHtmlElement(value: EventTarget): value is HTMLElement {
  if (typeof value !== 'object' || value === null) return false;
  const element = value as Element;
  return element.nodeType === 1 && element.namespaceURI === 'http://www.w3.org/1999/xhtml';
}

/**
 * `<lr-flow-canvas>` — a pannable/zoomable DAG workflow canvas: positions HTML node cards, draws
 * SVG edges between their handles, runs a shared layered auto-layout for unpositioned nodes, and owns
 * all selection/drag/connect interaction. Readonly (viewer) by default; opt into editor gestures
 * individually via `nodes-draggable`, `connectable`, `droppable`. `nodes` and `edges` remain
 * controlled and are never mutated internally. Selection is an internally applied interaction
 * state: `selectedNodeIds`/`selectedEdgeIds` can seed or replace it, and node/edge activation
 * updates those arrays before emitting `lr-selection-change`. Interaction announcements are
 * flushed to the document's shared light-DOM polite sink; mount is silent and repeated identical
 * messages remain separate announcements. `[part="live-region"]` is only an aria-hidden mirror.
 * Turning on `locked` is a live safety boundary: active pan, node-drag, connect, and palette-drop
 * previews are canceled and their window listeners are retired before later pointer events can
 * commit. Viewport-mutating imperative methods, including `focusNode()`, are inert while locked.
 * Replacing the controlled `nodes` model similarly retires node-drag and connect gestures before
 * their captured ids can outlive that model; background pan remains independent. Node and edge
 * collections reject blank ids and later duplicates at assignment, so the first valid occurrence
 * owns layout, focus, selection, gestures, companion snapshots, and emitted identity.
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
 * @event lr-edge-activate - `detail: { edgeId, source, target }`.
 * @event lr-selection-change - `detail: { nodeIds, edgeIds }`.
 * @event lr-node-move - `detail: { nodeId, position, previous }`.
 * @event lr-connect - `detail: { source, target, sourceHandle, targetHandle }`.
 * @event lr-node-add - `detail: { type, position }`.
 * @event lr-selection-delete - `detail: { nodeIds, edgeIds }`.
 * @event lr-viewport-change - `detail: { x, y, zoom }`.
 * @event lr-layout-change - `detail: { positions, truncated }`.
 * @csspart base - The root wrapper.
 * @csspart viewport - The focusable pan/zoom surface.
 * @csspart background - The dotted background grid.
 * @csspart edges - The edges SVG.
 * @csspart edge - A single edge path.
 * @csspart edge-label - An edge's drawn label.
 * @csspart arrowhead - A tone-matched directed-edge arrowhead marker.
 * @csspart stub - A dangling-edge stub line.
 * @csspart connection-line - The in-progress connect-gesture path.
 * @csspart node - A node's positioned wrapper. Carries `data-selected` while selected.
 * @csspart node-control - The visually hidden, roving selection button for a node.
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
 * @csspart layout-limit - A visible localized notice shown when layered layout reaches its bounded
 *   edge-ordering work limit. Its announcement is sent through the shared light-DOM polite sink.
 * @csspart live-region - An aria-hidden shadow mirror of the current item/gesture announcement;
 *   the actual announcement uses the shared light-DOM polite sink.
 * @csspart edge-list - A visually hidden list of dangling or otherwise unrenderable edges.
 * @csspart overlay-rail - A top or bottom wrapping rail that prevents opposite-corner companions
 *   from overlapping in narrow allocations.
 * @cssprop [--lr-flow-canvas-grid-size=var(--lr-size-0-5rem)] - Dotted background spacing. The
 *   `grid` property supplies the fallback when this hook is unset; an element or ancestor hook
 *   takes precedence.
 * @cssprop [--lr-flow-canvas-edge-neutral-color=var(--lr-color-border)] - Neutral edge and arrowhead color.
 * @cssprop [--lr-flow-canvas-edge-brand-color=var(--lr-color-brand)] - Brand edge and arrowhead color.
 * @cssprop [--lr-flow-canvas-edge-success-color=var(--lr-color-success)] - Success edge and arrowhead color.
 * @cssprop [--lr-flow-canvas-edge-warning-color=var(--lr-color-warning)] - Warning edge and arrowhead color.
 * @cssprop [--lr-flow-canvas-edge-danger-color=var(--lr-color-danger)] - Danger edge and arrowhead color.
 * @cssprop [--lr-flow-canvas-march-duration=var(--lr-duration-ambient)] - Running-edge march animation duration.
 * @cssprop [--lr-flow-canvas-node-selected-outline-color=var(--lr-color-brand)] - Outline color of a selected node.
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
 * @status stable
 * @since 4.0.0
 */
export class LyraFlowCanvas extends LyraElement<LyraFlowCanvasEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
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
    noData: LYRA_DEFAULT_noData,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  private _nodes: readonly FlowNode[] = Object.freeze([]);
  /** Controlled node model, snapshotted at assignment. Blank ids and later duplicates are omitted
   * first-wins. Replacing it cancels active node-drag and pointer/keyboard connect gestures and
   * prunes selected ids that no longer exist. */
  @property({ attribute: false })
  get nodes(): readonly FlowNode[] {
    return this._nodes;
  }
  set nodes(value: readonly FlowNode[]) {
    const previous = this._nodes;
    this._nodes = snapshotFlowNodes(value);
    this.requestUpdate('nodes', previous);
  }

  private _edges: readonly FlowEdge[] = Object.freeze([]);
  /** Controlled edge model, snapshotted at assignment. Blank ids and later duplicates are omitted
   * first-wins before every render, action, focus, selection, snapshot, and event path. */
  @property({ attribute: false })
  get edges(): readonly FlowEdge[] {
    return this._edges;
  }
  set edges(value: readonly FlowEdge[]) {
    const previous = this._edges;
    this._edges = snapshotFlowEdges(value);
    this.requestUpdate('edges', previous);
  }

  private _orientation: LyraOrientation = 'horizontal';
  /** Downstream layout and handle axis. Invalid runtime/attribute values normalize to horizontal. */
  @property({ reflect: true })
  get orientation(): LyraOrientation {
    return this._orientation;
  }
  set orientation(value: LyraOrientation) {
    const previous = this._orientation;
    const next: LyraOrientation = value === 'vertical' ? 'vertical' : 'horizontal';
    this._orientation = next;
    if (next !== previous || value !== next) this.requestUpdate('orientation', previous);
  }
  @property({ type: Boolean, attribute: 'nodes-draggable' }) nodesDraggable = false;
  @property({ type: Boolean }) connectable = false;
  @property({ type: Boolean }) droppable = false;
  /** Freezes pan/zoom/edit gestures and viewport-mutating methods. Enabling it live cancels and
   * rolls back every active gesture before retiring its global listeners. */
  @property({ type: Boolean, reflect: true }) locked = false;
  private _selectedNodeIds: readonly string[] = Object.freeze([]);
  @property({ attribute: false })
  get selectedNodeIds(): readonly string[] {
    return this._selectedNodeIds;
  }
  set selectedNodeIds(value: readonly string[]) {
    const previous = this._selectedNodeIds;
    this._selectedNodeIds = Object.freeze(
      Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [],
    );
    this.requestUpdate('selectedNodeIds', previous);
  }

  private _selectedEdgeIds: readonly string[] = Object.freeze([]);
  @property({ attribute: false })
  get selectedEdgeIds(): readonly string[] {
    return this._selectedEdgeIds;
  }
  set selectedEdgeIds(value: readonly string[]) {
    const previous = this._selectedEdgeIds;
    this._selectedEdgeIds = Object.freeze(
      Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [],
    );
    this.requestUpdate('selectedEdgeIds', previous);
  }
  @property({ type: Number, attribute: 'min-zoom' }) minZoom = 0.25;
  @property({ type: Number, attribute: 'max-zoom' }) maxZoom = 2;
  /** Snap step, in content px, for drags/nudges/drop positions; `0` disables snapping. Also the
   *  dotted background's base spacing. */
  @property({ type: Number }) grid = 8;
  @property({ type: Number, attribute: 'layer-gap' }) layerGap = 64;
  @property({ type: Number, attribute: 'node-gap' }) nodeGap = 24;
  private _decorations: FlowRunDecorations | null = null;
  @property({ attribute: false })
  get decorations(): FlowRunDecorations | null {
    return this._decorations;
  }
  set decorations(value: FlowRunDecorations | null) {
    const previous = this._decorations;
    this._decorations = value == null ? null : snapshotFlowDecorations(value);
    this.requestUpdate('decorations', previous);
  }
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
  private announcementSink?: AnnouncementSink;
  private readonly announcer = new Announcer({
    onFlush: (text) => {
      this.liveText = text;
      this.announcementSink?.announce(text);
    },
  });
  @state() private liveText = '';
  @state() private activeItemIndex = 0;
  @state() private connecting = false;
  @state() private layoutTruncated = false;
  @state() private keyboardConnectSourceId: string | null = null;
  @state() private keyboardConnectTargetIndex = 0;

  /** Auto-layout-assigned positions for nodes lacking an explicit `position`. Empty until the first
   *  layout pass runs; `nodePosition()` reads from it. */
  private autoPositions = new Map<string, { x: number; y: number }>();
  /** Per-node measured wrapper size (`ResizeObserver`-driven) — plain map, not reactive state, read
   *  by every geometry helper below. */
  private measuredSizes = new Map<string, { width: number; height: number }>();

  private resizeObserver?: ResizeObserver;
  private readonly observedNodeEls = new Set<Element>();
  private layoutRaf: OwnedAnimationFrame | null = null;
  private connectedWindow?: Window;

  private panX = 0;
  private panY = 0;
  private zoomLevel = 1;
  private viewportEl?: HTMLElement;
  private worldEl?: HTMLElement;
  private viewportChangeRaf: OwnedAnimationFrame | null = null;
  private hasFitOnce = false;
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

  override connectedCallback(): void {
    super.connectedCallback();
    const ownerWindow = this.ownerDocument.defaultView;
    this.connectedWindow = ownerWindow ?? undefined;
    if (ownerWindow) this.announcer.setTimerHost(ownerWindow);
    this.syncAnnouncementSink();
    const ResizeObserverCtor = ownerWindow?.ResizeObserver;
    this.resizeObserver = ResizeObserverCtor
      ? new ResizeObserverCtor((entries) => this.onNodesResized(entries))
      : undefined;
    // updated() only runs on renders -- a disconnect/reconnect (e.g. a reparenting move) that
    // changes no reactive property never triggers one, which would leave every already-rendered
    // wrapper unwatched by the freshly created observer above, so re-observe directly here.
    if (this.hasUpdated) this.observeNodeWrappers();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.announcer.cancel();
    this.releaseAnnouncementSink();
    this.liveText = '';
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.observedNodeEls.clear();
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
    const ownerWindow = this.ownerDocument.defaultView;
    if (ownerWindow) this.announcer.setTimerHost(ownerWindow);
  }

  private requestOwnerAnimationFrame(callback: FrameRequestCallback): OwnedAnimationFrame | null {
    const owner = this.ownerDocument.defaultView;
    if (!owner) return null;
    return { owner, handle: owner.requestAnimationFrame(callback) };
  }

  private cancelOwnerAnimationFrame(frame: OwnedAnimationFrame): void {
    frame.owner.cancelAnimationFrame(frame.handle);
  }

  private releaseAnnouncementSink(): void {
    this.announcementSink?.release();
    this.announcementSink = undefined;
  }

  private syncAnnouncementSink(): void {
    if (!this.isConnected) {
      this.releaseAnnouncementSink();
      return;
    }
    if (this.announcementSink?.element.ownerDocument === this.ownerDocument) return;
    this.releaseAnnouncementSink();
    this.announcementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  /** Observes every node wrapper not yet tracked by the current `ResizeObserver` instance. The
   *  tracking set is cleared alongside the observer itself in `disconnectedCallback()`, so a
   *  reconnect re-observes each wrapper with the freshly created observer instead of treating it
   *  as already watched. */
  private observeNodeWrappers(): void {
    for (const el of Array.from(this.renderRoot.querySelectorAll('[part="node"]'))) {
      if (!this.observedNodeEls.has(el)) {
        this.observedNodeEls.add(el);
        this.resizeObserver?.observe(el);
      }
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('nodes')) {
      this.cancelModelBoundGestures();
      this.pruneNodeCaches();
      this.syncAuthoredCards();
      const nodeIds = new Set(this.nodes.map((node) => node.id));
      this._selectedNodeIds = Object.freeze(
        this.selectedNodeIds.filter((id) => nodeIds.has(id)),
      );
    }
    if (changed.has('edges')) {
      this.cancelModelBoundGestures();
      const edgeIds = new Set(this.edges.map((edge) => edge.id));
      this._selectedEdgeIds = Object.freeze(
        this.selectedEdgeIds.filter((id) => edgeIds.has(id)),
      );
    }
    if (
      (changed.has('locked') && this.locked) ||
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
      for (const node of this.nodes) {
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
    const nodeIds = new Set(this.nodes.map((node) => node.id));
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
    if (changed.has('edges')) this.rebuildIncidentEdgesIndex();
    if (changed.has('layoutTruncated') && this.layoutTruncated) {
      this.announcer.announce(this.localize('flowCanvasLayoutLimit'));
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
      changed.has('locked') ||
      changed.has('orientation') ||
      changed.has('layerGap') ||
      changed.has('nodeGap')
    ) {
      this.scheduleCompanionNotify();
    }
    const viewportEl = this.renderRoot.querySelector('[part="viewport"]') as HTMLElement | null;
    if (viewportEl && viewportEl !== this.viewportEl) {
      this.viewportEl = viewportEl;
      this.worldEl = this.renderRoot.querySelector('.world') as HTMLElement | undefined;
      viewportEl.addEventListener('wheel', this.onWheel, { passive: false });
      viewportEl.addEventListener('keydown', this.onViewportKeyDown);
      viewportEl.addEventListener('dragover', this.onViewportDragOver);
      viewportEl.addEventListener('dragleave', this.onViewportDragLeave);
      viewportEl.addEventListener('drop', this.onViewportDrop);
      this.applyWorldTransform();
    }
  }

  // ---------------------------------------------------------------------
  // Card adoption / prop-push
  // ---------------------------------------------------------------------

  /** Reconciles only consumer-authored light-DOM cards. Default cards are declarative slot fallback
   *  content in `renderNodes()`, so SSR and hydration share the same owned DOM and no append/remove
   *  churn can leak into the consumer's light DOM. */
  private syncAuthoredCards(): void {
    const ids = new Set(this.nodes.map((n) => n.id));
    const children = (this as unknown as { children?: HTMLCollection }).children;
    for (const child of Array.from(children ?? [])) {
      const nodeId = child.getAttribute('node-id');
      if (!nodeId) continue;
      if (ids.has(nodeId)) {
        child.setAttribute('slot', `node-${nodeId}`);
      } else {
        child.removeAttribute('slot');
        console.warn(
          `<lr-flow-canvas> a child with node-id="${nodeId}" matches no entry in \`nodes\`; it will not render.`,
        );
      }
    }
  }

  /** Pushes changed node/selection/decoration state onto every currently-adopted card (default or
   *  user-authored) so handles and run paint always match the model, regardless of which slot
   *  mechanism produced the card. Indexing the direct children once avoids a full descendant
   *  selector scan for every node in large flows. */
  private pushCardPropsAll(changed: PropertyValues): void {
    const nodesChanged = changed.has('nodes');
    const selectionChanged = nodesChanged || changed.has('selectedNodeIds');
    const decorationsChanged = nodesChanged || changed.has('decorations');
    const orientationChanged = nodesChanged || changed.has('orientation');
    const cardsByNodeId = new Map<string, FlowNodeCardEl>();
    const children = (this as unknown as { children?: HTMLCollection }).children;
    for (const child of Array.from(children ?? [])) {
      const nodeId = child.getAttribute('node-id');
      if (nodeId) cardsByNodeId.set(nodeId, child as unknown as FlowNodeCardEl);
    }
    const selectedNodeIds = selectionChanged ? new Set(this.selectedNodeIds) : null;

    for (const node of this.nodes) {
      const el = cardsByNodeId.get(node.id);
      if (!el) continue;
      if (nodesChanged) {
        el.inputs = node.inputs ?? [{ id: 'in' }];
        el.outputs = node.outputs ?? [{ id: 'out' }];
        el.flowType = node.type ?? '';
      }
      if (orientationChanged) el.orientation = this.orientation;
      if (selectedNodeIds) el.selected = selectedNodeIds.has(node.id);
      if (decorationsChanged) {
        const decoration = this.decorations?.[node.id];
        el.status = decoration?.status ?? null;
        el.progress = decoration?.progress ?? null;
        el.statusDetail = decoration?.detail ?? '';
        el.durationMs = decoration?.durationMs ?? null;
      }
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
    const computed = ownerWindow?.getComputedStyle(host);
    const customWidth = resolveCssLength(
      computed?.getPropertyValue('--lr-flow-canvas-node-fallback-inline-size').trim(),
      { host },
    );
    const customHeight = resolveCssLength(
      computed?.getPropertyValue('--lr-flow-canvas-node-fallback-block-size').trim(),
      { host },
    );
    // Resolve the live rem/em values on every fallback read. There is no fixed `* 16` assumption:
    // a custom root font size or an em-based consumer override participates before ResizeObserver
    // is available, while ownerless SSR uses zero geometry (there is no layout viewport to fit).
    const width =
      customWidth ??
      (resolveCssLength(
        computed?.getPropertyValue('--lr-size-10rem').trim() || '10rem',
        { host },
      ) ?? 0) +
        (resolveCssLength(
          computed?.getPropertyValue('--lr-size-1rem').trim() || '1rem',
          { host },
        ) ?? 0);
    const height =
      customHeight ??
      resolveCssLength(
        computed?.getPropertyValue('--lr-size-4rem').trim() || '4rem',
        { host },
      ) ??
      0;
    return { width, height };
  }

  private resolvedNode(node: FlowNode): { node: FlowNode; x: number; y: number; width: number; height: number } {
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
    resolved: { node: FlowNode; x: number; y: number; width: number; height: number },
    kind: 'input' | 'output',
    handleId: string,
  ): { x: number; y: number } {
    const handles = kind === 'input' ? (resolved.node.inputs ?? [{ id: 'in' }]) : (resolved.node.outputs ?? [{ id: 'out' }]);
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
    const sourceNode = this.nodes.find((n) => n.id === edge.source);
    const targetNode = this.nodes.find((n) => n.id === edge.target);
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
    let changedAny = false;
    for (const entry of entries) {
      const id = (entry.target as HTMLElement).dataset['nodeId'];
      if (!id) continue;
      const box = entry.borderBoxSize?.[0];
      const width = box ? box.inlineSize : entry.contentRect.width;
      const height = box ? box.blockSize : entry.contentRect.height;
      const prev = this.measuredSizes.get(id);
      if (!prev || prev.width !== width || prev.height !== height) {
        this.measuredSizes.set(id, { width, height });
        changedAny = true;
      }
    }
    if (changedAny) {
      this.scheduleLayoutPass();
      this.scheduleCompanionNotify();
    }
  }

  /** Captures rendered wrapper boxes before the first layout request. This is also the no-
   * ResizeObserver path, so a controlled host never receives a preliminary 16px-assumed layout. */
  private measureNodeWrappers(): void {
    for (const wrapper of Array.from(
      this.renderRoot.querySelectorAll<HTMLElement>('[part="node"]'),
    )) {
      const id = wrapper.dataset['nodeId'];
      if (!id) continue;
      const rect = wrapper.getBoundingClientRect();
      // getBoundingClientRect() includes the world's current zoom transform. Prefer layout-space
      // dimensions so a reconnect or later relayout at zoom != 1 cannot double-count scale.
      const width = wrapper.offsetWidth || rect.width / Math.max(this.zoomLevel, Number.EPSILON);
      const height = wrapper.offsetHeight || rect.height / Math.max(this.zoomLevel, Number.EPSILON);
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        this.measuredSizes.set(id, { width, height });
      }
    }
  }

  private scheduleLayoutPass(): void {
    if (this.layoutRaf != null) return;
    this.layoutRaf = this.requestOwnerAnimationFrame(() => {
      this.layoutRaf = null;
      this.measureNodeWrappers();
      this.runAutoLayoutIfNeeded();
      this.requestUpdate();
      if (!this.hasFitOnce && this.nodes.length > 0) {
        this.hasFitOnce = true;
        this.fit();
      }
    });
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
   *  out). */
  private runAutoLayoutIfNeeded(): void {
    const unpositioned = this.nodes.filter((n) => !n.position);
    if (unpositioned.length === 0) {
      this.layoutTruncated = false;
      return;
    }
    const swap = this.orientation === 'horizontal';
    const graphNodes = this.nodes.map((n) => {
      const size = this.nodeSize(n.id);
      return { id: n.id, width: swap ? size.height : size.width, height: swap ? size.width : size.height };
    });
    const nodeIds = new Set(this.nodes.map((n) => n.id));
    const graphEdges = this.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));
    const fixedPositions = new Map<string, { x: number; y: number }>();
    for (const n of this.nodes) {
      if (!n.position) continue;
      const size = this.nodeSize(n.id);
      const center = { x: n.position.x + size.width / 2, y: n.position.y + size.height / 2 };
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
    this.layoutTruncated = result.truncated;
    if (Object.keys(positions).length > 0) {
      this.emit(
        'lr-layout-change',
        Object.freeze({ positions: Object.freeze(positions), truncated: result.truncated }),
      );
    }
  }

  // ---------------------------------------------------------------------
  // Pan / zoom / viewport
  // ---------------------------------------------------------------------

  get viewport(): Readonly<{ x: number; y: number; zoom: number }> {
    return Object.freeze({ x: this.panX, y: this.panY, zoom: this.zoomLevel });
  }

  setViewport(next: { x: number; y: number; zoom: number }): void {
    if (this.locked) return;
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
    if (this.locked) return;
    this.zoomAtCenter(this.zoomLevel * ZOOM_MULTIPLIER);
  }

  /** Decrease viewport zoom around the canvas center, clamped to the effective zoom bounds. */
  zoomOut(): void {
    if (this.locked) return;
    this.zoomAtCenter(this.zoomLevel / ZOOM_MULTIPLIER);
  }

  /** Restore zoom to 1 while preserving the current pan coordinates. */
  resetZoom(): void {
    if (this.locked) return;
    this.setViewport({ x: this.panX, y: this.panY, zoom: 1 });
  }

  fit(options?: { padding?: number }): void {
    if (this.locked || this.nodes.length === 0) return;
    const padding = finiteRange(options?.padding ?? DEFAULT_FIT_PADDING, DEFAULT_FIT_PADDING, 0);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of this.nodes) {
      const resolved = this.resolvedNode(node);
      minX = Math.min(minX, resolved.x);
      minY = Math.min(minY, resolved.y);
      maxX = Math.max(maxX, resolved.x + resolved.width);
      maxY = Math.max(maxY, resolved.y + resolved.height);
    }
    const rect = this.viewportEl?.getBoundingClientRect();
    const viewW = rect?.width ?? 0;
    const viewH = rect?.height ?? 0;
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const fitZoom = Math.min((viewW - padding * 2) / contentW, (viewH - padding * 2) / contentH);
    const zoom = this.clampZoom(Number.isFinite(fitZoom) && fitZoom > 0 ? fitZoom : 1);
    this.panX = viewW / 2 - (minX + contentW / 2) * zoom;
    this.panY = viewH / 2 - (minY + contentH / 2) * zoom;
    this.zoomLevel = zoom;
    this.applyWorldTransform();
    this.scheduleViewportChange();
  }

  focusNode(id: string, options?: { zoom?: number }): void {
    if (this.locked) return;
    const node = this.nodes.find((n) => n.id === id);
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

  private scheduleCompanionNotify(): void {
    if (this.companionRaf != null || this.companionCallbacks.size === 0) return;
    this.companionRaf = this.requestOwnerAnimationFrame(() => {
      this.companionRaf = null;
      // Each observer receives its own detached frozen snapshot. One companion cannot mutate or
      // retain aliases into canvas-owned state, nor share identity with a sibling observer.
      for (const cb of this.companionCallbacks) cb(this.buildSnapshot());
    });
  }

  private buildSnapshot(): FlowStructureSnapshot {
    const rect = this.viewportEl?.getBoundingClientRect();
    const bounds = this.effectiveZoomBounds;
    return Object.freeze({
      nodes: Object.freeze(this.nodes.map((n) => {
        const resolved = this.resolvedNode(n);
        return Object.freeze({
          id: n.id,
          x: resolved.x,
          y: resolved.y,
          width: resolved.width,
          height: resolved.height,
          status: this.decorations?.[n.id]?.status,
        });
      })),
      edges: Object.freeze(this.edges.map((e) => Object.freeze({
        id: e.id,
        source: e.source,
        target: e.target,
        status: this.decorations?.[e.id]?.status,
      }))),
      viewport: Object.freeze({
        x: this.panX,
        y: this.panY,
        zoom: this.zoomLevel,
        width: rect?.width ?? 0,
        height: rect?.height ?? 0,
        minZoom: bounds.min,
        maxZoom: bounds.max,
      }),
      locked: this.locked,
      orientation: this.orientation,
      layerGap: this.safeLayerGap,
      nodeGap: this.safeNodeGap,
    });
  }

  private clampZoom(z: number): number {
    const { min, max } = this.effectiveZoomBounds;
    return finiteRange(z, 1, min, max);
  }

  private applyWorldTransform(): void {
    if (this.worldEl) this.worldEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
    this.scheduleCompanionNotify();
  }

  private scheduleViewportChange(): void {
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

  private onWheel = (e: WheelEvent): void => {
    if (this.locked || !this.viewportEl) return;
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
    if (this.locked) return;
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
    if (this.locked) {
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
    this.endBackgroundPan(this.locked || e.type !== 'pointerup');
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
    if (e.target !== this.viewportEl || this.locked) return;
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
    if (!this.droppable || this.locked) return;
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
    if (!this.droppable || this.locked) return;
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

  private spatialNodeOrder(): FlowNode[] {
    const horizontal = this.orientation === 'horizontal';
    return [...this.nodes].sort((a, b) => {
      const pa = this.resolvedNode(a);
      const pb = this.resolvedNode(b);
      const mainA = horizontal ? pa.x : pa.y;
      const mainB = horizontal ? pb.x : pb.y;
      if (mainA !== mainB) return mainA - mainB;
      const crossA = horizontal ? pa.y : pa.x;
      const crossB = horizontal ? pb.y : pb.x;
      return crossA - crossB;
    });
  }

  /** Edges `renderEdges()` actually draws a focusable `[part="edge"]` path for -- a missing source
   *  node drops the edge entirely and a missing target renders a non-focusable dangling stub, so
   *  neither has a roving-nav element to land on. Excluding both here keeps roving indices/count in
   *  sync with what's really focusable in the DOM. */
  private focusableEdges(): FlowEdge[] {
    const nodeIds = new Set(this.nodes.map((n) => n.id));
    return this.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  }

  private rovingItems(): { kind: 'node' | 'edge'; id: string }[] {
    return [
      ...this.spatialNodeOrder().map((n) => ({ kind: 'node' as const, id: n.id })),
      ...this.focusableEdges().map((e) => ({ kind: 'edge' as const, id: e.id })),
    ];
  }

  private itemCount(): number {
    return this.nodes.length + this.focusableEdges().length;
  }

  private normalizedItemIndex(index = this.activeItemIndex): number {
    const count = this.itemCount();
    return count ? Math.min(Math.max(index, 0), count - 1) : -1;
  }

  private itemAccessibleText(item: { kind: 'node' | 'edge'; id: string }): string {
    if (item.kind === 'node') {
      const node = this.nodes.find((n) => n.id === item.id);
      return node ? this.nodeAccessibleText(node) : '';
    }
    const edge = this.edges.find((e) => e.id === item.id);
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
    const renderRoot = this.renderRoot as ParentNode | undefined;
    if (!renderRoot) return null;
    const ownerCss = this.ownerDocument?.defaultView?.CSS;
    const escape = ownerCss?.escape;
    if (typeof escape === 'function') {
      try {
        const match = renderRoot.querySelector(
          `[${attribute}="${escape.call(ownerCss, id)}"]`,
        );
        if (match) return match;
      } catch {
        // A partial owner realm may omit CSS.escape or expose an unusable implementation. The
        // constant-selector scan below also accepts every consumer id without treating it as CSS.
      }
    }
    return (
      [...renderRoot.querySelectorAll(`[${attribute}]`)].find(
        (candidate) => candidate.getAttribute(attribute) === id,
      ) ?? null
    );
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
    void this.updateComplete.then(() => {
      const el =
        item.kind === 'node'
          ? this.renderedNodeById(item.id)?.querySelector('[part="node-control"]')
          : this.renderedEdgeById(item.id)?.querySelector('[part="edge"]');
      (el as HTMLElement | null)?.focus();
    });
  }

  private applySelection(kind: 'node' | 'edge', id: string, additive: boolean): void {
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
        nodeIds: Object.freeze([...this.selectedNodeIds]),
        edgeIds: Object.freeze([...this.selectedEdgeIds]),
      }),
    );
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
      Object.freeze({ nodeIds: Object.freeze([]), edgeIds: Object.freeze([]) }),
    );
    this.announcer.announce(this.localize('flowSelectionCleared'));
  }

  private deleteSelection(): void {
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

  private onNodeActivate(node: FlowNode, additive: boolean): void {
    this.emit('lr-node-activate', Object.freeze({ nodeId: node.id }));
    this.applySelection('node', node.id, additive);
  }

  private onEdgeActivate(edge: FlowEdge, additive: boolean): void {
    this.emit(
      'lr-edge-activate',
      Object.freeze({ edgeId: edge.id, source: edge.source, target: edge.target }),
    );
    this.applySelection('edge', edge.id, additive);
  }

  private onItemKeyDown(e: KeyboardEvent, index: number, activate: (additive: boolean) => void): void {
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (this.nodesDraggable && !this.locked && (e.ctrlKey || e.metaKey) && arrowKeys.includes(e.key)) {
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
    if (this.connectable && !this.locked && e.key === 'c' && e.target === e.currentTarget) {
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
    let next = index;
    if (e.key === forwardKey || e.key === 'ArrowDown') next = Math.min(count - 1, index + 1);
    else if (e.key === backwardKey || e.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    else return;
    e.preventDefault();
    this.focusActiveItem(next);
  }

  private setActiveItemQuiet(index: number): void {
    const normalized = this.normalizedItemIndex(index);
    if (normalized >= 0) this.activeItemIndex = normalized;
  }

  private itemIndexMaps(): { nodeIndex: Map<string, number>; edgeIndex: Map<string, number> } {
    const items = this.rovingItems();
    const nodeIndex = new Map<string, number>();
    const edgeIndex = new Map<string, number>();
    items.forEach((item, i) => {
      if (item.kind === 'node') nodeIndex.set(item.id, i);
      else edgeIndex.set(item.id, i - nodeIndex.size);
    });
    return { nodeIndex, edgeIndex };
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
    for (const edge of this.edges) {
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
    for (const edgeId of this.nodeIncidentEdges.get(nodeId) ?? []) {
      const edge = this.edges.find((e) => e.id === edgeId);
      const sourceNode = edge && this.nodes.find((n) => n.id === edge.source);
      const targetNode = edge && this.nodes.find((n) => n.id === edge.target);
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

  private updateIncidentEdges(nodeId: string, x: number, y: number): void {
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
        if (this.orientation === 'horizontal' && isRtl(this)) {
          labelEl.setAttribute('transform', `translate(${2 * midX} 0) scale(-1 1)`);
        } else {
          labelEl.removeAttribute('transform');
        }
      }
    }
  }

  private onNodePointerDown(e: PointerEvent, node: FlowNode): void {
    if (!this.nodesDraggable || this.locked) return;
    const wrapper = e.currentTarget as HTMLElement;
    // An unscoped `closest()` match cannot be trusted on its own here: `[part='viewport']` is an
    // ANCESTOR of every node wrapper that itself carries `tabindex="0"` and a `part` other than
    // `"node"`, so `[tabindex]:not([part="node"])` matches it too. `closest()` doesn't stop at
    // shadow-DOM part boundaries, only at shadow-root boundaries, so it walks straight past the
    // wrapper up to the viewport and returns a match unconditionally, which would silently no-op
    // every drag attempt regardless of node content. The `wrapper.contains(...)` guard below
    // restricts the exclusion to genuine interactive DESCENDANTS of this node's own card (the
    // intent -- e.g. a button inside the card) while ignoring ancestor matches outside it.
    const interactive = (e.target as HTMLElement).closest(
      'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([part="node"])',
    );
    if (interactive && interactive !== wrapper && wrapper.contains(interactive)) return;
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
    if (this.locked || !this.nodesDraggable) {
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
    this.endNodeDrag(!this.locked && e.type === 'pointerup');
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
      this.nodesDraggable &&
      this.nodes.some((node) => node.id === drag.nodeId) &&
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
    const resetNode = this.nodes.find((n) => n.id === drag.nodeId);
    const resetPos = resetNode ? this.nodePosition(resetNode) : previous;
    drag.wrapper.style.transform = `translate(${resetPos.x}px, ${resetPos.y}px)`;
    this.updateIncidentEdges(drag.nodeId, resetPos.x, resetPos.y);
    this.dragEdgeRefs = undefined;
    this.requestUpdate();
  }

  private nudgeNode(nodeId: string, key: string): void {
    const node = this.nodes.find((n) => n.id === nodeId);
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
   *  `eligibleConnectTargets()`'s equivalent one-directional rule for the keyboard connect flow. */
  private isInvalidConnectTarget(hoveredId: string): boolean {
    if (!this.connectState) return false;
    if (hoveredId === this.connectState.sourceId) return true;
    return this.edges.some((e) => e.source === this.connectState!.sourceId && e.target === hoveredId);
  }

  private onWorldPointerDown = (e: PointerEvent): void => {
    if (!this.connectable || this.locked || this.connectState) return;
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
    const sourceNode = this.nodes.find((n) => n.id === nodeId);
    if (!sourceNode) return;
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
    if (this.locked || !this.connectable) {
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
    if (this.locked || !this.connectable) {
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
    const sourceNode = this.nodes.find((node) => node.id === state.sourceId);
    const targetNode = this.nodes.find((node) => node.id === targetNodeId);
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
    if (hoveredId === state.sourceId) return true;
    return this.edges.some((e) => e.source === state.sourceId && e.target === hoveredId);
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

  private eligibleConnectTargets(sourceId: string): FlowNode[] {
    return this.nodes.filter((n) => n.id !== sourceId && !this.edges.some((e) => e.source === sourceId && e.target === n.id));
  }

  private startKeyboardConnect(sourceId: string): void {
    const targets = this.eligibleConnectTargets(sourceId);
    if (targets.length === 0) return;
    const sourceNode = this.nodes.find((n) => n.id === sourceId);
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
    const source = this.nodes.find((node) => node.id === sourceId);
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

  private isKeyboardConnectTarget(nodeId: string): boolean {
    if (!this.keyboardConnectSourceId) return false;
    const targets = this.eligibleConnectTargets(this.keyboardConnectSourceId);
    return targets[this.keyboardConnectTargetIndex]?.id === nodeId;
  }

  private commitKeyboardConnect(): void {
    const sourceId = this.keyboardConnectSourceId;
    if (!sourceId) return;
    const targets = this.eligibleConnectTargets(sourceId);
    const target = targets[this.keyboardConnectTargetIndex];
    this.keyboardConnectSourceId = null;
    if (!target) return;
    const sourceOutputs = this.nodes.find((n) => n.id === sourceId)?.outputs ?? [{ id: 'out' }];
    const targetInputs = target.inputs ?? [{ id: 'in' }];
    if (!this.connectable || this.locked) return;
    this.emit(
      'lr-connect',
      Object.freeze({
        source: sourceId,
        target: target.id,
        sourceHandle: sourceOutputs[0]?.id ?? 'out',
        targetHandle: targetInputs[0]?.id ?? 'in',
      }),
    );
    const source = this.nodes.find((node) => node.id === sourceId);
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

  private renderEdges(nodeIndex: Map<string, number>, edgeIndex: Map<string, number>): SVGTemplateResult {
    const resolvedById = new Map(this.nodes.map((n) => [n.id, this.resolvedNode(n)]));
    const items: SVGTemplateResult[] = [];
    const ownerWindow = this.ownerDocument?.defaultView;
    const reducedMotion = !ownerWindow || prefersReducedMotion(ownerWindow);
    const counterMirrorLabels =
      this.orientation === 'horizontal' && !!this.ownerDocument?.defaultView && isRtl(this);
    for (const edge of this.edges) {
      const sourceResolved = resolvedById.get(edge.source);
      if (!sourceResolved) continue; // no position to draw from -- dropped entirely
      const targetResolved = resolvedById.get(edge.target);
      const sourcePt = this.handlePoint(sourceResolved, 'output', edge.sourceHandle ?? 'out');
      if (!targetResolved) {
        const stubPt = { x: sourcePt.x + 14, y: sourcePt.y + 14 };
        items.push(svg`<line
          part="stub"
          aria-hidden="true"
          x1=${sourcePt.x} y1=${sourcePt.y}
          x2=${stubPt.x} y2=${stubPt.y}
        ></line>`);
        continue;
      }
      const targetPt = this.handlePoint(targetResolved, 'input', edge.targetHandle ?? 'in');
      const midX = (sourcePt.x + targetPt.x) / 2;
      const midY = (sourcePt.y + targetPt.y) / 2;
      const index = nodeIndex.size + (edgeIndex.get(edge.id) ?? 0);
      const active = this.normalizedItemIndex() === index;
      const selected = this.selectedEdgeIds.includes(edge.id);
      const path = this.edgePathD(sourcePt, targetPt);
      const tone = this.edgeTone(edge);
      items.push(svg`<g data-edge-id=${edge.id}>
        <path
          part="edge-hit-area"
          aria-hidden="true"
          tabindex="-1"
          d=${path}
          @click=${(e: MouseEvent) => this.onEdgeActivate(edge, e.ctrlKey || e.metaKey)}
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
          @click=${(e: MouseEvent) => this.onEdgeActivate(edge, e.ctrlKey || e.metaKey)}
          @focus=${() => this.onItemFocus(index)}
          @keydown=${(e: KeyboardEvent) =>
            this.onItemKeyDown(e, index, (additive) => this.onEdgeActivate(edge, additive))}
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
      </g>`);
    }
    return svg`${items}`;
  }

  private renderNodes(nodeIndex: Map<string, number>): TemplateResult {
    const ownerRegistry = this.ownerDocument?.defaultView?.customElements;
    // Same-origin documents have independent custom-element registries. A canvas adopted into an
    // iframe must not instantiate a main-realm `lr-flow-node` whose constructed stylesheets cannot
    // be shared with that document. Keep SSR on the canonical declarative tag, but use equivalent
    // native fallback markup in a live owner realm where the granular node definition is absent.
    const canRenderFlowNode = !ownerRegistry || !!ownerRegistry.get(tag('flow-node'));
    return html`${repeat(
      this.nodes,
      (node) => node.id,
      (node) => {
        const resolved = this.resolvedNode(node);
        const index = nodeIndex.get(node.id) ?? 0;
        const active = this.normalizedItemIndex() === index;
        const selected = this.selectedNodeIds.includes(node.id);
        const heading = typeof node.data?.['label'] === 'string' ? node.data['label'] : node.id;
        const description =
          typeof node.data?.['description'] === 'string' ? node.data['description'] : '';
        const decoration = this.decorations?.[node.id];
        const typePart = nodeTypePart(node.type);
        return html`<div
          part="node"
          data-node-id=${node.id}
          data-type=${node.type ?? nothing}
          data-connect-target=${this.isKeyboardConnectTarget(node.id) ? '' : nothing}
          data-selected=${selected ? '' : nothing}
          role="group"
          aria-label=${this.nodeAccessibleText(node)}
          style="transform:translate(${resolved.x}px,${resolved.y}px)"
          @click=${(e: MouseEvent) => this.onNodeActivate(node, e.ctrlKey || e.metaKey)}
          @pointerdown=${(e: PointerEvent) => this.onNodePointerDown(e, node)}
        >
          <button
            part="node-control"
            class="sr-only"
            type="button"
            tabindex=${active ? '0' : '-1'}
            aria-label=${this.nodeAccessibleText(node)}
            aria-pressed=${selected ? 'true' : 'false'}
            @click=${(e: MouseEvent) => {
              e.stopPropagation();
              this.onNodeActivate(node, e.ctrlKey || e.metaKey);
            }}
            @focus=${() => this.onItemFocus(index)}
            @keydown=${(e: KeyboardEvent) =>
              this.onItemKeyDown(e, index, (additive) => this.onNodeActivate(node, additive))}
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
                  .inputs=${node.inputs ?? [{ id: 'in' }]}
                  .outputs=${node.outputs ?? [{ id: 'out' }]}
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
                    ${(node.inputs ?? [{ id: 'in' }]).map(
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
                    ${(node.outputs ?? [{ id: 'out' }]).map(
                      (handle) => html`<span
                        part="node-card-handle node-card-handle-output"
                        data-handle-kind="output"
                        data-handle-id=${handle.id}
                      ></span>`,
                    )}
                  </div>
                </div>`}
          </slot>
        </div>`;
      },
    )}`;
  }

  override render(): TemplateResult {
    const isEmpty = this.nodes.length === 0;
    const { nodeIndex, edgeIndex } = this.itemIndexMaps();
    const nodeIds = new Set(this.nodes.map((node) => node.id));
    const fallbackEdges = this.edges.filter(
      (edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target),
    );
    return html`<div part="base" role="region" aria-label=${this.accessibleLabel || this.localize('flowCanvasLabel')}>
      <div
        part="viewport"
        role="group"
        tabindex="0"
        aria-label=${this.accessibleLabel ||
        this.localize('flowCanvasSummary', undefined, {
          nodeCount: this.formatNumber(this.nodes.length),
          edgeCount: this.formatNumber(this.edges.length),
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
            ${this.renderEdges(nodeIndex, edgeIndex)}
            ${this.connecting ? svg`<path part="connection-line" d=""></path>` : ''}
          </svg>
          ${isEmpty ? nothing : this.renderNodes(nodeIndex)}
        </div>
        ${isEmpty
          ? html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`
          : nothing}
      </div>
      ${this.layoutTruncated
        ? html`<div part="layout-limit">
            ${this.localize('flowCanvasLayoutLimit')}
          </div>`
        : nothing}
      ${isEmpty
        ? nothing
        : html`
            <div part="live-region" class="sr-only" aria-hidden="true" id=${this.liveRegionId}>
              ${this.liveText}
            </div>
            ${fallbackEdges.length > 0
              ? html`<ul part="edge-list" class="sr-only" aria-label=${this.localize('flowEdgeList')}>
                  ${fallbackEdges.map((edge) => html`<li>${this.edgeAccessibleText(edge)}</li>`)}
                </ul>`
              : nothing}
            <slot></slot>
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
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-flow-canvas': LyraFlowCanvas;
  }
}
