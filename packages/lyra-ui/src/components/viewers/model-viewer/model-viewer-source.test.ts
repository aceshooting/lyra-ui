import { expect } from '@open-wc/testing';
import { isResourceLimitError } from '../../../internal/resource-loader.js';
import { MODEL_SOURCE_MAX_BYTES, readModelSource, resolveModelFormat, snapshotModelCamera } from './model-viewer-source.js';

it('does not execute camera accessors while validating structural input', () => {
  let reads = 0; const input = { pitch: 0, distance: 10, target: { x: 0, y: 0, z: 0 } };
  Object.defineProperty(input, 'yaw', { get() { reads++; return 1; } });
  expect(() => snapshotModelCamera(input)).to.throw(TypeError); expect(reads).to.equal(0);
});
it('cancels an ignored-abort body stream and never publishes its stale chunk', async () => {
  const original = window.fetch; const element = document.createElement('div'); document.body.append(element);
  let cancelled = 0; let sent = false;
  window.fetch = async () => new Response(new ReadableStream<Uint8Array>({ pull(stream) { if (!sent) { sent = true; stream.enqueue(new Uint8Array([1])); } }, cancel() { cancelled++; } }));
  const controller = new AbortController(); let current = true; let progress = 0;
  try {
    const reading = readModelSource(element, '/pending.obj', controller.signal, () => current, () => progress++);
    await new Promise(resolve => setTimeout(resolve, 0)); current = false; controller.abort(); const before = progress;
    let rejected = false; try { await reading; } catch { rejected = true; }
    expect(rejected).to.equal(true); expect(cancelled).to.equal(1); expect(progress).to.equal(before);
  } finally { element.remove(); window.fetch = original; }
});
it('rejects a source URL exceeding the encoded ceiling before fetch', async () => {
  const original = window.fetch; const element = document.createElement('div'); document.body.append(element); let requests = 0;
  window.fetch = async () => { requests++; return new Response(''); };
  try { let rejected = false; try { await readModelSource(element, `data:,${'x'.repeat(MODEL_SOURCE_MAX_BYTES)}`, new AbortController().signal, () => true, () => {}); } catch { rejected = true; } expect(rejected).to.equal(true); expect(requests).to.equal(0); }
  finally { element.remove(); window.fetch = original; }
});

it('rejects inherited MIME keys and falls back from descriptive names to source extensions', () => {
  for (const mime of ['__proto__', 'constructor', 'toString']) expect(resolveModelFormat('auto', 'Unknown', mime, '/attachment.bin')).to.equal(null);
  expect(resolveModelFormat('auto', 'Robot', '', '/robot.GLB?download=1')).to.equal('glb');
  expect(resolveModelFormat('auto', 'Robot.obj', '', '/robot.glb')).to.equal('obj');
});

it('rejects camera inputs that are not objects with finite own fields', () => {
  for (const value of [null, undefined, 42, 'camera', {}, { yaw: 0, pitch: 0, distance: 1 }]) expect(() => snapshotModelCamera(value)).to.throw(TypeError);
});
it('refuses a disallowed source URL before any request', async () => {
  const original = window.fetch; const element = document.createElement('div'); document.body.append(element); let requests = 0;
  window.fetch = async () => { requests++; return new Response(''); };
  try {
    let rejection: unknown; try { await readModelSource(element, 'java\tscript:alert(1)', new AbortController().signal, () => true, () => {}); } catch (error) { rejection = error; }
    expect(rejection instanceof TypeError).to.equal(true); expect(requests).to.equal(0);
  } finally { element.remove(); window.fetch = original; }
});
it('stops a body that streams past the ceiling even without a declared length', async () => {
  const original = window.fetch; const element = document.createElement('div'); document.body.append(element);
  const chunk = new Uint8Array(16 * 1024 * 1024); let sent = 0; let cancelled = 0;
  window.fetch = async () => new Response(new ReadableStream<Uint8Array>({ pull(stream) { sent++; stream.enqueue(chunk); }, cancel() { cancelled++; } }));
  try {
    let rejection: unknown; try { await readModelSource(element, '/endless.obj', new AbortController().signal, () => true, () => {}); } catch (error) { rejection = error; }
    expect(isResourceLimitError(rejection)).to.equal(true); expect(sent).to.be.at.most(6); expect(cancelled).to.be.at.most(1);
  } finally { element.remove(); window.fetch = original; }
});
it('reads a response without a body as an empty source', async () => {
  const original = window.fetch; const element = document.createElement('div'); document.body.append(element); const seen: Array<[number, number | null]> = [];
  window.fetch = async () => new Response(null, { status: 200 });
  try {
    const bytes = await readModelSource(element, '/empty.obj', new AbortController().signal, () => true, (loaded, total) => seen.push([loaded, total]));
    expect(bytes.byteLength).to.equal(0); expect(seen.at(-1)).to.deep.equal([0, 0]);
  } finally { element.remove(); window.fetch = original; }
});
