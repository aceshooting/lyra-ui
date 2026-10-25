import { CanvasTexture, Color, ConeGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, ShaderMaterial, SphereGeometry, SRGBColorSpace, Vector3 } from 'three';
import type { Lyra3dState, Lyra3dWorldPoint } from '../core/contract.js';
import { encodePickId, createPickMaterial } from '../core/picking.js';
import type { Lyra3dViewport } from '../core/viewport.js';
import type { Lyra3dRgba, ResolvedLyra3dStyle } from '../core/style.js';

import type { GraphSpatialAppearance } from './spatial-appearance.js';
import { spatialEdgePoint, spatialNodeWorldRadius } from './spatial-paths.js';
import { changedVisualRows } from '../core/visual-state.js';
import { markAttributeFull, markAttributeRows } from '../core/attribute-updates.js';
import { createPaintColors, type PaintColors } from '../core/paint-colors.js';

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
const MAX_LABEL_LENGTH = 256;
const MAX_LABEL_TEXT = 4 * 1024 * 1024;
const MAX_LABEL_CANVAS = 2048;

/** Copies and admits decoration inputs before a replacement retires the current scene. */
export function admitGraphDecorations(input: GraphDecorationData, nodes: number, edges: number): GraphDecorationData {
  let total = 0;
  const labels = (value: readonly string[] | undefined, count: number) => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.length !== count) throw new RangeError('Invalid graph label rows');
    return Array.from(value, (text) => {
      if (typeof text !== 'string') throw new TypeError('Graph labels must be plain strings');
      total += text.length;
      if (total > MAX_LABEL_TEXT) throw new RangeError('Graph label text exceeds its limit');
      return text.slice(0, MAX_LABEL_LENGTH);
    });
  };
  const scalar = (value: number | undefined, fallback: number, min: number, max: number, integer = false) => {
    const result = value ?? fallback;
    if (!Number.isFinite(result) || result < min || result > max || (integer && !Number.isInteger(result))) throw new RangeError('Invalid graph decoration option');
    return result;
  };
  const mode = input.nodeLabels ?? 'zoom';
  if (!['always', 'zoom', 'none'].includes(mode)) throw new RangeError('Invalid graph label mode');
  if (input.withEdgeLabels !== undefined && typeof input.withEdgeLabels !== 'boolean') throw new TypeError('Invalid graph edge label visibility');
  if (input.directed !== undefined && (!(input.directed instanceof Uint8Array) || !(input.directed.buffer instanceof ArrayBuffer) || input.directed.length !== edges || !input.directed.every((entry) => entry === 0 || entry === 1))) throw new RangeError('Invalid graph directed mask');
  return {
    labels: labels(input.labels, nodes), edgeLabels: labels(input.edgeLabels, edges), nodeLabels: mode,
    withEdgeLabels: input.withEdgeLabels ?? false, edgeLabelMinZoom: scalar(input.edgeLabelMinZoom, 0.6, 0.001, 1000),
    directed: input.directed?.slice(), particlesPerEdge: scalar(input.particlesPerEdge, 0, 0, 8, true),
    particleSpeed: scalar(input.particleSpeed, 0.25, 0, 10),
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

/** Bounded visual-only labels and particles; arrows reuse the owning edge's pick identity. */
export function createGraphDecorations(viewport: Lyra3dViewport, data: DecorationGraph, createCanvas = () => viewport.canvas.ownerDocument.createElement('canvas')) {
  const spatialData = data.spatialAppearance ? { ...data, spatialAppearance: data.spatialAppearance } : undefined;
  const preparedCanvas = data.labels?.some(Boolean) || data.edgeLabels?.some(Boolean) ? createCanvas() : undefined;
  const preparedContext = preparedCanvas?.getContext('2d') ?? null;
  const edgeIndices = Uint32Array.from((data.spatialAppearance ? undefined : data.directed)?.reduce<number[]>((result, directed, edge) => { if (directed) result.push(edge); return result; }, []) ?? []);
  const arrowRows = new Map<number, number>();
  edgeIndices.forEach((edge, row) => arrowRows.set(edge, row));
  const arrows = new InstancedMesh(new ConeGeometry(1, 1, 6), new MeshBasicMaterial(), edgeIndices.length);
  const arrowPick = new InstancedMesh(arrows.geometry, createPickMaterial(), edgeIndices.length);
  const perEdge = data.particlesPerEdge ?? 0;
  const particleCount = Math.min(GRAPH_MAX_PARTICLES, data.source.length * perEdge);
  const particles = new InstancedMesh(new SphereGeometry(1, 6, 4), new MeshBasicMaterial(), particleCount);
  for (const mesh of [arrows, arrowPick, particles]) mesh.frustumCulled = false;
  if (edgeIndices.length) { viewport.world.add(arrows); viewport.pickWorld.add(arrowPick); }
  if (particleCount) viewport.world.add(particles);
  for (let index = 0; index < edgeIndices.length; index += 1) {
    const rgb = encodePickId(data.nodeCount + edgeIndices[index]!)!;
    arrowPick.setColorAt(index, new Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255));
  }
  let canvas: HTMLCanvasElement | undefined;
  let context: CanvasRenderingContext2D | null = null;
  let labelTexture: CanvasTexture | undefined;
  let labelMesh: Mesh<PlaneGeometry, ShaderMaterial> | undefined;
  if (data.labels?.some(Boolean) || data.edgeLabels?.some(Boolean)) {
    canvas = preparedCanvas!; context = preparedContext;
    if (context) {
      labelTexture = new CanvasTexture(canvas); labelTexture.colorSpace = SRGBColorSpace;
      labelTexture.generateMipmaps = false;
      const material = new ShaderMaterial({
        uniforms: { labels: { value: labelTexture } }, transparent: true, depthTest: false, depthWrite: false,
        vertexShader: 'varying vec2 labelUv; void main() { labelUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'uniform sampler2D labels; varying vec2 labelUv; void main() { gl_FragColor = texture2D(labels, labelUv);\n#include <colorspace_fragment>\n}',
      });
      labelMesh = new Mesh(new PlaneGeometry(2, 2), material); labelMesh.frustumCulled = false; labelMesh.renderOrder = 100;
      viewport.scene.add(labelMesh);
    }
  }
  const color = new Color();
  const matrix = new Matrix4(); const point = new Vector3(); const scale = new Vector3();
  const direction = new Vector3(); const rotation = new Quaternion(); const up = new Vector3(0, 1, 0);
  let phase = 0; let previousTime: number | undefined;
  let lastLabels = '';
  let lastPainted = -1;
  let lastArrowTransforms = '';
  let lastArrowStyle: ResolvedLyra3dStyle | undefined;
  let lastState: Lyra3dState | undefined;
  let lastStyle: ResolvedLyra3dStyle | undefined;
  let lastPaintState: Lyra3dState | undefined;
  let lastPaintStyle: ResolvedLyra3dStyle | undefined;
  const drawLabels = (frame: GraphDecorationFrame) => {
    if (!canvas || !context || !labelTexture) return;
    const style = viewport.style;
    const camera = viewport.orbit;
    const key = [viewport.width, viewport.height, camera.yaw, camera.pitch, camera.distance, camera.target.x, camera.target.y, camera.target.z, frame.revision, frame.fittedDistance].join('|');
    if (lastLabels === key && lastState === frame.state && lastStyle === style) return;
    lastLabels = key; lastState = frame.state; lastStyle = style;
    const ratio = Math.min(style.devicePixelRatio, MAX_LABEL_CANVAS / Math.max(1, viewport.width, viewport.height));
    const width = Math.max(1, Math.floor(viewport.width * ratio)); const height = Math.max(1, Math.floor(viewport.height * ratio));
    const resized = canvas.width !== width || canvas.height !== height;
    if (resized) { canvas.width = width; canvas.height = height; }
    context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, viewport.width, viewport.height);
    context.font = `${style.fontSize}px ${style.fontFamily}`; context.textBaseline = 'middle'; context.textAlign = 'left';
    const foreground = style.foreground;
    context.fillStyle = `rgba(${foreground.r * 255}, ${foreground.g * 255}, ${foreground.b * 255}, ${foreground.a})`;
    const zoom = frame.fittedDistance / camera.distance;
    let painted = 0;
    const labelLimit = data.spatialAppearance?.labelLimit ?? GRAPH_MAX_PAINTED_LABELS;
    const paint = (item: number) => {
      if (painted >= labelLimit || item < 0 || item >= data.nodeCount + data.source.length) return;
      const node = item < data.nodeCount;
      if (node ? data.nodeLabels === 'none' || (data.nodeLabels !== 'always' && zoom < 0.5) : !data.withEdgeLabels || zoom < (data.edgeLabelMinZoom ?? 0.6)) return;
      const edge = item - data.nodeCount;
      const appearance = data.spatialAppearance;
      if (!node && appearance && ((appearance.edgeWidths?.[edge] ?? style.lineWidth) <= 0 || (appearance.edgeColors?.[edge * 4 + 3] ?? style.muted.a) <= 0)) return;
      const text = node ? data.labels?.[item] : data.edgeLabels?.[edge];
      if (!text) return;
      const a = frame.positionOf(node ? item : data.source[edge]!);
      const b = node ? a : frame.positionOf(data.target[edge]!);
      if (!a || !b) return;
      const anchor = !node && appearance ? spatialEdgePoint(spatialData!, edge, 0.5, frame.positionOf, viewport) : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
      const projected = anchor ? viewport.project(anchor) : null;
      if (!projected) return;
      const radius = node && appearance ? spatialNodeWorldRadius(spatialData!, item, a, viewport) * projected.scale : (data.sizes?.[item] ?? style.pointSize) / 2;
      const x = projected.x + (node ? radius + 4 : 0);
      const y = projected.y - (node ? 0 : style.fontSize);
      if (x < 0 || y < 0 || x >= viewport.width || y >= viewport.height) return;
      context!.globalAlpha = !style.forcedColors && frame.state.dimmed.has(item) ? data.spatialAppearance?.dimmedOpacity ?? 0.3 : 1;
      context!.fillText(text, x, y, Math.max(1, Math.min(512, viewport.width - x)));
      painted += 1;
    };
    // Skip the per-item scan when no row can paint at this zoom, and the texture upload while the
    // plane stays empty: a camera move over an unlabelled graph then costs no canvas work.
    const nodesPaint = !!data.labels && data.nodeLabels !== 'none' && (data.nodeLabels === 'always' || zoom >= 0.5);
    const edgesPaint = !!data.edgeLabels && !!data.withEdgeLabels && zoom >= (data.edgeLabelMinZoom ?? 0.6);
    if (nodesPaint || edgesPaint) {
      paint(frame.state.focus); if (frame.state.hover !== frame.state.focus) paint(frame.state.hover);
      for (let item = 0; item < data.nodeCount + data.source.length && painted < labelLimit; item += 1) {
        if (item !== frame.state.focus && item !== frame.state.hover) paint(item);
      }
    }
    context.globalAlpha = 1;
    if (painted > 0 || lastPainted !== 0 || resized) labelTexture.needsUpdate = true;
    lastPainted = painted;
  };
  return {
    update(frame: GraphDecorationFrame) {
      const style = viewport.style;
      const repaint = lastPaintState !== frame.state || lastPaintStyle !== style;
      const paintColor = repaint ? createPaintColors(style) : undefined;
      let changedEdges: number[] | undefined;
      if (!repaint || (edgeIndices.length === 0 && particleCount === 0)) changedEdges = [];
      else if (lastPaintState !== undefined && lastPaintStyle === style) {
        // Compare with the decoration's last consumed state, including coalesced engine updates.
        const rows = changedVisualRows(lastPaintState, frame.state, data.nodeCount + data.source.length);
        changedEdges = rows?.filter(item => item >= data.nodeCount).map(item => item - data.nodeCount);
      }
      lastPaintState = frame.state; lastPaintStyle = style;
      const camera = viewport.orbit;
      const arrowKey = [frame.revision, viewport.width, viewport.height, camera.yaw, camera.pitch, camera.distance, camera.target.x, camera.target.y, camera.target.z].join('|');
      const transformArrows = arrowKey !== lastArrowTransforms || lastArrowStyle !== style;
      lastArrowTransforms = arrowKey; lastArrowStyle = style;
      if (transformArrows) for (let index = 0; index < edgeIndices.length; index += 1) {
        const edge = edgeIndices[index]!;
        const a = frame.positionOf(data.source[edge]!)!; const b = frame.positionOf(data.target[edge]!)!;
        direction.set(b.x - a.x, b.y - a.y, b.z - a.z); const length = direction.length();
        const projection = viewport.project(b);
        const nodeRadius = projection ? (data.sizes?.[data.target[edge]!] ?? style.pointSize) / (2 * projection.scale) : 0;
        const height = projection && style.lineWidth > 0 ? Math.min(Math.max(6, style.lineWidth * 3) / projection.scale, Math.max(0, length - nodeRadius)) : 0;
        if (length) direction.divideScalar(length);
        rotation.setFromUnitVectors(up, length ? direction : up);
        point.set(b.x, b.y, b.z).addScaledVector(direction, -nodeRadius - height / 2);
        scale.set(height * Math.tan(0.45), height, height * Math.tan(0.45)); matrix.compose(point, rotation, scale);
        arrows.setMatrixAt(index, matrix); arrowPick.setMatrixAt(index, matrix);
      }
      if (transformArrows) { arrows.instanceMatrix.needsUpdate = true; arrowPick.instanceMatrix.needsUpdate = true; }
      if (repaint) {
        const rows = changedEdges?.flatMap(edge => { const row = arrowRows.get(edge); return row === undefined ? [] : [row]; });
        const paint = (index: number) => arrows.setColorAt(index, graphItemColor(style, frame.state, data.nodeCount + edgeIndices[index]!, style.muted, color, paintColor));
        if (rows === undefined) for (let index = 0; index < edgeIndices.length; index++) paint(index);
        else for (const index of rows) paint(index);
        if (arrows.instanceColor) {
          if (rows === undefined) markAttributeFull(arrows.instanceColor); else markAttributeRows(arrows.instanceColor, rows);
        }
      }
      const enabled = !style.reducedMotion && !style.forcedColors && style.lineWidth > 0;
      particles.visible = enabled;
      if (enabled && previousTime !== undefined && Number.isFinite(frame.time)) phase = (phase + Math.max(0, Math.min(100, frame.time - previousTime)) * (data.particleSpeed ?? 0.25) / 1000) % 1;
      previousTime = enabled && Number.isFinite(frame.time) ? frame.time : undefined;
      if (enabled) for (let index = 0; index < particleCount; index += 1) {
        const edge = Math.floor(index / perEdge); const t = (phase + (index % perEdge) / perEdge) % 1;
        const a = frame.positionOf(data.source[edge]!)!; const b = frame.positionOf(data.target[edge]!)!;
        const path = data.spatialAppearance ? spatialEdgePoint(spatialData!, edge, t, frame.positionOf, viewport) : null;
        point.set(path?.x ?? a.x + (b.x - a.x) * t, path?.y ?? a.y + (b.y - a.y) * t, path?.z ?? a.z + (b.z - a.z) * t);
        const projection = viewport.project(point);
        const radius = projection && (data.spatialAppearance || a.x !== b.x || a.y !== b.y || a.z !== b.z) && (data.spatialAppearance?.edgeWidths?.[edge] ?? style.lineWidth) > 0 && (data.spatialAppearance?.edgeColors?.[edge * 4 + 3] ?? 1) > 0 ? Math.max(2, style.lineWidth) / projection.scale : 0;
        rotation.identity(); scale.setScalar(radius); matrix.compose(point, rotation, scale); particles.setMatrixAt(index, matrix);
      }
      if (enabled) particles.instanceMatrix.needsUpdate = true;
      if (enabled && repaint) {
        const rows = changedEdges?.flatMap(edge => Array.from({ length: Math.max(0, Math.min(perEdge, particleCount - edge * perEdge)) }, (_, offset) => edge * perEdge + offset));
        const paint = (index: number) => particles.setColorAt(index, graphItemColor(style, frame.state, data.nodeCount + Math.floor(index / perEdge), style.accent, color, paintColor));
        if (rows === undefined) for (let index = 0; index < particleCount; index++) paint(index);
        else for (const index of rows) paint(index);
        if (particles.instanceColor) {
          if (rows === undefined) markAttributeFull(particles.instanceColor); else markAttributeRows(particles.instanceColor, rows);
        }
      }
      drawLabels(frame);
      return enabled && particleCount > 0 && (data.particleSpeed ?? 0.25) > 0;
    },
    dispose() {
      for (const mesh of [arrows, arrowPick, particles]) { mesh.removeFromParent(); mesh.material.dispose(); mesh.dispose(); }
      arrows.geometry.dispose(); particles.geometry.dispose();
      labelMesh?.removeFromParent(); labelMesh?.geometry.dispose(); labelMesh?.material.dispose(); labelTexture?.dispose();
      if (canvas) { canvas.width = 1; canvas.height = 1; }
    },
  };
}
