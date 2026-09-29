import { expect, fixture, html } from '@open-wc/testing';
import './document-viewer.js';
import {
  adaptDocumentRenderer,
  createDocumentRendererAdapter,
  createDocumentRendererRegistry,
  type DocumentFile,
  type DocumentRendererDefinition,
  type DocumentRendererRegistry,
  type LyraDocumentRendererAdapter,
  type LyraDocumentRendererPayload,
  type LyraResolvedDocumentRendererDefinition,
} from './registry.js';
import type { LyraDocumentViewer } from './document-viewer.js';

const FILE: DocumentFile = { name: 'Supported file', mimeType: 'application/x-adapter', src: '' };

function documentAdapter(): LyraDocumentRendererAdapter {
  return createDocumentRendererAdapter({
    kind: 'document',
    adapt: (file, supplied) => supplied?.kind === 'document' ? supplied : { kind: 'document', file },
    capabilities: () => ({ search: true, anchors: ['node-path'] }),
    render: payload => html`<p data-adapter>Document: ${payload.file.name}</p>`,
  });
}

function resolvedDefinition(registry: DocumentRendererRegistry): LyraResolvedDocumentRendererDefinition {
  const definition = registry.get(FILE.mimeType);
  if (!definition || definition.load) throw new Error('Expected a retained direct adapter definition');
  return definition;
}

for (const route of ['factory', 'native-map'] as const) {
  for (const kind of ['document', 'av'] as const) {
    it(`renders a ${kind} payload adapter assigned through a ${route} registry and preserves usable readback`, async () => {
      const adapter = kind === 'document' ? documentAdapter() : createDocumentRendererAdapter({
        kind: 'av',
        adapt: (file, supplied) => supplied?.kind === 'av' ? supplied : { kind: 'av', file, cues: [], tracks: [] },
        capabilities: payload => ({ search: payload.cues.length > 0, anchors: ['time-range'] }),
        render: payload => html`<p data-adapter>AV: ${payload.file.name}; ${payload.cues[0]?.text}; ${payload.tracks.length}</p>`,
      });
      const supplied: LyraDocumentRendererPayload = kind === 'document'
        ? { kind: 'document', file: FILE }
        : { kind: 'av', file: FILE, cues: [{ cueId: 'opening', start: 0, end: 1, text: 'Retained cue' }], tracks: [] };
      const sourceDefinition = { adapter };
      const sourceMap = new Map([[FILE.mimeType, sourceDefinition]]);
      const registry = route === 'factory' ? createDocumentRendererRegistry(sourceMap) : sourceMap;
      const viewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer open .registry=${registry} .payload=${supplied}></lr-document-viewer>`);
      await viewer.updateComplete;
      const expected = kind === 'document' ? 'Document: Supported file' : 'AV: Supported file; Retained cue; 0';
      expect(viewer.shadowRoot!.querySelector('[data-adapter]')?.textContent ?? '').to.equal(expected);
      const readback = viewer.registry!;
      const retained = resolvedDefinition(readback);
      const snapshot = retained.adapter;
      if (!snapshot) throw new Error('Expected the retained adapter object');
      expect(snapshot === adapter).to.equal(false);
      expect(Object.isFrozen(snapshot)).to.equal(true);
      expect(snapshot.kind).to.equal(kind);
      expect(snapshot.adapt === adapter.adapt).to.equal(true);
      expect(snapshot.capabilities === adapter.capabilities).to.equal(true);
      expect(snapshot.render === adapter.render).to.equal(true);
      const directPayload = snapshot.adapt(FILE, supplied);
      expect(directPayload.kind).to.equal(kind);
      expect(Object.isFrozen(directPayload)).to.equal(true);
      expect(snapshot.capabilities(directPayload)?.search).to.equal(true);
      expect(adaptDocumentRenderer(retained, FILE, supplied).capabilities?.anchors).to.deep.equal(
        kind === 'document' ? ['node-path'] : ['time-range'],
      );
      sourceMap.clear();
      sourceDefinition.adapter = documentAdapter();
      expect(readback.get(FILE.mimeType)?.adapter?.adapt === adapter.adapt).to.equal(true);
      expect('set' in readback).to.equal(false);
      expect(Object.isFrozen(readback)).to.equal(true);
      for (const reinjected of [createDocumentRendererRegistry(readback), new Map(readback)]) {
        viewer.registry = reinjected;
        await viewer.updateComplete;
        expect(viewer.shadowRoot!.querySelector('[data-adapter]')?.textContent ?? '').to.equal(expected);
      }
    });
  }
}

it('renders a document adapter without an explicit payload through the native file property route', async () => {
  const viewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer open
    .name=${FILE.name} .mimeType=${FILE.mimeType} .src=${FILE.src}
    .registry=${new Map([[FILE.mimeType, { adapter: documentAdapter() }]])}
  ></lr-document-viewer>`);
  expect(viewer.shadowRoot!.querySelector('[data-adapter]')?.textContent ?? '').to.equal('Document: Supported file');
});

for (const field of ['kind', 'adapt', 'capabilities', 'render'] as const) {
  it(`rejects a modified factory ${field} tuple even when it retains the original private brand`, async () => {
    const original = documentAdapter();
    const modified = { ...original, [field]: field === 'kind' ? 'av' : () => undefined };
    expect(() => createDocumentRendererRegistry([[FILE.mimeType, { adapter: modified } as DocumentRendererDefinition]])).to.throw(TypeError);
    const viewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer
      .registry=${new Map([[FILE.mimeType, { adapter: modified }]])}
    ></lr-document-viewer>`);
    expect(() => adaptDocumentRenderer(resolvedDefinition(viewer.registry!), FILE)).to.throw(TypeError);
  });

  it(`does not execute an adapter ${field} getter during direct validation or native registry assignment`, async () => {
    let reads = 0;
    const modified = { ...documentAdapter() };
    Object.defineProperty(modified, field, { enumerable: true, get() { reads++; throw new Error('Unexpected adapter getter'); } });
    expect(() => createDocumentRendererRegistry([[FILE.mimeType, { adapter: modified }]])).to.throw(TypeError);
    const viewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer
      .registry=${new Map([[FILE.mimeType, { adapter: modified }]])}
    ></lr-document-viewer>`);
    expect(() => adaptDocumentRenderer(resolvedDefinition(viewer.registry!), FILE)).to.throw(TypeError);
    expect(reads).to.equal(0);
  });
}

it('does not recognize a callback tuple assembled from different factory adapters', () => {
  const original = documentAdapter();
  const alternate = documentAdapter();
  const mixed = { ...original, capabilities: alternate.capabilities };
  expect(() => createDocumentRendererRegistry([[FILE.mimeType, { adapter: mixed }]])).to.throw(TypeError);
});

it('does not retain custom objects alongside an adapter', async () => {
  let reads = 0;
  const privateValue = Symbol('consumer-extension');
  class Unsupported { value = 'custom'; }
  const definition = {
    adapter: documentAdapter(),
    [privateValue]: new Unsupported(),
    unsupported: new Unsupported(),
  };
  Object.defineProperty(definition, 'readable', { enumerable: true, get() { reads++; throw new Error('Unexpected extension getter'); } });
  const viewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer .registry=${new Map([[FILE.mimeType, definition]])}></lr-document-viewer>`);
  const retained = viewer.registry!.get(FILE.mimeType)!;
  // Unsupported custom records fail closed at the containing definition boundary.
  expect(viewer.registry!.size).to.equal(0);
  expect(retained === undefined).to.equal(true);
  expect(reads).to.equal(0);
});

it('omits arbitrary symbols and getters while keeping the supported adapter usable', async () => {
  let reads = 0;
  const extension = Symbol('consumer-extension');
  const definition = { adapter: documentAdapter(), [extension]: { mutable: true } };
  Object.defineProperty(definition, 'readable', { enumerable: true, get() { reads++; throw new Error('Unexpected extension getter'); } });
  const viewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer .registry=${new Map([[FILE.mimeType, definition]])}></lr-document-viewer>`);
  const retained = resolvedDefinition(viewer.registry!);
  expect(Object.getOwnPropertySymbols(retained).length).to.equal(0);
  expect(Object.hasOwn(retained, 'readable')).to.equal(false);
  expect(adaptDocumentRenderer(retained, FILE).capabilities?.search).to.equal(true);
  expect(reads).to.equal(0);
});
