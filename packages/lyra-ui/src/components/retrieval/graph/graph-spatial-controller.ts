import { composedParentElement, isAccessibilityVisible } from '../../../internal/accessibility-visibility.js';
import { Engine3dSelection, engine3dFallbackNotice, type Engine3dFallbackDetail, type Engine3dFallbackReason, type Engine3dMessageKey } from '../../../internal/engine-3d.js';
import { GraphEngineAdapter, type GraphEngineAdapterServices, type GraphComponentEngine } from './graph-engine-adapter.js';
import { graphEngineColumnScene, type GraphEngineColumns, type GraphEngineColumnScene } from './graph-engine-columns.js';
import { graphWebglCamera, graphWebglData } from './graph-webgl-engine.js';
import { html, nothing, type TemplateResult } from 'lit';
import { finiteRange } from '../../../internal/numbers.js';
import { nextId } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { graphLinkIdentity, type LyraGraphCamera, type LyraGraphCommunity, type LyraGraphEdge, type LyraGraphNode, type LyraGraphPosition, type LyraGraphView, type NormalizedGraphModel } from './graph-model.js';
import { fittedGraphCamera, normalizeGraphCamera, panGraphCamera, projectSpatialPoint, spatialNodePosition,
  type SpatialHit, type SpatialViewport, type SpatialWorldNode } from './graph-spatial.js';
import { GraphBuiltin3dEngine, type GraphBuiltin3dFrame, type GraphBuiltin3dPaint } from './graph-builtin-3d-engine.js';

const selectionSets = new WeakMap<readonly string[], ReadonlySet<string>>();
function selectedIds(ids: readonly string[]): ReadonlySet<string> {
  if (!Object.isFrozen(ids)) return new Set(ids);
  let result = selectionSets.get(ids);
  if (!result) { result = new Set(ids); selectionSets.set(ids, result); }
  return result;
}

interface GraphSpatialHost extends Pick<HTMLElement, 'isConnected' | 'ownerDocument' | 'shadowRoot' | 'getBoundingClientRect'> {
  readonly renderRoot: HTMLElement | DocumentFragment;
  readonly accessibleLabel: string | null;
  readonly label: string | null;
  readonly camera?: LyraGraphCamera;
  readonly engine?: string;
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
}

export interface GraphSpatialOptions {
  readonly repaint: () => void;
  readonly columns?: () => GraphEngineColumns | undefined;
  readonly sourceMode?: () => boolean;
  readonly engineFallback?: (detail: Engine3dFallbackDetail) => void;
  readonly engineMessage?: (key: Engine3dMessageKey) => string;
  readonly engineServices?: GraphEngineAdapterServices;
  readonly categoryColors?: () => readonly string[];
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
  readonly paint: (nodes: readonly SpatialWorldNode[], edges: readonly LyraGraphEdge[]) => GraphBuiltin3dPaint;
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
  private readonly selection = new Engine3dSelection(true);
  private adapter: GraphEngineAdapter;
  private engine?: GraphComponentEngine;
  private engineSurface?: HTMLElement;
  private observedSurface?: HTMLElement;
  private enginePending = false;
  private engineEpoch = 0;
  private engineRevision = 0;
  private engineDataKey?: object;
  private enginePaintKey?: object;
  private engineStyleKey = '';
  private engineSizeKey = '';
  private stateInputs?: readonly unknown[];
  private edgeRowsKey?: object;
  private edgeRows = new Map<string, number>();
  private preference?: string;
  private fallback?: Engine3dFallbackDetail;
  private pendingFallbacks: { detail: Engine3dFallbackDetail; epoch: number }[] = [];
  private columns?: GraphEngineColumns;
  private columnScene?: GraphEngineColumnScene;
  private rgbaCache = new Map<string, readonly [number, number, number, number]>();
  private rgbaContext?: CanvasRenderingContext2D;
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
  private builtin?: GraphBuiltin3dEngine;
  private hoverFrame?: number;
  private hoverFrameWindow?: Window;
  private hoverGeneration = 0;
  private pendingHover?: { x: number; y: number };

  private paint?: GraphBuiltin3dPaint;
  private resize?: ResizeObserver;
  private intersection?: IntersectionObserver;
  private eligibility?: MutationObserver;
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

  constructor(private readonly host: GraphSpatialHost, private readonly options: GraphSpatialOptions) { this.adapter = new GraphEngineAdapter(options.engineServices); }

  private get itemCount(): number { return this.columnScene?.itemCount ?? this.items.length; }
  private columnItem(index: number): ListItem | undefined {
    const item = this.columnScene?.item(index); if (!item) return undefined;
    if (item.kind === 'node') return { kind: 'node', node: { id: item.id, label: item.label, type: this.columns?.columns.category ? this.columns.columns.categories?.[this.columns.columns.category[item.row]!] : undefined } };
    return { kind: 'link', edge: { id: `column-edge-${item.row}`, source: item.source, target: item.target } };
  }
  private pageItems(): ListItem[] {
    if (!this.columnScene) return this.items.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
    const result: ListItem[] = []; for (let i = this.page * PAGE_SIZE; i < Math.min(this.itemCount, (this.page + 1) * PAGE_SIZE); i++) { const item = this.columnItem(i); if (item) result.push(item); } return result;
  }
  private engineHit(index: number | null): SpatialHit | undefined {
    if (this.engineDataKey !== (this.columnScene ?? this.world) || index === null || !Number.isInteger(index) || index < 0) return undefined;
    if (this.columnScene) { const item = this.columnItem(index); return item?.kind === 'node' ? { kind: 'node', id: item.node.id, node: item.node } : item?.kind === 'link' ? { kind: 'link', id: graphLinkIdentity(item.edge), edge: item.edge } : undefined; }
    const node = this.world[index]?.node; if (node) return { kind: 'node', id: node.id, node };
    const edge = this.edges[index - this.world.length]; return edge ? { kind: 'link', id: graphLinkIdentity(edge), edge } : undefined;
  }
  private snapshotEnginePositions(): void {
    if (!this.engine || this.columnScene || this.engineDataKey !== this.world) return;
    for (let row = 0; row < this.world.length; row++) { const position = this.engine.positionOf?.(row); if (!position) continue;
      const entry = { ...this.world[row]!, position: Object.freeze({ ...position }) }; this.world[row] = entry; this.worldById.set(entry.node.id, entry); }
    this.builtin?.invalidate();
  }
  retryEngine(): void { this.closeEngine(); this.selection.prefer(this.preference); this.fallback = undefined; this.contextFailed = false; this.options.repaint(); }
  private closeEngine(): void {
    this.snapshotEnginePositions();
    this.eligibility?.disconnect(); this.eligibility = undefined;
    this.engineEpoch++; this.enginePending = false; this.engine = undefined; this.engineDataKey = this.enginePaintKey = undefined; this.engineStyleKey = this.engineSizeKey = ''; this.stateInputs = undefined; this.edgeRowsKey = undefined; this.adapter.close();
  }
  private failEngine(reason: Engine3dFallbackReason): void {
    this.snapshotEnginePositions();
    const detail = this.selection.fail(reason); if (!detail) return;
    this.fallback = detail; this.setHover(undefined);
    this.pendingFallbacks.push({ detail, epoch: this.engineEpoch });
    this.options.afterUpdate(() => {
      const pending = this.pendingFallbacks; this.pendingFallbacks = [];
      for (const entry of pending) { if (!this.host.isConnected || entry.epoch !== this.engineEpoch) continue; this.options.engineFallback?.(entry.detail); }
      if (this.host.isConnected) this.options.repaint();
    }, 'graph-engine-fallback');
  }
  private ensureEngine(): void {
    const surface = this.engineSurface;
    if (!surface || this.engine || this.enginePending || !this.host.isConnected || this.host.view !== '3d' || this.selection.renderer !== 'webgl') return;
    if (!this.visible || !isAccessibilityVisible(surface)) {
      const view = this.host.ownerDocument.defaultView;
      if (!this.eligibility && view?.MutationObserver) {
        const epoch = this.engineEpoch;
        this.eligibility = new view.MutationObserver(() => {
          if (epoch !== this.engineEpoch || this.engineSurface !== surface || !this.host.isConnected) return;
          if (!view.IntersectionObserver) this.visible = surface.clientWidth > 0 && surface.clientHeight > 0;
          this.ensureEngine();
        });
        // Observe only the pending surface's composed author fences, never a document subtree.
        let ancestor: Element | null = surface;
        let depth = 0;
        while (ancestor && depth++ <= 256) {
          this.eligibility.observe(ancestor, { attributes: true, attributeFilter: ['aria-hidden', 'inert', 'hidden', 'style', 'class', 'open'] });
          ancestor = composedParentElement(ancestor);
        }
      }
      return;
    }
    this.eligibility?.disconnect(); this.eligibility = undefined;
    this.enginePending = true; const epoch = ++this.engineEpoch;
    this.options.afterUpdate(() => this.options.repaint(), 'graph-engine-loading');
    void this.adapter.open({ preference: this.preference, eligible: !this.options.sourceMode?.(), visible: this.visible, container: surface,
      host: {
        hover: (item) => { if (this.selection.renderer === 'webgl') this.setHover(this.engineHit(item)); },
        pick: (item, modifiers) => {
          if (this.selection.renderer !== 'webgl') return;
          const hit = this.engineHit(item); if (!hit) return;
          if (modifiers.double && hit.kind === 'node') { this.options.expand(hit.id); return; }
          const Mouse = this.host.ownerDocument.defaultView?.MouseEvent; if (Mouse) this.options.activate(hit, new Mouse('click', { ctrlKey: modifiers.ctrl, shiftKey: modifiers.shift }));
        },
        camera: (value) => { if (this.selection.renderer !== 'webgl') return; this.currentCamera = graphWebglCamera(value, this.currentCamera); this.notifyCamera = true; this.schedule(); },
        lost: (reason) => { if (this.selection.renderer !== 'webgl') return; if (reason === 'error') this.closeEngine(); this.failEngine(reason); },
        restored: () => { if (this.selection.restore()) { this.fallback = undefined; this.enginePaintKey = undefined; this.options.repaint(); this.schedule(); } },
      }, failure: (reason) => { if (epoch === this.engineEpoch) this.failEngine(reason); },
    }).then((engine) => {
      if (epoch !== this.engineEpoch || !this.host.isConnected || this.engineSurface !== surface) return;
      this.enginePending = false; this.engine = engine ?? undefined;
      if (engine) { const canvas = surface.querySelector('canvas:not([data-graph-labels])'); canvas?.setAttribute('aria-hidden', 'true'); this.drawEngine(true); }
      this.options.repaint();
    });
  }
  private rgba(value: string): readonly [number, number, number, number] {
    const previous = this.rgbaCache.get(value); if (previous) return previous;
    if (!this.rgbaContext) { const canvas = this.host.ownerDocument.createElement('canvas'); canvas.width = canvas.height = 1; this.rgbaContext = canvas.getContext('2d', { willReadFrequently: true }) ?? undefined; }
    const ctx = this.rgbaContext; if (!ctx) throw new Error('Color canvas unavailable');
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000000'; ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0, a = 255] = ctx.getImageData(0, 0, 1, 1).data;
    const result = [r / 255, g / 255, b / 255, a / 255] as const; this.rgbaCache.set(value, result); return result;
  }
  private engineState() {
    const nodes = this.columnScene?.data.nodeCount ?? this.world.length;
    const nodeRow = (id: string) => this.columnScene ? this.columnScene.nodeIndex(id) : this.nodeIndexById.get(id);
    const key = this.columnScene ?? this.world;
    if (key !== this.edgeRowsKey) { this.edgeRowsKey = key; this.edgeRows.clear();
      if (this.columnScene) this.columnScene.edgeRows.forEach((original, row) => this.edgeRows.set(`column-edge-${original}`, nodes + row));
      else this.edges.forEach((edge, row) => this.edgeRows.set(graphLinkIdentity(edge), nodes + row)); }
    const edges = this.edgeRows;
    const map = (nodeIds: readonly string[], edgeIds: readonly string[]) => { const result = new Set<number>(); for (const id of nodeIds) { const row = nodeRow(id); if (row !== undefined) result.add(row); } for (const id of edgeIds) { const row = edges.get(id); if (row !== undefined) result.add(row); } return result; };
    return { selected: map(this.host.selectedNodeIds, this.host.selectedEdgeIds), dimmed: map(this.host.dimmedNodeIds, this.host.dimmedEdgeIds),
      focus: this.host.focusNodeId ? nodeRow(this.host.focusNodeId) ?? -1 : -1,
      hover: this.hover ? this.hover.kind === 'node' ? nodeRow(this.hover.id) ?? -1 : edges.get(this.hover.id) ?? -1 : -1 };
  }
  private columnData(paint: GraphBuiltin3dPaint) {
    const scene = this.columnScene!, data = scene.data;
    const palette = this.options.categoryColors?.() ?? ['#808080'];
    const colors = new Float32Array(data.nodeCount * 4), edges = new Float32Array(data.source.length * 4);
    for (let row = 0; row < data.nodeCount; row++) colors.set(this.rgba(palette[(data.categories?.[row] ?? 0) % palette.length]!), row * 4);
    for (let row = 0; row < data.source.length; row++) edges.set(this.rgba(palette[(data.edgeCategories?.[row] ?? 0) % palette.length]!), row * 4);
    const labelLimit = Math.min(256, Math.floor(4 * 1024 * 1024 / Math.max(1, data.nodeCount)));
    const labels = data.labels ?? Array.from(scene.nodeRows, (row) => this.columns!.columns.ids[row]!.slice(0, labelLimit));
    return { ...data, labels, nodeLabels: this.host.nodeLabels === 'always' ? 'always' as const : this.host.nodeLabels === 'none' ? 'none' as const : 'zoom' as const, withEdgeLabels: false,
      spatialAppearance: { ...data.spatialAppearance, nodeColors: colors, edgeColors: edges, dimmedOpacity: paint.dimmedOpacity } };
  }
  private panCamera(dx: number, dy: number): LyraGraphCamera {
    if (this.preference !== 'webgl') return panGraphCamera(this.currentCamera, dx, dy, this.viewport());
    const camera = this.currentCamera, units = 2 * camera.distance * Math.tan(Math.PI / 8) / this.viewport().height;
    const sy = Math.sin(camera.yaw), cy = Math.cos(camera.yaw), sp = Math.sin(camera.pitch), cp = Math.cos(camera.pitch);
    return graphWebglCamera({ ...camera, target: { x: camera.target.x - units * (cy * dx + sy * sp * dy), y: camera.target.y - units * cp * dy, z: camera.target.z - units * (-sy * dx + cy * sp * dy) } }, camera);
  }
  private drawEngine(initial = false): void {
    const engine = this.engine; if (!engine || this.selection.renderer !== 'webgl') return;
    const paint = this.paint ??= this.options.paint(this.world, this.edges), size = this.viewport();
    const key = this.columnScene ?? this.world;
    try {
      if (key !== this.engineDataKey || paint !== this.enginePaintKey) {
        const input = this.columnScene ? this.columnData(paint) : graphWebglData(this.world, this.edges, paint, (color) => this.rgba(color));
        if (key !== this.engineDataKey) engine.setData(input, this.engineRevision++);
        else engine.setAppearance({ spatialAppearance: input.spatialAppearance, labels: 'labels' in input ? input.labels : undefined, nodeLabels: input.nodeLabels, withEdgeLabels: input.withEdgeLabels });
        this.engineDataKey = key; this.enginePaintKey = paint;
      }
      const view = this.host.ownerDocument.defaultView;
      const reducedMotion = view?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? true, forcedColors = view?.matchMedia('(forced-colors: active)').matches ?? false;
      const styleKey = [paint.text, paint.selected, paint.font, paint.fontSize, view?.devicePixelRatio, reducedMotion, forcedColors].join('|');
      if (styleKey !== this.engineStyleKey) { this.engineStyleKey = styleKey; engine.setStyle({ background: 'rgba(0,0,0,0)', foreground: paint.text, muted: paint.text, accent: paint.selected, focus: paint.selected,
        palette: [paint.text], fontFamily: paint.font, fontSize: paint.fontSize, devicePixelRatio: view?.devicePixelRatio ?? 1, reducedMotion, forcedColors }); }
      const stateInputs = [key, this.host.selectedNodeIds, this.host.selectedEdgeIds, this.host.dimmedNodeIds, this.host.dimmedEdgeIds, this.host.focusNodeId, this.hover?.kind, this.hover?.id];
      if (!this.stateInputs || stateInputs.some((value, index) => value !== this.stateInputs![index])) { this.stateInputs = stateInputs; engine.setState?.(this.engineState()); }
      const sizeKey = `${size.width}|${size.height}`; if (sizeKey !== this.engineSizeKey) { this.engineSizeKey = sizeKey; engine.resize(size.width, size.height); }
      if (initial && !this.host.camera && !this.cameraInitialized && engine.fit) { this.currentCamera = graphWebglCamera(engine.fit(), this.currentCamera); this.fittedDistance = this.currentCamera.distance; this.cameraInitialized = true; }
      if (initial) engine.setCamera(this.currentCamera);
      this.drawEngineLabels(paint, size);
    } catch { this.closeEngine(); this.failEngine('error'); }
  }
  private drawEngineLabels(paint: GraphBuiltin3dPaint, size: SpatialViewport): void {
    const canvas = this.engineSurface?.querySelector<HTMLCanvasElement>('[data-graph-labels]'); const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !this.engine) return;
    if (this.columnScene) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    const ratio = Math.min(finiteRange(this.host.ownerDocument.defaultView?.devicePixelRatio ?? 1, 1, 1, 4), 8192 / Math.max(size.width, size.height));
    canvas.width = Math.max(1, Math.round(size.width * ratio)); canvas.height = Math.max(1, Math.round(size.height * ratio)); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.font = `${paint.fontSize}px ${paint.font}`; ctx.fillStyle = paint.text; ctx.textBaseline = 'middle';
    const zoom = this.fittedDistance / this.currentCamera.distance;
    if (this.host.nodeLabels !== 'none' && (this.host.nodeLabels === 'always' || zoom >= 0.5)) {
      const count = this.world.length;
      for (let row = 0; row < count; row++) {
        const point = this.engine.project?.(row), position = this.engine.positionOf?.(row); if (!point || !position) continue;
        const label = this.world[row]!.node.label ?? this.world[row]!.node.id;
        const id = this.world[row]!.node.id;
        const projected = projectSpatialPoint(position, this.currentCamera, size); const radius = this.world[row]?.radius ?? 15;
        if (!projected || point.x < -512 || point.x > size.width || point.y < 0 || point.y > size.height) continue;
        ctx.globalAlpha = selectedIds(this.host.dimmedNodeIds).has(id) ? paint.dimmedOpacity : 1;
        ctx.fillText(label, point.x + radius * projected.scale + 4, point.y);
      }
    }
    if (!this.columnScene && this.host.withEdgeLabels && zoom >= finiteRange(this.host.edgeLabelMinZoom, 0.6, 0.001, 1000)) for (const edge of this.edges) {
      if (!edge.label || !paint.visibleEdges.has(graphLinkIdentity(edge))) continue;
      const a = this.position(edge.source), b = this.position(edge.target); if (!a) continue;
      const radius = this.worldById.get(edge.source)?.radius ?? 15;
      const anchor = edge.source === edge.target ? { x: a.x, y: a.y - radius * 3.2, z: a.z } : b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 } : { x: a.x + 14, y: a.y - 14, z: a.z };
      const point = projectSpatialPoint(anchor, this.currentCamera, size); if (!point) continue;
      ctx.globalAlpha = selectedIds(this.host.dimmedEdgeIds).has(graphLinkIdentity(edge)) ? paint.dimmedOpacity : 1; ctx.fillText(edge.label, point.x, point.y - paint.fontSize);
    }
    ctx.globalAlpha = 1;
  }

  prepare(): void {
    const preference = this.options.sourceMode?.() ? 'builtin' : this.host.engine ?? 'builtin';
    if (this.preference !== preference) { this.closeEngine(); this.preference = preference; this.selection.prefer(preference); this.fallback = undefined; this.contextFailed = false; }
    const columns = this.options.columns?.();
    if (columns) {
      if (this.columns !== columns || this.hiddenTypes !== this.host.hiddenTypes) {
        this.columns = columns; this.hiddenTypes = this.host.hiddenTypes; this.columnScene = graphEngineColumnScene(columns, this.hiddenTypes);
        this.world = []; this.edges = []; this.items = []; this.worldById.clear(); this.nodeIndexById.clear(); this.source = undefined;
        this.paint = undefined; this.engineDataKey = undefined; this.page = Math.min(this.page, Math.max(0, Math.ceil(this.itemCount / PAGE_SIZE) - 1)); this.setHover(undefined);
      }
      if (this.selection.renderer === 'builtin' && this.host.view === '3d') this.failEngine('unsupported');
      this.admitCamera(); return;
    }
    if (this.columns) { this.columns = undefined; this.columnScene = undefined; this.source = undefined; this.engineDataKey = undefined; }
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
      this.page = Math.min(this.page, Math.max(0, Math.ceil(this.itemCount / PAGE_SIZE) - 1));
      this.builtin?.invalidate();
      this.setHover(undefined);
      if (!this.cameraInitialized && this.world.length) {
        this.currentCamera = fittedGraphCamera(this.world, this.viewport());
        this.fittedDistance = this.currentCamera.distance;
        this.cameraInitialized = true;
        this.pendingInitialFit = true;
      }
    }
    this.admitCamera();
  }

  private normalizeCamera(value: unknown): LyraGraphCamera { return this.preference === 'webgl' ? graphWebglCamera(value, this.currentCamera) : normalizeGraphCamera(value, this.currentCamera); }
  private admitCamera(): void {
    if (this.authoredCamera !== this.host.camera) {
      this.authoredCamera = this.host.camera;
      this.pendingInitialFit = false;
      this.currentCamera = this.authoredCamera ? this.normalizeCamera(this.authoredCamera) : this.engine?.fit ? this.normalizeCamera(this.engine.fit()) : fittedGraphCamera(this.world, this.viewport());
      this.engine?.setCamera(this.currentCamera);
      this.builtin?.invalidate();
    }
  }

  update(repaint = true): void {
    if (!this.host.isConnected || this.host.view === '2d') { this.disconnect(); return; }
    if (repaint) { this.paint = undefined; this.rgbaCache.clear(); }
    const next = this.host.renderRoot.querySelector<HTMLCanvasElement>('canvas[part="spatial-canvas"]') ?? undefined;
    const engineSurface = this.host.renderRoot.querySelector<HTMLElement>('[data-webgl-host]') ?? undefined;
    if (this.engineSurface !== engineSurface) { this.closeEngine(); this.engineSurface = engineSurface; }
    if (this.canvas !== next) {
      this.cancelGesture(); this.builtin?.dispose(); this.builtin = undefined; this.canvas = next;
      this.fitInitialCanvas();
      try { this.context = next?.getContext('2d') ?? undefined; } catch { this.context = undefined; }
      if (next && this.context) this.builtin = new GraphBuiltin3dEngine(next, this.context);
      if (next && !this.context && !this.contextFailed) {
        this.contextFailed = true;
        this.options.afterUpdate(() => { if (!this.contextFailed || this.host.view !== '3d') return; this.failEngine('unsupported'); this.options.unavailable(); this.options.repaint(); }, 'graph-spatial-context');
      }
    }
    const surface = this.selection.renderer === 'webgl' ? engineSurface : next;
    if (this.observedSurface !== surface) {
      this.resize?.disconnect(); this.intersection?.disconnect(); this.observedSurface = surface; this.visible = this.selection.renderer !== 'webgl';
      const view = this.host.ownerDocument.defaultView;
      if (surface && view) {
        const Resize = view.ResizeObserver;
        if (Resize) { this.resize = new Resize(() => { this.fitInitialCanvas(); this.builtin?.invalidate(); this.schedule(); }); this.resize.observe(surface); }
        const Intersection = view.IntersectionObserver;
        if (Intersection) { this.intersection = new Intersection((entries) => { this.visible = entries[0]?.isIntersecting ?? false; if (this.visible) { this.ensureEngine(); this.schedule(); } }); this.intersection.observe(surface); }
        else this.visible = surface.clientWidth > 0 && surface.clientHeight > 0;
      }
    }
    this.ensureEngine(); this.schedule();
    if (this.focusAfterViewChange) {
      this.focusAfterViewChange = false;
      (this.host.renderRoot.querySelector<HTMLElement>('[part="spatial-list-item"]') ?? this.host.renderRoot.querySelector<HTMLElement>('[part="spatial-canvas"]') ?? this.host.renderRoot.querySelector<HTMLElement>('[data-spatial-action="3d"]'))?.focus();
    }
  }

  disconnect(): void {
    this.closeEngine(); this.preference = undefined; this.fallback = undefined; this.engineSurface = undefined; this.observedSurface = undefined;
    this.cancelHover();
    this.builtin?.dispose(); this.builtin = undefined;
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
    this.hover = undefined;
    this.visible = true;
    this.contextFailed = false;
  }

  invalidate(): void { this.paint = undefined; this.builtin?.invalidate(); this.schedule(); }

  private fitInitialCanvas(): void {
    if (!this.pendingInitialFit || !this.canvas?.clientWidth || !this.canvas.clientHeight) return;
    this.pendingInitialFit = false;
    this.currentCamera = fittedGraphCamera(this.world, this.viewport());
    this.fittedDistance = this.currentCamera.distance;
    this.builtin?.invalidate();
  }

  private viewport(): SpatialViewport {
    const surface = this.selection.renderer === 'webgl' ? this.engineSurface : this.canvas;
    return { width: Math.max(1, surface?.clientWidth || this.options.viewport().width), height: Math.max(1, surface?.clientHeight || this.options.viewport().height) };
  }

  position(id: string): LyraGraphPosition | undefined {
    this.prepare(); const row = this.columnScene?.nodeIndex(id) ?? this.nodeIndexById.get(id);
    const point = row === undefined || this.engineDataKey !== (this.columnScene ?? this.world) || this.selection.renderer !== 'webgl' ? undefined : this.engine?.positionOf?.(row);
    if (point) return Object.freeze({ ...point });
    if (this.columnScene) { const data = this.columnScene.data; if (row === undefined) return undefined; return data.positions ? Object.freeze({ x: data.positions[row * 3]!, y: data.positions[row * 3 + 1]!, z: data.positions[row * 3 + 2]! }) : spatialNodePosition({ id }); }
    return this.worldById.get(id)?.position;
  }

  screenPosition(id: string): { x: number; y: number } | undefined {
    if (this.host.view !== '3d' || this.selection.renderer === 'list') return undefined;
    if (this.selection.renderer === 'webgl') { if (this.engineDataKey !== (this.columnScene ?? this.world)) return undefined; const row = this.columnScene?.nodeIndex(id) ?? this.nodeIndexById.get(id); const point = row === undefined ? null : this.engine?.project?.(row); if (!point || !this.engineSurface) return undefined; const bounds = this.engineSurface.getBoundingClientRect(), host = this.host.getBoundingClientRect(); return { x: bounds.left - host.left + point.x, y: bounds.top - host.top + point.y }; }
    if (!this.canvas) return undefined;
    const node = this.worldById.get(id);
    const point = node && projectSpatialPoint(node.position, this.currentCamera, this.viewport());
    if (!point) return undefined;
    const bounds = this.canvas.getBoundingClientRect(), hostBounds = this.host.getBoundingClientRect();
    return { x: bounds.left - hostBounds.left + point.x, y: bounds.top - hostBounds.top + point.y };
  }

  fit(padding?: number): void {
    this.prepare();
    if (this.selection.renderer === 'webgl' && this.engine?.fit) { const camera = this.engine.fit(padding); this.currentCamera = this.normalizeCamera(camera); this.fittedDistance = this.currentCamera.distance; this.changeCamera(this.currentCamera); return; }
    if (!this.world.length) return;
    const camera = fittedGraphCamera(this.world, this.viewport(), padding);
    this.fittedDistance = camera.distance;
    this.changeCamera(camera);
  }

  focusNode(id: string, zoom?: number): boolean {
    this.prepare();
    const position = this.position(id);
    if (!position) return false;
    if (this.host.view === 'list' || this.contextFailed || this.selection.renderer === 'list') {
      this.page = Math.floor((this.columnScene?.nodeIndex(id) ?? this.nodeIndexById.get(id) ?? 0) / PAGE_SIZE);
      this.options.repaint();
    }
    this.changeCamera({ ...this.currentCamera, target: position, distance: zoom === undefined ? this.currentCamera.distance : this.fittedDistance / this.safeZoom(zoom) });
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
    this.currentCamera = this.normalizeCamera(camera);
    this.engine?.setCamera(this.currentCamera);
    this.builtin?.invalidate();
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
        this.options.cameraChanged(this.normalizeCamera(this.currentCamera));
      }
    });
  }

  private builtinFrame(): GraphBuiltin3dFrame {
    return {
      world: this.world, edges: this.edges, camera: this.currentCamera, viewport: this.viewport(),
      paint: this.paint ??= this.options.paint(this.world, this.edges), fittedDistance: this.fittedDistance,
      selectedNodeIds: this.host.selectedNodeIds, selectedEdgeIds: this.host.selectedEdgeIds,
      dimmedNodeIds: this.host.dimmedNodeIds, dimmedEdgeIds: this.host.dimmedEdgeIds,
      focusNodeId: this.host.focusNodeId, hover: this.hover, nodeLabels: this.host.nodeLabels,
      withEdgeLabels: this.host.withEdgeLabels, edgeLabelMinZoom: this.host.edgeLabelMinZoom,
    };
  }

  private draw(): void {
    if (this.host.view !== '3d') return;
    if (this.selection.renderer === 'webgl') { this.drawEngine(); return; }
    this.builtin?.draw(this.builtinFrame());
  }

  private hit(clientX: number, clientY: number): SpatialHit | undefined {
    if (this.selection.renderer === 'webgl' && this.engineSurface) { const bounds = this.engineSurface.getBoundingClientRect(); return this.engineHit(this.engine?.pick?.(clientX - bounds.left, clientY - bounds.top) ?? null); }
    return this.builtin?.hit(clientX, clientY, this.builtinFrame());
  }

  private cancelHover(): void {
    this.hoverGeneration++;
    if (this.hoverFrame !== undefined) this.hoverFrameWindow?.cancelAnimationFrame(this.hoverFrame);
    this.hoverFrame = undefined;
    this.hoverFrameWindow = undefined;
    this.pendingHover = undefined;
  }

  private queueHover(x: number, y: number): void {
    this.pendingHover = { x, y };
    if (this.hoverFrame !== undefined) return;
    const view = this.host.ownerDocument.defaultView;
    if (!view) return;
    const generation = this.hoverGeneration;
    this.hoverFrameWindow = view;
    this.hoverFrame = view.requestAnimationFrame(() => {
      if (generation !== this.hoverGeneration) return;
      this.hoverFrame = undefined;
      this.hoverFrameWindow = undefined;
      const point = this.pendingHover;
      this.pendingHover = undefined;
      if (point && this.host.isConnected && this.host.view === '3d' && !this.gesture)
        this.setHover(this.hit(point.x, point.y));
    });
  }

  private setHover(next: SpatialHit | undefined): void {
    if (this.hover?.kind === next?.kind && this.hover?.id === next?.id) return;
    const previous = this.hover; this.hover = next;
    const surface = this.selection.renderer === 'webgl' ? this.engineSurface : this.canvas;
    if (surface) surface.title = next?.kind === 'node' ? this.options.nodeTooltip(next.node) : next?.kind === 'link' ? this.options.edgeTooltip(next.edge) : '';
    this.options.hover(previous, next);
    this.schedule();
  }

  private cancelGesture(): void {
    const gesture = this.gesture;
    this.gesture = undefined;
    if (gesture && this.canvas?.hasPointerCapture(gesture.id)) this.canvas.releasePointerCapture(gesture.id);
  }

  private readonly enginePointerDown = { capture: true, handleEvent: () => { this.engineSurface?.focus(); } };
  private readonly enginePointerMove = { capture: true, handleEvent: () => { this.schedule(); } };
  private readonly pointerDown = (event: PointerEvent): void => {
    if (this.selection.renderer === 'webgl') return;
    if (event.button !== 0 || this.gesture) return;
    this.cancelHover();
    this.canvas?.focus();
    this.gesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false, pan: event.shiftKey };
    try { this.canvas?.setPointerCapture(event.pointerId); } catch { /* Synthetic pointers need no capture. */ }
    this.setHover(undefined);
  };
  private readonly pointerMove = (event: PointerEvent): void => {
    if (this.selection.renderer === 'webgl') { this.schedule(); return; }
    const gesture = this.gesture;
    if (!gesture) { this.queueHover(event.clientX, event.clientY); return; }
    if (gesture.id !== event.pointerId) return;
    gesture.moved ||= Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 5;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    gesture.x = event.clientX; gesture.y = event.clientY;
    if (!gesture.moved) return;
    if (gesture.pan) this.changeCamera(this.panCamera(dx, dy));
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
  private readonly pointerCancel = (event: PointerEvent): void => { this.cancelHover(); if (event.pointerId === this.gesture?.id) this.cancelGesture(); };
  private readonly wheel = (event: WheelEvent): void => {
    if (this.selection.renderer === 'webgl') { if (this.host.shadowRoot?.activeElement !== this.engineSurface) return; event.preventDefault(); this.zoom(Math.exp(-finiteRange(event.deltaY, 0, -300, 300) * 0.002)); return; }
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
      if (event.shiftKey) this.changeCamera(this.panCamera(dx * 24, dy * 24));
      else this.orbit(dx * ORBIT_STEP, -dy * ORBIT_STEP);
    } else if (event.key === '+' || event.key === '=' || event.key === '-') {
      event.preventDefault(); this.zoom(event.key === '-' ? 1 / 1.2 : 1.2);
    } else if (event.key === 'Home') { event.preventDefault(); this.fit(); }
    else if (event.key === 'Escape') this.options.clearSelection();
  };

  private changeView(view: '3d' | 'list'): void {
    this.cancelGesture();
    if (view === '3d') { this.contextFailed = false; this.selection.prefer(this.preference); this.fallback = undefined; }
    this.host.view = view;
    this.options.repaint();
    this.focusAfterViewChange = true;
    this.options.viewChanged();
  }

  private changePage(delta: number): void {
    this.page = Math.max(0, Math.min(Math.ceil(this.itemCount / PAGE_SIZE) - 1, this.page + delta));
    this.focusAfterViewChange = true;
    this.options.repaint();
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
    const list = this.host.view === 'list' || this.contextFailed || this.selection.renderer === 'list';
    const pageItems = this.pageItems();
    const number = getNumberFormat(this.options.locale());
    const selectedNodes = selectedIds(this.host.selectedNodeIds), selectedEdges = selectedIds(this.host.selectedEdgeIds);
    const button = (action: string, label: string, callback: () => void) => html`<button type="button" part="spatial-control" data-spatial-action=${action} @click=${callback}>${label}</button>`;
    return html`<div part="base" class="spatial-base">
      <div part="spatial-toolbar" role="group" aria-label=${messages['controls']}>
        <button type="button" part="spatial-control" data-spatial-action="3d" aria-pressed=${String(!list)} @click=${() => this.changeView('3d')}>${messages['view3d']}</button>
        <button type="button" part="spatial-control" data-spatial-action="list" aria-pressed=${String(list)} @click=${() => this.changeView('list')}>${messages['viewList']}</button>
        ${!list ? html`${button('fit', messages['fit']!, () => this.fit())}${button('left', messages['left']!, () => this.orbit(-ORBIT_STEP, 0))}${button('right', messages['right']!, () => this.orbit(ORBIT_STEP, 0))}${button('up', messages['up']!, () => this.orbit(0, ORBIT_STEP))}${button('down', messages['down']!, () => this.orbit(0, -ORBIT_STEP))}${button('zoom-in', messages['zoomIn']!, () => this.zoom(1.2))}${button('zoom-out', messages['zoomOut']!, () => this.zoom(1 / 1.2))}` : nothing}
      </div>
      ${this.contextFailed ? html`<p part="error">${messages['unavailable']}</p>` : nothing}
      ${this.fallback ? html`<p part="engine-notice">${this.options.engineMessage?.(engine3dFallbackNotice(this.fallback).reason)} ${this.options.engineMessage?.(engine3dFallbackNotice(this.fallback).showing)}</p>` : nothing}
      ${this.enginePending ? html`<p part="loading">${this.options.engineMessage?.('engine3dLoading')}</p>` : nothing}
      ${this.host.view === '3d' && this.preference === 'webgl' ? html`<div data-webgl-host part="spatial-canvas" class="webgl-surface" ?hidden=${this.selection.renderer !== 'webgl'} tabindex="0" role="img"
        aria-label=${this.host.accessibleLabel ?? this.host.label ?? messages['view3d']} aria-describedby=${this.instructionsId} @keydown=${this.keyDown} @wheel=${this.wheel} @pointermove=${this.enginePointerMove}
        @pointerdown=${this.enginePointerDown}><canvas data-graph-labels aria-hidden="true"></canvas></div>` : nothing}
      ${list ? html`<div part="spatial-list" tabindex="-1" @keydown=${(event: KeyboardEvent) => { if (event.key === 'Escape') this.options.clearSelection(); }}>
        <ul aria-label=${messages['dataList']}>
          ${pageItems.map((item, index) => {
            const id = item.kind === 'node' ? item.node.id : item.kind === 'link' ? graphLinkIdentity(item.edge) : item.community.id;
            const selected = item.kind === 'node' ? selectedNodes.has(id) : item.kind === 'link' ? selectedEdges.has(id) : false;
            const text = item.kind === 'node' ? this.options.nodeText(item.node) : item.kind === 'link' ? this.options.edgeText(item.edge) : this.options.communityText({ label: item.community.label ?? id, count: number.format(this.communityCounts.get(id) ?? 0) });
            return html`<li aria-posinset=${this.page * PAGE_SIZE + index + 1} aria-setsize=${this.itemCount}><button type="button" part="spatial-list-item" data-node-id=${item.kind === 'node' ? id : nothing}
              aria-pressed=${item.kind !== 'community' && this.host.selectionMode !== 'none' ? String(selected) : nothing}
              aria-current=${item.kind !== 'community' && this.host.selectionMode === 'none' && selected ? 'true' : nothing}
              @keydown=${(event: KeyboardEvent) => this.listKeyDown(item, event)} @click=${(event: MouseEvent) => this.activateItem(item, event)} @dblclick=${() => { if (item.kind === 'node') this.options.expand(id); }}
            >${text}</button></li>`;
          })}
        </ul>
        ${!this.itemCount ? html`<p part="empty">${messages['noData']}</p>` : nothing}
        <p part="spatial-page-count">${this.options.pageText({ page: number.format(this.page + 1), pages: number.format(Math.max(1, Math.ceil(this.itemCount / PAGE_SIZE))), total: number.format(this.itemCount) })}</p>
        <div part="spatial-pagination">
          <button type="button" part="spatial-control" data-spatial-action="previous" ?disabled=${this.page === 0} @click=${() => this.changePage(-1)}>${messages['previous']}</button>
          <button type="button" part="spatial-control" data-spatial-action="next" ?disabled=${(this.page + 1) * PAGE_SIZE >= this.itemCount} @click=${() => this.changePage(1)}>${messages['next']}</button>
        </div>
      </div>` : html`<p part="spatial-instructions" id=${this.instructionsId}>${messages['instructions']}</p>
        ${this.selection.renderer !== 'webgl' ? html`<canvas part="spatial-canvas" tabindex="0" role="img" aria-label=${this.host.accessibleLabel ?? this.host.label ?? messages['view3d']}
          aria-describedby=${this.instructionsId} @pointerdown=${this.pointerDown} @pointermove=${this.pointerMove} @pointerup=${this.pointerUp}
          @pointercancel=${this.pointerCancel} @lostpointercapture=${this.pointerCancel} @pointerleave=${() => { if (!this.gesture) { this.cancelHover(); this.setHover(undefined); } }}
          @wheel=${this.wheel} @keydown=${this.keyDown} @dblclick=${(event: MouseEvent) => { const hit = this.hit(event.clientX, event.clientY); if (hit?.kind === 'node') this.options.expand(hit.id); }}
        ></canvas>` : nothing}
        ${!(this.columnScene?.data.nodeCount ?? this.world.length) ? html`<p part="empty">${messages['noData']}</p>` : nothing}`}
      ${limitNotices}
    </div>`;
  }
}
