import { createEngine } from '@aceshooting/lyra-3d/graph';
import { DEFAULT_LYRA_3D_STYLE, DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '@aceshooting/lyra-3d/core';

const width = 640, height = 480;
let active;
export function cleanupGraphSpatialCurves() {
  active?.engine.dispose(); active?.container.remove(); active = undefined;
}
// Independent world-space oracle. The fixed vectors below also exercise basis-axis ties.
function curve(a, b, curvature, t) {
  const d = b.map((value, i) => value - a[i]), length = Math.hypot(...d);
  const axis = [0, 1, 2].reduce((best, i) => Math.abs(d[i]) < Math.abs(d[best]) ? i : best, 0);
  const basis = [0, 0, 0]; basis[axis] = 1;
  const cross = [d[1] * basis[2] - d[2] * basis[1], d[2] * basis[0] - d[0] * basis[2], d[0] * basis[1] - d[1] * basis[0]];
  const norm = Math.hypot(...cross);
  return a.map((value, i) => value + d[i] * t + (norm ? 4 * curvature * length * cross[i] / norm * t * (1 - t) : 0));
}
function eye(p, camera) {
  const [dx, dy, dz] = p.map((v, i) => v - camera.target[['x', 'y', 'z'][i]]);
  const x = Math.cos(camera.yaw) * dx - Math.sin(camera.yaw) * dz;
  const z = Math.sin(camera.yaw) * dx + Math.cos(camera.yaw) * dz;
  return [x, Math.cos(camera.pitch) * dy - Math.sin(camera.pitch) * z,
    camera.distance - Math.sin(camera.pitch) * dy - Math.cos(camera.pitch) * z];
}
function screen(p) {
  const scale = height / (2 * Math.tan(Math.PI / 8) * p[2]);
  return { x: width / 2 + p[0] * scale, y: height / 2 + p[1] * scale };
}
async function mount(a, b, curvature, camera, dashes = [], directed = false) {
  cleanupGraphSpatialCurves();
  const container = document.createElement('div');
  container.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px`;
  document.body.replaceChildren(container);
  const engine = createEngine(), lost = [];
  active = { engine, container, lost, camera };
  engine.setData({ nodeCount: 2, positions: new Float32Array([...a, ...b]), sizes: new Float32Array(2),
    source: new Uint32Array([0]), target: new Uint32Array([1]), directed: new Uint8Array([directed ? 1 : 0]), spatialAppearance: {
      sizeUnits: 'css', edgeWidths: new Float32Array([4]), edgeColors: new Float32Array([1, 1, 1, 1]),
      nodeColors: new Float32Array(8), edgeCurvatures: new Float32Array([curvature]), edgeDashes: [dashes],
    } }, 0);
  engine.setCamera(camera);
  engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, devicePixelRatio: 1, background: '#000000', reducedMotion: true });
  await engine.mount(container, { hover() {}, pick() {}, camera() {}, lost: (reason) => lost.push(reason) });
  engine.resize(width, height);
  active.gl = container.querySelector('canvas')?.getContext('webgl2');
  if (!active.gl) throw new Error('Expected owned WebGL2 canvas');
  return active;
}
async function pixels(record) {
  const gl = record.gl, original = gl.drawElementsInstanced;
  let timer;
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Expected a visual draw for curve pixel capture')), 5000);
      gl.drawElementsInstanced = (...args) => {
        original.apply(gl, args);
        // Read the visual draw before a browser discards its non-preserved default buffer.
        // Picking uses an offscreen framebuffer and must never satisfy this capture.
        if (gl.getParameter(gl.FRAMEBUFFER_BINDING) !== null) return;
        const buffer = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
        resolve(buffer);
      };
      // setCamera always invalidates, even when the logical camera values stay equal.
      record.engine.setCamera({ ...record.camera, target: { ...record.camera.target } });
    });
  } finally {
    clearTimeout(timer); gl.drawElementsInstanced = original;
  }
}
function bright(buffer, point) {
  const x = Math.floor(point.x), y = height - 1 - Math.floor(point.y);
  return buffer[(y * width + x) * 4] > 180;
}

export const graphSpatialCurveCases = {
  async 'graph-spatial-curves-arrow-perspective-differential'() {
    const a = [-60, -40, 0], b = [60, 40, 300], c = 0.8;
    const camera = { ...DEFAULT_ORBIT_CAMERA, yaw: 0.4, pitch: 0.1 };
    const plain = await pixels(await mount(a, b, c, camera));
    const record = await mount(a, b, c, camera, [], true), arrow = await pixels(record);
    const tip = screen(eye(b, camera));
    // A converged numerical derivative of the projected quadratic independently checks the
    // analytic endpoint perspective differential, including its changing eye depth.
    const before = screen(eye(curve(a, b, c, 1 - 1e-7), camera));
    const length = Math.hypot(tip.x - before.x, tip.y - before.y);
    const direction = { x: (tip.x - before.x) / length, y: (tip.y - before.y) / length };
    const head = 12, halfWidth = head * Math.tan(0.45);
    let added = 0, outside = 0;
    for (let y = Math.floor(tip.y - 20); y <= Math.ceil(tip.y + 20); y++) {
      for (let x = Math.floor(tip.x - 20); x <= Math.ceil(tip.x + 20); x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const point = { x: x + 0.5, y: y + 0.5 };
        if (!bright(arrow, point) || bright(plain, point)) continue;
        const dx = tip.x - point.x, dy = tip.y - point.y;
        const back = dx * direction.x + dy * direction.y, side = Math.abs(dx * direction.y - dy * direction.x);
        added++;
        if (back < -1.5 || back > head + 1.5 || side > halfWidth * back / head + 1.5) outside++;
      }
    }
    return { passed: !record.lost.length && added >= 8 && outside === 0, added, outside, direction, tip };
  },
  async 'graph-spatial-curves-world-vectors-paint-and-pick'() {
    const vectors = [
      { a: [-60, 0, 0], b: [60, 0, 0], c: 0.5, camera: { yaw: 0.7, pitch: 0.35 } },
      { a: [0, -60, 0], b: [0, 60, 0], c: -0.5, camera: { yaw: 0.7, pitch: 0.35 } },
      { a: [-40, -40, -40], b: [40, 40, 40], c: 0.5, camera: { yaw: -0.6, pitch: 0.2 } },
      { a: [60, 0, 0], b: [-60, 0, 0], c: 0.5, camera: { yaw: 0.7, pitch: 0.35 } },
    ];
    const results = [];
    for (const { a, b, c, camera: angles } of vectors) {
      const camera = { ...DEFAULT_ORBIT_CAMERA, ...angles }, record = await mount(a, b, c, camera), buffer = await pixels(record);
      const probes = [0.25, 0.5, 0.75].map((t) => {
        const p = curve(a, b, c, t), point = projectOrbitPoint({ x: p[0], y: p[1], z: p[2] }, camera, { width, height });
        return { painted: bright(buffer, point), picked: record.engine.pick(point.x, point.y) };
      });
      const chord = screen(eye(a.map((v, i) => (v + b[i]) / 2), camera));
      results.push({ probes, chordPainted: bright(buffer, chord), chordPick: record.engine.pick(chord.x, chord.y), lost: record.lost });
    }
    return { passed: results.every((r) => !r.lost.length && r.probes.every((p) => p.painted && p.picked === 2) && !r.chordPainted && r.chordPick === null), results };
  },
  async 'graph-spatial-curves-continuous-clipped-dashes'() {
    const results = [];
    // The second view has a curve crossing the near plane while its visible samples remain
    // in the viewport. Accumulate only clipped projected lengths, including offscreen ones.
    for (const camera of [{ ...DEFAULT_ORBIT_CAMERA, yaw: 0.7, pitch: 0.25 },
      { ...DEFAULT_ORBIT_CAMERA, distance: 20, target: { x: -24, y: 0, z: 16.2 } }]) {
      const a = [-30, 0, 0], b = [30, 0, 0], c = 1.5 / 2;
      const record = await mount(a, b, c, camera, [13, 11]), buffer = await pixels(record);
      const near = Math.max(0.01, camera.distance * 0.001); let offset = 0;
      const samples = [];
      for (let segment = 0; segment < 16; segment++) {
        let p = eye(curve(a, b, c, segment / 16), camera), q = eye(curve(a, b, c, (segment + 1) / 16), camera);
        if (p[2] < near && q[2] < near) continue;
        const clip = (from, to) => from.map((v, i) => v + (to[i] - v) * (near - from[2]) / (to[2] - from[2]));
        if (p[2] < near) p = clip(p, q);
        if (q[2] < near) q = clip(q, p);
        const start = screen(p), end = screen(q), span = Math.hypot(end.x - start.x, end.y - start.y);
        for (const fraction of [0.3, 0.5, 0.7]) {
          const point = { x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction };
          const phase = (offset + span * fraction) % 24;
          if (point.x < 5 || point.x > width - 5 || point.y < 5 || point.y > height - 5 || Math.min(phase, Math.abs(phase - 13), 24 - phase) < 2) continue;
          samples.push({ segment, expected: phase < 13, actual: bright(buffer, point) });
        }
        offset += span;
      }
      results.push({ samples, lost: record.lost });
    }
    return { passed: results.every((r) => !r.lost.length && r.samples.length >= 6 && r.samples.some((s) => s.expected) && r.samples.some((s) => !s.expected) && r.samples.every((s) => s.actual === s.expected)), results };
  },
};
