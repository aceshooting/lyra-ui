import { CanvasTexture, Mesh, PlaneGeometry, ShaderMaterial, SRGBColorSpace } from 'three';
import type { Lyra3dState, Lyra3dWorldPoint } from '../core/contract.js';
import type { Lyra3dViewport } from '../core/viewport.js';
import type { AdmittedPointsData } from './data.js';
import type { PointsAxisName } from './types.js';
import { disposePointsLabelResources, type PointsLabelResources } from './label-resources.js';

export interface PointsText { readonly position: Lyra3dWorldPoint; readonly text: string }
const point = (axis: PointsAxisName, value: number): Lyra3dWorldPoint => ({ x: axis === 'x' ? value : 0, y: axis === 'y' ? value : 0, z: axis === 'z' ? value : 0 });
/** Axes and grid geometry are derived solely from admitted component-supplied coordinates. */
export function pointsAxes(data: AdmittedPointsData) {
  const lines: number[] = []; const grid: number[] = []; const labels: PointsText[] = [];
  const axes = data.axes.filter((axis) => data.mode !== '2d' || axis.axis !== 'z');
  for (const axis of axes) {
    const start = point(axis.axis, axis.min); const end = point(axis.axis, axis.max);
    lines.push(start.x, start.y, start.z, end.x, end.y, end.z);
    if (axis.label) labels.push({ position: end, text: axis.label });
    for (const tick of axis.ticks) {
      const position = point(axis.axis, tick.value);
      if (tick.label) labels.push({ position, text: tick.label });
      if (axis.grid) for (const other of axes) {
        if (other.axis === axis.axis) continue;
        const a = { ...position, [other.axis]: other.min }; const b = { ...position, [other.axis]: other.max };
        grid.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
  }
  return { lines: new Float32Array(lines), grid: new Float32Array(grid), labels };
}

/** One plain-text overlay texture; axis/tick labels precede a bounded set of point labels. */
export function createPointsLabels(viewport: Lyra3dViewport, data: AdmittedPointsData, axisLabels: readonly PointsText[], createCanvas = () => viewport.canvas.ownerDocument.createElement('canvas')) {
  if (axisLabels.length === 0 && !data.labels?.some(Boolean)) return { resources: undefined, update(_state: Lyra3dState) {}, dispose() {} };
  const canvas = createCanvas(); const context = canvas.getContext('2d');
  const resources: PointsLabelResources = { canvas, texture: undefined, material: undefined, geometry: undefined, mesh: undefined, disposed: false };
  if (!context) return { resources, update(_state: Lyra3dState) {}, dispose() { disposePointsLabelResources(resources); } };
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.generateMipmaps = false;
  const material = new ShaderMaterial({ uniforms: { labels: { value: texture } }, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 textUv; void main() { textUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D labels; varying vec2 textUv; void main() { gl_FragColor = texture2D(labels, textUv);\n#include <colorspace_fragment>\n}' });
  const mesh = new Mesh(new PlaneGeometry(2, 2), material); mesh.frustumCulled = false; mesh.renderOrder = 100; viewport.scene.add(mesh);
  resources.texture = texture; resources.material = material; resources.geometry = mesh.geometry; resources.mesh = mesh;
  let key = ''; let previousStyle = viewport.style; let previousState: Lyra3dState | undefined;
  return {
    resources,
    update(state: Lyra3dState) {
      if (resources.disposed) return;
      const camera = viewport.orbit; const style = viewport.style;
      const nextKey = [viewport.width, viewport.height, camera.yaw, camera.pitch, camera.distance, camera.target.x, camera.target.y, camera.target.z].join('|');
      if (key === nextKey && previousStyle === style && previousState === state) return;
      key = nextKey; previousStyle = style; previousState = state;
      const ratio = Math.min(style.devicePixelRatio, 2048 / Math.max(1, viewport.width, viewport.height));
      const width = Math.max(1, Math.floor(viewport.width * ratio)); const height = Math.max(1, Math.floor(viewport.height * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, viewport.width, viewport.height);
      context.font = `${style.fontSize}px ${style.fontFamily}`; context.textAlign = 'left'; context.textBaseline = 'middle';
      const foreground = style.foreground; context.fillStyle = `rgb(${foreground.r * 255} ${foreground.g * 255} ${foreground.b * 255})`;
      let count = 0;
      const draw = (label: PointsText, row = -1) => {
        if (count >= 256 || !label.text) return;
        const projected = viewport.project(label.position);
        if (!projected) return;
        const x = projected.x + 4 + (row < 0 ? 0 : (data.sizes?.[row] ?? style.pointSize) / 2);
        const y = projected.y;
        if (x < 0 || y < 0 || x >= viewport.width || y >= viewport.height) return;
        context.globalAlpha = row >= 0 && !style.forcedColors && state.dimmed.has(row) ? 0.3 : 1;
        context.fillText(label.text, x, y, Math.min(512, viewport.width - x)); count += 1;
      };
      for (const label of axisLabels) draw(label);
      const rowLabel = (row: number) => {
        if (!Number.isInteger(row) || row < 0 || row >= data.positions.length / 3 || !data.labels?.[row]) return;
        draw({ text: data.labels[row]!, position: { x: data.positions[row * 3]!, y: data.positions[row * 3 + 1]!, z: data.positions[row * 3 + 2]! } }, row);
      };
      rowLabel(state.focus); if (state.hover !== state.focus) rowLabel(state.hover);
      for (let row = 0; row < (data.labels?.length ?? 0) && count < 256; row += 1) if (row !== state.focus && row !== state.hover) rowLabel(row);
      context.globalAlpha = 1; texture.needsUpdate = true;
    },
    dispose() { disposePointsLabelResources(resources); },
  };
}
