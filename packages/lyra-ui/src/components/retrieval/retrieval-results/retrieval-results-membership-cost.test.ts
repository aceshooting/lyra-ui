import { measureArrayMembership } from '../../../../test/array-membership-cost.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import './retrieval-results.js';
import type { LyraRetrievalResults } from './retrieval-results.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import type { LyraCheckbox } from '../../forms/checkbox/checkbox.class.js';

const chunks = Array.from({ length: 100 }, (_, index) => ({
  id: `membership-${index}`, text: `Text ${index}`, score: 0.5,
  source: { id: `source-${index}`, name: `Source ${index}` },
}));

it('shares selection membership work across flat result rows', async () => {
  const results = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results
    virtualize-at="200" .chunks=${chunks}
  ></lr-retrieval-results>`);
  results.selectedChunkIds = chunks.map((chunk) => chunk.id).reverse();
  await results.updateComplete;
  const comparisons = measureArrayMembership('membership-', () => results.render()).comparisons;
  await results.updateComplete;
  expect(results.shadowRoot!.querySelectorAll('[data-selected]').length).to.equal(100);
  expect(comparisons).to.be.at.most(200);
});

it('refreshes virtual selection after replacement without rebuilding item identities', async () => {
  const results = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results
    virtualize-at="1" .chunks=${chunks} .selectedChunkIds=${['membership-0']}
  ></lr-retrieval-results>`);
  const list = results.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
  await list.updateComplete;
  const items = list.items;
  const keyFunction = list.keyFunction;
  const selected = (id: string) => list.shadowRoot!
    .querySelector<LyraCheckbox>(`[part="select"][data-chunk-id="${id}"]`)?.checked;
  await waitUntil(() => selected('membership-0') === true);
  results.selectedChunkIds = ['membership-99', 'membership-99', 'membership-unknown'];
  await results.updateComplete;
  await list.updateComplete;
  expect(selected('membership-0')).to.equal(false);
  expect(list.items === items).to.equal(true);
  expect(list.keyFunction === keyFunction).to.equal(true);
  list.scrollToIndex(99, { align: 'start', behavior: 'auto' });
  await twoFrames();
  await waitUntil(() => selected('membership-99') === true);
  results.selectedChunkIds = [];
  await results.updateComplete;
  await list.updateComplete;
  expect(selected('membership-99')).to.equal(false);
});

it('preserves owned selection snapshots and the single-row early-match path', async () => {
  const selected = ['membership-0', ...Array.from({ length: 999 }, (_, index) => `membership-unused-${index}`)];
  const results = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results
    .chunks=${chunks.slice(0, 1)}
  ></lr-retrieval-results>`);
  results.selectedChunkIds = selected;
  const NativeSet = globalThis.Set;
  const canonical = results.selectedChunkIds;
  let indexedSelection = 0;
  globalThis.Set = class extends NativeSet {
    constructor(values?: Iterable<unknown> | null) {
      if (values === canonical) indexedSelection++;
      super(values == null ? undefined : Array.from(values));
    }
  } as SetConstructor;
  try { results.render(); } finally { globalThis.Set = NativeSet; }
  expect(indexedSelection).to.equal(0);
  await results.updateComplete;
  selected.splice(0, 1);
  results.requestUpdate();
  await results.updateComplete;
  expect(results.shadowRoot!.querySelectorAll('[data-selected]').length).to.equal(1);
  results.selectedChunkIds = [...selected];
  await results.updateComplete;
  expect(results.shadowRoot!.querySelectorAll('[data-selected]').length).to.equal(0);
});

it('releases selection indexes when empty or error views no longer render their rows', async () => {
  const results = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results
    virtualize-at="200" .chunks=${chunks} .selectedChunkIds=${chunks.map((chunk) => chunk.id)}
  ></lr-retrieval-results>`);
  const state = results as unknown as { selectedMembership?: { source: readonly string[]; ids: ReadonlySet<string> } };
  const original = state.selectedMembership;
  expect(original !== undefined).to.equal(true);
  results.label = 'Updated results';
  await results.updateComplete;
  expect(state.selectedMembership === original).to.equal(true);
  results.errorText = 'Results unavailable';
  results.selectedChunkIds = ['membership-99'];
  await results.updateComplete;
  expect(results.shadowRoot!.querySelectorAll('[data-selected]').length).to.equal(0);
  expect(state.selectedMembership === undefined).to.equal(true);
  results.errorText = '';
  await results.updateComplete;
  expect(state.selectedMembership?.source === results.selectedChunkIds).to.equal(true);
  results.chunks = [];
  results.loading = true;
  await results.updateComplete;
  expect(state.selectedMembership === undefined).to.equal(true);
});
