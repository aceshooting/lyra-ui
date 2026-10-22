import { DoubleSide, Color, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PerspectiveCamera, PlaneGeometry, ShaderMaterial, SRGBColorSpace, Vector2 } from 'three';
import type { Lyra3dState } from '../core/contract.js';
import { LYRA_3D_WORLD_LIMIT, orbitNearPlane, projectOrbitPoint } from '../core/orbit.js';
import { createPickColors } from '../core/picking.js';
import type { Lyra3dRgba } from '../core/style.js';
import type { Lyra3dViewport } from '../core/viewport.js';
import type { GraphSpatialAppearance } from './spatial-appearance.js';

interface SpatialNodeData {
  readonly nodeCount: number;
  readonly sizes?: Float32Array;
  readonly categories?: Uint16Array;
  readonly spatialAppearance: GraphSpatialAppearance;
}
type NodeViewport = Pick<Lyra3dViewport, 'width' | 'height' | 'orbit' | 'style'>;
const SQUARE = Math.sqrt(Math.PI) / 2;
const DIAMOND = Math.sqrt(Math.PI / 2);
const vertex = `
attribute vec3 nodePosition;
attribute float nodeRadius;
attribute float nodePickDepth;
flat varying float pickDepth;
attribute float nodeShape;
attribute vec2 nodeExtent;
attribute vec2 nodeFlags;
attribute vec4 nodeFill;
attribute vec4 nodeRing;
attribute vec4 nodeMarker;
attribute vec3 pickColor;
uniform vec2 viewportSize;
varying vec2 offset;
varying float radius;
varying float shape;
varying vec2 flags;
varying vec4 fill;
varying vec4 ring;
varying vec4 marker;
void main() {
  radius = nodeRadius; shape = nodeShape; flags = nodeFlags; pickDepth = nodePickDepth;
  #ifdef PICKING
    offset = position.xy * nodeExtent.y;
    fill = vec4(pickColor, 1.0);
  #else
    offset = position.xy * nodeExtent.x;
    fill = nodeFill;
  #endif
  ring = nodeRing; marker = nodeMarker;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(nodePosition, 1.0);
  gl_Position.xy += offset * 2.0 / viewportSize * gl_Position.w;
}`;
export const graphSpatialNodeFragment = `
uniform float markerArm;
#ifdef PICKING
  flat varying float pickDepth;
#endif
varying vec2 offset;
varying float radius;
varying float shape;
varying vec2 flags;
varying vec4 fill;
varying vec4 ring;
varying vec4 marker;
vec4 over(vec4 foreground, vec4 background) {
  float alpha = foreground.a + background.a * (1.0 - foreground.a);
  if (alpha <= 0.0) return vec4(0.0);
  return vec4((foreground.rgb * foreground.a + background.rgb * background.a * (1.0 - foreground.a)) / alpha, alpha);
}
bool inside(vec2 p, float r) {
  if (shape < 0.5) return length(p) <= r;
  if (shape < 1.5) {
    #ifdef PICKING
      return max(abs(p.x), abs(p.y)) <= max(12.0, r * 0.88622692545);
    #else
      return max(abs(p.x), abs(p.y)) <= r * 0.88622692545;
    #endif
  }
  return abs(p.x) + abs(p.y) <= r * 1.25331413732;
}
void paintGraphSpatialNode() {
  #ifdef PICKING
    if (!inside(offset, max(12.0, radius))) discard;
    gl_FragDepth = pickDepth;
    gl_FragColor = fill;
  #else
    vec4 paint = vec4(0.0);
    if (radius > 0.0 && inside(offset, radius)) paint = fill;
    if (flags.x > 0.5 && abs(length(offset) - radius - 4.0) <= 1.0) paint = over(ring, paint);
    vec2 plus = abs(offset - vec2(radius));
    if (flags.y > 0.5 && ((plus.x <= 0.75 && plus.y <= markerArm) || (plus.y <= 0.75 && plus.x <= markerArm))) paint = over(marker, paint);
    if (paint.a <= 0.0) discard;
    gl_FragColor = paint;
    #include <colorspace_fragment>
  #endif
}`;
const fragment = graphSpatialNodeFragment + '\nvoid main() { paintGraphSpatialNode(); }';

/** Batched screen-facing spatial glyphs. Pick colors always identify the original node row. */
export function createGraphSpatialNodes(input: SpatialNodeData) {
  const count = input.nodeCount;
  if (!Number.isInteger(count) || count < 0 || count > 200_000) throw new RangeError('Invalid spatial node count');
  const appearance = input.spatialAppearance;
  if (!appearance || (appearance.sizeUnits !== undefined && appearance.sizeUnits !== 'css' && appearance.sizeUnits !== 'world')) throw new TypeError('Invalid spatial node appearance');
  const opacity = appearance.dimmedOpacity ?? 0.35;
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new RangeError('Invalid spatial node opacity');
  const bytes = (value: Uint8Array | undefined, maximum: number) => {
    if (value === undefined) return undefined;
    if (!(value instanceof Uint8Array) || value.length !== count || !value.every((item) => item <= maximum)) throw new RangeError('Invalid spatial node mask');
    return value.slice();
  };
  const floats = (value: Float32Array | undefined, length: number, maximum: number) => {
    if (value === undefined) return undefined;
    if (!(value instanceof Float32Array) || value.length !== length || !value.every((item) => Number.isFinite(item) && item >= 0 && item <= maximum)) throw new RangeError('Invalid spatial node values');
    return value.slice();
  };
  const shapes = bytes(appearance.nodeShapes, 2), expandable = bytes(appearance.expandable, 1);
  const colors = floats(appearance.nodeColors, count * 4, 1), sizes = floats(input.sizes, count, Number.MAX_VALUE);
  if (input.categories !== undefined && (!(input.categories instanceof Uint16Array) || input.categories.length !== count)) throw new RangeError('Invalid spatial node categories');
  const categories = input.categories?.slice();
  const worldSize = appearance.sizeUnits === 'world';
  const plane = new PlaneGeometry(2, 2), geometry = new InstancedBufferGeometry();
  geometry.index = plane.index; geometry.attributes = { ...plane.attributes }; geometry.instanceCount = count; plane.dispose();
  const attribute = (name: string, components: number) => {
    const result = new InstancedBufferAttribute(new Float32Array(count * components), components);
    geometry.setAttribute(name, result); return result;
  };
  const position = attribute('nodePosition', 3), radius = attribute('nodeRadius', 1), shape = attribute('nodeShape', 1), extent = attribute('nodeExtent', 2);
  const pickDepth = attribute('nodePickDepth', 1);
  const flags = attribute('nodeFlags', 2), fill = attribute('nodeFill', 4), ring = attribute('nodeRing', 4), marker = attribute('nodeMarker', 4), pickColor = attribute('pickColor', 3);
  const ids = createPickColors(count), order = new Uint32Array(count), depths = new Float64Array(count), radii = new Float32Array(count), shown = new Uint8Array(count);
  const viewportSize = new Vector2(1, 1), pickViewportSize = new Vector2(1, 1);
  const material = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, uniforms: { viewportSize: { value: viewportSize }, markerArm: { value: 3 } }, vertexShader: vertex, fragmentShader: fragment });
  const pickMaterial = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, uniforms: { viewportSize: { value: pickViewportSize }, markerArm: { value: 3 } }, defines: { PICKING: 1 }, vertexShader: vertex, fragmentShader: fragment, toneMapped: false });
  const mesh = new Mesh(geometry, material), pick = new Mesh(geometry, pickMaterial); mesh.frustumCulled = pick.frustumCulled = false;
  pick.onBeforeRender = (_renderer, _scene, camera) => {
    const view = camera instanceof PerspectiveCamera ? camera.view : null;
    pickViewportSize.copy(viewportSize);
    if (view?.enabled) pickViewportSize.set(viewportSize.x * view.width / view.fullWidth, viewportSize.y * view.height / view.fullHeight);
    pickMaterial.uniformsNeedUpdate = true;
  };
  const color = new Color(); let disposed = false;
  const setPaint = (target: InstancedBufferAttribute, index: number, value: Lyra3dRgba, alpha: number) => {
    color.setRGB(value.r, value.g, value.b, SRGBColorSpace); target.setXYZW(index, color.r, color.g, color.b, value.a * alpha);
  };
  return {
    mesh, pick,
    depthAt(index: number) { return depths[order[index]!]!; },
    update(viewport: NodeViewport, positions: Float32Array, state: Lyra3dState) {
      if (disposed) return;
      if (!(positions instanceof Float32Array) || positions.length !== count * 3 || !positions.every((value) => Number.isFinite(value) && Math.abs(value) <= LYRA_3D_WORLD_LIMIT)) throw new RangeError('Invalid spatial node positions');
      const style = viewport.style, width = Math.max(1, viewport.width), height = Math.max(1, viewport.height);
      viewportSize.set(width, height);
      const near = orbitNearPlane(viewport.orbit), far = Math.max(near * 10, viewport.orbit.distance * 4 + 1e4);
      const arm = Math.max(3, style.fontSize / 4); material.uniforms['markerArm']!.value = arm;
      let translucent = false;
      for (let row = 0; row < count; row++) {
        order[row] = row;
        const projected = projectOrbitPoint({ x: positions[row * 3]!, y: positions[row * 3 + 1]!, z: positions[row * 3 + 2]! }, viewport.orbit, { width, height });
        shown[row] = projected ? 1 : 0; depths[row] = projected?.depth ?? Infinity;
        const baseRadius = (sizes?.[row] ?? style.pointSize) / 2;
        radii[row] = projected ? Math.min(Math.max(width, height) * 2, worldSize ? baseRadius * projected.scale : baseRadius) : 0;
        const alpha = style.forcedColors || !state.dimmed.has(row) ? 1 : opacity;
        const fillAlpha = style.forcedColors ? style.foreground.a : colors?.[row * 4 + 3] ?? style.palette[(categories?.[row] ?? 0) % style.palette.length]!.a;
        if (shown[row] && (fillAlpha * alpha < 1 || ((state.selected.has(row) || state.hover === row || state.focus === row) && style.accent.a * alpha < 1) || (expandable?.[row] && style.foreground.a * alpha < 1))) translucent = true;
      }
      // Sorting only when alpha blending needs it keeps ordinary opaque updates linear.
      // Item IDs travel with sorted attributes; geometry order never becomes item identity.
      if (translucent) order.sort((a, b) => depths[b]! - depths[a]! || a - b);
      if (material.transparent !== translucent) { material.transparent = translucent; material.needsUpdate = true; }
      material.depthWrite = !translucent;
      for (let index = 0; index < count; index++) {
        const row = order[index]!, r = radii[row]!, kind = shapes?.[row] ?? 0;
        const selected = state.selected.has(row) || state.hover === row || state.focus === row;
        const expanded = expandable?.[row] === 1;
        const alpha = style.forcedColors || !state.dimmed.has(row) ? 1 : opacity;
        const source = style.forcedColors ? style.foreground : colors ? { r: colors[row * 4]!, g: colors[row * 4 + 1]!, b: colors[row * 4 + 2]!, a: colors[row * 4 + 3]! } : style.palette[(categories?.[row] ?? 0) % style.palette.length]!;
        position.setXYZ(index, positions[row * 3]!, positions[row * 3 + 1]!, positions[row * 3 + 2]!);
        // Match the edge batch's CPU projection and fragment depth conversion. Mixing
        // GPU matrix depth with CPU endpoint depth can reverse coplanar pick priority.
        // Store window depth directly and pass it flat to avoid interpolation rounding.
        const depth = depths[row]!;
        pickDepth.setX(index, ((far + near) / (far - near) - (2 * far * near) / ((far - near) * depth)) * 0.5 + 0.5);
        radius.setX(index, r); shape.setX(index, kind); flags.setXY(index, selected ? 1 : 0, expanded ? 1 : 0);
        const bodyExtent = kind === 1 ? r * SQUARE : kind === 2 ? r * DIAMOND : r;
        const hitExtent = kind === 1 ? Math.max(12, r * SQUARE) : kind === 2 ? Math.max(12, r) * DIAMOND : Math.max(12, r);
        extent.setXY(index, shown[row] ? Math.max(bodyExtent, selected ? r + 5 : 0, expanded ? r + arm : 0) : 0, shown[row] ? hitExtent : 0);
        setPaint(fill, index, source, alpha); setPaint(ring, index, style.accent, alpha); setPaint(marker, index, style.foreground, alpha);
        pickColor.setXYZ(index, ids[row * 3]!, ids[row * 3 + 1]!, ids[row * 3 + 2]!);
      }
      for (const buffer of [position, radius, shape, extent, flags, fill, ring, marker, pickColor, pickDepth]) buffer.needsUpdate = true;
    },
    dispose() { if (disposed) return; disposed = true; mesh.removeFromParent(); pick.removeFromParent(); material.dispose(); pickMaterial.dispose(); geometry.dispose(); },
  };
}
