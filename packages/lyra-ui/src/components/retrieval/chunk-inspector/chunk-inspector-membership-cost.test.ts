import { measureArrayMembership } from '../../../../test/array-membership-cost.js';
import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import './chunk-inspector.js';
import type { LyraChunkInspector } from './chunk-inspector.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';

const chunks = Array.from({ length: 100 }, (_, index) => ({
  id: `membership-${index}`, text: `Text ${index}`, title: `Title ${index}`, score: 0.5, sourceId: 'source',
}));

it('shares expansion membership work across standalone flat chunks', async () => {
  const inspector = await fixture<LyraChunkInspector>(html`<lr-chunk-inspector
    virtualize-at="200" .chunks=${chunks}
  ></lr-chunk-inspector>`);
  inspector.expandedChunkIds = [
    ...Array.from({ length: 900 }, (_, index) => `membership-unknown-${index}`),
    ...chunks.map((chunk) => chunk.id).reverse(),
  ];
  const comparisons = measureArrayMembership('membership-', () => inspector.render()).comparisons;
  await inspector.updateComplete;
  expect(inspector.shadowRoot!.querySelectorAll('[part="toggle"][aria-expanded="true"]').length).to.equal(100);
  expect(comparisons).to.be.at.most(2000);
});

it('keeps expansion fresh for virtual callbacks after scrolling and replacement', async () => {
  const inspector = await fixture<LyraChunkInspector>(html`<lr-chunk-inspector
    virtualize-at="1" .chunks=${chunks} .expandedChunkIds=${['membership-0']}
  ></lr-chunk-inspector>`);
  const list = inspector.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
  await list.updateComplete;
  const items = list.items;
  const expanded = (title: string) => [...list.shadowRoot!.querySelectorAll('[part="chunk"]')]
    .find((row) => row.querySelector('[part="title"]')?.textContent === title)
    ?.querySelector('[part="toggle"]')?.getAttribute('aria-expanded');
  await waitUntil(() => expanded('Title 0') === 'true');
  inspector.expandedChunkIds = ['membership-99', 'membership-unknown'];
  await inspector.updateComplete;
  await list.updateComplete;
  expect(expanded('Title 0')).to.equal('false');
  expect(list.items === items).to.equal(true);
  list.scrollToIndex(99, { align: 'start', behavior: 'auto' });
  await twoFrames();
  await waitUntil(() => expanded('Title 99') === 'true');
  const row = [...list.shadowRoot!.querySelectorAll('[part="chunk"]')]
    .find((candidate) => candidate.querySelector('[part="title"]')?.textContent === 'Title 99')!;
  const toggled = oneEvent(inspector, 'lr-toggle');
  row.querySelector<HTMLButtonElement>('[part="toggle"]')!.click();
  expect((await toggled).detail).to.deep.equal({ itemId: 'membership-99', expanded: false });
  expect(inspector.expandedChunkIds).to.deep.equal(['membership-unknown']);
});

it('avoids indexing a full expansion list for an embedded single chunk', async () => {
  const expanded = ['membership-0', ...Array.from({ length: 999 }, (_, index) => `membership-unused-${index}`)];
  const inspector = await fixture<LyraChunkInspector>(html`<lr-chunk-inspector
    .chunks=${chunks.slice(0, 1)} .ordinalIndex=${1} .ordinalTotal=${100}
  ></lr-chunk-inspector>`);
  inspector.expandedChunkIds = expanded;
  const canonical = inspector.expandedChunkIds;
  const NativeSet = globalThis.Set;
  let indexedExpansion = 0;
  globalThis.Set = class extends NativeSet {
    constructor(values?: Iterable<unknown> | null) {
      if (values === canonical) indexedExpansion++;
      super(values == null ? undefined : Array.from(values));
    }
  } as SetConstructor;
  try { inspector.render(); } finally { globalThis.Set = NativeSet; }
  expect(indexedExpansion).to.equal(0);
  await inspector.updateComplete;
  expanded.splice(0, 1);
  inspector.requestUpdate();
  await inspector.updateComplete;
  expect(inspector.shadowRoot!.querySelector('[part="toggle"]')?.getAttribute('aria-expanded')).to.equal('true');
  inspector.expandedChunkIds = [...expanded];
  await inspector.updateComplete;
  expect(inspector.shadowRoot!.querySelector('[part="toggle"]')?.getAttribute('aria-expanded')).to.equal('false');
});

it('releases expansion indexes when an empty catalog no longer renders chunks', async () => {
  const inspector = await fixture<LyraChunkInspector>(html`<lr-chunk-inspector
    virtualize-at="200" .chunks=${chunks} .expandedChunkIds=${chunks.map((chunk) => chunk.id)}
  ></lr-chunk-inspector>`);
  const state = inspector as unknown as { expandedMembership?: { source: readonly string[]; ids: ReadonlySet<string> } };
  const original = state.expandedMembership;
  expect(original !== undefined).to.equal(true);
  inspector.label = 'Updated chunks';
  await inspector.updateComplete;
  expect(state.expandedMembership === original).to.equal(true);
  inspector.chunks = [];
  await inspector.updateComplete;
  expect(inspector.shadowRoot!.querySelectorAll('[part="chunk"]').length).to.equal(0);
  expect(state.expandedMembership === undefined).to.equal(true);
  inspector.chunks = chunks;
  inspector.expandedChunkIds = ['membership-99'];
  await inspector.updateComplete;
  expect(state.expandedMembership?.source === inspector.expandedChunkIds).to.equal(true);
  inspector.chunks = chunks.slice(0, 1);
  await inspector.updateComplete;
  expect(state.expandedMembership === undefined).to.equal(true);
});
