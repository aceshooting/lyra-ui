import { disposeAll } from '../core/dispose.js';
import { CanvasTexture, Color, ConeGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, ShaderMaterial, Sphere, SphereGeometry, SRGBColorSpace, Vector3 } from 'three';
import type { Lyra3dState, Lyra3dWorldPoint } from '../core/contract.js';
import { encodePickId, createPickMaterial } from '../core/picking.js';
import type { Lyra3dViewport } from '../core/viewport.js';
import { projectOrbitPoint } from '../core/orbit.js';
import type { GraphPreparedDataColumns } from './data-preparation.js';
import type { Lyra3dRgba, ResolvedLyra3dStyle } from '../core/style.js';

import type { GraphSpatialAppearance } from './spatial-appearance.js';
import { spatialEdgePoint, spatialNodeWorldRadius } from './spatial-paths.js';
import { changedVisualRows } from '../core/visual-state.js';
import { markAttributeFull, markAttributeRows } from '../core/attribute-updates.js';
import { createPaintColors, type PaintColors } from '../core/paint-colors.js';
import { createGraphLabelAdmission, graphDecorationMode, graphDecorationScalar, graphEdgeLabelsVisible, isGraphDirectedValue } from './decoration-admission.js';

export type GraphNodeLabelsMode = 'always' | 'zoom' | 'none';
export interface GraphDecorationData {
  labels?: readonly string[];
  edgeLabels?: readonly string[];
  nodeLabels?: GraphNodeLabelsMode;
  withEdgeLabels?: boolean;
  edgeLabelMinZoom?: number;
  directed?: Uint8Array;
  /** Up to eight source-to-target particles per edge; the total is capped at 16,384. */
  particlesPerEdge?: number;
  /** Traversals per second; zero leaves particles stationary. */
  particleSpeed?: number;
}
const GRAPH_MAX_PAINTED_LABELS = 256;
const GRAPH_MAX_PARTICLES = 16_384;
const MAX_LABEL_CANVAS = 2048;

/** Copies and admits decoration inputs before a replacement retires the current scene. */
export function admitGraphDecorations(input: GraphDecorationData, nodes: number, edges: number): GraphDecorationData {
  const admitLabel = createGraphLabelAdmission();
  const labels = (value: readonly string[] | undefined, count: number) => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.length !== count) throw new RangeError('Invalid graph label rows');
    return Array.from(value, admitLabel);
  };
  const mode = graphDecorationMode(input.nodeLabels);
  if (input.withEdgeLabels !== undefined) graphEdgeLabelsVisible(input.withEdgeLabels);
  if (input.directed !== undefined && (!(input.directed instanceof Uint8Array) || !(input.directed.buffer instanceof ArrayBuffer) || input.directed.length !== edges || !input.directed.every(isGraphDirectedValue))) throw new RangeError('Invalid graph directed mask');
  return {
    labels: labels(input.labels, nodes), edgeLabels: labels(input.edgeLabels, edges), nodeLabels: mode,
    withEdgeLabels: input.withEdgeLabels ?? false, edgeLabelMinZoom: graphDecorationScalar('edgeLabelMinZoom', input.edgeLabelMinZoom),
    directed: input.directed?.slice(), particlesPerEdge: graphDecorationScalar('particlesPerEdge', input.particlesPerEdge),
    particleSpeed: graphDecorationScalar('particleSpeed', input.particleSpeed),
  };
}

export function graphItemColor(style: ResolvedLyra3dStyle, state: Lyra3dState, item: number, base: Lyra3dRgba, color = new Color(), paintColor?: PaintColors): Color {
  const value = state.focus === item ? style.focus : state.selected.has(item) || state.hover === item ? style.accent : style.forcedColors ? style.foreground : base;
  if (paintColor) paintColor(value, color); else color.setRGB(value.r, value.g, value.b, SRGBColorSpace);
  if (!style.forcedColors && state.dimmed.has(item)) color.multiplyScalar(0.3);
  return color;
}

interface DecorationGraph extends GraphDecorationData {
  nodeCount: number;
  source: Uint32Array;
  target: Uint32Array;
  sizes?: Float32Array;
  spatialAppearance?: GraphSpatialAppearance;
}
export interface GraphDecorationFrame {
  positionOf(item: number): Lyra3dWorldPoint | null;
  state: Lyra3dState;
  fittedDistance: number;
  /** Increases when positions change in place. */
  revision: number;
  time: number;
}

export type GraphDecorationsView = Pick<Lyra3dViewport, 'width' | 'height' | 'orbit' | 'style'>;
export interface GraphDecorationsPresentation extends GraphDecorationsView {
  readonly state: Lyra3dState;
  readonly fittedDistance: number;
  readonly revision: number;
}
/** Native owners only; semantic data and canvas contexts never enter this retirement record. */
export interface GraphDecorationResources {
  readonly arrows: InstancedMesh<ConeGeometry, MeshBasicMaterial>;
  readonly arrowPick: InstancedMesh<ConeGeometry, MeshBasicMaterial>;
  readonly particles: InstancedMesh<SphereGeometry, MeshBasicMaterial>;
  readonly canvas?: HTMLCanvasElement;
  readonly labelTexture?: CanvasTexture;
  readonly labelMesh?: Mesh<PlaneGeometry, ShaderMaterial>;
  arrowSubmitted: boolean;
  arrowPickSubmitted: boolean;
  particleSubmitted: boolean;
  disposed: boolean;
}
export interface GraphDecorationBatch {
  update(view: GraphDecorationsView, frame: GraphDecorationFrame): boolean;
  allocationBuffers(): readonly ArrayBufferLike[];
  quiesce(): void;
  dispose(): void;
}
export interface GraphPreparedDecorations {
  readonly batch: GraphDecorationBatch;
  readonly resources: GraphDecorationResources;
  readonly ownedBuffers: readonly ArrayBufferLike[];
  readonly borrowedBuffers: readonly ArrayBufferLike[];
  readonly storage: {
    readonly cpuBytes: number;
    readonly gpuAttributeBytes: number;
    readonly gpuTextureBytes: number;
    readonly canvasBackingEstimateBytes: number;
    readonly semanticMapEntries: number;
  };
}
export interface GraphDecorationsWorkStep {
  readonly done: boolean;
  readonly operations: number;
  readonly allocatedBytes: number;
  readonly visitedLabelPresenceRows: number;
  readonly visitedDirectedRows: number;
  readonly initializedArrows: number;
  readonly initializedParticles: number;
  readonly boundedInstances: number;
  readonly consideredLabels: number;
  readonly paintedLabels: number;
  readonly canvasOperations: number;
  readonly value?: GraphPreparedDecorations;
}
export interface GraphDecorationsWork { step(maxOperations: number): GraphDecorationsWorkStep; dispose(): void; }

export function disposeGraphDecorationResources(resources: GraphDecorationResources): void {
  if (resources.disposed) return;
  resources.disposed = true;
  const { arrows, arrowPick, particles, canvas, labelTexture, labelMesh } = resources;
  disposeAll([
    ...[arrows, arrowPick, particles].flatMap(mesh => [() => mesh.removeFromParent(), () => mesh.material.dispose(), () => mesh.dispose()]),
    () => arrows.geometry.dispose(), () => particles.geometry.dispose(), () => labelMesh?.removeFromParent(), () => labelMesh?.geometry.dispose(),
    () => labelMesh?.material.dispose(), () => labelTexture?.dispose(), () => { if (canvas) canvas.width = 1; }, () => { if (canvas) canvas.height = 1; },
  ]);
}

type DecorationProjection = GraphDecorationsView & Pick<Lyra3dViewport, 'project'>;
type MutableDecorationResources = { -readonly [Key in keyof GraphDecorationResources]: GraphDecorationResources[Key] };
function decorationProjection(view: GraphDecorationsView): DecorationProjection {
  const { width, height, orbit, style } = view;
  return { width, height, orbit, style, project: point => projectOrbitPoint(point, orbit, { width, height }) };
}
function decorationColumns(data: DecorationGraph): DecorationGraph {
  const appearance = data.spatialAppearance;
  return { nodeCount: data.nodeCount, source: data.source, target: data.target, sizes: data.sizes,
    labels: data.labels, edgeLabels: data.edgeLabels, nodeLabels: data.nodeLabels, withEdgeLabels: data.withEdgeLabels,
    edgeLabelMinZoom: data.edgeLabelMinZoom, directed: appearance ? undefined : data.directed,
    particlesPerEdge: data.particlesPerEdge, particleSpeed: data.particleSpeed,
    spatialAppearance: appearance ? { sizeUnits: appearance.sizeUnits, edgeWidths: appearance.edgeWidths, edgeColors: appearance.edgeColors,
      edgeCurvatures: appearance.edgeCurvatures, dangling: appearance.dangling, labelLimit: appearance.labelLimit, dimmedOpacity: appearance.dimmedOpacity } : undefined };
}
function decorationPositionOf(positions: Float32Array): GraphDecorationFrame['positionOf'] {
  return row => row >= 0 && row < positions.length / 3
    ? { x: positions[row * 3]!, y: positions[row * 3 + 1]!, z: positions[row * 3 + 2]! } : null;
}
function decorationBuffers(resources: GraphDecorationResources, edgeIndices: Uint32Array): ArrayBufferLike[] {
  const arrays: ArrayBufferView[] = [edgeIndices];
  for (const mesh of [resources.arrows, resources.arrowPick, resources.particles, ...(resources.labelMesh ? [resources.labelMesh] : [])]) {
    for (const attribute of Object.values(mesh.geometry.attributes)) arrays.push(attribute.array);
    if (mesh.geometry.index) arrays.push(mesh.geometry.index.array);
    if (mesh instanceof InstancedMesh) { arrays.push(mesh.instanceMatrix.array); if (mesh.instanceColor) arrays.push(mesh.instanceColor.array); }
  }
  return [...new Set(arrays.map(array => array.buffer))];
}
function decorationLabelMaterial(texture: CanvasTexture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { labels: { value: texture } }, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 labelUv; void main() { labelUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D labels; varying vec2 labelUv; void main() { gl_FragColor = texture2D(labels, labelUv);\n#include <colorspace_fragment>\n}',
  });
}
function decorationSubmitted(resources: GraphDecorationResources, kind: 'arrowSubmitted' | 'arrowPickSubmitted' | 'particleSubmitted'): () => void {
  return () => { resources[kind] = true; };
}
function prepareDecorationBounds(resources: GraphDecorationResources): void {
  resources.arrows.boundingSphere = new Sphere().makeEmpty();
  resources.arrowPick.boundingSphere = new Sphere().makeEmpty();
  resources.particles.boundingSphere = new Sphere().makeEmpty();
  resources.arrows.onBeforeRender = decorationSubmitted(resources, 'arrowSubmitted');
  resources.arrowPick.onBeforeRender = decorationSubmitted(resources, 'arrowPickSubmitted');
  resources.particles.onBeforeRender = decorationSubmitted(resources, 'particleSubmitted');
}
interface DecorationLabelPaint { text: string; x: number; y: number; width: number; alpha: number; }
interface DecorationLabels {
  ratio: number;
  width: number;
  height: number;
  resized: boolean;
  scan: boolean;
  limit: number;
  painted: number;
}

function createDecorationController(data: DecorationGraph, resources: GraphDecorationResources, edgeIndices: Uint32Array,
  arrowRows: Map<number, number>, initialContext: CanvasRenderingContext2D | null, prepared: boolean) {
  const spatialData = data.spatialAppearance ? { ...data, spatialAppearance: data.spatialAppearance } : undefined;
  const { arrows, arrowPick, particles } = resources;
  let context = initialContext;
  const perEdge = data.particlesPerEdge ?? 0, particleCount = particles.count;
  const color = new Color(), matrix = new Matrix4(), point = new Vector3(), scale = new Vector3();
  const direction = new Vector3(), rotation = new Quaternion(), up = new Vector3(0, 1, 0), bound = new Sphere();
  let phase = 0, previousTime: number | undefined, quiesced = false;
  let lastLabels = '', lastPainted = -1, lastArrowTransforms = '';
  let lastArrowStyle: ResolvedLyra3dStyle | undefined, lastState: Lyra3dState | undefined, lastStyle: ResolvedLyra3dStyle | undefined;
  let lastPaintState: Lyra3dState | undefined, lastPaintStyle: ResolvedLyra3dStyle | undefined;
  const arrowKey = (view: DecorationProjection, frame: GraphDecorationFrame) => {
    const camera = view.orbit;
    return [frame.revision, view.width, view.height, camera.yaw, camera.pitch, camera.distance, camera.target.x, camera.target.y, camera.target.z].join('|');
  };
  const boundRow = (mesh: InstancedMesh, row: number) => {
    matrix.fromArray(mesh.instanceMatrix.array, row * 16);
    bound.copy(mesh.geometry.boundingSphere!).applyMatrix4(matrix);
    mesh.boundingSphere!.union(bound);
  };
  const writeArrow = (index: number, view: DecorationProjection, frame: GraphDecorationFrame) => {
    const edge = edgeIndices[index]!, style = view.style;
    const a = frame.positionOf(data.source[edge]!)!, b = frame.positionOf(data.target[edge]!)!;
    direction.set(b.x - a.x, b.y - a.y, b.z - a.z); const length = direction.length();
    const projection = view.project(b);
    const nodeRadius = projection ? (data.sizes?.[data.target[edge]!] ?? style.pointSize) / (2 * projection.scale) : 0;
    const height = projection && style.lineWidth > 0 ? Math.min(Math.max(6, style.lineWidth * 3) / projection.scale, Math.max(0, length - nodeRadius)) : 0;
    if (length) direction.divideScalar(length);
    rotation.setFromUnitVectors(up, length ? direction : up);
    point.set(b.x, b.y, b.z).addScaledVector(direction, -nodeRadius - height / 2);
    scale.set(height * Math.tan(0.45), height, height * Math.tan(0.45)); matrix.compose(point, rotation, scale);
    arrows.setMatrixAt(index, matrix); arrowPick.setMatrixAt(index, matrix);
  };
  const writeParticle = (index: number, view: DecorationProjection, frame: GraphDecorationFrame) => {
    const style = view.style, edge = Math.floor(index / perEdge), t = (phase + (index % perEdge) / perEdge) % 1;
    const a = frame.positionOf(data.source[edge]!)!, b = frame.positionOf(data.target[edge]!)!;
    // The spatial helpers use only style/project from this owned projection facade.
    const path = spatialData ? spatialEdgePoint(spatialData, edge, t, frame.positionOf, view as Lyra3dViewport) : null;
    point.set(path?.x ?? a.x + (b.x - a.x) * t, path?.y ?? a.y + (b.y - a.y) * t, path?.z ?? a.z + (b.z - a.z) * t);
    const projection = view.project(point);
    const radius = projection && (spatialData || a.x !== b.x || a.y !== b.y || a.z !== b.z)
      && (data.spatialAppearance?.edgeWidths?.[edge] ?? style.lineWidth) > 0 && (data.spatialAppearance?.edgeColors?.[edge * 4 + 3] ?? 1) > 0
      ? Math.max(2, style.lineWidth) / projection.scale : 0;
    rotation.identity(); scale.setScalar(radius); matrix.compose(point, rotation, scale); particles.setMatrixAt(index, matrix);
  };
  const paintArrow = (index: number, view: DecorationProjection, frame: GraphDecorationFrame, paintColor?: PaintColors) =>
    arrows.setColorAt(index, graphItemColor(view.style, frame.state, data.nodeCount + edgeIndices[index]!, view.style.muted, color, paintColor));
  const paintParticle = (index: number, view: DecorationProjection, frame: GraphDecorationFrame, paintColor?: PaintColors) =>
    particles.setColorAt(index, graphItemColor(view.style, frame.state, data.nodeCount + Math.floor(index / perEdge), view.style.accent, color, paintColor));
  const beginLabels = (view: DecorationProjection, frame: GraphDecorationFrame, checkpoint?: () => void): DecorationLabels | undefined => {
    if (!resources.canvas || !context || !resources.labelTexture) return undefined;
    const { style, orbit: camera } = view;
    const key = [view.width, view.height, camera.yaw, camera.pitch, camera.distance, camera.target.x, camera.target.y, camera.target.z, frame.revision, frame.fittedDistance].join('|');
    if (lastLabels === key && lastState === frame.state && lastStyle === style) return undefined;
    lastLabels = key; lastState = frame.state; lastStyle = style;
    const ratio = Math.min(style.devicePixelRatio, MAX_LABEL_CANVAS / Math.max(1, view.width, view.height));
    const width = Math.max(1, Math.floor(view.width * ratio)), height = Math.max(1, Math.floor(view.height * ratio));
    checkpoint?.(); const previousWidth = resources.canvas.width; checkpoint?.();
    const previousHeight = resources.canvas.height; checkpoint?.();
    const zoom = frame.fittedDistance / camera.distance;
    const nodesPaint = !!data.labels && data.nodeLabels !== 'none' && (data.nodeLabels === 'always' || zoom >= 0.5);
    const edgesPaint = !!data.edgeLabels && !!data.withEdgeLabels && zoom >= (data.edgeLabelMinZoom ?? 0.6);
    return { ratio, width, height, resized: previousWidth !== width || previousHeight !== height,
      scan: nodesPaint || edgesPaint, limit: data.spatialAppearance?.labelLimit ?? GRAPH_MAX_PAINTED_LABELS, painted: 0 };
  };
  const considerLabel = (item: number, labels: DecorationLabels, view: DecorationProjection, frame: GraphDecorationFrame): DecorationLabelPaint | undefined => {
    if (labels.painted >= labels.limit || item < 0 || item >= data.nodeCount + data.source.length) return undefined;
    const style = view.style, zoom = frame.fittedDistance / view.orbit.distance, node = item < data.nodeCount;
    if (node ? data.nodeLabels === 'none' || (data.nodeLabels !== 'always' && zoom < 0.5) : !data.withEdgeLabels || zoom < (data.edgeLabelMinZoom ?? 0.6)) return undefined;
    const edge = item - data.nodeCount, appearance = data.spatialAppearance;
    if (!node && appearance && ((appearance.edgeWidths?.[edge] ?? style.lineWidth) <= 0 || (appearance.edgeColors?.[edge * 4 + 3] ?? style.muted.a) <= 0)) return undefined;
    const text = node ? data.labels?.[item] : data.edgeLabels?.[edge]; if (!text) return undefined;
    const a = frame.positionOf(node ? item : data.source[edge]!), b = node ? a : frame.positionOf(data.target[edge]!);
    if (!a || !b) return undefined;
    const anchor = !node && spatialData ? spatialEdgePoint(spatialData, edge, 0.5, frame.positionOf, view as Lyra3dViewport)
      : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
    const projected = anchor ? view.project(anchor) : null; if (!projected) return undefined;
    const radius = node && spatialData ? spatialNodeWorldRadius(spatialData, item, a, view as Lyra3dViewport) * projected.scale : (data.sizes?.[item] ?? style.pointSize) / 2;
    const x = projected.x + (node ? radius + 4 : 0), y = projected.y - (node ? 0 : style.fontSize);
    if (x < 0 || y < 0 || x >= view.width || y >= view.height) return undefined;
    return { text, x, y, width: Math.max(1, Math.min(512, view.width - x)),
      alpha: !style.forcedColors && frame.state.dimmed.has(item) ? appearance?.dimmedOpacity ?? 0.3 : 1 };
  };
  const labelContextOperation = (operation: number, labels: DecorationLabels, view: DecorationProjection) => {
    const style = view.style, foreground = style.foreground;
    switch (operation) {
      case 0: context!.setTransform(labels.ratio, 0, 0, labels.ratio, 0, 0); break;
      case 1: context!.clearRect(0, 0, view.width, view.height); break;
      // Font-family admission is unchanged; string composition and the native setter are indivisible.
      case 2: context!.font = `${style.fontSize}px ${style.fontFamily}`; break;
      case 3: context!.textBaseline = 'middle'; break;
      case 4: context!.textAlign = 'left'; break;
      case 5: context!.fillStyle = `rgba(${foreground.r * 255}, ${foreground.g * 255}, ${foreground.b * 255}, ${foreground.a})`; break;
    }
  };
  const finishLabels = (labels: DecorationLabels) => {
    if (labels.painted > 0 || lastPainted !== 0 || labels.resized) resources.labelTexture!.needsUpdate = true;
    lastPainted = labels.painted;
  };
  const drawLabels = (view: DecorationProjection, frame: GraphDecorationFrame) => {
    const labels = beginLabels(view, frame); if (!labels) return;
    if (labels.resized) { resources.canvas!.width = labels.width; resources.canvas!.height = labels.height; }
    for (let operation = 0; operation < 6; operation++) labelContextOperation(operation, labels, view);
    const paint = (item: number) => {
      const value = considerLabel(item, labels, view, frame); if (!value) return;
      context!.globalAlpha = value.alpha; context!.fillText(value.text, value.x, value.y, value.width); labels.painted++;
    };
    if (labels.scan) {
      paint(frame.state.focus); if (frame.state.hover !== frame.state.focus) paint(frame.state.hover);
      for (let item = 0; item < data.nodeCount + data.source.length && labels.painted < labels.limit; item++) {
        if (item !== frame.state.focus && item !== frame.state.hover) paint(item);
      }
    }
    context!.globalAlpha = 1; finishLabels(labels);
  };
  const update = (view: DecorationProjection, frame: GraphDecorationFrame): boolean => {
    if (resources.disposed || quiesced) return false;
    const style = view.style, repaint = lastPaintState !== frame.state || lastPaintStyle !== style;
    const paintColor = repaint ? createPaintColors(style) : undefined;
    let changedEdges: number[] | undefined;
    if (!repaint || (edgeIndices.length === 0 && particleCount === 0)) changedEdges = [];
    else if (lastPaintState !== undefined && lastPaintStyle === style) {
      const rows = changedVisualRows(lastPaintState, frame.state, data.nodeCount + data.source.length);
      changedEdges = rows?.filter(item => item >= data.nodeCount).map(item => item - data.nodeCount);
    }
    lastPaintState = frame.state; lastPaintStyle = style;
    const key = arrowKey(view, frame), transformArrows = key !== lastArrowTransforms || lastArrowStyle !== style;
    lastArrowTransforms = key; lastArrowStyle = style;
    if (transformArrows) {
      if (prepared && !resources.arrowSubmitted) arrows.boundingSphere!.makeEmpty();
      if (prepared && !resources.arrowPickSubmitted) arrowPick.boundingSphere!.makeEmpty();
      for (let index = 0; index < edgeIndices.length; index++) {
        writeArrow(index, view, frame);
        if (prepared && !resources.arrowSubmitted) boundRow(arrows, index);
        if (prepared && !resources.arrowPickSubmitted) boundRow(arrowPick, index);
      }
      arrows.instanceMatrix.needsUpdate = true; arrowPick.instanceMatrix.needsUpdate = true;
    }
    if (repaint) {
      const rows = changedEdges?.flatMap(edge => { const row = arrowRows.get(edge); return row === undefined ? [] : [row]; });
      if (rows === undefined) for (let index = 0; index < edgeIndices.length; index++) paintArrow(index, view, frame, paintColor);
      else for (const index of rows) paintArrow(index, view, frame, paintColor);
      if (arrows.instanceColor) { if (rows === undefined) markAttributeFull(arrows.instanceColor); else markAttributeRows(arrows.instanceColor, rows); }
    }
    const enabled = !style.reducedMotion && !style.forcedColors && style.lineWidth > 0;
    particles.visible = enabled;
    if (enabled && previousTime !== undefined && Number.isFinite(frame.time)) phase = (phase + Math.max(0, Math.min(100, frame.time - previousTime)) * (data.particleSpeed ?? 0.25) / 1000) % 1;
    previousTime = enabled && Number.isFinite(frame.time) ? frame.time : undefined;
    if (enabled) {
      if (prepared && !resources.particleSubmitted) particles.boundingSphere!.makeEmpty();
      for (let index = 0; index < particleCount; index++) {
        writeParticle(index, view, frame);
        if (prepared && !resources.particleSubmitted) boundRow(particles, index);
      }
      particles.instanceMatrix.needsUpdate = true;
    }
    if (enabled && repaint) {
      const rows = changedEdges?.flatMap(edge => Array.from({ length: Math.max(0, Math.min(perEdge, particleCount - edge * perEdge)) }, (_, offset) => edge * perEdge + offset));
      if (rows === undefined) for (let index = 0; index < particleCount; index++) paintParticle(index, view, frame, paintColor);
      else for (const index of rows) paintParticle(index, view, frame, paintColor);
      if (particles.instanceColor) { if (rows === undefined) markAttributeFull(particles.instanceColor); else markAttributeRows(particles.instanceColor, rows); }
    }
    drawLabels(view, frame);
    return enabled && particleCount > 0 && (data.particleSpeed ?? 0.25) > 0;
  };
  const batch: GraphDecorationBatch = {
    update(view, frame) { return update(decorationProjection(view), frame); },
    allocationBuffers() { return decorationBuffers(resources, edgeIndices); },
    quiesce() { quiesced = true; },
    dispose() { quiesced = true; context = null; disposeGraphDecorationResources(resources); },
  };
  return { batch, update, writeArrow, writeParticle, paintArrow, paintParticle, boundRow, beginLabels, considerLabel, labelContextOperation, finishLabels,
    setContext(value: CanvasRenderingContext2D | null) { context = value; },
    initializeIdentity(index: number) { matrix.identity(); particles.setMatrixAt(index, matrix); },
    initializePick(index: number) {
      const rgb = encodePickId(data.nodeCount + edgeIndices[index]!)!;
      arrowPick.setColorAt(index, color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255));
    },
    finishInitialization(view: DecorationProjection, frame: GraphDecorationFrame, enabled: boolean) {
      lastPaintState = frame.state; lastPaintStyle = view.style; lastArrowTransforms = arrowKey(view, frame); lastArrowStyle = view.style;
      previousTime = enabled ? 0 : undefined;
      arrows.instanceMatrix.needsUpdate = true; arrowPick.instanceMatrix.needsUpdate = true;
      if (arrows.instanceColor) markAttributeFull(arrows.instanceColor);
      particles.visible = enabled;
      if (enabled) particles.instanceMatrix.needsUpdate = true;
      if (particles.instanceColor) markAttributeFull(particles.instanceColor);
    },
  };
}

/** Bounded visual-only labels and particles; arrows reuse the owning edge's pick identity. */
export function createGraphDecorations(viewport: Lyra3dViewport, data: DecorationGraph, createCanvas = () => viewport.canvas.ownerDocument.createElement('canvas')) {
  const preparedCanvas = data.labels?.some(Boolean) || data.edgeLabels?.some(Boolean) ? createCanvas() : undefined;
  const context = preparedCanvas?.getContext('2d') ?? null;
  const edgeIndices = Uint32Array.from((data.spatialAppearance ? undefined : data.directed)?.reduce<number[]>((result, directed, edge) => { if (directed) result.push(edge); return result; }, []) ?? []);
  const arrowRows = new Map<number, number>(); edgeIndices.forEach((edge, row) => arrowRows.set(edge, row));
  const arrows = new InstancedMesh(new ConeGeometry(1, 1, 6), new MeshBasicMaterial(), edgeIndices.length);
  const arrowPick = new InstancedMesh(arrows.geometry, createPickMaterial(), edgeIndices.length);
  const particles = new InstancedMesh(new SphereGeometry(1, 6, 4), new MeshBasicMaterial(), Math.min(GRAPH_MAX_PARTICLES, data.source.length * (data.particlesPerEdge ?? 0)));
  for (const mesh of [arrows, arrowPick, particles]) mesh.frustumCulled = false;
  if (edgeIndices.length) { viewport.world.add(arrows); viewport.pickWorld.add(arrowPick); }
  if (particles.count) viewport.world.add(particles);
  for (let index = 0; index < edgeIndices.length; index++) {
    const rgb = encodePickId(data.nodeCount + edgeIndices[index]!)!;
    arrowPick.setColorAt(index, new Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255));
  }
  let labelTexture: CanvasTexture | undefined, labelMesh: Mesh<PlaneGeometry, ShaderMaterial> | undefined;
  if (context) {
    labelTexture = new CanvasTexture(preparedCanvas!); labelTexture.colorSpace = SRGBColorSpace; labelTexture.generateMipmaps = false;
    const material = decorationLabelMaterial(labelTexture);
    labelMesh = new Mesh(new PlaneGeometry(2, 2), material); labelMesh.frustumCulled = false; labelMesh.renderOrder = 100;
    viewport.scene.add(labelMesh);
  }
  const resources: GraphDecorationResources = { arrows, arrowPick, particles, canvas: preparedCanvas, labelTexture, labelMesh,
    arrowSubmitted: false, arrowPickSubmitted: false, particleSubmitted: false, disposed: false };
  const controller = createDecorationController(decorationColumns(data), resources, edgeIndices, arrowRows, context, false);
  return { update(frame: GraphDecorationFrame) { return controller.update(viewport, frame); },
    allocationBuffers: controller.batch.allocationBuffers, dispose: controller.batch.dispose };
}

interface DecorationAssembly {
  data: DecorationGraph;
  positions: Float32Array;
  view: DecorationProjection;
  frame: GraphDecorationFrame;
  hasLabels: boolean;
  directedCount: number;
  particleCount: number;
  enabled: boolean;
  edgeIndices?: Uint32Array;
  arrowRows: Map<number, number>;
  cone?: ConeGeometry;
  sphere?: SphereGeometry;
  arrowMaterial?: MeshBasicMaterial;
  pickMaterial?: MeshBasicMaterial;
  particleMaterial?: MeshBasicMaterial;
  arrows?: InstancedMesh<ConeGeometry, MeshBasicMaterial>;
  arrowPick?: InstancedMesh<ConeGeometry, MeshBasicMaterial>;
  particles?: InstancedMesh<SphereGeometry, MeshBasicMaterial>;
  labelMaterial?: ShaderMaterial;
  plane?: PlaneGeometry;
  resources?: MutableDecorationResources;
  context: CanvasRenderingContext2D | null;
  controller?: ReturnType<typeof createDecorationController>;
  labels?: DecorationLabels;
  paint?: DecorationLabelPaint;
}
function decorationAssembly(data: GraphPreparedDataColumns, presentation: GraphDecorationsPresentation): DecorationAssembly {
  const view = decorationProjection(presentation);
  return { data: decorationColumns(data), positions: data.positions, view,
    frame: { positionOf: decorationPositionOf(data.positions), state: presentation.state, fittedDistance: presentation.fittedDistance, revision: presentation.revision, time: 0 },
    hasLabels: false, directedCount: 0, particleCount: Math.min(GRAPH_MAX_PARTICLES, data.source.length * (data.particlesPerEdge ?? 0)),
    enabled: !view.style.reducedMotion && !view.style.forcedColors && view.style.lineWidth > 0, arrowRows: new Map(), context: null };
}
function retireDecorationAssembly(owner: DecorationAssembly): void {
  const { resources, cone, sphere, arrowMaterial, pickMaterial, particleMaterial, arrows, arrowPick, particles, plane, labelMaterial } = owner;
  owner.resources = undefined; owner.cone = undefined; owner.sphere = undefined; owner.arrowMaterial = undefined; owner.pickMaterial = undefined;
  owner.particleMaterial = undefined; owner.arrows = undefined; owner.arrowPick = undefined; owner.particles = undefined;
  owner.plane = undefined; owner.labelMaterial = undefined; owner.controller = undefined; owner.context = null; owner.labels = undefined; owner.paint = undefined;
  disposeAll([() => { if (resources) disposeGraphDecorationResources(resources); },
    () => cone?.dispose(), () => sphere?.dispose(), () => arrowMaterial?.dispose(), () => pickMaterial?.dispose(), () => particleMaterial?.dispose(),
    () => arrows?.dispose(), () => arrowPick?.dispose(), () => particles?.dispose(), () => plane?.dispose(), () => labelMaterial?.dispose()]);
}
function constructDecoration(owner: DecorationAssembly, stage: number): number {
  switch (stage) {
    case 0: owner.cone = new ConeGeometry(1, 1, 6); return 936;
    case 1: owner.sphere = new SphereGeometry(1, 6, 4); return 1336;
    case 2: owner.arrowMaterial = new MeshBasicMaterial(); break;
    case 3: owner.pickMaterial = createPickMaterial(); break;
    case 4: owner.particleMaterial = new MeshBasicMaterial(); break;
    case 5: owner.arrows = new InstancedMesh(owner.cone!, owner.arrowMaterial!, 0); owner.arrows.frustumCulled = false; break;
    case 6: owner.arrowPick = new InstancedMesh(owner.cone!, owner.pickMaterial!, 0); owner.arrowPick.frustumCulled = false; break;
    case 7: {
      owner.particles = new InstancedMesh(owner.sphere!, owner.particleMaterial!, 0); owner.particles.frustumCulled = false;
      owner.resources = { arrows: owner.arrows!, arrowPick: owner.arrowPick!, particles: owner.particles,
        arrowSubmitted: false, arrowPickSubmitted: false, particleSubmitted: false, disposed: false };
      owner.cone = undefined; owner.sphere = undefined; owner.arrowMaterial = undefined; owner.pickMaterial = undefined; owner.particleMaterial = undefined;
      owner.arrows = undefined; owner.arrowPick = undefined; owner.particles = undefined;
      break;
    }
  }
  return 0;
}
function prepareDecorationResult(owner: DecorationAssembly, checkpoint: () => void): GraphPreparedDecorations {
  const resources = owner.resources!, batch = owner.controller!.batch, data = owner.data, appearance = data.spatialAppearance;
  const ownedBuffers = batch.allocationBuffers();
  const borrowed = [owner.positions, data.source, data.target, data.sizes, data.directed,
    appearance?.edgeWidths, appearance?.edgeColors, appearance?.edgeCurvatures, appearance?.dangling];
  const borrowedBuffers = [...new Set(borrowed.filter((array): array is Float32Array | Uint32Array | Uint8Array => array !== undefined).map(array => array.buffer))];
  const D = owner.directedCount, N = owner.particleCount, B = Number(Boolean(resources.labelMesh)), Z = Number(owner.enabled);
  let canvasBackingEstimateBytes = 0;
  if (resources.canvas) {
    checkpoint(); const width = resources.canvas.width; checkpoint();
    const height = resources.canvas.height; checkpoint(); canvasBackingEstimateBytes = 4 * width * height;
  }
  return { resources, batch, ownedBuffers, borrowedBuffers,
    storage: { cpuBytes: ownedBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0),
      gpuAttributeBytes: 936 * Number(D > 0) + 1336 * Number(N > 0) + 140 * B + 152 * D + (64 + 12 * Z) * N,
      gpuTextureBytes: B ? canvasBackingEstimateBytes : 0, canvasBackingEstimateBytes, semanticMapEntries: D } };
}

type DecorationPhase = 'setup' | 'presence' | 'directed-count' | 'indices' | 'directed-fill' | 'native' | 'matrices' | 'colors' | 'geometry-bounds'
  | 'arrows' | 'particles' | 'arrow-bounds' | 'particle-bounds' | 'canvas' | 'context' | 'overlay' | 'label-setup' | 'resize'
  | 'label-context' | 'label-consider' | 'label-alpha' | 'label-text' | 'label-reset' | 'finish';
interface DecorationWorkState {
  input: GraphPreparedDataColumns | undefined;
  presentation: GraphDecorationsPresentation | undefined;
  createCanvas: (() => HTMLCanvasElement) | undefined;
  guard: (() => boolean) | undefined;
  active: boolean;
  owner: DecorationAssembly | undefined;
  phase: DecorationPhase;
  row: number;
  directedRow: number;
  priority: number;
}

/**
 * Prepares detached decoration owners without a live viewport. Each operation visits one row,
 * allocates one backing or performs fixed native work. Canvas rasterization, fixed geometry
 * construction and the font setter remain indivisible; later GPU upload is not performed here.
 */
export function createGraphDecorationsWork(data: GraphPreparedDataColumns, presentation: GraphDecorationsPresentation,
  createCanvas: (() => HTMLCanvasElement) | undefined, isCurrent?: () => boolean): GraphDecorationsWork {
  const state: DecorationWorkState = { input: data, presentation, createCanvas, guard: isCurrent, active: true, owner: undefined,
    phase: 'setup', row: 0, directedRow: 0, priority: 0 };
  data = undefined as never; presentation = undefined as never; createCanvas = undefined; isCurrent = undefined;
  let running = false;
  const checkpoint = (): void => {
    const current = state.active && (!state.guard || state.guard());
    if (!current || !state.active) throw new DOMException('Graph decoration preparation was superseded', 'AbortError');
  };
  const releaseInputs = (): void => { state.active = false; state.input = undefined; state.presentation = undefined; state.createCanvas = undefined; state.guard = undefined; };
  const close = (): void => {
    releaseInputs();
    if (running) return;
    const owner = state.owner; state.owner = undefined;
    if (owner) retireDecorationAssembly(owner);
  };
  return {
    step(maxOperations) {
      if (!state.active || running) throw new DOMException('Graph decoration preparation is closed or running', 'InvalidStateError');
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph decoration preparation budget');
      const result = { done: false, operations: 0, allocatedBytes: 0, visitedLabelPresenceRows: 0, visitedDirectedRows: 0,
        initializedArrows: 0, initializedParticles: 0, boundedInstances: 0, consideredLabels: 0, paintedLabels: 0, canvasOperations: 0 };
      running = true;
      try {
        while (result.operations < maxOperations) {
          checkpoint();
          const owner = state.owner;
          switch (state.phase) {
            case 'setup':
              state.owner = decorationAssembly(state.input!, state.presentation!); state.input = undefined; state.presentation = undefined;
              state.phase = 'presence'; break;
            case 'presence': {
              const nodes = owner!.data.labels?.length ?? 0, edges = owner!.data.edgeLabels?.length ?? 0;
              if (state.row === nodes + edges) { state.phase = 'directed-count'; state.row = 0; continue; }
              const label = state.row < nodes ? owner!.data.labels![state.row] : owner!.data.edgeLabels![state.row - nodes];
              if (label) owner!.hasLabels = true;
              state.row++; result.visitedLabelPresenceRows++; break;
            }
            case 'directed-count': {
              const directed = owner!.data.directed;
              if (!directed || state.row === directed.length) { state.phase = 'indices'; continue; }
              if (directed[state.row++]) owner!.directedCount++;
              result.visitedDirectedRows++; break;
            }
            case 'indices':
              owner!.edgeIndices = new Uint32Array(owner!.directedCount); result.allocatedBytes += owner!.edgeIndices.byteLength;
              state.phase = 'directed-fill'; state.row = 0; break;
            case 'directed-fill': {
              const directed = owner!.data.directed;
              if (!directed || state.row === directed.length) { state.phase = 'native'; state.row = 0; continue; }
              const edge = state.row++;
              if (directed[edge]) { owner!.edgeIndices![state.directedRow] = edge; owner!.arrowRows.set(edge, state.directedRow++); }
              result.visitedDirectedRows++; break;
            }
            case 'native':
              if (state.row === 8) { state.phase = 'matrices'; state.row = 0; continue; }
              result.allocatedBytes += constructDecoration(owner!, state.row++); break;
            case 'matrices': {
              if (state.row === 3) { state.phase = 'colors'; state.row = 0; continue; }
              const resources = owner!.resources!, mesh = [resources.arrows, resources.arrowPick, resources.particles][state.row++]!;
              const count = mesh === resources.particles ? owner!.particleCount : owner!.directedCount;
              const array = new Float32Array(count * 16); mesh.instanceMatrix = new InstancedBufferAttribute(array, 16); mesh.count = count;
              result.allocatedBytes += array.byteLength; break;
            }
            case 'colors': {
              if (state.row === 3) { state.phase = 'geometry-bounds'; state.row = 0; continue; }
              const resources = owner!.resources!, mesh = [resources.arrows, resources.arrowPick, resources.particles][state.row++]!;
              if (!mesh.count || mesh === resources.particles && !owner!.enabled) continue;
              const array = new Float32Array(mesh.count * 3); mesh.instanceColor = new InstancedBufferAttribute(array, 3);
              result.allocatedBytes += array.byteLength; break;
            }
            case 'geometry-bounds': {
              const resources = owner!.resources!;
              if (state.row++ === 0) resources.arrows.geometry.computeBoundingSphere();
              else {
                resources.particles.geometry.computeBoundingSphere(); prepareDecorationBounds(resources);
                owner!.controller = createDecorationController(owner!.data, resources, owner!.edgeIndices!, owner!.arrowRows, null, true);
                state.phase = 'arrows'; state.row = 0;
              }
              break;
            }
            case 'arrows': {
              if (state.row === owner!.directedCount) { state.phase = 'particles'; state.row = 0; continue; }
              const controller = owner!.controller!, row = state.row++;
              controller.writeArrow(row, owner!.view, owner!.frame); controller.paintArrow(row, owner!.view, owner!.frame); controller.initializePick(row);
              result.initializedArrows++; break;
            }
            case 'particles': {
              if (state.row === owner!.particleCount) { state.phase = 'arrow-bounds'; state.row = 0; continue; }
              const controller = owner!.controller!, row = state.row++;
              if (owner!.enabled) { controller.writeParticle(row, owner!.view, owner!.frame); controller.paintParticle(row, owner!.view, owner!.frame); }
              else controller.initializeIdentity(row);
              result.initializedParticles++; break;
            }
            case 'arrow-bounds':
              if (state.row === owner!.directedCount) { state.phase = 'particle-bounds'; state.row = 0; continue; }
              owner!.controller!.boundRow(owner!.resources!.arrows, state.row++); result.boundedInstances++; break;
            case 'particle-bounds':
              if (state.row === owner!.particleCount) { state.phase = 'canvas'; continue; }
              owner!.controller!.boundRow(owner!.resources!.particles, state.row++); result.boundedInstances++; break;
            case 'canvas':
              if (!owner!.hasLabels) { state.phase = 'finish'; continue; }
              if (!state.createCanvas) throw new TypeError('A canvas factory is required for graph labels');
              owner!.resources!.canvas = state.createCanvas(); state.phase = 'context'; result.canvasOperations++; break;
            case 'context':
              owner!.context = owner!.resources!.canvas!.getContext('2d'); owner!.controller!.setContext(owner!.context);
              state.phase = owner!.context ? 'overlay' : 'finish'; state.row = 0; result.canvasOperations++; break;
            case 'overlay': {
              const resources = owner!.resources!;
              switch (state.row++) {
                case 0:
                  resources.labelTexture = new CanvasTexture(resources.canvas!); resources.labelTexture.colorSpace = SRGBColorSpace;
                  resources.labelTexture.generateMipmaps = false; break;
                case 1: owner!.labelMaterial = decorationLabelMaterial(resources.labelTexture!); break;
                case 2: owner!.plane = new PlaneGeometry(2, 2); result.allocatedBytes += 140; break;
                case 3:
                  resources.labelMesh = new Mesh(owner!.plane!, owner!.labelMaterial!); resources.labelMesh.frustumCulled = false; resources.labelMesh.renderOrder = 100;
                  owner!.plane = undefined; owner!.labelMaterial = undefined; state.phase = 'label-setup'; break;
              }
              break;
            }
            case 'label-setup':
              owner!.labels = owner!.controller!.beginLabels(owner!.view, owner!.frame, checkpoint)!;
              state.phase = 'resize'; state.row = 0; break;
            case 'resize':
              if (!owner!.labels!.resized || state.row === 2) { state.phase = 'label-context'; state.row = 0; continue; }
              if (state.row++ === 0) owner!.resources!.canvas!.width = owner!.labels!.width;
              else owner!.resources!.canvas!.height = owner!.labels!.height;
              result.canvasOperations++; break;
            case 'label-context':
              if (state.row === 6) { state.phase = 'label-consider'; state.row = 0; continue; }
              owner!.controller!.labelContextOperation(state.row++, owner!.labels!, owner!.view); result.canvasOperations++; break;
            case 'label-consider': {
              const labels = owner!.labels!, frame = owner!.frame;
              if (!labels.scan || state.priority >= 2 && (labels.painted >= labels.limit || state.row === owner!.data.nodeCount + owner!.data.source.length)) {
                state.phase = 'label-reset'; continue;
              }
              let item: number;
              if (state.priority === 0) { state.priority++; item = frame.state.focus; }
              else if (state.priority === 1) { state.priority++; if (frame.state.hover === frame.state.focus) continue; item = frame.state.hover; }
              else {
                item = state.row++;
                if (item === frame.state.focus || item === frame.state.hover) { result.consideredLabels++; break; }
              }
              owner!.paint = owner!.controller!.considerLabel(item, labels, owner!.view, frame);
              if (owner!.paint) state.phase = 'label-alpha';
              result.consideredLabels++; break;
            }
            case 'label-alpha':
              owner!.context!.globalAlpha = owner!.paint!.alpha; state.phase = 'label-text'; result.canvasOperations++; break;
            case 'label-text': {
              const paint = owner!.paint!; owner!.context!.fillText(paint.text, paint.x, paint.y, paint.width);
              owner!.labels!.painted++; owner!.paint = undefined; state.phase = 'label-consider'; result.canvasOperations++; result.paintedLabels++; break;
            }
            case 'label-reset':
              owner!.context!.globalAlpha = 1; state.phase = 'finish'; result.canvasOperations++; break;
            case 'finish': {
              owner!.resources!.arrowPick.boundingSphere!.copy(owner!.resources!.arrows.boundingSphere!);
              owner!.controller!.finishInitialization(owner!.view, owner!.frame, owner!.enabled);
              if (owner!.labels) owner!.controller!.finishLabels(owner!.labels);
              const value = prepareDecorationResult(owner!, checkpoint);
              checkpoint(); state.owner = undefined; releaseInputs();
              return { ...result, done: true, operations: result.operations + 1, value };
            }
          }
          result.operations++; checkpoint();
        }
        return result;
      } catch (error) {
        running = false;
        try { close(); } catch { /* Preserve the originating preparation failure. */ }
        throw error;
      } finally { running = false; }
    },
    dispose: close,
  };
}
