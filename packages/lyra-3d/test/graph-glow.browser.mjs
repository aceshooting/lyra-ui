import { createEngine } from '@aceshooting/lyra-3d/graph';
import { DEFAULT_LYRA_3D_STYLE, DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '@aceshooting/lyra-3d/core';

const WIDTH = 640, HEIGHT = 480;
let active;
export function cleanupGraphGlow() { active?.engine.dispose(); active?.container.remove(); active = undefined; }
async function mount({ background = '#0a141e', alpha = 1, empty = false } = {}) {
  cleanupGraphGlow();
  const container = document.createElement('div'); container.style.cssText = `position:absolute;left:0;top:0;width:${WIDTH}px;height:${HEIGHT}px`; document.body.replaceChildren(container);
  const engine = createEngine(), lost = [];
  active = { engine, container, lost };
  engine.setData({ nodeCount: empty ? 0 : 1, positions: new Float32Array(empty ? [] : [0, 0, 0]), sizes: new Float32Array(empty ? [] : [60]),
    source: new Uint32Array(), target: new Uint32Array(), spatialAppearance: { sizeUnits: 'world', nodeColors: new Float32Array(empty ? [] : [.8, .2, .1, alpha]) } }, 0);
  engine.setCamera(DEFAULT_ORBIT_CAMERA); engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, devicePixelRatio: 1, background, reducedMotion: true });
  await engine.mount(container, { hover() {}, pick() {}, camera() {}, lost: reason => lost.push(reason) }); engine.resize(WIDTH, HEIGHT);
  active.gl = container.querySelector('canvas')?.getContext('webgl2'); if (!active.gl) throw Error('Expected owned WebGL2 context');
  return active;
}
async function pixels(record) {
  const { gl, engine } = record, methods = ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced'];
  const original = new Map(methods.map(name => [name, gl[name]])); let timer;
  try {
    return await new Promise((resolve, reject) => {
      let latest, queued = false;
      timer = setTimeout(() => reject(Error('Expected main-frame visual draw')), 5000);
      for (const name of methods) gl[name] = (...args) => {
        original.get(name).apply(gl, args);
        if (gl.getParameter(gl.FRAMEBUFFER_BINDING) !== null) return;
        latest = new Uint8Array(WIDTH * HEIGHT * 4); gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, latest);
        if (!queued) { queued = true; queueMicrotask(() => resolve(latest)); }
      };
      engine.setCamera({ ...DEFAULT_ORBIT_CAMERA, target: { ...DEFAULT_ORBIT_CAMERA.target } });
    });
  } finally { clearTimeout(timer); for (const [name, method] of original) gl[name] = method; }
}
function pixel(buffer, x, y) {
  const offset = ((HEIGHT - 1 - Math.floor(y)) * WIDTH + Math.floor(x)) * 4;
  return [...buffer.subarray(offset, offset + 4)];
}
function probes() {
  const center = projectOrbitPoint({ x: 0, y: 0, z: 0 }, DEFAULT_ORBIT_CAMERA, { width: WIDTH, height: HEIGHT });
  const side = projectOrbitPoint({ x: 30, y: 0, z: 0 }, DEFAULT_ORBIT_CAMERA, { width: WIDTH, height: HEIGHT });
  return { center, halo: { x: side.x + 2, y: center.y }, far: { x: 10, y: 10 } };
}
const close = (a, b, tolerance = 2) => a.every((value, index) => Math.abs(value - b[index]) <= tolerance);

export const graphGlowCases = {
  async 'graph-glow-halo-pick-background-and-reset'() {
    const record = await mount(), p = probes();
    const before = await pixels(record), beforePicks = [record.engine.pick(p.center.x, p.center.y), record.engine.pick(p.halo.x, p.halo.y)];
    await record.engine.setGlow(true); const enabled = await pixels(record);
    const afterPicks = [record.engine.pick(p.center.x, p.center.y), record.engine.pick(p.halo.x, p.halo.y)];
    await record.engine.setGlow(false); const reset = await pixels(record);
    const baseCenter = pixel(before, p.center.x, p.center.y), glowCenter = pixel(enabled, p.center.x, p.center.y);
    const baseHalo = pixel(before, p.halo.x, p.halo.y), glowHalo = pixel(enabled, p.halo.x, p.halo.y), far = pixel(enabled, p.far.x, p.far.y);
    return { passed: !record.lost.length && close(baseCenter, glowCenter) && glowHalo[0] > baseHalo[0] + 2 && close(far, [10, 20, 30, 255]) &&
      JSON.stringify(beforePicks) === '[0,null]' && JSON.stringify(afterPicks) === '[0,null]' && before.every((value, index) => value === reset[index]),
      baseCenter, glowCenter, baseHalo, glowHalo, far, beforePicks, afterPicks };
  },
  async 'graph-glow-transparent-premultiplication-and-forced-colors'() {
    const record = await mount({ background: 'rgba(0,0,0,0)', alpha: .5 }), p = probes();
    await record.engine.setGlow(true); const enabled = await pixels(record);
    const center = pixel(enabled, p.center.x, p.center.y), halo = pixel(enabled, p.halo.x, p.halo.y), far = pixel(enabled, p.far.x, p.far.y);
    const straight = center.slice(0, 3).map(value => value * 255 / center[3]);
    const blackMatte = halo.slice(0, 3), whiteMatte = halo.slice(0, 3).map(value => value + 255 - halo[3]);
    record.engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, devicePixelRatio: 1, background: 'rgba(0,0,0,0)', forcedColors: true, reducedMotion: true });
    const forced = await pixels(record);
    await record.engine.setGlow(false); const forcedPlain = await pixels(record);
    return { passed: !record.lost.length && center[3] > 128 && halo[3] > 0 && close(far, [0, 0, 0, 0], 0) && close(straight, [204, 51, 25.5], 6) &&
      whiteMatte.every((value, channel) => value >= blackMatte[channel] && value <= 255) && forced.every((value, index) => value === forcedPlain[index]),
      center, halo, far, straight, blackMatte, whiteMatte };
  },
  async 'graph-glow-empty-scene-preserves-nonblack-background'() {
    const record = await mount({ empty: true });
    await record.engine.setGlow(true); const buffer = await pixels(record);
    const points = [[10, 10], [WIDTH / 2, HEIGHT / 2], [WIDTH - 10, HEIGHT - 10]].map(([x, y]) => pixel(buffer, x, y));
    return { passed: !record.lost.length && points.every(value => close(value, [10, 20, 30, 255], 0)), points };
  },
};
