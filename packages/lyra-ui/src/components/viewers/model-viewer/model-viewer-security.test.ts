import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './model-viewer.js';
import type { LyraModelViewer } from './model-viewer.class.js';
import { modelEngineEnvironment, modelEngineLoader } from './model-viewer-loader.js';
import { MODEL_SOURCE_MAX_BYTES, resolveModelFormat } from './model-viewer-source.js';
import type { Engine3dHost } from '../../../internal/engine-3d-loader.js';

const originalFetch = window.fetch; const originalAvailable = modelEngineEnvironment.available;
let fetched: number; let imports: number; let admitted: number; let disposed: number; let signal: AbortSignal | undefined;
beforeEach(() => {
  fetched = imports = admitted = disposed = 0; signal = undefined; modelEngineEnvironment.available = () => true;
  window.fetch = async (_input, init) => { fetched++; signal = init?.signal ?? undefined; return new Response('v 0 0 0\n'); };
  modelEngineLoader.override(async () => { imports++; return { createEngine: () => {
    let host: Engine3dHost;
    return { contract: 1, async mount(_container: HTMLElement, value: Engine3dHost) { host = value; }, setData() { admitted++; queueMicrotask(() => host.progress?.(8, 8)); }, setStyle() {}, setCamera() {}, fit() { return { yaw: 0, pitch: 0, distance: 10, target: { x: 0, y: 0, z: 0 } }; }, resize() {}, dispose() { disposed++; } };
  } }; });
});
afterEach(() => { window.fetch = originalFetch; modelEngineEnvironment.available = originalAvailable; modelEngineLoader.override(undefined); });
const failed = async (viewer: LyraModelViewer) => waitUntil(() => viewer.shadowRoot!.querySelector('[part="error"]') !== null);

it('rejects executable sources before fetch or engine import and never renders a dangerous download', async () => {
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src="java\tscript:alert(1)" format="obj"></lr-model-viewer>`); await failed(viewer);
  expect(fetched).to.equal(0); expect(imports).to.equal(0); expect(viewer.shadowRoot!.querySelector('a') === null).to.equal(true);
});
it('rejects declared byte bombs before setData and retains a guarded author-controlled download', async () => {
  window.fetch = async () => { fetched++; return new Response('x', { headers: { 'content-length': String(MODEL_SOURCE_MAX_BYTES + 1) } }); };
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src="/large.obj" target="report" rel="opener nofollow" name="large.obj"></lr-model-viewer>`); await failed(viewer);
  expect(admitted).to.equal(0); const link = viewer.shadowRoot!.querySelector('a')!;
  expect(link.target).to.equal('report'); expect(link.rel).to.include('nofollow'); expect(link.rel).to.include('noopener'); expect(link.rel).to.include('noreferrer'); expect(link.rel.split(' ')).not.to.include('opener');
});
it('guards stale fetch completion and aborts immediately on a source property write', async () => {
  let finish!: (response: Response) => void;
  window.fetch = (_input, init) => { fetched++; signal = init?.signal ?? undefined; return new Promise(resolve => { finish = resolve; }); };
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src="/old.obj"></lr-model-viewer>`); await waitUntil(() => fetched === 1);
  viewer.src = ''; expect(signal?.aborted).to.equal(true); finish(new Response('v 0 0 0\n')); await viewer.updateComplete; await new Promise(resolve => setTimeout(resolve, 0));
  expect(admitted).to.equal(0); expect(viewer.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
});
it('disposes a late engine factory result after disconnect', async () => {
  let finish!: (value: unknown) => void; modelEngineLoader.override(() => new Promise(resolve => { finish = resolve; }));
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src="/late.obj"></lr-model-viewer>`); await waitUntil(() => Boolean(finish)); viewer.remove();
  finish({ createEngine: () => ({ contract: 1, async mount() {}, setData() {}, setStyle() {}, setCamera() {}, fit() { return { yaw: 0, pitch: 0, distance: 10, target: { x: 0, y: 0, z: 0 } }; }, resize() {}, dispose() { disposed++; } }) });
  await waitUntil(() => disposed === 1); expect(admitted).to.equal(0);
});
it('localizes parser failures without exposing raw diagnostics and allows retry', async () => {
  modelEngineLoader.override(async () => ({ createEngine: () => ({ contract: 1, async mount() {}, setData() { throw new Error('Secret diagnostic'); }, setStyle() {}, setCamera() {}, fit() { return { yaw: 0, pitch: 0, distance: 10, target: { x: 0, y: 0, z: 0 } }; }, resize() {}, dispose() { disposed++; } }) }));
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src="/bad.gltf" .strings=${{ modelViewerInvalid: 'The model was rejected' }}></lr-model-viewer>`); await failed(viewer);
  expect(viewer.shadowRoot!.textContent).to.contain('The model was rejected'); expect(viewer.shadowRoot!.textContent).not.to.contain('Secret diagnostic'); expect(disposed).to.equal(1);
  viewer.retry(); await waitUntil(() => disposed === 2);
});
it('recognizes exactly the seven supported extensions without claiming unknown attachments', () => {
  for (const format of ['gltf', 'glb', 'stl', 'obj', 'ply', 'xyz', 'pcd']) expect(resolveModelFormat('auto', `shape.${format.toUpperCase()}`, '', '')).to.equal(format);
  expect(resolveModelFormat('auto', 'report.bin', 'application/octet-stream', '/report.bin')).to.equal(null);
  expect(resolveModelFormat('obj', 'report.bin', '', '')).to.equal('obj');
});

it('rejects an oversized source string before URL resolution, fetch or download rendering', async () => {
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer .src=${'x'.repeat(MODEL_SOURCE_MAX_BYTES + 1)} format="obj"></lr-model-viewer>`); await failed(viewer);
  expect(fetched).to.equal(0); expect(imports).to.equal(0); expect(viewer.shadowRoot!.querySelector('a') === null).to.equal(true);
});
