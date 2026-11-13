import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraRetrievalResults, RetrievalResultsSource } from './retrieval-results.class.js';
import type { RetrievalChunk } from '../../../ai/types.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import type { LyraSourceGroup } from '../../../data-sources.js';
import './retrieval-results.js';

const chunk = (): RetrievalChunk => ({ id: 'c0', text: 'Relevant passage', score: 0.8, source: { id: 's', name: 'Source' } });
async function ready(viewer: LyraRetrievalResults): Promise<LyraVirtualList> {
  await waitUntil(() => viewer.sourceTotal === 1 && Boolean(viewer.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')?.items.length));
  const list = viewer.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
  await list.updateComplete;
  expect((list.items[0] as RetrievalChunk).id).to.equal('c0');
  expect(viewer.shadowRoot!.querySelectorAll('[part="source-retry"]').length).to.equal(0);
  return list;
}
async function rejectedChunk(value: unknown): Promise<void> {
  let invalid = true;
  const provider: RetrievalResultsSource = { revision: 1,
    query: async () => ({ total: 1, rows: [{ key: 'c0', order: 0, value: (invalid ? value : chunk()) as RetrievalChunk }] }),
    lookup: async () => [], locate: async () => null };
  const viewer = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results grouping="none" .dataSource=${provider}></lr-retrieval-results>`);
  await waitUntil(() => Boolean(viewer.shadowRoot!.querySelector('[part="source-retry"]')));
  expect(viewer.sourceTotal).to.equal(null);
  expect(viewer.shadowRoot!.querySelectorAll('lr-virtual-list').length).to.equal(0);
  invalid = false;
  viewer.shadowRoot!.querySelector<HTMLElement>('[part="source-retry"]')!.click();
  await ready(viewer);
  expect(viewer.chunks.length).to.equal(0);
}

for (const [name, value] of [
  ['null chunk', null], ['array chunk', []], ['primitive chunk', 4],
  ['null source', { ...chunk(), source: null }], ['array source', { ...chunk(), source: [] }],
  ['primitive source', { ...chunk(), source: 'source' }],
  ['null locator', { ...chunk(), locator: null }],
  ['array locator', { ...chunk(), locator: [] }],
  ['non-array path', { ...chunk(), locator: { kind: 'node-path', path: 'root' } }],
  ['oversized path', { ...chunk(), locator: { kind: 'node-path', path: Array.from({ length: 501 }, () => 0) } }],
  ['sparse path', { ...chunk(), locator: { kind: 'node-path', path: new Array(1) } }],
  ['non-scalar path item', { ...chunk(), locator: { kind: 'node-path', path: [true] } }],
  ['oversized path text', { ...chunk(), locator: { kind: 'node-path', path: ['x'.repeat(65_536)] } }],
  ['incomplete rectangle', { ...chunk(), locator: { kind: 'pdf', page: 1, rect: { x: 0, y: 0, width: 1 } } }],
  ['nonfinite rectangle', { ...chunk(), locator: { kind: 'pdf', page: 1, rect: { x: 0, y: 0, width: Infinity, height: 1 } } }],
  ['invalid canonical identity', { ...chunk(), id: 'other' }],
  ['non-numeric chunk score', { ...chunk(), score: '0.8' }],
] as const) {
  it(`rejects a provider result with ${name} and recovers from its retry`, async () => {
    await rejectedChunk(value);
  });
}

for (const field of ['page', 'start', 'end'] as const) {
  for (const value of [Infinity, '1']) {
    it(`rejects a ${typeof value} invalid locator ${field} without retaining a partial result`, async () => {
      await rejectedChunk({ ...chunk(), locator: { kind: 'text-range', [field]: value } });
    });
  }
}

const group = (key: string, startIndex: number, itemCount: number): LyraSourceGroup => ({ key, label: key, startIndex, itemCount });
for (const [name, groups] of [
  ['overlapping groups', [group('first', 0, 2), group('second', 1, 2)]],
  ['gapped groups', [group('first', 0, 1), group('second', 2, 1)]],
  ['incomplete groups', [group('first', 0, 2)]],
] as const) {
  it(`rejects ${name} without assigning rows to a false global partition`, async () => {
    let invalid = true;
    const provider: RetrievalResultsSource = { revision: 1,
      query: async () => ({ total: 3,
        rows: Array.from({ length: 3 }, (_, index) => ({ key: `c${index}`, order: index, value: { ...chunk(), id: `c${index}` } })),
        groups: invalid ? groups : [group('all', 0, 3)] }),
      lookup: async () => [], locate: async () => null };
    const viewer = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results grouping="source" .dataSource=${provider}></lr-retrieval-results>`);
    await waitUntil(() => Boolean(viewer.shadowRoot!.querySelector('[part="source-retry"]')));
    expect(viewer.sourceTotal).to.equal(null);
    invalid = false;
    viewer.shadowRoot!.querySelector<HTMLElement>('[part="source-retry"]')!.click();
    await waitUntil(() => viewer.sourceTotal === 3);
    await viewer.updateComplete;
    const list = viewer.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
    expect(list.items.filter(item => (item as RetrievalChunk).id !== undefined).map(item => (item as RetrievalChunk).id)).to.deep.equal(['c0', 'c1', 'c2']);
  });
}

it('owns and preserves a valid 500-part locator path without losing string or numeric segments', async () => {
  const path = Array.from({ length: 500 }, (_, index) => index % 2 ? `field${index}` : index);
  const provider: RetrievalResultsSource = { revision: 1,
    query: async () => ({ total: 1, rows: [{ key: 'c0', order: 0, value: { ...chunk(), locator: { kind: 'node-path', path } } }] }),
    lookup: async () => [], locate: async () => null };
  const viewer = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results grouping="none" .dataSource=${provider}></lr-retrieval-results>`);
  const list = await ready(viewer);
  const locator = (list.items[0] as RetrievalChunk).locator;
  expect(locator?.kind).to.equal('node-path');
  if (locator?.kind !== 'node-path') throw new Error('Expected node path');
  expect(locator.path).to.deep.equal(path);
  path[0] = 'mutated';
  expect(locator.path[0]).to.equal(0);
  expect(Object.isFrozen(locator.path)).to.equal(true);
});
