import { DoubleSide, Color, InstancedBufferAttribute, InstancedBufferGeometry, LinearSRGBColorSpace, Mesh, PerspectiveCamera, PlaneGeometry, ShaderMaterial, SRGBColorSpace, Vector2 } from 'three';
import type { Lyra3dState } from '../core/contract.js';
import { createPickColors } from '../core/picking.js';
import type { ResolvedLyra3dStyle } from '../core/style.js';
import type { AdmittedPointsData } from './data.js';

function quads(count: number): InstancedBufferGeometry {
  const plane = new PlaneGeometry(2, 2);
  const geometry = new InstancedBufferGeometry();
  geometry.index = plane.index; geometry.attributes = { ...plane.attributes }; geometry.instanceCount = count;
  plane.dispose();
  return geometry;
}
const pointVertex = `
attribute vec3 pointPosition;
attribute float pointSize;
attribute vec3 pointColor;
attribute vec3 pickColor;
uniform vec2 viewportSize;
varying vec2 disk;
varying vec3 tint;
void main() {
  disk = uv * 2.0 - 1.0;
  #ifdef PICKING
    tint = pickColor;
  #else
    tint = pointColor;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pointPosition, 1.0);
  gl_Position.xy += position.xy * pointSize / viewportSize * gl_Position.w;
}`;
const pointFragment = `
varying vec2 disk;
varying vec3 tint;
void main() {
  if (dot(disk, disk) > 1.0) discard;
  gl_FragColor = vec4(tint, 1.0);
  #ifndef PICKING
    #include <colorspace_fragment>
  #endif
}`;

/** One shared attribute geometry for normal and ID passes, without per-point matrices or objects. */
export function createPointBatch(data: AdmittedPointsData) {
  const count = data.positions.length / 3;
  const geometry = quads(count);
  geometry.setAttribute('pointPosition', new InstancedBufferAttribute(data.positions, 3));
  geometry.setAttribute('pointSize', new InstancedBufferAttribute(data.sizes?.slice() ?? new Float32Array(count), 1));
  geometry.setAttribute('pointColor', new InstancedBufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('pickColor', new InstancedBufferAttribute(createPickColors(count), 3));
  const viewportSize = new Vector2(1, 1);
  const material = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, uniforms: { viewportSize: { value: viewportSize } }, vertexShader: pointVertex, fragmentShader: pointFragment });
  const pickViewportSize = new Vector2(1, 1);
  const pickMaterial = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, uniforms: { viewportSize: { value: pickViewportSize } }, defines: { PICKING: 1 }, vertexShader: pointVertex, fragmentShader: pointFragment, toneMapped: false });
  const mesh = new Mesh(geometry, material); const pick = new Mesh(geometry, pickMaterial);
  mesh.frustumCulled = pick.frustumCulled = false;
  pick.onBeforeRender = (_renderer, _scene, camera) => {
    const view = camera instanceof PerspectiveCamera ? camera.view : null;
    pickViewportSize.copy(viewportSize);
    if (view?.enabled) pickViewportSize.set(viewportSize.x * view.width / view.fullWidth, viewportSize.y * view.height / view.fullHeight);
    pickMaterial.uniformsNeedUpdate = true;
  };
  const color = new Color();
  return {
    mesh, pick,
    resize(width: number, height: number) { viewportSize.set(Math.max(1, width), Math.max(1, height)); },
    paint(style: ResolvedLyra3dStyle, state: Lyra3dState) {
      const colors = geometry.getAttribute('pointColor') as InstancedBufferAttribute;
      const sizes = geometry.getAttribute('pointSize') as InstancedBufferAttribute;
      for (let row = 0; row < count; row += 1) {
        const override = state.focus === row ? style.focus : state.selected.has(row) || state.hover === row ? style.accent : style.forcedColors ? style.foreground : undefined;
        if (data.colors && !override) {
          // Loader vertex colors already use linear-sRGB; the fragment output applies the display
          // transfer. Applying the style's sRGB input transfer here would darken them twice.
          color.setRGB(data.colors[row * 3]!, data.colors[row * 3 + 1]!, data.colors[row * 3 + 2]!, LinearSRGBColorSpace);
        } else {
          const value = override ?? style.palette[(data.categories?.[row] ?? 0) % style.palette.length]!;
          color.setRGB(value.r, value.g, value.b, SRGBColorSpace);
        }
        if (!style.forcedColors && state.dimmed.has(row)) color.multiplyScalar(0.3);
        colors.setXYZ(row, color.r, color.g, color.b);
        if (!data.sizes) sizes.setX(row, style.pointSize);
      }
      colors.needsUpdate = true; if (!data.sizes) sizes.needsUpdate = true;
    },
    dispose() { mesh.removeFromParent(); pick.removeFromParent(); material.dispose(); pickMaterial.dispose(); geometry.dispose(); },
  };
}

const lineVertex = `
attribute vec3 lineStart;
attribute vec3 lineEnd;
uniform vec2 viewportSize;
uniform float lineWidth;
void main() {
  vec4 a = projectionMatrix * modelViewMatrix * vec4(lineStart, 1.0);
  vec4 b = projectionMatrix * modelViewMatrix * vec4(lineEnd, 1.0);
  vec2 delta = (b.xy / b.w - a.xy / a.w) * viewportSize;
  float span = length(delta);
  if (a.z < -a.w || b.z < -b.w || span < 0.0001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  } else {
    gl_Position = mix(a, b, uv.x);
    vec2 perpendicular = vec2(-delta.y, delta.x) / span;
    gl_Position.xy += perpendicular * position.y * lineWidth / viewportSize * gl_Position.w;
  }
}`;
/** Screen-space-width lines are visual only; the stable point-row pick space stays unchanged. */
export function createLineBatch(endpoints: Float32Array) {
  const count = endpoints.length / 6;
  const geometry = quads(count);
  const start = new Float32Array(count * 3); const end = new Float32Array(count * 3);
  for (let row = 0; row < count; row += 1) { start.set(endpoints.subarray(row * 6, row * 6 + 3), row * 3); end.set(endpoints.subarray(row * 6 + 3, row * 6 + 6), row * 3); }
  geometry.setAttribute('lineStart', new InstancedBufferAttribute(start, 3)); geometry.setAttribute('lineEnd', new InstancedBufferAttribute(end, 3));
  const material = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, uniforms: { viewportSize: { value: new Vector2(1, 1) }, lineWidth: { value: 1 }, tint: { value: new Color() } }, vertexShader: lineVertex,
    fragmentShader: 'uniform vec3 tint; void main() { gl_FragColor = vec4(tint, 1.0);\n#include <colorspace_fragment>\n}' });
  const mesh = new Mesh(geometry, material); mesh.frustumCulled = false;
  return {
    mesh,
    update(style: ResolvedLyra3dStyle, width: number, height: number, axis = false) {
      (material.uniforms['viewportSize']!.value as Vector2).set(Math.max(1, width), Math.max(1, height));
      material.uniforms['lineWidth']!.value = style.lineWidth;
      const value = style.forcedColors || axis ? style.foreground : style.muted;
      (material.uniforms['tint']!.value as Color).setRGB(value.r, value.g, value.b, SRGBColorSpace);
    },
    dispose() { mesh.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}
