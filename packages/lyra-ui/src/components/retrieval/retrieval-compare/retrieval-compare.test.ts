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
  const empty = (await fixture(
    html`<lr-retrieval-compare
      .strings=${{ retrievalCompareEmpty: 'Aucun résultat à comparer' }}
    ></lr-retrieval-compare>`,
  )) as LyraRetrievalCompare;
  expect(empty.shadowRoot!.querySelector('lr-empty')?.getAttribute('heading')).to.equal(
    'Aucun résultat à comparer',
  );
  const populated = (await fixture(html`<lr-retrieval-compare .sets=${sets}></lr-retrieval-compare>`)) as LyraRetrievalCompare;
  await expect(populated).shadowDom.to.be.accessible();
});

it('applies per-instance strings to the comparison region label', async () => {
  const el = (await fixture(html`<lr-retrieval-compare
    .strings=${{ retrievalCompareLabel: 'Localized retrieval comparison' }}
  ></lr-retrieval-compare>`)) as LyraRetrievalCompare;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Localized retrieval comparison',
  );
});

it('uses instance-safe heading ids instead of caller set ids', async () => {
  const hostileSets: RetrievalComparisonSet[] = [
    { id: 'same id', label: 'First', chunks: [chunk('a', 0.8)] },
    { id: 'same id', label: 'Second', chunks: [chunk('b', 0.7)] },
  ];
  const first = (await fixture(
    html`<lr-retrieval-compare .sets=${hostileSets}></lr-retrieval-compare>`,
  )) as LyraRetrievalCompare;
  const second = (await fixture(
    html`<lr-retrieval-compare .sets=${hostileSets}></lr-retrieval-compare>`,
  )) as LyraRetrievalCompare;
  const headings = [
    ...first.shadowRoot!.querySelectorAll('[part="set-heading"]'),
    ...second.shadowRoot!.querySelectorAll('[part="set-heading"]'),
  ];
  const ids = headings.map((heading) => heading.id);
  expect(new Set(ids).size).to.equal(4);
  expect(ids.some((id) => id.includes('same id'))).to.be.false;
  for (const set of first.shadowRoot!.querySelectorAll('[part="set"]')) {
    expect(set.getAttribute('aria-labelledby')).to.equal(
      set.querySelector('[part="set-heading"]')!.id,
    );
  }
});

it('formats ranks with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-retrieval-compare lang="ar-u-nu-arab" .sets=${sets}></lr-retrieval-compare>`,
  )) as LyraRetrievalCompare;
  expect(el.shadowRoot!.querySelector('[part="chunk-rank"]')!.textContent).to.contain('١');
});

it('renders a labeled overlap summary for every pair of result sets', async () => {
  const threeSets: RetrievalComparisonSet[] = [
    ...sets,
    { id: 'hybrid', label: 'Hybrid', chunks: [chunk('a', 0.9), chunk('d', 0.6)] },
  ];
  const el = (await fixture(
    html`<lr-retrieval-compare .sets=${threeSets}></lr-retrieval-compare>`,
  )) as LyraRetrievalCompare;
  const summaries = [...el.shadowRoot!.querySelectorAll('[part="overlap"]')];
  expect(summaries.length).to.equal(3);
  expect(summaries.map((summary) => summary.textContent)).to.deep.include.members([
    'BaselineRerankedTop-k overlap: 33.3%',
    'BaselineHybridTop-k overlap: 33.3%',
    'RerankedHybridTop-k overlap: 33.3%',
  ]);
});
