import { finiteRange } from '../../../internal/numbers.js';
import { graphLinkIdentity, type LyraGraphCamera, type LyraGraphEdge } from './graph-model.js';
import { SpatialHitIndex, SpatialProjectionWorkspace, projectSpatialScene, type SpatialHit, type SpatialProjectedNode, type SpatialScene, type SpatialSegment, type SpatialViewport, type SpatialWorldNode } from './graph-spatial.js';

const EMPTY_DASH = { values: [] as number[], key: '' };
const DANGLING_DASH = { values: [4, 4], key: '4,4' };
const selectionSets = new WeakMap<readonly string[], ReadonlySet<string>>();
function selectedIds(ids: readonly string[]): ReadonlySet<string> {
  if (!Object.isFrozen(ids)) return new Set(ids);
  let result = selectionSets.get(ids);
  if (!result) { result = new Set(ids); selectionSets.set(ids, result); }
  return result;
}

export interface GraphBuiltin3dPaint {
  readonly nodes: ReadonlyMap<string, string>;
  readonly edges: ReadonlyMap<string, string>;
  readonly visibleEdges: ReadonlySet<string>;
  readonly text: string;
  readonly selected: string;
  readonly font: string;
  readonly fontSize: number;
  readonly dimmedOpacity: number;
}
export interface GraphBuiltin3dFrame {
  readonly world: readonly SpatialWorldNode[];
  readonly edges: readonly LyraGraphEdge[];
  readonly camera: LyraGraphCamera;
  readonly viewport: SpatialViewport;
  readonly paint: GraphBuiltin3dPaint;
  readonly fittedDistance: number;
  readonly selectedNodeIds: readonly string[];
  readonly selectedEdgeIds: readonly string[];
  readonly dimmedNodeIds: readonly string[];
  readonly dimmedEdgeIds: readonly string[];
  readonly focusNodeId: string | null;
  readonly hover?: SpatialHit;
  readonly nodeLabels?: string;
  readonly withEdgeLabels: boolean;
  readonly edgeLabelMinZoom: number;
}

/** Canvas drawing and projected hit geometry; the component owns its surface and interactions. */
export class GraphBuiltin3dEngine {
  private canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D;
  private world?: readonly SpatialWorldNode[];
  private edges?: readonly LyraGraphEdge[];
  private camera?: LyraGraphCamera;
  private scene?: SpatialScene;
  private hitIndex?: SpatialHitIndex;
  private projectionWorkspace = new SpatialProjectionWorkspace();
  private sceneViewport?: SpatialViewport;
  private sceneVisibleEdges?: ReadonlySet<string>;
  private projectedById = new Map<string, SpatialProjectedNode>();
  private edgeDashes = new WeakMap<LyraGraphEdge, { values: number[]; key: string }>();
  private readonly textWidths = new Map<string, number>();
  private measuredFont = '';

  constructor(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) { this.canvas = canvas; this.context = context; }

  invalidate(): void { this.scene = undefined; this.hitIndex = undefined; }

  dispose(): void {
    if (!this.canvas) return;
    this.canvas = undefined; this.context = undefined;
    this.world = undefined; this.edges = undefined; this.camera = undefined;
    this.scene = undefined; this.hitIndex = undefined; this.sceneViewport = undefined; this.sceneVisibleEdges = undefined;
    this.projectedById.clear(); this.textWidths.clear(); this.measuredFont = '';
    this.edgeDashes = new WeakMap(); this.projectionWorkspace = new SpatialProjectionWorkspace();
  }

  private projectedScene(frame: GraphBuiltin3dFrame): SpatialScene {
    const { viewport, paint } = frame;
    const previousEdges = this.sceneVisibleEdges;
    if (this.world !== frame.world || this.edges !== frame.edges || this.camera !== frame.camera ||
      this.sceneViewport?.width !== viewport.width || this.sceneViewport.height !== viewport.height ||
      (!previousEdges || (previousEdges !== paint.visibleEdges && (previousEdges.size !== paint.visibleEdges.size || [...paint.visibleEdges].some((id) => !previousEdges.has(id))))))
      this.scene = undefined;
    if (!this.scene) {
      this.scene = projectSpatialScene(frame.world, frame.edges.filter((edge) => paint.visibleEdges.has(graphLinkIdentity(edge))), frame.camera, viewport, this.projectionWorkspace);
      this.hitIndex = new SpatialHitIndex(this.scene);
      this.projectedById = new Map(this.scene.nodes.map(node => [node.node.id, node]));
      this.sceneViewport = { ...viewport }; this.world = frame.world; this.edges = frame.edges; this.camera = frame.camera;
    }
    this.sceneVisibleEdges = paint.visibleEdges;
    return this.scene;
  }

  private textWidth(ctx: CanvasRenderingContext2D, text: string): number {
    if (this.measuredFont !== ctx.font) { this.measuredFont = ctx.font; this.textWidths.clear(); }
    let width = this.textWidths.get(text);
    if (width === undefined) {
      width = ctx.measureText(text).width;
      if (this.textWidths.size >= 10000) this.textWidths.delete(this.textWidths.keys().next().value!);
      this.textWidths.set(text, width);
    }
    return width;
  }

  draw(frame: GraphBuiltin3dFrame): void {
    const canvas = this.canvas, ctx = this.context;
    if (!canvas || !ctx) return;
    const size = frame.viewport;
    const dpr = finiteRange(canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1, 1, 1, 4);
    const scale = Math.min(dpr, 8192 / Math.max(size.width, size.height));
    const width = Math.max(1, Math.round(size.width * scale)), height = Math.max(1, Math.round(size.height * scale));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    const paint = frame.paint;
    ctx.save();
    ctx.font = `${paint.fontSize}px ${paint.font}`;
    ctx.textBaseline = 'middle';
    const selectedNodes = selectedIds(frame.selectedNodeIds), selectedEdges = selectedIds(frame.selectedEdgeIds);
    const dimmedNodes = selectedIds(frame.dimmedNodeIds), dimmedEdges = selectedIds(frame.dimmedEdgeIds);
    const zoom = frame.fittedDistance / frame.camera.distance;
    const scene = this.projectedScene(frame);
    const outside = (left: number, top: number, right: number, bottom: number) =>
      right < 0 || bottom < 0 || left > size.width || top > size.height;
    const nodeLabels = frame.nodeLabels !== 'none' && (frame.nodeLabels === 'always' || zoom >= 0.5);
    let strokeStyle: string | undefined;
    const flushStroke = () => { if (strokeStyle !== undefined) { ctx.stroke(); strokeStyle = undefined; } };
    for (const primitive of scene.primitives) {
      if (primitive.kind === 'node') {
        const entry = primitive.value, id = entry.node.id;
        const radius = entry.screenRadius * Math.SQRT2 + Math.max(6, paint.fontSize);
        const labelWidth = nodeLabels ? this.textWidth(ctx, entry.node.label ?? id) : 0;
        if (outside(entry.x - radius, entry.y - radius, entry.x + radius + labelWidth, entry.y + radius)) continue;
        flushStroke();
        ctx.setLineDash([]); ctx.textAlign = 'left';
        ctx.globalAlpha = dimmedNodes.has(id) ? paint.dimmedOpacity : 1;
        this.drawNode(ctx, entry, paint.nodes.get(id) ?? paint.text);
        if (selectedNodes.has(id) || frame.focusNodeId === id || (frame.hover?.kind === 'node' && frame.hover.id === id)) {
          ctx.strokeStyle = paint.selected; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(entry.x, entry.y, entry.screenRadius + 4, 0, Math.PI * 2); ctx.stroke();
        }
        if (nodeLabels) {
          ctx.fillStyle = paint.text;
          ctx.fillText(entry.node.label ?? entry.node.id, entry.x + entry.screenRadius + 4, entry.y);
        }
        if (entry.node.expandable) {
          ctx.fillStyle = paint.text; ctx.fillText('+', entry.x + entry.screenRadius, entry.y - entry.screenRadius);
        }
      } else {
        const entry = primitive.value;
        const padding = Math.max(6, finiteRange(entry.edge.width ?? 1.5, 1.5, 0, 1000) * 3, this.projectedById.get(entry.edge.target)?.screenRadius ?? 0);
        const labelPoint = entry.labelPoint ?? entry.a;
        const labelWidth = entry.middle && frame.withEdgeLabels && entry.edge.label ? this.textWidth(ctx, entry.edge.label) : 0;
        if (outside(Math.min(entry.a.x, entry.b.x, labelWidth ? labelPoint.x : entry.a.x) - padding,
          Math.min(entry.a.y, entry.b.y, labelWidth ? labelPoint.y : entry.a.y) - padding - paint.fontSize,
          Math.max(entry.a.x, entry.b.x, labelWidth ? labelPoint.x + labelWidth : entry.a.x) + padding,
          Math.max(entry.a.y, entry.b.y, labelWidth ? labelPoint.y : entry.a.y) + padding)) continue;
        const alpha = dimmedEdges.has(entry.id) ? paint.dimmedOpacity : 1;
        const selected = selectedEdges.has(entry.id) || (frame.hover?.kind === 'link' && frame.hover.id === entry.id);
        const color = selected ? paint.selected : paint.edges.get(entry.id) ?? paint.text;
        const width = finiteRange(entry.edge.width ?? 1.5, 1.5, 0, 1000);
        const labeled = entry.middle && frame.withEdgeLabels && entry.edge.label;
        const dash = this.dashPattern(entry.edge, entry.dangling);
        // Repeated translucent strokes accumulate coverage, so only opaque runs may share a path.
        const opaque = alpha === 1 && (/^rgb\([\d.,\s]+\)$/.test(color) || /^#[\da-f]{6}$/i.test(color));
        if (!entry.edge.directed && !labeled && width > 0 && opaque) {
          const style = `${color}|${width + (selected ? 2 : 0)}|${alpha}|${dash.key}|${entry.offset}`;
          if (strokeStyle !== style) {
            flushStroke(); ctx.beginPath(); strokeStyle = style;
            ctx.strokeStyle = color; ctx.lineWidth = width + (selected ? 2 : 0);
            ctx.globalAlpha = alpha; ctx.setLineDash(dash.values); ctx.lineDashOffset = -entry.offset;
          }
          ctx.moveTo(entry.a.x, entry.a.y); ctx.lineTo(entry.b.x, entry.b.y);
          continue;
        }
        flushStroke();
        ctx.globalAlpha = alpha;
        this.drawSegment(ctx, entry, selected ? paint.selected : paint.edges.get(entry.id) ?? paint.text, selected, this.projectedById.get(entry.edge.target)?.screenRadius ?? 0);
        if (entry.middle && frame.withEdgeLabels && zoom >= finiteRange(frame.edgeLabelMinZoom, 0.6, 0.001, 1000) && entry.edge.label) {
          ctx.fillStyle = paint.text; ctx.fillText(entry.edge.label, labelPoint.x, labelPoint.y - paint.fontSize);
        }
      }
    }
    flushStroke();
    ctx.restore();
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

  private dashPattern(edge: LyraGraphEdge, dangling: boolean): { values: number[]; key: string } {
    if (dangling) return DANGLING_DASH;
    const cached = this.edgeDashes.get(edge);
    if (cached) return cached;
    const dash = edge.dash;
    const result = Array.isArray(dash) && dash.length > 0 && dash.length <= 32 && dash.every(value => Number.isFinite(value) && value >= 0)
      ? { values: [...dash], key: dash.join(',') } : EMPTY_DASH;
    if (Object.isFrozen(edge)) this.edgeDashes.set(edge, result);
    return result;
  }

  private drawSegment(ctx: CanvasRenderingContext2D, segment: SpatialSegment, color: string, selected: boolean, targetRadius: number): void {
    const { a, b, edge } = segment;
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = finiteRange(edge.width ?? 1.5, 1.5, 0, 1000) + (selected ? 2 : 0);
    ctx.setLineDash(this.dashPattern(edge, segment.dangling).values);
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

  hit(clientX: number, clientY: number, frame: GraphBuiltin3dFrame): SpatialHit | undefined {
    const bounds = this.canvas?.getBoundingClientRect();
    if (!bounds) return undefined;
    this.projectedScene(frame);
    return this.hitIndex?.hit(clientX - bounds.left, clientY - bounds.top);
  }

}
