import { html, nothing, type TemplateResult } from 'lit';
import { finiteRange } from '../../../internal/numbers.js';
import { nextId } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { graphLinkIdentity, type LyraGraphCamera, type LyraGraphCommunity, type LyraGraphEdge, type LyraGraphNode, type LyraGraphPosition, type LyraGraphView, type NormalizedGraphModel } from './graph-model.js';
import { fittedGraphCamera, normalizeGraphCamera, panGraphCamera, pickSpatialScene, projectSpatialPoint, projectSpatialScene, spatialNodePosition,
  type SpatialHit, type SpatialProjectedNode, type SpatialScene, type SpatialSegment, type SpatialViewport, type SpatialWorldNode } from './graph-spatial.js';

interface GraphSpatialHost extends Pick<HTMLElement, 'isConnected' | 'ownerDocument' | 'shadowRoot' | 'getBoundingClientRect'> {
  readonly renderRoot: HTMLElement | DocumentFragment;
  readonly accessibleLabel: string | null;
  readonly label: string | null;
  readonly camera?: LyraGraphCamera;
  view: LyraGraphView;
  readonly hiddenTypes: readonly string[];
  readonly selectedNodeIds: readonly string[];
  readonly selectedEdgeIds: readonly string[];
  readonly dimmedNodeIds: readonly string[];
  readonly dimmedEdgeIds: readonly string[];
  readonly focusNodeId: string | null;
  readonly selectionMode: string;
  readonly nodeLabels?: string;
  readonly withEdgeLabels: boolean;
  readonly edgeLabelMinZoom: number;
  readonly minZoom: number;
  readonly maxZoom: number;
  requestUpdate(): void;
}

interface SpatialPaint {
  readonly nodes: ReadonlyMap<string, string>;
  readonly edges: ReadonlyMap<string, string>;
  readonly visibleEdges: ReadonlySet<string>;
  readonly text: string;
  readonly selected: string;
  readonly font: string;
  readonly fontSize: number;
  readonly dimmedOpacity: number;
}
export interface GraphSpatialOptions {
  readonly model: () => NormalizedGraphModel;
  readonly locale: () => string;
  readonly direction: () => 'ltr' | 'rtl';
  readonly pageText: (values: Record<string, string | number>) => string;
  readonly viewport: () => SpatialViewport;
  readonly messages: () => Readonly<Record<string, string>>;
  readonly communityText: (values: Record<string, string | number>) => string;
  readonly nodeText: (node: LyraGraphNode) => string;
  readonly edgeText: (edge: LyraGraphEdge) => string;
  readonly nodeTooltip: (node: LyraGraphNode) => string;
  readonly edgeTooltip: (edge: LyraGraphEdge) => string;
  readonly nodeShape: (node: LyraGraphNode) => SpatialWorldNode['shape'];
  readonly paint: (nodes: readonly SpatialWorldNode[], edges: readonly LyraGraphEdge[]) => SpatialPaint;
  readonly activate: (hit: SpatialHit, event: MouseEvent | KeyboardEvent) => void;
  readonly expand: (id: string) => void;
  readonly hover: (previous: SpatialHit | undefined, next: SpatialHit | undefined) => void;
  readonly community: (community: LyraGraphCommunity) => void;
  readonly cameraChanged: (camera: LyraGraphCamera) => void;
  readonly viewChanged: () => void;
  readonly unavailable: () => void;
  readonly clearSelection: () => void;
  readonly afterUpdate: (callback: () => void, key: string) => void;
}

type ListItem = { readonly kind: 'node'; readonly node: LyraGraphNode } |
  { readonly kind: 'link'; readonly edge: LyraGraphEdge } |
  { readonly kind: 'community'; readonly community: LyraGraphCommunity };
const PAGE_SIZE = 200;
const ORBIT_STEP = Math.PI / 18;

/** Owns only the opt-in spatial/list branches. It never starts a force simulation or binds d3. */
export class GraphSpatialController {
  private world: SpatialWorldNode[] = [];
  private edges: readonly LyraGraphEdge[] = [];
  private items: ListItem[] = [];
  private communityCounts = new Map<string, number>();
  private worldById = new Map<string, SpatialWorldNode>();
  private nodeIndexById = new Map<string, number>();
  private source?: NormalizedGraphModel;
  private hiddenTypes?: readonly string[];
  private authoredCamera?: LyraGraphCamera;
  private currentCamera: LyraGraphCamera = normalizeGraphCamera(undefined, { yaw: 0, pitch: 0, distance: 500, target: { x: 0, y: 0, z: 0 } });
  private fittedDistance = 500;
  private cameraInitialized = false;
  private pendingInitialFit = false;
  private canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D;
  private scene?: SpatialScene;
  private sceneViewport?: SpatialViewport;
  private sceneVisibleEdges?: ReadonlySet<string>;
  private paint?: SpatialPaint;
  private resize?: ResizeObserver;
  private intersection?: IntersectionObserver;
  private visible = true;
  private frame?: number;
  private frameWindow?: Window;
  private notifyCamera = false;
  private contextFailed = false;
  private page = 0;
  private focusAfterViewChange = false;
  private hover?: SpatialHit;
  private gesture?: { readonly id: number; readonly startX: number; readonly startY: number; x: number; y: number; moved: boolean; readonly pan: boolean };
  private lastKeyActivation?: { readonly id: string; readonly time: number };
  private readonly instructionsId = nextId('graph-spatial-instructions');

  constructor(private readonly host: GraphSpatialHost, private readonly options: GraphSpatialOptions) {}

  prepare(): void {
    const model = this.options.model();
    if (this.source !== model || this.hiddenTypes !== this.host.hiddenTypes) {
      this.source = model;
      this.hiddenTypes = this.host.hiddenTypes;
      const hidden = new Set(this.host.hiddenTypes);
      const allIds = new Set(model.nodes.map((node) => node.id));
      this.world = model.nodes.filter((node) => node.type == null || !hidden.has(node.type)).map((node) => ({
        node, position: spatialNodePosition(node), radius: finiteRange(node.radius ?? 15, 15, 6, 24), shape: this.options.nodeShape(node),
      }));
      this.worldById = new Map(this.world.map((node) => [node.node.id, node]));
      this.nodeIndexById = new Map(this.world.map((node, index) => [node.node.id, index]));
      this.edges = model.links.filter((edge) => this.worldById.has(edge.source) && (this.worldById.has(edge.target) || !allIds.has(edge.target)));
      const communityMembers = new Map<string, Set<string>>();
      for (const { node } of this.world) {
        if (!node.communityId) continue;
        let members = communityMembers.get(node.communityId);
        if (!members) communityMembers.set(node.communityId, (members = new Set()));
        members.add(node.id);
      }
      this.communityCounts = new Map();
      const communities = model.communities.filter((community) => {
        const members = communityMembers.get(community.id) ?? new Set<string>();
        for (const id of community.memberIds) if (this.worldById.has(id)) members.add(id);
        this.communityCounts.set(community.id, members.size);
        return members.size > 0;
      });
      this.items = [
        ...this.world.map(({ node }): ListItem => ({ kind: 'node', node })),
        ...this.edges.map((edge): ListItem => ({ kind: 'link', edge })),
        ...communities.map((community): ListItem => ({ kind: 'community', community })),
      ];
      const focused = this.host.shadowRoot?.activeElement;
      if (focused?.getAttribute('part') === 'spatial-list-item') {
        const id = focused.getAttribute('data-node-id');
        if (id && !this.worldById.has(id)) this.focusAfterViewChange = true;
      }
      this.page = Math.min(this.page, Math.max(0, Math.ceil(this.items.length / PAGE_SIZE) - 1));
      this.scene = undefined;
      this.setHover(undefined);
      if (!this.cameraInitialized && this.world.length) {
        this.currentCamera = fittedGraphCamera(this.world, this.viewport());
        this.fittedDistance = this.currentCamera.distance;
        this.cameraInitialized = true;
        this.pendingInitialFit = true;
      }
    }
    if (this.authoredCamera !== this.host.camera) {
      this.authoredCamera = this.host.camera;
      this.pendingInitialFit = false;
      this.currentCamera = this.authoredCamera ? normalizeGraphCamera(this.authoredCamera, this.currentCamera) : fittedGraphCamera(this.world, this.viewport());
      this.scene = undefined;
    }
  }

  update(): void {
    if (!this.host.isConnected || this.host.view === '2d') { this.disconnect(); return; }
    this.paint = undefined;
    const next = this.host.renderRoot.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]') ?? undefined;
    if (this.canvas !== next) {
      this.cancelGesture();
      this.resize?.disconnect();
      this.intersection?.disconnect();
      this.canvas = next;
      this.scene = undefined;
      this.fitInitialCanvas();
      try { this.context = next?.getContext('2d') ?? undefined; } catch { this.context = undefined; }
      if (next && !this.context && !this.contextFailed) {
        this.contextFailed = true;
        // The context can only be inspected after the canvas exists. Publish the fallback
        // after this completed render, rather than requesting another update from updated().
        this.options.afterUpdate(() => {
          if (!this.contextFailed || this.host.view !== '3d') return;
          this.options.unavailable();
          this.host.requestUpdate();
        }, 'graph-spatial-context');
      }
      const view = this.host.ownerDocument.defaultView as (Window & typeof globalThis) | null;
      if (next && view) {
        const Resize = view.ResizeObserver;
        if (Resize) {
          this.resize = new Resize(() => { this.fitInitialCanvas(); this.scene = undefined; this.schedule(); });
          this.resize.observe(next);
        }
        const Intersection = view.IntersectionObserver;
        if (Intersection) {
          this.intersection = new Intersection((entries) => {
            this.visible = entries[0]?.isIntersecting ?? true;
            if (this.visible) this.schedule();
          });
          this.intersection.observe(next);
        }
      }
    }
    this.schedule();
    if (this.focusAfterViewChange) {
      this.focusAfterViewChange = false;
      (this.host.renderRoot.querySelector<HTMLElement>('[part="spatial-list-item"]') ??
        this.host.renderRoot.querySelector<HTMLElement>('[part="spatial-canvas"]') ??
        this.host.renderRoot.querySelector<HTMLElement>('[data-spatial-action="3d"]'))?.focus();
    }
  }

  disconnect(): void {
    this.cancelGesture();
    if (this.frame !== undefined) this.frameWindow?.cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.frameWindow = undefined;
    this.notifyCamera = false;
    this.lastKeyActivation = undefined;
    this.resize?.disconnect(); this.resize = undefined;
    this.intersection?.disconnect(); this.intersection = undefined;
    this.canvas = undefined;
    this.context = undefined;
    this.scene = undefined;
    this.hover = undefined;
    this.visible = true;
    this.contextFailed = false;
  }

  invalidate(): void { this.paint = undefined; this.scene = undefined; this.schedule(); }

  private fitInitialCanvas(): void {
    if (!this.pendingInitialFit || !this.canvas?.clientWidth || !this.canvas.clientHeight) return;
    this.pendingInitialFit = false;
    this.currentCamera = fittedGraphCamera(this.world, this.viewport());
    this.fittedDistance = this.currentCamera.distance;
    this.scene = undefined;
  }

  private viewport(): SpatialViewport {
    return { width: Math.max(1, this.canvas?.clientWidth || this.options.viewport().width), height: Math.max(1, this.canvas?.clientHeight || this.options.viewport().height) };
  }

  position(id: string): LyraGraphPosition | undefined { this.prepare(); return this.worldById.get(id)?.position; }

  screenPosition(id: string): { x: number; y: number } | undefined {
    if (this.host.view !== '3d' || !this.canvas) return undefined;
    const node = this.worldById.get(id);
    const point = node && projectSpatialPoint(node.position, this.currentCamera, this.viewport());
    if (!point) return undefined;
    const bounds = this.canvas.getBoundingClientRect(), hostBounds = this.host.getBoundingClientRect();
    return { x: bounds.left - hostBounds.left + point.x, y: bounds.top - hostBounds.top + point.y };
  }

  fit(padding?: number): void {
    this.prepare();
    if (!this.world.length) return;
    const camera = fittedGraphCamera(this.world, this.viewport(), padding);
    this.fittedDistance = camera.distance;
    this.changeCamera(camera);
  }

  focusNode(id: string, zoom?: number): boolean {
    this.prepare();
    const node = this.worldById.get(id);
    if (!node) return false;
    if (this.host.view === 'list' || this.contextFailed) {
      this.page = Math.floor((this.nodeIndexById.get(id) ?? 0) / PAGE_SIZE);
      this.host.requestUpdate();
    }
    this.changeCamera({ ...this.currentCamera, target: node.position, distance: zoom === undefined ? this.currentCamera.distance : this.fittedDistance / this.safeZoom(zoom) });
    return true;
  }

  private safeZoom(value: number): number {
    const min = finiteRange(this.host.minZoom, 0.1, 0.001, 1000);
    const max = finiteRange(this.host.maxZoom, 8, 0.001, 1000);
    return finiteRange(value, 1, Math.min(min, max), Math.max(min, max));
  }

  private zoom(factor: number): void {
    const zoom = this.safeZoom(this.fittedDistance / this.currentCamera.distance * factor);
    this.changeCamera({ ...this.currentCamera, distance: this.fittedDistance / zoom });
  }

  private orbit(yaw: number, pitch: number): void {
    this.changeCamera({ ...this.currentCamera, yaw: this.currentCamera.yaw + yaw, pitch: this.currentCamera.pitch + pitch });
  }

  private changeCamera(camera: LyraGraphCamera): void {
    this.pendingInitialFit = false;
    this.currentCamera = normalizeGraphCamera(camera, this.currentCamera);
    this.scene = undefined;
    this.notifyCamera = true;
    this.schedule();
  }

  private schedule(): void {
    if (!this.host.isConnected || this.host.view === '2d' || this.frame !== undefined || (!this.visible && !this.notifyCamera)) return;
    const view = this.host.ownerDocument.defaultView as (Window & typeof globalThis) | null;
    if (!view) return;
    this.frameWindow = view;
    this.frame = view.requestAnimationFrame(() => {
      this.frame = undefined;
      this.frameWindow = undefined;
      if (!this.host.isConnected || this.host.view === '2d') return;
      if (this.visible) this.draw();
      if (this.notifyCamera) {
        this.notifyCamera = false;
        this.options.cameraChanged(normalizeGraphCamera(this.currentCamera, this.currentCamera));
      }
    });
  }

  private projectedScene(): SpatialScene {
    const paint = this.paint ??= this.options.paint(this.world, this.edges);
    const viewport = this.viewport();
    const previousEdges = this.sceneVisibleEdges;
    if (this.sceneViewport?.width !== viewport.width || this.sceneViewport.height !== viewport.height ||
      !previousEdges || previousEdges.size !== paint.visibleEdges.size || [...paint.visibleEdges].some((id) => !previousEdges.has(id)))
      this.scene = undefined;
    if (!this.scene) {
      this.scene = projectSpatialScene(this.world, this.edges.filter((edge) => paint.visibleEdges.has(graphLinkIdentity(edge))), this.currentCamera, viewport);
      this.sceneViewport = viewport;
      this.sceneVisibleEdges = paint.visibleEdges;
    }
    return this.scene;
  }

  private draw(): void {
    const canvas = this.canvas, ctx = this.context;
    if (!canvas || !ctx || this.host.view !== '3d') return;
    const size = this.viewport();
    const dpr = finiteRange(this.host.ownerDocument.defaultView?.devicePixelRatio ?? 1, 1, 1, 4);
    const scale = Math.min(dpr, 8192 / Math.max(size.width, size.height));
    const width = Math.max(1, Math.round(size.width * scale)), height = Math.max(1, Math.round(size.height * scale));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    const paint = this.paint ??= this.options.paint(this.world, this.edges);
    ctx.font = `${paint.fontSize}px ${paint.font}`;
    ctx.textBaseline = 'middle';
    const selectedNodes = new Set(this.host.selectedNodeIds), selectedEdges = new Set(this.host.selectedEdgeIds);
    const dimmedNodes = new Set(this.host.dimmedNodeIds), dimmedEdges = new Set(this.host.dimmedEdgeIds);
    const zoom = this.fittedDistance / this.currentCamera.distance;
    const scene = this.projectedScene();
    const projectedById = new Map(scene.nodes.map((node) => [node.node.id, node]));
    for (const primitive of scene.primitives) {
      ctx.save();
      if (primitive.kind === 'node') {
        const entry = primitive.value, id = entry.node.id;
        ctx.globalAlpha = dimmedNodes.has(id) ? paint.dimmedOpacity : 1;
        this.drawNode(ctx, entry, paint.nodes.get(id) ?? paint.text);
        if (selectedNodes.has(id) || this.host.focusNodeId === id || (this.hover?.kind === 'node' && this.hover.id === id)) {
          ctx.strokeStyle = paint.selected; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(entry.x, entry.y, entry.screenRadius + 4, 0, Math.PI * 2); ctx.stroke();
        }
        if (this.host.nodeLabels !== 'none' && (this.host.nodeLabels === 'always' || zoom >= 0.5)) {
          ctx.fillStyle = paint.text;
          ctx.fillText(entry.node.label ?? entry.node.id, entry.x + entry.screenRadius + 4, entry.y);
        }
        if (entry.node.expandable) {
          ctx.fillStyle = paint.text; ctx.fillText('+', entry.x + entry.screenRadius, entry.y - entry.screenRadius);
        }
      } else {
        const entry = primitive.value;
        ctx.globalAlpha = dimmedEdges.has(entry.id) ? paint.dimmedOpacity : 1;
        const selected = selectedEdges.has(entry.id) || (this.hover?.kind === 'link' && this.hover.id === entry.id);
        this.drawSegment(ctx, entry, selected ? paint.selected : paint.edges.get(entry.id) ?? paint.text, selected, projectedById.get(entry.edge.target)?.screenRadius ?? 0);
        if (entry.middle && this.host.withEdgeLabels && zoom >= finiteRange(this.host.edgeLabelMinZoom, 0.6, 0.001, 1000) && entry.edge.label) {
          ctx.fillStyle = paint.text; ctx.fillText(entry.edge.label, entry.a.x, entry.a.y - paint.fontSize);
        }
      }
      ctx.restore();
    }
  }

  private drawNode(ctx: CanvasRenderingContext2D, node: SpatialProjectedNode, fill: string): void {
    ctx.fillStyle = fill;
    ctx.beginPath();
    const r = node.screenRadius;
    if (node.shape === 'circle') ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    else if (node.shape === 'square') {
      const half = r * Math.sqrt(Math.PI) / 2;
      ctx.rect(node.x - half, node.y - half, 2 * half, 2 * half);
    } else {
      const half = r * Math.sqrt(Math.PI / 2);
      ctx.moveTo(node.x, node.y - half); ctx.lineTo(node.x + half, node.y);
      ctx.lineTo(node.x, node.y + half); ctx.lineTo(node.x - half, node.y); ctx.closePath();
    }
    ctx.fill();
  }

  private drawSegment(ctx: CanvasRenderingContext2D, segment: SpatialSegment, color: string, selected: boolean, targetRadius: number): void {
    const { a, b, edge } = segment;
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = finiteRange(edge.width ?? 1.5, 1.5, 0, 1000) + (selected ? 2 : 0);
    const dash = edge.dash;
    ctx.setLineDash(segment.dangling ? [4, 4] : Array.isArray(dash) && dash.length <= 32 && dash.every((value) => Number.isFinite(value) && value >= 0) ? [...dash] : []);
    ctx.lineDashOffset = -segment.offset;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    if (segment.last && edge.directed) {
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const inset = targetRadius;
      const x = b.x - Math.cos(angle) * inset, y = b.y - Math.sin(angle) * inset;
      const size = Math.max(6, ctx.lineWidth * 3);
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(angle - 0.45) * size, y - Math.sin(angle - 0.45) * size);
      ctx.lineTo(x - Math.cos(angle + 0.45) * size, y - Math.sin(angle + 0.45) * size);
      ctx.closePath(); ctx.fill();
    }
  }

  private hit(clientX: number, clientY: number): SpatialHit | undefined {
    const bounds = this.canvas?.getBoundingClientRect();
    if (!bounds) return undefined;
    const scene = this.projectedScene();
    const hit = pickSpatialScene(scene, clientX - bounds.left, clientY - bounds.top);
    return hit;
  }

  private setHover(next: SpatialHit | undefined): void {
    if (this.hover?.kind === next?.kind && this.hover?.id === next?.id) return;
    const previous = this.hover; this.hover = next;
    if (this.canvas) this.canvas.title = next?.kind === 'node' ? this.options.nodeTooltip(next.node) : next?.kind === 'link' ? this.options.edgeTooltip(next.edge) : '';
    this.options.hover(previous, next);
    this.schedule();
  }

  private cancelGesture(): void {
    const gesture = this.gesture;
    this.gesture = undefined;
    if (gesture && this.canvas?.hasPointerCapture(gesture.id)) this.canvas.releasePointerCapture(gesture.id);
  }

  private readonly pointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.gesture) return;
    this.canvas?.focus();
    this.gesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false, pan: event.shiftKey };
    try { this.canvas?.setPointerCapture(event.pointerId); } catch { /* Synthetic pointers need no capture. */ }
    this.setHover(undefined);
  };
  private readonly pointerMove = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (!gesture) { this.setHover(this.hit(event.clientX, event.clientY)); return; }
    if (gesture.id !== event.pointerId) return;
    gesture.moved ||= Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 5;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    gesture.x = event.clientX; gesture.y = event.clientY;
    if (!gesture.moved) return;
    if (gesture.pan) this.changeCamera(panGraphCamera(this.currentCamera, dx, dy, this.viewport()));
    else this.orbit(dx * 0.008, -dy * 0.008);
  };
  private readonly pointerUp = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (!gesture || gesture.id !== event.pointerId) return;
    this.cancelGesture();
    if (!gesture.moved && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) <= 5) {
      const hit = this.hit(event.clientX, event.clientY);
      if (hit) this.options.activate(hit, event);
    }
  };
  private readonly pointerCancel = (event: PointerEvent): void => { if (event.pointerId === this.gesture?.id) this.cancelGesture(); };
  private readonly wheel = (event: WheelEvent): void => {
    if (this.host.shadowRoot?.activeElement !== this.canvas && !this.gesture) return;
    event.preventDefault();
    this.zoom(Math.exp(-finiteRange(event.deltaY, 0, -300, 300) * 0.002));
  };
  private readonly keyDown = (event: KeyboardEvent): void => {
    const direction = this.options.direction() === 'rtl' ? -1 : 1;
    const dx = event.key === 'ArrowRight' ? direction : event.key === 'ArrowLeft' ? -direction : 0;
    const dy = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (dx || dy) {
      event.preventDefault();
      if (event.shiftKey) this.changeCamera(panGraphCamera(this.currentCamera, dx * 24, dy * 24, this.viewport()));
      else this.orbit(dx * ORBIT_STEP, -dy * ORBIT_STEP);
    } else if (event.key === '+' || event.key === '=' || event.key === '-') {
      event.preventDefault(); this.zoom(event.key === '-' ? 1 / 1.2 : 1.2);
    } else if (event.key === 'Home') { event.preventDefault(); this.fit(); }
    else if (event.key === 'Escape') this.options.clearSelection();
  };

  private changeView(view: '3d' | 'list'): void {
    this.cancelGesture();
    if (view === '3d') this.contextFailed = false;
    this.host.view = view;
    this.host.requestUpdate();
    this.focusAfterViewChange = true;
    this.options.viewChanged();
  }

  private changePage(delta: number): void {
    this.page = Math.max(0, Math.min(Math.ceil(this.items.length / PAGE_SIZE) - 1, this.page + delta));
    this.focusAfterViewChange = true;
    this.host.requestUpdate();
  }

  private listKeyDown(item: ListItem, event: KeyboardEvent): void {
    if (item.kind !== 'node' || (event.key !== 'Enter' && event.key !== ' ') || event.repeat) return;
    const time = this.host.ownerDocument.defaultView?.performance.now() ?? 0;
    if (this.lastKeyActivation?.id === item.node.id && time - this.lastKeyActivation.time <= 500) {
      this.lastKeyActivation = undefined;
      this.options.expand(item.node.id);
    } else this.lastKeyActivation = { id: item.node.id, time };
  }

  private activateItem(item: ListItem, event: MouseEvent | KeyboardEvent): void {
    if (item.kind === 'node') this.options.activate({ kind: 'node', id: item.node.id, node: item.node }, event);
    else if (item.kind === 'link') this.options.activate({ kind: 'link', id: graphLinkIdentity(item.edge), edge: item.edge }, event);
    else this.options.community(item.community);
  }

  render(limitNotices: TemplateResult): TemplateResult {
    this.prepare();
    const messages = this.options.messages();
    const list = this.host.view === 'list' || this.contextFailed;
    const pageItems = this.items.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
    const number = getNumberFormat(this.options.locale());
    const selectedNodes = new Set(this.host.selectedNodeIds), selectedEdges = new Set(this.host.selectedEdgeIds);
    const button = (action: string, label: string, callback: () => void) => html`<button type="button" part="spatial-control" data-spatial-action=${action} @click=${callback}>${label}</button>`;
    return html`<div part="base" class="spatial-base">
      <div part="spatial-toolbar" role="group" aria-label=${messages['controls']}>
        <button type="button" part="spatial-control" data-spatial-action="3d" aria-pressed=${String(!list)} @click=${() => this.changeView('3d')}>${messages['view3d']}</button>
        <button type="button" part="spatial-control" data-spatial-action="list" aria-pressed=${String(list)} @click=${() => this.changeView('list')}>${messages['viewList']}</button>
        ${!list ? html`${button('fit', messages['fit']!, () => this.fit())}${button('left', messages['left']!, () => this.orbit(-ORBIT_STEP, 0))}${button('right', messages['right']!, () => this.orbit(ORBIT_STEP, 0))}${button('up', messages['up']!, () => this.orbit(0, ORBIT_STEP))}${button('down', messages['down']!, () => this.orbit(0, -ORBIT_STEP))}${button('zoom-in', messages['zoomIn']!, () => this.zoom(1.2))}${button('zoom-out', messages['zoomOut']!, () => this.zoom(1 / 1.2))}` : nothing}
      </div>
      ${this.contextFailed ? html`<p part="error">${messages['unavailable']}</p>` : nothing}
      ${list ? html`<div part="spatial-list" tabindex="-1" @keydown=${(event: KeyboardEvent) => { if (event.key === 'Escape') this.options.clearSelection(); }}>
        <ul aria-label=${messages['dataList']}>
          ${pageItems.map((item, index) => {
            const id = item.kind === 'node' ? item.node.id : item.kind === 'link' ? graphLinkIdentity(item.edge) : item.community.id;
            const selected = item.kind === 'node' ? selectedNodes.has(id) : item.kind === 'link' ? selectedEdges.has(id) : false;
            const text = item.kind === 'node' ? this.options.nodeText(item.node) : item.kind === 'link' ? this.options.edgeText(item.edge) : this.options.communityText({ label: item.community.label ?? id, count: number.format(this.communityCounts.get(id) ?? 0) });
            return html`<li aria-posinset=${this.page * PAGE_SIZE + index + 1} aria-setsize=${this.items.length}><button type="button" part="spatial-list-item" data-node-id=${item.kind === 'node' ? id : nothing}
              aria-pressed=${item.kind !== 'community' && this.host.selectionMode !== 'none' ? String(selected) : nothing}
              aria-current=${item.kind !== 'community' && this.host.selectionMode === 'none' && selected ? 'true' : nothing}
              @keydown=${(event: KeyboardEvent) => this.listKeyDown(item, event)} @click=${(event: MouseEvent) => this.activateItem(item, event)} @dblclick=${() => { if (item.kind === 'node') this.options.expand(id); }}
            >${text}</button></li>`;
          })}
        </ul>
        ${!this.items.length ? html`<p part="empty">${messages['noData']}</p>` : nothing}
        <p part="spatial-page-count">${this.options.pageText({ page: number.format(this.page + 1), pages: number.format(Math.max(1, Math.ceil(this.items.length / PAGE_SIZE))), total: number.format(this.items.length) })}</p>
        <div part="spatial-pagination">
          <button type="button" part="spatial-control" data-spatial-action="previous" ?disabled=${this.page === 0} @click=${() => this.changePage(-1)}>${messages['previous']}</button>
          <button type="button" part="spatial-control" data-spatial-action="next" ?disabled=${(this.page + 1) * PAGE_SIZE >= this.items.length} @click=${() => this.changePage(1)}>${messages['next']}</button>
        </div>
      </div>` : html`<p part="spatial-instructions" id=${this.instructionsId}>${messages['instructions']}</p>
        <canvas part="spatial-canvas" tabindex="0" role="img" aria-label=${this.host.accessibleLabel ?? this.host.label ?? messages['view3d']}
          aria-describedby=${this.instructionsId} @pointerdown=${this.pointerDown} @pointermove=${this.pointerMove} @pointerup=${this.pointerUp}
          @pointercancel=${this.pointerCancel} @lostpointercapture=${this.pointerCancel} @pointerleave=${() => { if (!this.gesture) this.setHover(undefined); }}
          @wheel=${this.wheel} @keydown=${this.keyDown} @dblclick=${(event: MouseEvent) => { const hit = this.hit(event.clientX, event.clientY); if (hit?.kind === 'node') this.options.expand(hit.id); }}
        ></canvas>
        ${!this.world.length ? html`<p part="empty">${messages['noData']}</p>` : nothing}`}
      ${limitNotices}
    </div>`;
  }
}
