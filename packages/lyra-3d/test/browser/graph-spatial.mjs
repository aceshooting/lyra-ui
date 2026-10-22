import { createEngine } from '@aceshooting/lyra-3d/graph';
import { DEFAULT_LYRA_3D_STYLE, DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '@aceshooting/lyra-3d/core';
const WIDTH = 640, HEIGHT = 480;
let active;
const state = (selected = []) => ({ selected: new Set(selected), dimmed: new Set(), hover: -1, focus: -1 });
const data = (extra = {}) => ({ nodeCount: 2, positions: new Float32Array([-80, 0, 0, 80, 0, 0]), sizes: new Float32Array([40, 40]),
  source: new Uint32Array([0]), target: new Uint32Array([1]), spatialAppearance: { sizeUnits: 'world', nodeShapes: new Uint8Array([1, 2]),
    nodeColors: new Float32Array([1, 0, 0, 1, 0, 1, 0, 1]), edgeColors: new Float32Array([1, 1, 1, 1]), edgeWidths: new Float32Array([2]), edgeDashes: [[8, 8]] }, ...extra });
export function cleanupGraphSpatial() { active?.engine.dispose(); active?.container.remove(); active = undefined; }
async function mount(input) {
  cleanupGraphSpatial(); const container = document.createElement('div'); container.style.cssText = `position:absolute;left:0;top:0;width:${WIDTH}px;height:${HEIGHT}px`; document.body.replaceChildren(container);
  const engine = createEngine(); const lost = [];
  active = { engine, container, lost };
  engine.setData(input, 0); engine.setCamera(DEFAULT_ORBIT_CAMERA);
  engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, devicePixelRatio: 1, background: '#000000', accent: '#0000ff', foreground: '#ffffff', reducedMotion: true });
  await engine.mount(container, { hover() {}, pick() {}, camera() {}, lost: (reason) => lost.push(reason) }); engine.resize(WIDTH, HEIGHT);
  const canvas = container.querySelector('canvas'), gl = canvas?.getContext('webgl2'); if (!gl) throw new Error('Expected owned WebGL2 canvas');
  Object.assign(active, { canvas, gl }); return active;
}
async function pixels(record, selected = []) {
  record.engine.setState(state(selected));
  return new Promise((resolve) => requestAnimationFrame(() => { const result = new Uint8Array(WIDTH * HEIGHT * 4); record.gl.readPixels(0, 0, WIDTH, HEIGHT, record.gl.RGBA, record.gl.UNSIGNED_BYTE, result); resolve(result); }));
}
function pixel(buffer, point) {
  const x = Math.max(0, Math.min(WIDTH - 1, Math.round(point.x))), y = Math.max(0, Math.min(HEIGHT - 1, HEIGHT - 1 - Math.round(point.y)));
  return [...buffer.slice((y * WIDTH + x) * 4, (y * WIDTH + x) * 4 + 4)];
}
const white = (rgba) => rgba[0] > 180 && rgba[1] > 180 && rgba[2] > 180;
const black = (rgba) => rgba[0] < 30 && rgba[1] < 30 && rgba[2] < 30;
const project = (point) => projectOrbitPoint(point, DEFAULT_ORBIT_CAMERA, { width: WIDTH, height: HEIGHT });
export const graphSpatialCases = {
  async 'graph-spatial-glyph-rings-dashes-pick'() {
    const record = await mount(data()); const original = await pixels(record);
    const a = record.engine.project(0), b = record.engine.project(1); if (!a || !b) throw new Error('Expected projected nodes');
    const centers = [pixel(original, a), pixel(original, b)];
    const radius = project({ x: -60, y: 0, z: 0 }).x - a.x;
    const squareDiagonal = { x: a.x + radius * 0.8, y: a.y + radius * 0.8 };
    const diamondDiagonal = { x: b.x + radius * 0.7, y: b.y + radius * 0.7 };
    const diamondAxis = { x: b.x + radius * 1.1, y: b.y };
    const silhouettes = [pixel(original, squareDiagonal), pixel(original, diamondDiagonal), pixel(original, diamondAxis)];
    const shapePicks = [squareDiagonal, diamondDiagonal, diamondAxis].map((point) => record.engine.pick(point.x, point.y));
    let painted = 0, gaps = 0;
    for (let x = a.x + 35; x < b.x - 35; x++) { const rgba = pixel(original, { x, y: a.y }); if (white(rgba)) painted++; if (black(rgba)) gaps++; }
    const selected = await pixels(record, [0]);
    const body = pixel(selected, a), ring = pixel(selected, { x: a.x + radius + 4, y: a.y });
    const picks = [record.engine.pick(a.x, a.y), record.engine.pick(b.x, b.y), record.engine.pick((a.x + b.x) / 2, a.y)];
    return { passed: record.lost.length === 0 && centers[0][0] > 180 && centers[0][1] < 30 && centers[1][1] > 180 &&
      body[0] > 180 && body[2] < 30 && ring[2] > 150 && ring[0] < 60 && painted > 10 && gaps > 10 && JSON.stringify(picks) === '[0,1,2]' && silhouettes[0][0] > 180 && black(silhouettes[1]) && silhouettes[2][1] > 180 && JSON.stringify(shapePicks) === '[0,null,1]', centers, silhouettes, shapePicks, body, ring, painted, gaps, picks };
  },
  async 'graph-spatial-loop-and-dangling-identities'() {
    const input = data({ source: new Uint32Array([0, 1]), target: new Uint32Array([0, 1]), directed: new Uint8Array([1, 1]),
      spatialAppearance: { sizeUnits: 'world', nodeColors: new Float32Array([1, 0, 0, 1, 0, 1, 0, 1]), edgeColors: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1]), dangling: new Uint8Array([0, 1]), edgeWidths: new Float32Array([2, 2]) } });
    const record = await mount(input); const buffer = await pixels(record);
    const loop = project({ x: -80, y: -64, z: 0 }), stub = project({ x: 108, y: -28, z: 0 });
    const loopPick = record.engine.pick(loop.x, loop.y), stubPick = record.engine.pick(stub.x, stub.y);
    let stubPaint = 0;
    for (let t = 0.7; t <= 1; t += 0.02) if (white(pixel(buffer, project({ x: 80 + 28 * t, y: -28 * t, z: 0 })))) stubPaint++;
    return { passed: record.lost.length === 0 && loopPick === 2 && stubPick === null && white(pixel(buffer, loop)) && stubPaint > 0,
      loopPick, stubPick, stubPaint, loopPixel: pixel(buffer, loop) };
  },
};

// The crossing is far from its zero-size endpoint glyphs. Both layers cover the probe fully,
// so reversing camera depth must reverse source-over color without changing authored alpha.
graphSpatialCases['graph-spatial-mixed-rgba-camera-order'] = async () => {
  const layers = (nodeAlpha, edgeAlpha) => ({ nodeCount: 3,
    positions: new Float32Array([0, 0, 0, -140, 0, 80, 140, 0, 80]), sizes: new Float32Array([80, 0, 0]),
    source: new Uint32Array([1]), target: new Uint32Array([2]),
    spatialAppearance: { sizeUnits: 'world', nodeColors: new Float32Array([1, 0, 0, nodeAlpha, 0, 0, 0, 0, 0, 0, 0, 0]),
      edgeColors: new Float32Array([0, 0, 1, edgeAlpha]), edgeWidths: new Float32Array([32]) },
  });
  const record = await mount(layers(0.5, 0)); const probe = { x: WIDTH / 2, y: HEIGHT / 2 };
  const redControl = pixel(await pixels(record), probe);
  record.engine.setData(layers(0, 0.5), 1);
  const blueControl = pixel(await pixels(record), probe);
  record.engine.setData(layers(0.5, 0.5), 2);
  const nearBlue = pixel(await pixels(record), probe);
  const bluePick = record.engine.pick(probe.x, probe.y);
  record.engine.setCamera({ ...DEFAULT_ORBIT_CAMERA, yaw: Math.PI });
  const nearRed = pixel(await pixels(record), probe);
  const redPick = record.engine.pick(probe.x, probe.y);
  const close = (actual, expected) => expected.every((value, channel) => Math.abs(actual[channel] - value) <= 10);
  // Shader output is already sRGB encoded. The ordinary unorm drawing buffer blends encoded
  // channels (half red reads 128); an sRGB attachment blends linear light (half red reads 188).
  // Calibrate both isolated layers before choosing the transfer; neither black nor unblended
  // full-intensity output can satisfy these controls.
  const encodedBlend = close(redControl, [128, 0, 0, 255]) && close(blueControl, [0, 0, 128, 255]);
  const linearBlend = close(redControl, [188, 0, 0, 255]) && close(blueControl, [0, 0, 188, 255]);
  const decode = (value) => {
    const channel = value / 255;
    return linearBlend ? channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4 : channel;
  };
  const encode = (value) => 255 * (linearBlend ? value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055 : value);
  const expectedBlue = [encode(decode(redControl[0]) * 0.5), 0, blueControl[2], 255];
  const expectedRed = [redControl[0], 0, encode(decode(blueControl[2]) * 0.5), 255];
  return { passed: record.lost.length === 0 && (encodedBlend || linearBlend) && close(nearBlue, expectedBlue) && close(nearRed, expectedRed) &&
    nearBlue[2] > nearBlue[0] + 30 && nearRed[0] > nearRed[2] + 30 && bluePick === 3 && redPick === 0,
    redControl, blueControl, nearBlue, nearRed, expectedBlue, expectedRed, bluePick, redPick, blending: linearBlend ? 'linear-light' : 'encoded-channels' };
};

// Probe a crossing away from endpoint hit expansion. Exact ties belong to nodes, while an
// actually nearer edge must still win; camera reversal exchanges the front/back controls.
graphSpatialCases['graph-spatial-pick-depth-ties-and-crossings'] = async () => {
  const input = (z) => ({ nodeCount: 3, positions: new Float32Array([-80, 0, z, 80, 0, z, 0, 0, 0]),
    sizes: new Float32Array([0, 0, 30]), source: new Uint32Array([0]), target: new Uint32Array([1]),
    spatialAppearance: { sizeUnits: 'css', edgeWidths: new Float32Array([4]) } });
  const record = await mount(input(0)); const results = []; let revision = 0;
  for (const distance of [300, 500, 1000]) for (const yaw of [0, Math.PI]) {
    record.engine.setCamera({ ...DEFAULT_ORBIT_CAMERA, distance, yaw });
    for (const z of [0, 20, -20]) {
      record.engine.setData(input(z), ++revision); await pixels(record);
      const expected = z * Math.cos(yaw) > 0 ? 3 : 2;
      for (const dx of [-4, 0, 4]) {
        const picked = record.engine.pick(WIDTH / 2 + dx, HEIGHT / 2);
        results.push({ distance, yaw, z, dx, expected, picked });
      }
    }
  }
  return { passed: record.lost.length === 0 && results.every((row) => row.picked === row.expected), results };
};


// Appearance changes can legitimately produce no label-plane objects in the scene.
graphSpatialCases['graph-spatial-appearance-empty-label-scene'] = async () => {
  const originalError = console.error, errors = [];
  console.error = function(...args) { errors.push(args.map(String).join(' ')); originalError.apply(console, args); };
  try {
    const input = data(), record = await mount(input), point = record.engine.project(0);
    if (!point) throw new Error('Expected projected node');
    const before = pixel(await pixels(record), point), position = record.engine.positionOf(0);
    record.engine.setAppearance({ nodeLabels: 'none', spatialAppearance: { ...input.spatialAppearance,
      nodeColors: new Float32Array([0, 0, 1, 1, 0, 1, 0, 1]) } });
    const changed = pixel(await pixels(record), point);
    record.engine.setAppearance({ labels: ['Alpha', 'Beta'], nodeLabels: 'always' }); await pixels(record);
    record.engine.setAppearance({ labels: ['', ''], nodeLabels: 'none' });
    const cleared = pixel(await pixels(record), point), afterPosition = record.engine.positionOf(0);
    const unchangedPosition = position && afterPosition && ['x', 'y', 'z'].every((axis) => position[axis] === afterPosition[axis]);
    const picked = record.engine.pick(point.x, point.y);
    return { passed: errors.length === 0 && record.lost.length === 0 && unchangedPosition && picked === 0 &&
      before[0] > 200 && before[2] < 30 && changed[2] > 200 && changed[0] < 30 && cleared[2] > 200 && cleared[0] < 30,
      errors, before, changed, cleared, picked, unchangedPosition };
  } finally { console.error = originalError; }
};
