import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './model-viewer-register.js';
import '../document-viewer/document-viewer.js';
import { adaptDocumentRenderer, createDocumentRendererAdapter, createDocumentRendererRegistry, findDocumentRenderer, loadDocumentRenderer, registerDocumentRenderer, snapshotLyraDocumentRendererPayload, type LyraDocumentRendererDefinition, type LyraModelDocumentRendererPayload } from '../document-viewer/registry.js';
import type { LyraDocumentViewer } from '../document-viewer/document-viewer.class.js';
import type { LyraModelViewer } from './model-viewer.class.js';
import { modelEngineEnvironment } from './model-viewer-loader.js';

const camera = () => ({ yaw: 0.2, pitch: 0.1, distance: 8, target: { x: 1, y: 2, z: 3 } });
const file = { name: 'shape.obj', mimeType: 'model/obj', src: '', alt: 'One triangular face' };
it('keeps inline legacy lazy render callbacks typed as document files', async () => {
  const legacy = { ...file, name: 'legacy.txt', mimeType: 'application/x-legacy-inference' };
  registerDocumentRenderer(legacy.mimeType, {
    load: () => Promise.resolve().then(() => ({ render: current => current.name })),
  });
  const definition = findDocumentRenderer(legacy)!;
  const resolved = await loadDocumentRenderer(definition);
  expect(adaptDocumentRenderer(resolved, legacy).render()).to.equal('legacy.txt');
});
it('routes seven model extensions lazily without claiming octet-stream or unrelated formats', async () => {
  const registry = createDocumentRendererRegistry();
  for (const format of ['gltf', 'glb', 'stl', 'obj', 'ply', 'xyz', 'pcd']) {
    const document = { ...file, name: `shape.${format.toUpperCase()}`, mimeType: 'application/octet-stream' };
    const matched = findDocumentRenderer(document, registry); expect(matched?.load).to.be.a('function');
    const resolved = await loadDocumentRenderer(matched!); const adapted = adaptDocumentRenderer(resolved, document);
    expect(adapted.payload.kind).to.equal('model'); expect(adapted.capabilities).to.deep.equal({ anchors: [], search: false, textSelect: false });
  }
  for (const mimeType of ['__proto__', 'constructor']) expect(findDocumentRenderer({ ...file, name: 'report.bin', mimeType }, registry)).to.equal(undefined);
  expect(findDocumentRenderer({ ...file, name: 'report.bin', mimeType: 'application/octet-stream' }, registry)).to.equal(undefined);
  expect(findDocumentRenderer({ ...file, name: 'document.pdf', mimeType: 'application/x-unregistered' }, registry)?.load).not.to.equal(findDocumentRenderer(file, registry)?.load);
});
it('copies model payload camera/format and rejects unknown formats or nonfinite fields atomically', () => {
  const source: LyraModelDocumentRendererPayload = { kind: 'model', file, format: 'obj', camera: camera() };
  const snapshot = snapshotLyraDocumentRendererPayload(source) as LyraModelDocumentRendererPayload;
  (source.camera!.target as { x: number }).x = 99; expect(snapshot.camera!.target.x).to.equal(1); expect(Object.isFrozen(snapshot.camera!.target)).to.equal(true);
  expect(() => snapshotLyraDocumentRendererPayload({ ...source, format: 'fbx' } as unknown as LyraModelDocumentRendererPayload)).to.throw(TypeError);
  expect(() => snapshotLyraDocumentRendererPayload({ ...source, camera: { ...camera(), distance: Infinity } })).to.throw(TypeError);
});
it('passes the exact typed payload through lazy model adaptation in document-viewer', async () => {
  const available = modelEngineEnvironment.available; modelEngineEnvironment.available = () => false;
  try {
    const payload: LyraModelDocumentRendererPayload = { kind: 'model', file, format: 'obj', camera: camera() };
    const viewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer open .payload=${payload}></lr-document-viewer>`);
    const definition = findDocumentRenderer(file, viewer.registry ?? createDocumentRendererRegistry())!; await loadDocumentRenderer(definition); await waitUntil(() => Boolean(viewer.shadowRoot!.querySelector('lr-model-viewer'))); await viewer.updateComplete;
    const model = viewer.shadowRoot!.querySelector('lr-model-viewer') as LyraModelViewer;
    expect(Boolean(model)).to.equal(true); expect(model.alt).to.equal(file.alt); expect(model.format).to.equal('obj'); expect(model.camera).to.deep.equal(camera());
  } finally { modelEngineEnvironment.available = available; }
});
it('opens a legacy scalar model attachment in place', async () => {
  const available = modelEngineEnvironment.available; modelEngineEnvironment.available = () => false;
  try {
    const viewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer open name="shape.obj" mime-type="model/obj" src="data:text/plain,v%200%200%200" alt="One face"></lr-document-viewer>`);
    await waitUntil(() => Boolean(viewer.shadowRoot!.querySelector('lr-model-viewer')), 'the model renderer did not open', { timeout: 10000 });
    const model = viewer.shadowRoot!.querySelector('lr-model-viewer') as LyraModelViewer;
    expect([model.name, model.mimeType, model.alt, model.format, model.getAttribute('src')]).to.deep.equal(['shape.obj', 'model/obj', 'One face', 'auto', 'data:text/plain,v%200%200%200']);
    expect(model.camera).to.equal(undefined);
  } finally { modelEngineEnvironment.available = available; }
});
it('allows only payload-derived capabilities for lazy adapters and keeps conflicting legacy definitions rejected', async () => {
  const adapter = createDocumentRendererAdapter({ kind: 'model', adapt: current => ({ kind: 'model', file: current }), capabilities: () => ({ search: false }), render: payload => payload.file.name });
  const valid = { rendererKind: 'adapted' as const, load: async () => ({ adapter }) }; const resolved = await loadDocumentRenderer(valid);
  expect(adaptDocumentRenderer(resolved, file).capabilities?.search).to.equal(false);
  let failed = false;
  try { await loadDocumentRenderer({ ...valid, capabilities: { search: true } } as unknown as LyraDocumentRendererDefinition); } catch { failed = true; }
  expect(failed).to.equal(true);
  let wrongDirectKind = false;
  try { await loadDocumentRenderer({ load: async () => ({ adapter }) } as unknown as LyraDocumentRendererDefinition); } catch { wrongDirectKind = true; }
  expect(wrongDirectKind).to.equal(true);
  let wrongAdaptedKind = false;
  try { await loadDocumentRenderer({ rendererKind: 'adapted', load: async () => ({ render: () => null }) } as unknown as LyraDocumentRendererDefinition); } catch { wrongAdaptedKind = true; }
  expect(wrongAdaptedKind).to.equal(true);
  let kindReads = 0;
  const changingKind = {
    capabilities: { search: true },
    load: async () => ({ adapter }),
    get rendererKind() { kindReads++; return kindReads > 2 ? 'adapted' : undefined; },
  } as unknown as LyraDocumentRendererDefinition;
  expect(() => loadDocumentRenderer(changingKind)).to.throw(TypeError);
  expect(kindReads).to.equal(0);
});

it('rejects a rendererKind on anything but a lazy payload adapter before registering it', () => {
  const adapter = createDocumentRendererAdapter({ kind: 'model', adapt: current => ({ kind: 'model', file: current }), capabilities: () => undefined, render: payload => payload.file.name });
  const invalid: unknown[] = [
    { render: () => 'x', rendererKind: 'adapted' },
    { adapter, rendererKind: 'adapted' },
    { load: async () => ({ adapter }), rendererKind: 'direct' },
  ];
  for (const [index, definition] of invalid.entries()) {
    expect(() => registerDocumentRenderer(`application/x-invalid-kind-${index}`, definition as LyraDocumentRendererDefinition)).to.throw(TypeError);
    expect(findDocumentRenderer({ ...file, mimeType: `application/x-invalid-kind-${index}`, name: 'shape.bin' }, createDocumentRendererRegistry())).to.equal(undefined);
  }
});
