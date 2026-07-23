import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import type { RetrievalChunk } from '../../../ai/types.js';
import './retrieval-compare.js';
import type { LyraRetrievalCompare, RetrievalComparisonSet } from './retrieval-compare.js';

function chunk(id: string, score: number, rank?: number): RetrievalChunk {
  return {
    id,
    text: `Text for ${id}`,
    score,
    rank,
    source: { id: `source-${id}`, name: `Source ${id}` },
    scores: { dense: score - 0.1, sparse: score - 0.2, final: score },
  };
}

const sets: RetrievalComparisonSet[] = [
  { id: 'baseline', label: 'Baseline', chunks: [chunk('a', 0.8, 2), chunk('b', 0.9, 1)] },
  { id: 'reranked', label: 'Reranked', chunks: [chunk('a', 0.95, 1), chunk('c', 0.7, 2)] },
];

it('sorts explicit ranks, reports overlap, and shows score breakdowns', async () => {
  const el = (await fixture(html`<lr-retrieval-compare .sets=${sets}></lr-retrieval-compare>`)) as LyraRetrievalCompare;
  const firstColumn = el.shadowRoot!.querySelector('[part="set"]')!;
  expect(firstColumn.querySelector('[part="chunk-title"]')!.textContent).to.contain('Source b');
  expect(el.shadowRoot!.querySelector('[part="overlap"]')!.textContent).to.contain('33');
  expect(el.shadowRoot!.textContent).to.contain('Dense');
  expect(el.shadowRoot!.textContent).to.contain('Sparse');
});

it('honors top-k and emits the full selected set/chunk pair', async () => {
  const el = (await fixture(html`<lr-retrieval-compare .sets=${sets} top-k="1"></lr-retrieval-compare>`)) as LyraRetrievalCompare;
  expect(el.shadowRoot!.querySelectorAll('[part="chunk"]').length).to.equal(2);
  const pending = oneEvent(el, 'lr-chunk-select');
  (el.shadowRoot!.querySelector('[part="chunk"]') as HTMLButtonElement).click();
  expect((await pending).detail).to.deep.equal({ setId: 'baseline', chunk: sets[0]!.chunks[1] });
});

it('renders a localized empty state and remains accessible at populated state', async () => {
  const empty = (await fixture(html`<lr-retrieval-compare></lr-retrieval-compare>`)) as LyraRetrievalCompare;
  expect(empty.shadowRoot!.querySelector('lr-empty')).to.exist;
  const populated = (await fixture(html`<lr-retrieval-compare .sets=${sets}></lr-retrieval-compare>`)) as LyraRetrievalCompare;
  await expect(populated).shadowDom.to.be.accessible();
});

