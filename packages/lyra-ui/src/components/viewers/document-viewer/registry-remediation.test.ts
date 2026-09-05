import { expect, fixture, html } from '@open-wc/testing';
import './document-viewer.js';
import { createDocumentRendererRegistry, findDocumentRenderer, type DocumentFile, type DocumentRendererDefinition } from './registry.js';
import type { LyraDocumentViewer } from './document-viewer.js';
import { AudioVideoPayload, RegisteredRenderer } from './document-viewer.stories.js';

it('renders the existing public factory registry story', async () => {
  const render = RegisteredRenderer.render!;
  const element = await fixture<LyraDocumentViewer>(render({}, { viewMode: 'story' } as Parameters<typeof render>[1]));
  await element.updateComplete;
  expect(element.shadowRoot!.textContent).to.include('Custom registered renderer for');
  expect(element.shadowRoot!.querySelector('strong')?.textContent).to.equal('demo.lyra');
});

for (const route of ['scalar', 'payload'] as const) {
  it(`accepts the public immutable registry factory through ${route} file binding`, async () => {
    const file: DocumentFile = { name: 'Factory.xml', mimeType: ' APPLICATION/X-FACTORY ; charset=UTF-8 ', src: 'https://example.test/factory', alt: 'Factory details' };
    const received: DocumentFile[] = [];
    const render = (value: DocumentFile) => { received.push(value); return html`<p data-factory>Factory renderer</p>`; };
    const definition = { render, capabilities: { anchors: ['node-path'] } } as DocumentRendererDefinition;
    const registry = createDocumentRendererRegistry([['application/x-factory', definition]]);
    const element = await fixture<LyraDocumentViewer>(html`<lr-document-viewer open
      .registry=${registry} .name=${file.name} .mimeType=${file.mimeType} .src=${file.src} .alt=${file.alt}
      .payload=${route === 'payload' ? { kind: 'document', file } : undefined}
    ></lr-document-viewer>`);
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[data-factory]')?.textContent).to.equal('Factory renderer');
    expect(received.length).to.equal(1);
    expect(received[0]?.name).to.equal(file.name);
    expect(received[0]?.mimeType).to.equal(file.mimeType);
    expect(received[0]?.src).to.equal(file.src);
    expect(received[0]?.alt).to.equal(file.alt);
    expect(element.registry === registry).to.be.false;
    expect(Object.isFrozen(element.registry)).to.be.true;
    expect('set' in element.registry!).to.be.false;
    expect(element.registry!.get('application/x-factory')?.render === render).to.be.true;
    expect(Object.isFrozen(element.registry!.get('application/x-factory'))).to.be.true;
    expect([...element.registry!.keys()]).to.include('application/x-factory');
    expect([...element.registry!].some(([key]) => key === 'application/x-factory')).to.be.true;
    expect(findDocumentRenderer(file, element.registry)?.render === render).to.be.true;
  });
}

it('keeps a factory snapshot functional after source-definition edits and repeated bindings', async () => {
  const render = () => html`<p data-original>Original</p>`;
  const definition = { render, capabilities: { anchors: ['node-path'] as Array<'node-path'> } };
  const source = createDocumentRendererRegistry([['application/x-factory', definition]]);
  definition.render = () => html`<p data-changed>Changed</p>`;
  definition.capabilities.anchors.length = 0;
  const element = await fixture<LyraDocumentViewer>(html`<lr-document-viewer open mime-type="application/x-factory" .registry=${source}></lr-document-viewer>`);
  expect(element.shadowRoot!.querySelector('[data-original]')?.textContent).to.equal('Original');
  const retained = element.registry;
  element.registry = source;
  await element.updateComplete;
  expect(element.registry === retained).to.be.true;
  element.registry = retained;
  await element.updateComplete;
  expect(element.registry === retained).to.be.true;
  expect(element.registry!.get('application/x-factory')?.capabilities?.anchors).to.deep.equal(['node-path']);
});

it('preserves native Map snapshot safety, mutation isolation and replacement', async () => {
  let reads = 0;
  const source = new Map<string, DocumentRendererDefinition>([['application/x-native', { render: () => html`<p data-native>Native</p>` }]]);
  Object.defineProperty(source, Symbol.iterator, { get() { reads++; throw new Error('custom iterator must not execute'); } });
  Object.defineProperty(source, 'entries', { get() { reads++; throw new Error('custom entries must not execute'); } });
  const element = await fixture<LyraDocumentViewer>(html`<lr-document-viewer open mime-type="application/x-native" .registry=${source}></lr-document-viewer>`);
  expect(reads).to.equal(0);
  expect(element.shadowRoot!.querySelector('[data-native]')?.textContent).to.equal('Native');
  const retained = element.registry;
  source.clear();
  element.registry = source;
  await element.updateComplete;
  expect(element.registry === retained).to.be.true;
  expect(element.registry!.has('application/x-native')).to.be.true;
  element.registry = new Map([['application/x-native', { render: () => html`<p data-replaced>Replacement</p>` }]]);
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[data-replaced]')?.textContent).to.equal('Replacement');
  expect(element.registry === retained).to.be.false;
});

it('does not execute unrecognized readonly-map getters or iterators', async () => {
  let reads = 0;
  class Unrecognized {
    get() { reads++; throw new Error('unrecognized get'); }
    values() { reads++; throw new Error('unrecognized values'); }
    [Symbol.iterator]() { reads++; throw new Error('unrecognized iterator'); }
  }
  const element = await fixture<LyraDocumentViewer>(html`<lr-document-viewer></lr-document-viewer>`);
  element.registry = new Unrecognized() as unknown as ReadonlyMap<string, DocumentRendererDefinition>;
  await element.updateComplete;
  expect(reads).to.equal(0);
  expect(Array.isArray(element.registry)).to.be.true;
  expect((element.registry as unknown as unknown[]).length).to.equal(0);
  expect(Object.isFrozen(element.registry)).to.be.true;
});

it('preserves explicit undefined and replacement after a factory override', async () => {
  const registry = createDocumentRendererRegistry([['application/x-factory', { render: () => html`<p>Factory</p>` }]]);
  const element = await fixture<LyraDocumentViewer>(html`<lr-document-viewer .registry=${registry}></lr-document-viewer>`);
  expect(element.registry?.has('application/x-factory')).to.be.true;
  element.registry = undefined;
  await element.updateComplete;
  expect(element.registry).to.equal(undefined);
  element.registry = registry;
  await element.updateComplete;
  expect(element.registry?.has('application/x-factory')).to.be.true;
});

it('applies the same entry and record budgets to factory and native Map sources', async () => {
  const render = () => html`<p>Bounded</p>`;
  const source = createDocumentRendererRegistry(Array.from({ length: 10_010 }, (_, index) => [`application/x-bounded-${index}`, { render }] as const));
  const native = new Map(source);
  const factoryViewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer .registry=${source}></lr-document-viewer>`);
  const nativeViewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer .registry=${native}></lr-document-viewer>`);
  expect(factoryViewer.registry?.size).to.equal(nativeViewer.registry?.size);
  expect(factoryViewer.registry!.size).to.be.greaterThan(0);
  expect(factoryViewer.registry!.size).to.be.at.most(10_000);
  expect([...factoryViewer.registry!.keys()]).to.deep.equal([...nativeViewer.registry!.keys()]);
  expect(Object.getOwnPropertyNames(source)).to.deep.equal([]);
});

it('does not execute native Map definition accessors at assignment', async () => {
  let reads = 0;
  const definition = Object.defineProperty({}, 'render', { enumerable: true, get() { reads++; throw new Error('unsafe definition getter'); } });
  const source = new Map([['application/x-accessor', definition]]) as unknown as ReadonlyMap<string, DocumentRendererDefinition>;
  const element = await fixture<LyraDocumentViewer>(html`<lr-document-viewer .registry=${source}></lr-document-viewer>`);
  expect(reads).to.equal(0);
  expect(Object.keys(element.registry!.get('application/x-accessor')!)).to.deep.equal([]);
  expect(Object.isFrozen(element.registry!.get('application/x-accessor'))).to.be.true;
});

it('retains both transcript cues from the existing document-viewer AV payload story', async () => {
  const render = AudioVideoPayload.render!;
  const element = await fixture<LyraDocumentViewer>(render({}, { viewMode: 'docs' } as Parameters<typeof render>[1]));
  const payload = element.payload;
  expect(payload?.kind).to.equal('av');
  if (payload?.kind !== 'av') throw new Error('Expected the AV story payload');
  expect(payload.cues?.map(cue => cue.cueId)).to.deep.equal(['intro', 'topic']);
  expect(payload.cues?.map(cue => cue.text)).to.deep.equal([
    'Welcome to the searchable transcript.',
    'Renderer capabilities follow retained cue data.',
  ]);
});
