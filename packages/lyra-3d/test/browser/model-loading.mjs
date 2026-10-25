import { createEngine } from '@aceshooting/lyra-3d/model';

const bytes = text => new TextEncoder().encode(text);
const inputs = {
  xyz: { format: 'xyz', bytes: bytes('0 0 0\n1 2 3\n') },
  obj: { format: 'obj', bytes: bytes('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n') },
};
function glb() {
  const positions = new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
  const document = { asset: { version: '2.0' }, buffers: [{ byteLength: positions.length }], bufferViews: [{ buffer: 0, byteLength: positions.length }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 };
  const json = JSON.stringify(document); const text = bytes(json.padEnd(Math.ceil(json.length / 4) * 4, ' '));
  const output = new Uint8Array(28 + text.length + positions.length); const view = new DataView(output.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, output.length, true);
  view.setUint32(12, text.length, true); view.setUint32(16, 0x4e4f534a, true); output.set(text, 20);
  view.setUint32(20 + text.length, positions.length, true); view.setUint32(24 + text.length, 0x004e4942, true); output.set(positions, 28 + text.length);
  return { format: 'glb', bytes: output };
}
const engine = createEngine(); let revision = 0; let success; let failure;
const container = document.createElement('div'); container.style.cssText = 'width:320px;height:240px'; document.body.append(container);
await engine.mount(container, { hover() {}, pick() {}, camera() {}, lost(reason, detail) { failure?.(new Error(`${reason}:${detail}`)); }, progress() { success?.(); } });
engine.resize(320, 240);
window.loadModelFormat = format => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Model fixture did not complete')), 10000);
  success = () => { clearTimeout(timer); resolve(); };
  failure = error => { clearTimeout(timer); reject(error); };
  try { engine.setData(format === 'glb' ? glb() : inputs[format], revision++); } catch (error) { failure(error); }
});
window.disposeModelFixture = () => engine.dispose();
document.body.dataset.ready = 'true';
