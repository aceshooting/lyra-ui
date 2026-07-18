import { html, nothing, svg, type TemplateResult, type SVGTemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { tag } from '../../internal/prefix.js';
import { nextId, srOnly } from '../../internal/a11y.js';
import { Announcer } from '../../internal/announcer.js';
import { isRtl } from '../../internal/rtl.js';
import { prefersReducedMotion } from '../../internal/motion.js';
import { layeredLayout } from '../../internal/layered-layout.js';
import { styles } from './flow-canvas.styles.js';

export interface FlowHandle {
  id: string;
  label?: string;
}

export interface FlowNode {
  id: string;
  /** Palette/host taxonomy; echoed in `lyra-node-add`, styleable via a `[data-type]` selector on
   *  the adopted card's wrapper. */
  type?: string;
  /** Content coordinates. Absent means "let auto-layout place it" — see `runAutoLayoutIfNeeded()`. */
  position?: { x: number; y: number };
  /** The default card reads `label`/`description` (strings) from here; arbitrary otherwise. */
  data?: Record<string, unknown>;
  /** Spoken-name override; falls back to `data.label`, then `id`. */
  accessibleLabel?: string;
  inputs?: FlowHandle[];
  outputs?: FlowHandle[];
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  /** Drawn at the edge midpoint (unlike `lyra-graph`'s `GraphLink.label`, which is spoken-only). */
  label?: string;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
}

/** The existing tool-lifecycle status enum, reused verbatim. */
export type FlowRunStatus = 'pending' | 'running' | 'success' | 'error' | 'denied';

export interface FlowRunDecoration {
  status: FlowRunStatus;
  progress?: number;
  durationMs?: number;
  detail?: string;
}

export type FlowRunDecorations = Record<string, FlowRunDecoration>;

export interface FlowStructureSnapshot {
  nodes: { id: string; x: number; y: number; width: number; height: number; status?: FlowRunStatus }[];
  edges: { id: string; source: string; target: string; status?: FlowRunStatus }[];
  viewport: { x: number; y: number; zoom: number; width: number; height: number };
}

/** The `dragstart`/`dragover`/`drop` MIME type shared between `lyra-node-palette` and this
 *  canvas's `droppable` handling — a single exported constant so the two files can never
 *  disagree on the literal string. */
export const FLOW_PALETTE_MIME_TYPE = 'application/lyra-flow-node';

const CONNECT_OFFSET_MIN = 24;
const CONNECT_OFFSET_MAX = 120;
const ZOOM_MULTIPLIER = 1.2;
const DEFAULT_FIT_PADDING = 24;
const KEYBOARD_PAN_STEP = 32;

function toggledSelection(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export interface LyraFlowCanvasEventMap {
  'lyra-node-click': CustomEvent<{ id: string }>;
  'lyra-edge-click': CustomEvent<{ id: string; source: string; target: string }>;
  'lyra-selection-change': CustomEvent<{ nodeIds: string[]; edgeIds: string[] }>;
  'lyra-node-move': CustomEvent<{
    id: string;
    position: { x: number; y: number };
    previous: { x: number; y: number };
  }>;
  'lyra-connect': CustomEvent<{ source: string; target: string; sourceHandle: string; targetHandle: string }>;
  'lyra-node-add': CustomEvent<{ type: string; position: { x: number; y: number } }>;
  'lyra-selection-delete': CustomEvent<{ nodeIds: string[]; edgeIds: string[] }>;
  'lyra-viewport-change': CustomEvent<{ x: number; y: number; zoom: number }>;
  'lyra-layout-change': CustomEvent<{ positions: Record<string, { x: number; y: number }> }>;
}

/** A light-DOM-adopted card element (the default `lyra-flow-node`, or an arbitrary consumer-authored
 *  custom element) — a structural type, not an import of `LyraFlowNode`, so this module never
 *  depends on the `flow-node` component module load order. */
interface FlowNodeCardEl extends HTMLElement {
  nodeId: string;
  heading: string;
  status: FlowRunStatus | null;
  progress: number | null;
  statusDetail: string;
  durationMs: number | null;
  selected: boolean;
  inputs: FlowHandle[];
  outputs: FlowHandle[];
}

/**
 * `<lyra-flow-canvas>` — a pannable/zoomable DAG workflow canvas: positions HTML node cards, draws
 * SVG edges between their handles, runs a shared layered auto-layout for unpositioned nodes, and owns
 * all selection/drag/connect interaction as controlled events. Readonly (viewer) by default; opt into
 * editor gestures individually via `nodes-draggable`, `connectable`, `droppable`. Never mutates `nodes`
 * or `edges` itself — every edit intent is an event the host applies, mirroring `lyra-stepper`/
 * `lyra-table`'s controlled-component contract.
 *
 * @customElement lyra-flow-canvas
 * @slot - `lyra-flow-node` children to adopt by `node-id`; non-matching children are ignored with a
 *   console warning.
 * @slot top-start - Floating corner overlay (e.g. `lyra-flow-run-overlay`).
 * @slot top-end - Floating corner overlay.
 * @slot bottom-start - Floating corner overlay (e.g. `lyra-flow-controls`).
 * @slot bottom-end - Floating corner overlay (e.g. `lyra-flow-minimap`).
 * @event lyra-node-click - `detail: { id }`.
 * @event lyra-edge-click - `detail: { id, source, target }`.
 * @event lyra-selection-change - `detail: { nodeIds, edgeIds }`.
 * @event lyra-node-move - `detail: { id, position, previous }`.
 * @event lyra-connect - `detail: { source, target, sourceHandle, targetHandle }`.
 * @event lyra-node-add - `detail: { type, position }`.
 * @event lyra-selection-delete - `detail: { nodeIds, edgeIds }`.
 * @event lyra-viewport-change - `detail: { x, y, zoom }`.
 * @event lyra-layout-change - `detail: { positions }`.
 * @csspart base - The root wrapper.
 * @csspart viewport - The focusable pan/zoom surface.
 * @csspart background - The dotted background grid.
 * @csspart edges - The edges SVG.
 * @csspart edge - A single edge path.
 * @csspart edge-label - An edge's drawn label.
 * @csspart arrowhead - The shared directed-edge arrowhead marker.
 * @csspart stub - A dangling-edge stub line.
 * @csspart connection-line - The in-progress connect-gesture path.
 * @csspart node - A node's positioned wrapper.
 * @csspart empty - The `lyra-empty` shown when `nodes` is empty.
 * @csspart live-region - The current item/gesture announcement.
 * @csspart edge-list - A visually hidden list of every edge.
 * @cssprop [--lyra-flow-canvas-grid-size=8px] - Dotted background spacing.
 * @cssprop [--lyra-flow-canvas-march-duration=var(--lyra-transition-ambient)] - Running-edge march animation duration.
 */
export class LyraFlowCanvas extends LyraElement<LyraFlowCanvasEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

  @property({ attribute: false }) nodes: FlowNode[] = [];
  @property({ attribute: false }) edges: FlowEdge[] = [];
  @property({ reflect: true }) orientation: 'horizontal' | 'vertical' = 'horizontal';
  @property({ type: Boolean, attribute: 'nodes-draggable' }) nodesDraggable = false;
  @property({ type: Boolean }) connectable = false;
  @property({ type: Boolean }) droppable = false;
  @property({ type: Boolean, reflect: true }) locked = false;
  @property({ attribute: false }) selectedNodeIds: string[] = [];
  @property({ attribute: false }) selectedEdgeIds: string[] = [];
  @property({ type: Number, attribute: 'min-zoom' }) minZoom = 0.25;
  @property({ type: Number, attribute: 'max-zoom' }) maxZoom = 2;
  /** Snap step, in content px, for drags/nudges/drop positions; `0` disables snapping. Also the
   *  dotted background's base spacing. */
  @property({ type: Number }) grid = 8;
  @property({ type: Number, attribute: 'layer-gap' }) layerGap = 64;
  @property({ type: Number, attribute: 'node-gap' }) nodeGap = 24;
  @property({ attribute: false }) decorations: FlowRunDecorations | null = null;
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private readonly arrowMarkerId = nextId('flow-canvas-arrow');
  private readonly liveRegionId = nextId('flow-canvas-live');
  private readonly announcer = new Announcer({ onFlush: (text) => (this.liveText = text) });
  @state() private liveText = '';
  @state() private activeItemIndex = 0;
  @state() private connecting = false;
  @state() private keyboardConnectSourceId: string | null = null;
  @state() private keyboardConnectTargetIndex = 0;

  /** Auto-layout-assigned positions for nodes lacking an explicit `position`. Empty until the first
   *  layout pass runs; `nodePosition()` reads from it. */
  private autoPositions = new Map<string, { x: number; y: number }>();
  /** Per-node measured wrapper size (`ResizeObserver`-driven) — plain map, not reactive state, read
   *  by every geometry helper below. */
  private measuredSizes = new Map<string, { width: number; height: number }>();

  private resizeObserver?: ResizeObserver;
  private readonly observedNodeEls = new WeakSet<Element>();
  private layoutRaf: number | null = null;

  private panX = 0;
  private panY = 0;
  private zoomLevel = 1;
  private viewportEl?: HTMLElement;
  private worldEl?: HTMLElement;
  private viewportChangeRaf: number | null = null;
  private hasFitOnce = false;
  private panDrag?: { pointerId: number; startClientX: number; startClientY: number; startPanX: number; startPanY: number };

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
  };
  private nodeIncidentEdges = new Map<string, string[]>();

  private connectState?: { sourceId: string; sourceHandle: string; startPt: { x: number; y: number } };
  private connectionLineEl?: SVGPathElement;
  private connectInvalidNodeId: string | null = null;

  private companionCallbacks = new Set<(snapshot: FlowStructureSnapshot) => void>();
  private companionRaf: number | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver((entries) => this.onNodesResized(entries));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    if (this.layoutRaf != null) cancelAnimationFrame(this.layoutRaf);
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('nodes')) {
      this.syncDefaultCards();
    }
    if (changed.has('nodes') || changed.has('selectedNodeIds') || changed.has('decorations')) {
      this.pushCardPropsAll();
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('edges')) this.rebuildIncidentEdgesIndex();
    if (changed.has('nodes') || changed.has('edges')) {
      this.runAutoLayoutIfNeeded();
      this.scheduleCompanionNotify();
    }
    if (changed.has('decorations')) this.scheduleCompanionNotify();
    for (const el of Array.from(this.renderRoot.querySelectorAll('[part="node"]'))) {
      if (!this.observedNodeEls.has(el)) {
        this.observedNodeEls.add(el);
        this.resizeObserver?.observe(el);
      }
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

  /** By-`node-id` reconciliation of light-DOM children: a user-authored child gets `slot="node-{id}"`
   *  set on it; a data node with no matching light-DOM child gets a default `<lyra-flow-node>`
   *  created and appended (marked `data-flow-canvas-default-card` so it — and only it — is removed
   *  again once its node id disappears). Mirrors `lyra-tree`'s `syncNodes()` by-id reconciliation. A
   *  light-DOM child whose `node-id` matches no current node is left in place with no `slot` (renders
   *  nowhere) and a console warning, exactly like an unrecognized top-level child of any other
   *  slot-adopting component in this library. */
  private syncDefaultCards(): void {
    const ids = new Set(this.nodes.map((n) => n.id));
    const byNodeId = new Map<string, Element>();
    for (const child of Array.from(this.children)) {
      const nodeId = child.getAttribute('node-id');
      if (!nodeId) continue;
      byNodeId.set(nodeId, child);
      if (ids.has(nodeId)) {
        child.setAttribute('slot', `node-${nodeId}`);
      } else {
        child.removeAttribute('slot');
        console.warn(
          `<lyra-flow-canvas> a child with node-id="${nodeId}" matches no entry in \`nodes\`; it will not render.`,
        );
      }
    }
    for (const [nodeId, child] of byNodeId) {
      if (!ids.has(nodeId) && child.hasAttribute('data-flow-canvas-default-card')) {
        child.remove();
        byNodeId.delete(nodeId);
      }
    }
    for (const node of this.nodes) {
      if (byNodeId.has(node.id)) continue;
      const card = document.createElement(tag('flow-node')) as FlowNodeCardEl;
      card.setAttribute('node-id', node.id);
      card.setAttribute('data-flow-canvas-default-card', '');
      card.setAttribute('slot', `node-${node.id}`);
      card.nodeId = node.id;
      card.heading = typeof node.data?.label === 'string' ? node.data.label : node.id;
      if (typeof node.data?.description === 'string') card.textContent = node.data.description;
      this.appendChild(card);
    }
  }

  /** Pushes `inputs`/`outputs`/`selected`/decoration-derived `status`/`progress`/`statusDetail` onto
   *  every currently-adopted card (default or user-authored) so handles and run paint always match
   *  the model, regardless of which slot mechanism produced the card. */
  private pushCardPropsAll(): void {
    for (const node of this.nodes) {
      const el = this.querySelector(`[node-id="${CSS.escape(node.id)}"]`) as FlowNodeCardEl | null;
      if (!el) continue;
      el.inputs = node.inputs ?? [{ id: 'in' }];
      el.outputs = node.outputs ?? [{ id: 'out' }];
      el.selected = this.selectedNodeIds.includes(node.id);
      const decoration = this.decorations?.[node.id];
      el.status = decoration?.status ?? null;
      el.progress = decoration?.progress ?? null;
      el.statusDetail = decoration?.detail ?? '';
      el.durationMs = decoration?.durationMs ?? null;
    }
  }

  // ---------------------------------------------------------------------
  // Geometry helpers
  // ---------------------------------------------------------------------

  private nodePosition(node: FlowNode): { x: number; y: number } {
    return node.position ?? this.autoPositions.get(node.id) ?? { x: 0, y: 0 };
  }

  private nodeSize(id: string): { width: number; height: number } {
    return this.measuredSizes.get(id) ?? { width: 176, height: 64 }; // 11rem/4rem @ 16px, pre-measure fallback
  }

  private resolvedNode(node: FlowNode): { node: FlowNode; x: number; y: number; width: number; height: number } {
    const pos = this.nodePosition(node);
    const size = this.nodeSize(node.id);
    return { node, x: pos.x, y: pos.y, width: size.width, height: size.height };
  }

  /** Evenly distributes `count` handles along a `span`-px edge (index 0-based) — matches
   *  `justify-content: space-around` so `lyra-flow-node`'s handle-column CSS lines up with this
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
    const label = typeof node.data?.label === 'string' ? node.data.label : node.id;
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
      const id = (entry.target as HTMLElement).dataset.nodeId;
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

  private scheduleLayoutPass(): void {
    if (this.layoutRaf != null) return;
    this.layoutRaf = requestAnimationFrame(() => {
      this.layoutRaf = null;
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
   *  Deviation from the plan brief (documented per this task's execution instructions): the real
   *  `../../internal/layered-layout.ts` export is `layeredLayout({ nodes, edges, options })` — a
   *  single object argument — not the two-argument `layeredLayout(graph, options?)` curried form the
   *  brief assumed; the call below uses the real shape. The brief also assumed the util treats its
   *  own `x` as the layering axis ("this canvas is what remaps that to the visual axis"); the util's
   *  own JSDoc says the opposite -- "coordinates assigned top -> bottom (block axis)... left -> right
   *  within a layer" -- i.e. `y` is the layer/downstream axis and `x` is the in-layer sibling axis
   *  (confirmed further by `nodeGap`'s default of 24 matching the util's own `gapX` default, and
   *  `layerGap`'s default of 64 being the same order of magnitude as the util's `gapY` default of
   *  100). `swap` below reconciles the two frames: canvas `orientation="vertical"` (downstream = y)
   *  already matches the util's native frame directly, so only `orientation="horizontal"`
   *  (downstream = x) needs both axes swapped when talking to the util, and `gapX`/`gapY` are always
   *  passed as `nodeGap`/`layerGap` respectively (never swapped) since those map to the util's own
   *  fixed sibling/layer axes regardless of how the *result* is later remapped into canvas space.
   *  The util also documents its return value as "raw box centers", whereas this canvas's own
   *  `position` convention (see `render()`'s `translate(x,y)` and `[part='node']`'s
   *  `inset-block-start/inline-start: 0`) is a top-left corner -- `nodeSize()` is used to convert
   *  between the two in both directions (`fixedPositions` in, the returned map out). */
  private runAutoLayoutIfNeeded(): void {
    const unpositioned = this.nodes.filter((n) => !n.position);
    if (unpositioned.length === 0) return;
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
      options: { gapX: this.nodeGap, gapY: this.layerGap, fixedPositions },
    });
    const positions: Record<string, { x: number; y: number }> = {};
    for (const n of unpositioned) {
      const raw = result.get(n.id);
      if (!raw) continue;
      const center = swap ? { x: raw.y, y: raw.x } : { x: raw.x, y: raw.y };
      const size = this.nodeSize(n.id);
      const resolved = { x: center.x - size.width / 2, y: center.y - size.height / 2 };
      this.autoPositions.set(n.id, resolved);
      positions[n.id] = resolved;
    }
    if (Object.keys(positions).length > 0) this.emit('lyra-layout-change', { positions });
  }

  // ---------------------------------------------------------------------
  // Pan / zoom / viewport
  // ---------------------------------------------------------------------

  get viewport(): { x: number; y: number; zoom: number } {
    return { x: this.panX, y: this.panY, zoom: this.zoomLevel };
  }

  setViewport(next: { x: number; y: number; zoom: number }): void {
    this.panX = next.x;
    this.panY = next.y;
    this.zoomLevel = this.clampZoom(next.zoom);
    this.applyWorldTransform();
    this.emit('lyra-viewport-change', { x: this.panX, y: this.panY, zoom: this.zoomLevel });
  }

  zoomIn = (): void => {
    if (this.locked) return;
    this.zoomAtCenter(this.zoomLevel * ZOOM_MULTIPLIER);
  };

  zoomOut = (): void => {
    if (this.locked) return;
    this.zoomAtCenter(this.zoomLevel / ZOOM_MULTIPLIER);
  };

  resetZoom = (): void => {
    if (this.locked) return;
    this.setViewport({ x: this.panX, y: this.panY, zoom: 1 });
  };

  fit(options?: { padding?: number }): void {
    if (this.nodes.length === 0) return;
    const padding = options?.padding ?? DEFAULT_FIT_PADDING;
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

  registerCompanion(cb: (snapshot: FlowStructureSnapshot) => void): () => void {
    this.companionCallbacks.add(cb);
    this.scheduleCompanionNotify();
    return () => {
      this.companionCallbacks.delete(cb);
    };
  }

  private scheduleCompanionNotify(): void {
    if (this.companionRaf != null || this.companionCallbacks.size === 0) return;
    this.companionRaf = requestAnimationFrame(() => {
      this.companionRaf = null;
      const snapshot = this.buildSnapshot();
      for (const cb of this.companionCallbacks) cb(snapshot);
    });
  }

  private buildSnapshot(): FlowStructureSnapshot {
    const rect = this.viewportEl?.getBoundingClientRect();
    return {
      nodes: this.nodes.map((n) => {
        const resolved = this.resolvedNode(n);
        return {
          id: n.id,
          x: resolved.x,
          y: resolved.y,
          width: resolved.width,
          height: resolved.height,
          status: this.decorations?.[n.id]?.status,
        };
      }),
      edges: this.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, status: this.decorations?.[e.id]?.status })),
      viewport: { x: this.panX, y: this.panY, zoom: this.zoomLevel, width: rect?.width ?? 0, height: rect?.height ?? 0 },
    };
  }

  private clampZoom(z: number): number {
    return Math.min(this.maxZoom, Math.max(this.minZoom, z));
  }

  private applyWorldTransform(): void {
    if (this.worldEl) this.worldEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
    this.scheduleCompanionNotify();
  }

  private scheduleViewportChange(): void {
    if (this.viewportChangeRaf != null) return;
    this.viewportChangeRaf = requestAnimationFrame(() => {
      this.viewportChangeRaf = null;
      this.emit('lyra-viewport-change', { x: this.panX, y: this.panY, zoom: this.zoomLevel });
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
  private localWorldX(clientX: number, rect: DOMRect): number {
    const local = clientX - rect.left;
    return this.orientation === 'horizontal' && isRtl(this) ? rect.width - local : local;
  }

  private onWheel = (e: WheelEvent): void => {
    if (this.locked || !this.viewportEl) return;
    e.preventDefault();
    const rect = this.viewportEl.getBoundingClientRect();
    const localX = this.localWorldX(e.clientX, rect);
    const localY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? ZOOM_MULTIPLIER : 1 / ZOOM_MULTIPLIER;
    this.zoomAtPoint(localX, localY, this.zoomLevel * factor);
  };

  private onBackgroundPointerDown = (e: PointerEvent): void => {
    if (this.locked) return;
    this.panDrag = { pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, startPanX: this.panX, startPanY: this.panY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.viewportEl?.setAttribute('data-panning', '');
    window.addEventListener('pointermove', this.onBackgroundPointerMove);
    window.addEventListener('pointerup', this.onBackgroundPointerUp);
    window.addEventListener('pointercancel', this.onBackgroundPointerUp);
    window.addEventListener('lostpointercapture', this.onBackgroundPointerUp);
  };

  private onBackgroundPointerMove = (e: PointerEvent): void => {
    const drag = this.panDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    // Panning tracks the pointer's *physical* direction, so under the RTL ancestor mirror the
    // stored panX delta must be negated to still visually follow the cursor.
    const rtlFlip = this.orientation === 'horizontal' && isRtl(this) ? -1 : 1;
    this.panX = drag.startPanX + (e.clientX - drag.startClientX) * rtlFlip;
    this.panY = drag.startPanY + (e.clientY - drag.startClientY);
    this.applyWorldTransform();
    this.scheduleViewportChange();
  };

  private onBackgroundPointerUp = (e: PointerEvent): void => {
    if (!this.panDrag || e.pointerId !== this.panDrag.pointerId) return;
    this.panDrag = undefined;
    this.viewportEl?.removeAttribute('data-panning');
    window.removeEventListener('pointermove', this.onBackgroundPointerMove);
    window.removeEventListener('pointerup', this.onBackgroundPointerUp);
    window.removeEventListener('pointercancel', this.onBackgroundPointerUp);
    window.removeEventListener('lostpointercapture', this.onBackgroundPointerUp);
  };

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
      this.panBy(-KEYBOARD_PAN_STEP, 0);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.panBy(KEYBOARD_PAN_STEP, 0);
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
    let payload: { type?: string };
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (!payload.type) return;
    const contentPoint = this.toContentPoint(e.clientX, e.clientY);
    this.emit('lyra-node-add', {
      type: payload.type,
      position: { x: this.snap(contentPoint.x), y: this.snap(contentPoint.y) },
    });
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

  private rovingItems(): { kind: 'node' | 'edge'; id: string }[] {
    return [
      ...this.spatialNodeOrder().map((n) => ({ kind: 'node' as const, id: n.id })),
      ...this.edges.map((e) => ({ kind: 'edge' as const, id: e.id })),
    ];
  }

  private itemCount(): number {
    return this.nodes.length + this.edges.length;
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
        index: index + 1,
        total: this.itemCount(),
      }),
    );
  }

  private onItemFocus(index: number): void {
    if (this.normalizedItemIndex(index) < 0) return;
    this.activeItemIndex = index;
    this.announceItem(index);
  }

  private focusActiveItem(index = this.activeItemIndex): void {
    const normalized = this.normalizedItemIndex(index);
    if (normalized < 0) return;
    this.activeItemIndex = normalized;
    this.announceItem(normalized);
    void this.updateComplete.then(() => {
      const items = [
        ...Array.from(this.renderRoot.querySelectorAll('[part="node"]')),
        ...Array.from(this.renderRoot.querySelectorAll('[part="edge"]')),
      ] as HTMLElement[];
      items[normalized]?.focus();
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
    this.emit('lyra-selection-change', { nodeIds: this.selectedNodeIds, edgeIds: this.selectedEdgeIds });
    const selected = kind === 'node' ? this.selectedNodeIds.includes(id) : this.selectedEdgeIds.includes(id);
    const label = this.itemAccessibleText({ kind, id });
    this.announcer.announce(this.localize(selected ? 'flowNodeSelected' : 'flowNodeDeselected', undefined, { label }));
  }

  private clearSelection(): void {
    if (this.selectedNodeIds.length === 0 && this.selectedEdgeIds.length === 0) return;
    this.selectedNodeIds = [];
    this.selectedEdgeIds = [];
    this.emit('lyra-selection-change', { nodeIds: [], edgeIds: [] });
    this.announcer.announce(this.localize('flowSelectionCleared'));
  }

  private deleteSelection(): void {
    if (!this.nodesDraggable && !this.connectable && !this.droppable) return;
    if (this.selectedNodeIds.length === 0 && this.selectedEdgeIds.length === 0) return;
    this.emit('lyra-selection-delete', { nodeIds: this.selectedNodeIds, edgeIds: this.selectedEdgeIds });
  }

  private onNodeActivate(node: FlowNode, additive: boolean): void {
    this.emit('lyra-node-click', { id: node.id });
    this.applySelection('node', node.id, additive);
  }

  private onEdgeActivate(edge: FlowEdge, additive: boolean): void {
    this.emit('lyra-edge-click', { id: edge.id, source: edge.source, target: edge.target });
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
    return this.grid > 0 ? Math.round(value / this.grid) * this.grid : value;
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

  private updateIncidentEdges(nodeId: string, x: number, y: number): void {
    for (const edgeId of this.nodeIncidentEdges.get(nodeId) ?? []) {
      const edge = this.edges.find((e) => e.id === edgeId);
      const sourceNode = edge && this.nodes.find((n) => n.id === edge.source);
      const targetNode = edge && this.nodes.find((n) => n.id === edge.target);
      if (!edge || !sourceNode || !targetNode) continue;
      const sourceResolved = edge.source === nodeId ? { ...this.resolvedNode(sourceNode), x, y } : this.resolvedNode(sourceNode);
      const targetResolved = edge.target === nodeId ? { ...this.resolvedNode(targetNode), x, y } : this.resolvedNode(targetNode);
      const sourcePt = this.handlePoint(sourceResolved, 'output', edge.sourceHandle ?? 'out');
      const targetPt = this.handlePoint(targetResolved, 'input', edge.targetHandle ?? 'in');
      const group = this.renderRoot.querySelector(`[data-edge-id="${CSS.escape(edgeId)}"]`);
      group?.querySelector('[part="edge"]')?.setAttribute('d', this.edgePathD(sourcePt, targetPt));
      const label = group?.querySelector('[part="edge-label"]');
      if (label) {
        label.setAttribute('x', String((sourcePt.x + targetPt.x) / 2));
        label.setAttribute('y', String((sourcePt.y + targetPt.y) / 2));
      }
    }
  }

  private onNodePointerDown(e: PointerEvent, node: FlowNode): void {
    if (!this.nodesDraggable || this.locked) return;
    const wrapper = e.currentTarget as HTMLElement;
    // Deviation from the plan brief: the brief's literal `(e.target).closest(selector)` (with no
    // scoping) also matches `[part='viewport']` -- an ANCESTOR of every node wrapper that (Slice D)
    // itself carries `tabindex="0"` and a `part` other than `"node"`, so `[tabindex]:not([part=
    // "node"])` matches it too. `closest()` doesn't stop at shadow-DOM part boundaries, only at
    // shadow-root boundaries, so it walks straight past the wrapper up to the viewport and returns a
    // match unconditionally, silently no-op'ing every drag attempt regardless of node content. The
    // `wrapper.contains(...)` guard below restricts the exclusion to genuine interactive DESCENDANTS
    // of this node's own card (the intent -- e.g. a button inside the card) while ignoring ancestor
    // matches outside it.
    const interactive = (e.target as HTMLElement).closest(
      'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([part="node"])',
    );
    if (interactive && interactive !== wrapper && wrapper.contains(interactive)) return;
    e.stopPropagation();
    const start = this.nodePosition(node);
    this.nodeDrag = { pointerId: e.pointerId, nodeId: node.id, startClientX: e.clientX, startClientY: e.clientY, startX: start.x, startY: start.y, wrapper };
    wrapper.setPointerCapture?.(e.pointerId);
    window.addEventListener('pointermove', this.onNodePointerMove);
    window.addEventListener('pointerup', this.onNodePointerUp);
    window.addEventListener('pointercancel', this.onNodePointerUp);
    window.addEventListener('lostpointercapture', this.onNodePointerUp);
  }

  private onNodePointerMove = (e: PointerEvent): void => {
    const drag = this.nodeDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const rtlFlip = this.orientation === 'horizontal' && isRtl(this) ? -1 : 1;
    const dx = ((e.clientX - drag.startClientX) * rtlFlip) / this.zoomLevel;
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
    this.nodeDrag = undefined;
    window.removeEventListener('pointermove', this.onNodePointerMove);
    window.removeEventListener('pointerup', this.onNodePointerUp);
    window.removeEventListener('pointercancel', this.onNodePointerUp);
    window.removeEventListener('lostpointercapture', this.onNodePointerUp);
    const previous = { x: drag.startX, y: drag.startY };
    const position = { x: drag.currentX ?? drag.startX, y: drag.currentY ?? drag.startY };
    if (position.x !== previous.x || position.y !== previous.y) {
      this.emit('lyra-node-move', { id: drag.nodeId, position, previous });
    }
    // Deviation from the plan brief: relying on `requestUpdate()` alone (the brief's literal
    // comment: "snaps the wrapper back to the ... data position") does not actually reset anything
    // when the host doesn't apply the move (or applies the identical position) -- Lit's own
    // AttributePart dirty-checks the *interpolated string* against what Lit itself last committed,
    // and that string is unchanged from the pre-drag render (this loop's imperative
    // `drag.wrapper.style.transform = ...` writes during the drag never went through Lit, so Lit's
    // cached value was never invalidated). `requestUpdate()` therefore re-renders but skips
    // rewriting this exact attribute, leaving the mid-drag transform stuck. Writing the reset
    // transform directly (looked up fresh by id, in case a synchronous host listener already
    // applied a new position) fixes the visible state immediately regardless of Lit's diffing.
    const resetNode = this.nodes.find((n) => n.id === drag.nodeId);
    const resetPos = resetNode ? this.nodePosition(resetNode) : previous;
    drag.wrapper.style.transform = `translate(${resetPos.x}px, ${resetPos.y}px)`;
    this.requestUpdate();
  };

  private nudgeNode(nodeId: string, key: string): void {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const current = this.nodePosition(node);
    const step = this.grid > 0 ? this.grid : 1;
    const rtlFlip = this.orientation === 'horizontal' && isRtl(this) ? -1 : 1;
    let dx = 0;
    let dy = 0;
    if (key === 'ArrowRight') dx = step * rtlFlip;
    else if (key === 'ArrowLeft') dx = -step * rtlFlip;
    else if (key === 'ArrowDown') dy = step;
    else if (key === 'ArrowUp') dy = -step;
    const position = { x: current.x + dx, y: current.y + dy };
    this.emit('lyra-node-move', { id: nodeId, position, previous: current });
    this.announcer.announce(
      this.localize('flowNodeMoved', undefined, { label: this.nodeAccessibleText(node), x: position.x, y: position.y }),
    );
    this.requestUpdate();
  }

  // ---------------------------------------------------------------------
  // Connect gesture (pointer + keyboard)
  // ---------------------------------------------------------------------

  private nodeIdFromComposedPath(path: EventTarget[]): string | null {
    for (const el of path) {
      if (el instanceof HTMLElement && el.getAttribute('part') === 'node' && el.dataset.nodeId) {
        return el.dataset.nodeId;
      }
    }
    return null;
  }

  /** Simplified duplicate check: any existing edge between the two nodes counts as a duplicate,
   *  regardless of which handles it uses -- the finer-grained "exact duplicate edge" rule from the
   *  spec collapses to this for the common case of one edge per node pair. */
  private isInvalidConnectTarget(hoveredId: string): boolean {
    if (!this.connectState) return false;
    if (hoveredId === this.connectState.sourceId) return true;
    return this.edges.some((e) => e.source === this.connectState!.sourceId && e.target === hoveredId);
  }

  private onWorldPointerDown = (e: PointerEvent): void => {
    if (!this.connectable || this.locked || this.connectState) return;
    const path = e.composedPath();
    const handleEl = path.find((el) => el instanceof HTMLElement && el.dataset.handleKind === 'output') as
      | HTMLElement
      | undefined;
    if (!handleEl) return;
    const nodeId = this.nodeIdFromComposedPath(path);
    const handleId = handleEl.dataset.handleId;
    if (!nodeId || !handleId) return;
    e.stopPropagation();
    this.startConnectGesture(nodeId, handleId, e.clientX, e.clientY);
  };

  private startConnectGesture(nodeId: string, handleId: string, clientX: number, clientY: number): void {
    const sourceNode = this.nodes.find((n) => n.id === nodeId);
    if (!sourceNode) return;
    const startPt = this.handlePoint(this.resolvedNode(sourceNode), 'output', handleId);
    this.connectState = { sourceId: nodeId, sourceHandle: handleId, startPt };
    this.connecting = true;
    this.announcer.announce(this.localize('flowConnectStarted', undefined, { label: this.nodeAccessibleText(sourceNode) }));
    void this.updateComplete.then(() => {
      this.connectionLineEl = (this.renderRoot.querySelector('[part="connection-line"]') as SVGPathElement) ?? undefined;
      this.connectionLineEl?.setAttribute('d', this.edgePathD(startPt, this.toContentPoint(clientX, clientY)));
    });
    window.addEventListener('pointermove', this.onConnectPointerMove);
    window.addEventListener('pointerup', this.onConnectPointerUp);
  }

  private onConnectPointerMove = (e: PointerEvent): void => {
    if (!this.connectState) return;
    const targetPt = this.toContentPoint(e.clientX, e.clientY);
    this.connectionLineEl?.setAttribute('d', this.edgePathD(this.connectState.startPt, targetPt));
    const hoveredId = this.nodeIdFromComposedPath(e.composedPath());
    const invalid = hoveredId != null && this.isInvalidConnectTarget(hoveredId);
    if (this.connectInvalidNodeId && this.connectInvalidNodeId !== (invalid ? hoveredId : null)) {
      this.renderRoot.querySelector(`[data-node-id="${CSS.escape(this.connectInvalidNodeId)}"]`)?.removeAttribute('data-connect-invalid');
    }
    this.connectInvalidNodeId = invalid ? (hoveredId as string) : null;
    if (invalid) {
      this.renderRoot.querySelector(`[data-node-id="${CSS.escape(hoveredId as string)}"]`)?.setAttribute('data-connect-invalid', '');
    }
  };

  private onConnectPointerUp = (e: PointerEvent): void => {
    if (!this.connectState) return;
    const state = this.connectState;
    const path = e.composedPath();
    const targetNodeId = this.nodeIdFromComposedPath(path);
    this.endConnectGesture();
    if (!targetNodeId || this.isInvalidConnectTargetFor(state, targetNodeId)) {
      this.announcer.announce(this.localize('flowConnectCancelled'));
      return;
    }
    const handleEl = path.find((el) => el instanceof HTMLElement && el.dataset.handleKind === 'input') as
      | HTMLElement
      | undefined;
    const targetHandle = handleEl?.dataset.handleId ?? 'in';
    this.emit('lyra-connect', { source: state.sourceId, target: targetNodeId, sourceHandle: state.sourceHandle, targetHandle });
    this.announcer.announce(this.localize('flowConnectCommitted', undefined, { source: state.sourceId, target: targetNodeId }));
  };

  /** Same rule as `isInvalidConnectTarget()`, callable after `connectState` has already been
   *  cleared by `endConnectGesture()` -- takes the snapshotted state explicitly instead. */
  private isInvalidConnectTargetFor(state: { sourceId: string }, hoveredId: string): boolean {
    if (hoveredId === state.sourceId) return true;
    return this.edges.some((e) => e.source === state.sourceId && e.target === hoveredId);
  }

  private endConnectGesture(): void {
    if (this.connectInvalidNodeId) {
      this.renderRoot.querySelector(`[data-node-id="${CSS.escape(this.connectInvalidNodeId)}"]`)?.removeAttribute('data-connect-invalid');
      this.connectInvalidNodeId = null;
    }
    this.connectState = undefined;
    this.connecting = false;
    window.removeEventListener('pointermove', this.onConnectPointerMove);
    window.removeEventListener('pointerup', this.onConnectPointerUp);
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
    if (sourceNode) this.announcer.announce(this.localize('flowConnectStarted', undefined, { label: this.nodeAccessibleText(sourceNode) }));
  }

  private cycleKeyboardConnectTarget(direction: 1 | -1): void {
    if (!this.keyboardConnectSourceId) return;
    const targets = this.eligibleConnectTargets(this.keyboardConnectSourceId);
    if (targets.length === 0) return;
    this.keyboardConnectTargetIndex = (this.keyboardConnectTargetIndex + direction + targets.length) % targets.length;
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
    this.emit('lyra-connect', {
      source: sourceId,
      target: target.id,
      sourceHandle: sourceOutputs[0]?.id ?? 'out',
      targetHandle: targetInputs[0]?.id ?? 'in',
    });
    this.announcer.announce(this.localize('flowConnectCommitted', undefined, { source: sourceId, target: target.id }));
  }

  private cancelKeyboardConnect(): void {
    if (!this.keyboardConnectSourceId) return;
    this.keyboardConnectSourceId = null;
    this.announcer.announce(this.localize('flowConnectCancelled'));
  }

  // ---------------------------------------------------------------------
  // Decoration paint
  // ---------------------------------------------------------------------

  private statusTone(status: FlowRunStatus): 'accent' | 'success' | 'warning' | 'danger' | 'neutral' {
    if (status === 'running') return 'accent';
    if (status === 'success') return 'success';
    if (status === 'error') return 'danger';
    if (status === 'denied') return 'warning';
    return 'neutral';
  }

  private edgeTone(edge: FlowEdge): string {
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
      items.push(svg`<g data-edge-id=${edge.id}>
        <path
          part="edge"
          role="button"
          tabindex=${active ? '0' : '-1'}
          aria-label=${this.edgeAccessibleText(edge)}
          aria-pressed=${selected ? 'true' : 'false'}
          d=${this.edgePathD(sourcePt, targetPt)}
          marker-end="url(#${this.arrowMarkerId})"
          data-tone=${this.edgeTone(edge)}
          data-running=${this.edgeIsRunning(edge) && !prefersReducedMotion() ? '' : nothing}
          data-running-static=${this.edgeIsRunning(edge) && prefersReducedMotion() ? '' : nothing}
          @click=${(e: MouseEvent) => this.onEdgeActivate(edge, e.ctrlKey || e.metaKey)}
          @focus=${() => this.onItemFocus(index)}
          @keydown=${(e: KeyboardEvent) =>
            this.onItemKeyDown(e, index, (additive) => this.onEdgeActivate(edge, additive))}
        ></path>
        ${edge.label
          ? svg`<text part="edge-label" x=${midX} y=${midY} paint-order="stroke">${edge.label}</text>`
          : ''}
      </g>`);
    }
    return svg`${items}`;
  }

  private renderNodes(nodeIndex: Map<string, number>): TemplateResult {
    return html`${repeat(
      this.nodes,
      (node) => node.id,
      (node) => {
        const resolved = this.resolvedNode(node);
        const index = nodeIndex.get(node.id) ?? 0;
        const active = this.normalizedItemIndex() === index;
        const selected = this.selectedNodeIds.includes(node.id);
        return html`<div
          part="node"
          data-node-id=${node.id}
          data-type=${node.type ?? nothing}
          data-connect-target=${this.isKeyboardConnectTarget(node.id) ? '' : nothing}
          role="group"
          tabindex=${active ? '0' : '-1'}
          aria-label=${this.nodeAccessibleText(node)}
          aria-current=${selected ? 'true' : 'false'}
          style="transform:translate(${resolved.x}px,${resolved.y}px)"
          @click=${(e: MouseEvent) => this.onNodeActivate(node, e.ctrlKey || e.metaKey)}
          @focus=${() => this.onItemFocus(index)}
          @pointerdown=${(e: PointerEvent) => this.onNodePointerDown(e, node)}
          @keydown=${(e: KeyboardEvent) =>
            this.onItemKeyDown(e, index, (additive) => this.onNodeActivate(node, additive))}
        >
          <slot name=${`node-${node.id}`}></slot>
        </div>`;
      },
    )}`;
  }

  render(): TemplateResult {
    if (this.nodes.length === 0) {
      return html`<div part="base" role="region" aria-label=${this.localize('flowCanvasLabel')}>
        <lyra-empty part="empty" heading=${this.localize('noData')}></lyra-empty>
      </div>`;
    }
    const { nodeIndex, edgeIndex } = this.itemIndexMaps();
    return html`<div part="base" role="region" aria-label=${this.localize('flowCanvasLabel')}>
      <div
        part="viewport"
        tabindex="0"
        aria-label=${this.accessibleLabel ||
        this.localize('flowCanvasSummary', undefined, {
          nodeCount: this.nodes.length,
          edgeCount: this.edges.length,
        })}
      >
        <div class="world" @pointerdown=${this.onWorldPointerDown}>
          <div
            part="background"
            style="--lyra-flow-canvas-grid-size:${this.grid > 0 ? this.grid : 8}px"
            @pointerdown=${this.onBackgroundPointerDown}
          ></div>
          <svg part="edges">
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
            ${this.renderEdges(nodeIndex, edgeIndex)}
            ${this.connecting ? svg`<path part="connection-line" d=""></path>` : ''}
          </svg>
          ${this.renderNodes(nodeIndex)}
        </div>
      </div>
      <div part="live-region" class="sr-only" role="status" aria-live="polite" aria-atomic="true" id=${this.liveRegionId}>
        ${this.liveText}
      </div>
      <ul part="edge-list" class="sr-only" aria-label=${this.localize('flowEdgeList')}>
        ${this.edges.map((edge) => html`<li>${this.edgeAccessibleText(edge)}</li>`)}
      </ul>
      <slot></slot>
      <slot name="top-start"></slot>
      <slot name="top-end"></slot>
      <slot name="bottom-start"></slot>
      <slot name="bottom-end"></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-flow-canvas': LyraFlowCanvas;
  }
}
